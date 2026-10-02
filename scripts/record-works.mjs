// Records clean footage of every project in src/ui/works.js: no screen-recorder
// UI, no cursor, no letterbox. Captured at 1920x848 (the same 960:424 ratio the
// site's preview pane uses), then encoded to public/videos/<name>.mp4 + .jpg.
//
// Setup (once):
//   pnpm add -D playwright
//   pnpm exec playwright install chromium
//   (ffmpeg must be on PATH: brew install ffmpeg)
//
// Run:
//   node scripts/record-works.mjs                 all projects
//   node scripts/record-works.mjs --only KURASHI  one project (name prefix)
//   node scripts/record-works.mjs --seconds 30    longer loop (default 24)
//   node scripts/record-works.mjs --url https://example.com --name test
//   node scripts/record-works.mjs --headed        visible window (use this if a
//                                                 WebGL-heavy site records no frames)
//
// Tips: close other apps while recording (smoother frames), and check each
// clip. Sites with a cookie banner or opening modal may need a click first:
// add it to BEFORE_RECORD below.

import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKS } from '../src/ui/works.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1920;
const HEIGHT = 848;

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const seconds = Number(option('seconds') ?? 24);
const only = option('only')?.toUpperCase();
const customUrl = option('url');

// Optional per-project actions before recording starts (e.g. dismiss a modal).
const BEFORE_RECORD = {
  // LUZREAL: async (page) => page.click('text=Luz Music ON').catch(() => {}),
};

const targets = customUrl
  ? [{ name: (option('name') ?? 'custom').toUpperCase(), href: customUrl, video: `/videos/${option('name') ?? 'custom'}.mp4` }]
  : WORKS.filter((work) => !only || work.name.startsWith(only));

if (!targets.length) {
  console.error(`No project matches --only ${only}. Names: ${WORKS.map((w) => w.name).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch({
  headless: !args.includes('--headed'),
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});

for (const work of targets) {
  // works without footage yet (video: null) record to their `record` path
  const output = path.join(ROOT, 'public', work.video ?? work.record);
  const poster = output.replace(/\.mp4$/, '.jpg');
  const frameDir = await mkdtemp(path.join(tmpdir(), `record-${work.name}-`));
  console.log(`\n● ${work.name}  ${work.href}`);

  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  try {
    await page.goto(work.href, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000); // let loaders and intro animations finish
    await BEFORE_RECORD[work.name]?.(page);
    await page.mouse.move(WIDTH / 2, HEIGHT / 2);

    // Chrome's screencast gives full-quality JPEG frames with timestamps.
    const cdp = await page.context().newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      frames.push({ data, time: metadata.timestamp });
      await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.enable');
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 });

    // Choreography: hold on the first view, then scroll down steadily.
    const started = Date.now();
    await page.waitForTimeout(2500);
    while (Date.now() - started < seconds * 1000) {
      await page.mouse.wheel(0, 7);
      await page.waitForTimeout(16);
    }
    await cdp.send('Page.stopScreencast');
    const endTime = started / 1000 + seconds;

    if (frames.length < 2) throw new Error('no frames captured (try --headed)');
    let list = 'ffconcat version 1.0\n';
    for (let index = 0; index < frames.length; index += 1) {
      const file = `f${String(index).padStart(5, '0')}.jpg`;
      await writeFile(path.join(frameDir, file), Buffer.from(frames[index].data, 'base64'));
      const next = frames[index + 1]?.time ?? Math.max(frames[index].time + 0.04, endTime);
      list += `file '${file}'\nduration ${Math.max(0.001, next - frames[index].time).toFixed(4)}\n`;
    }
    list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
    await writeFile(path.join(frameDir, 'list.txt'), list);

    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(frameDir, 'list.txt'),
      '-vf', `fps=30,scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', output,
    ]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '7', '-i', output, '-frames:v', '1', '-q:v', '4', poster]);
    console.log(`  ${frames.length} frames → ${path.relative(ROOT, output)} (+ poster)`);
  } catch (error) {
    console.error(`  failed: ${error.message}`);
  } finally {
    await page.close();
    await rm(frameDir, { recursive: true, force: true });
  }
}

await browser.close();
