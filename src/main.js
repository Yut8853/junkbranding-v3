import './styles.css';
import { gsap } from 'gsap';
import { World } from './gl/World.js';
import { Director } from './ui/Director.js';
import { BrandRedaction } from './BrandRedaction.js';
import { ContactForm } from './ContactForm.js';
import { Loader } from './ui/Loader.js';
import { Sound } from './ui/Sound.js';
import {
  FORM,
  medusaTargets,
  hanabiTargets,
  mapleFallTargets,
  snowFallTargets,
  seasonsRingTargets,
  sakuraFallTargets,
} from './gl/targets.js';

// Web font @font-face rules (the Japanese face is ~120 unicode-range chunks)
// load as a separate stylesheet so they never block first paint.
const fontStyles = Promise.all([
  import('@fontsource/shippori-mincho/500.css'),
  import('@fontsource/shippori-mincho/700.css'),
  import('@fontsource/shippori-mincho/800.css'),
  import('@fontsource/instrument-serif/400.css'),
  import('@fontsource/instrument-serif/400-italic.css'),
  import('@fontsource/zen-kaku-gothic-new/400.css'),
  import('@fontsource/zen-kaku-gothic-new/500.css'),
]).catch(() => {});

const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.innerWidth < 760
  || (navigator.deviceMemory && navigator.deviceMemory <= 4)
  || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  || /iPhone|iPad|Android/i.test(navigator.userAgent);
const tier = params.get('tier') ?? (lowPower ? 'low' : 'high');

const loader = new Loader($('[data-loader]'), { reducedMotion });
loader.setTotal(tier === 'high' ? 512 * 512 + 384 * 384 : 256 * 256 + 192 * 192);
const sound = new Sound($('[data-sound]'), '/music/Out%20of%20Flux%20-%20Blue%20Race.mp3');
// ?capture=<pixel ratio>: full-quality stills (e.g. award submissions)
const capture = params.has('capture') ? Number(params.get('capture')) || 1 : 0;
const world = new World({ canvas: $('[data-stage]'), reducedMotion, tier, lite: params.has('lite') || Boolean(capture), capture });
// Verification mode: software renderers take seconds per frame, so let GSAP
// follow wall-clock time instead of treating each frame as lag.
if (params.has('lite') || capture) gsap.ticker.lagSmoothing(0);
const redaction = new BrandRedaction({
  elements: Array.from(document.querySelectorAll('[data-brand-name]')),
  hoverElements: [$('.masthead__name')],
  reducedMotion,
});
const contactForm = new ContactForm($('[data-contact-form]'));

// Motion switch: freezes every animation (the scene stays navigable).
const motionButton = $('[data-motion]');
const motionLabel = $('[data-motion-label]');
function setMotion(on) {
  world.paused = !on;
  motionButton?.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (motionLabel) motionLabel.textContent = on ? 'Motion on' : 'Motion off';
}
motionButton?.addEventListener('click', () => setMotion(world.paused));
let director = null;



// After a message is sent: the hidden sector. One globe, reused; the sea is
// paused underneath (rendering and scrolling) and resumes when it closes.
let earth = null;
document.addEventListener('junkbranding:reveal-earth', async (event) => {
  const root = $('[data-secret-earth]');
  if (!root) return;
  if (!earth) {
    const { SecretEarthPage } = await import('./SecretEarthPage.js');
    earth = new SecretEarthPage(root);
  }
  world.stop();
  if (director) director.busy = true;
  window.setTimeout(() => director?.reveal.replay(root), 700);
  earth.show({
    origin: event.detail,
    returnTo: $('[data-submit]'),
    onClose: () => {
      world.start();
      if (director) director.busy = false;
    },
  });
});

// ---------------------------------------------------------------- recovery
// Start-up must never strand the visitor. If 3D cannot start or the GPU
// drops the context, reload once; if it happens again, open the light
// version (the same content as a readable page). A stale build after a
// deploy (a chunk that no longer exists) also gets one automatic reload.
const RETRY_KEY = 'jb-start-retry';
const session = {
  get: (key) => { try { return sessionStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* private mode */ } },
  clear: (key) => { try { sessionStorage.removeItem(key); } catch { /* private mode */ } },
};
let started = false;
let lightMode = false;

function openLight() {
  if (lightMode) return;
  lightMode = true;
  world.stop();
  director = null;
  document.documentElement.classList.add('no-webgl');
  loader.clearTrouble();
  loader.finish();
  document.body.classList.remove('is-loading');
}

function retryOnceOr(message) {
  if (!session.get(RETRY_KEY)) {
    session.set(RETRY_KEY, '1');
    window.location.reload();
    return;
  }
  loader.trouble(message, { onLight: openLight });
}

window.addEventListener('vite:preloadError', (event) => {
  if (session.get('jb-chunk-retry')) return;
  event.preventDefault();
  session.set('jb-chunk-retry', '1');
  window.location.reload();
});

window.addEventListener('junkbranding:gl-lost', () => {
  if (lightMode) return;
  if (started) {
    // mid-visit: one reload brings the sea back; a second loss goes light
    if (!session.get(RETRY_KEY)) { session.set(RETRY_KEY, '1'); window.location.reload(); } else openLight();
    return;
  }
  retryOnceOr('この端末では3D表示を開始できませんでした。');
});

async function boot() {
  const watchdog = window.setTimeout(() => {
    if (!started) loader.trouble('読み込みに時間がかかっています。このまま待つか、次の方法をお選びください。', { onLight: openLight });
  }, 30000);
  const fontsReady = fontStyles
    .then(() => Promise.all([
      document.fonts?.load('400 1em "Zen Kaku Gothic New"', 'きれいなだけ'),
      document.fonts?.load('italic 400 1em "Instrument Serif"', 'Beautiful flower'),
      document.fonts?.load('400 1em "Instrument Serif"', '0123456789'),
      document.fonts?.load('800 1em "Shippori Mincho"', 'JUNKBRANDING'),
      document.fonts?.load('600 1em "Shippori Mincho"', '深海にも四季がある'),
    ]))
    .catch(() => {})
    .then(() => loader.setProgress(0.3));
  const worldReady = fontsReady
    .then(() => world.init({
      // The flower swarm's forms, built one per frame. Key visual first.
      flowerTasks: [
        ['seasonsRing', (size) => ({ id: FORM.VORTEX, ...seasonsRingTargets(size) })],
        ['sakuraFall', (size) => ({ id: FORM.FALL, ...sakuraFallTargets(size) })],
        ['hanabi', (size) => ({ id: FORM.NETWORK, ...hanabiTargets(size) })],
        ['mapleFall', (size) => ({ id: FORM.FALL, ...mapleFallTargets(size) })],
        ['snowFall', (size) => ({ id: FORM.FALL, ...snowFallTargets(size) })],
      ],
      jellyTasks: [
        ['medusa', (size) => ({ id: FORM.JELLY, ...medusaTargets(size) })],
      ],
      // Real progress: fonts are the first 30%, building the sea the rest.
      onProgress: (done) => loader.setProgress(0.3 + done * 0.62),
    }))
    .then(() => loader.setProgress(0.9));

  try {
    await worldReady;
    director = new Director({ world, redaction, reducedMotion });
    director.init();
  } catch (error) {
    console.error('[junkbranding] 3D could not start.', error);
    window.clearTimeout(watchdog);
    retryOnceOr('この端末では3D表示を開始できませんでした。');
    return;
  }
  window.clearTimeout(watchdog);
  loader.clearTrouble();
  loader.setProgress(1);

  const choice = await loader.waitForChoice();
  if (lightMode) return;
  started = true;
  // sound is a bonus: a failure to play must never block entering
  if (choice === 'sound') Promise.resolve().then(() => sound.play()).catch(() => {});
  loader.finish();
  // the opening reveals the navigation itself at its end
  if (director) director.introPlay();
  else document.body.classList.remove('is-loading');
  // a visit that got this far is healthy: allow an automatic retry next time
  window.setTimeout(() => { session.clear(RETRY_KEY); session.clear('jb-chunk-retry'); }, 15000);
}

boot();

if (import.meta.env.DEV) window.__app = { world, get director() { return director; } };

console.log(
  '%cXXXXXXXXXXXX%c\nMix the unexpected. Keep diving.',
  'font: 800 26px "Shippori Mincho", serif; color: #ff9dbf; letter-spacing: 0.1em;',
  'font: italic 14px "Instrument Serif", serif; color: #7ff3ff;',
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sound.dispose();
    redaction.dispose();
    contactForm.dispose();
  });
}
