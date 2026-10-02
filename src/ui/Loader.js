import { REDACTION_GLYPHS } from '../BrandRedaction.js';
import { LoaderGL } from './loaderGL.js';

// Loading is the start of the dive, in the same sea as the site: we sink
// from the sunlit surface into the deep while the colossal medusa of the key
// visual comes into view overhead, so entering continues the same picture.
// Drawn by a shader (in a worker when possible). The numbers are real:
// percent, depth, particles generated.
// Each digit as normalised points (height 1 = the height of a figure),
// sampled from the site's serif so the numeral matches the scene's.
function sampleDigits(family = '"Instrument Serif", "Times New Roman", serif') {
  const size = 220;
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 300;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.font = `400 ${size}px ${family}`;
  const ascent = context.measureText('0').actualBoundingBoxAscent || size * 0.7;
  const baseline = 260;
  const glyphs = {};
  for (const char of '0123456789') {
    context.clearRect(0, 0, 300, 300);
    context.fillStyle = '#fff';
    context.textBaseline = 'alphabetic';
    context.fillText(char, 20, baseline);
    const { data } = context.getImageData(0, 0, 300, 300);
    const filled = [];
    for (let y = 0; y < 300; y += 1) {
      for (let x = 0; x < 300; x += 1) {
        if (data[(y * 300 + x) * 4 + 3] > 128) filled.push(x, y);
      }
    }
    const count = Math.min(1100, filled.length / 2);
    const points = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const k = Math.floor(Math.random() * (filled.length / 2));
      points[i * 2] = (filled[k * 2] - 20 + Math.random()) / ascent;
      points[i * 2 + 1] = (filled[k * 2 + 1] - (baseline - ascent) + Math.random()) / ascent;
    }
    glyphs[char] = { points, advance: (context.measureText(char).width / ascent) * 0.94 };
  }
  return glyphs;
}

export class Loader {
  constructor(root, { reducedMotion = false } = {}) {
    this.root = root;
    this.reducedMotion = reducedMotion;
    this.canvas = root.querySelector('[data-loader-motif]');
    this.count = root.querySelector('[data-loader-count]');
    this.depth = root.querySelector('[data-loader-depth]');
    this.particles = root.querySelector('[data-loader-particles]');
    this.rule = root.querySelector('[data-loader-rule]');
    this.name = root.querySelector('[data-loader-name]');
    this.total = 409600;
    this.target = 0;
    this.shown = 0;
    this.startedAt = performance.now();
    this.last = this.startedAt;
    this.running = true;
    this.completed = false;
    const options = { small: window.innerWidth < 760, reducedMotion };
    this.startPicture(options);
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.resize();
    window.addEventListener('resize', this.resize);
    // the numeral's shapes: a fallback serif at once, the site's serif when ready
    this.sendGlyphs(sampleDigits());
    document.fonts?.load('400 220px "Instrument Serif"', '0123456789').then(() => this.sendGlyphs(sampleDigits())).catch(() => {});
    requestAnimationFrame(this.render);
  }

  startPicture(options) {
    if (!this.canvas) return;
    try {
      // A separate thread only helps with cores to spare, and only if the
      // browser can run WebGL on an OffscreenCanvas in a worker.
      const cores = navigator.hardwareConcurrency || 2;
      let offscreenGL = false;
      if (typeof OffscreenCanvas !== 'undefined') {
        const probe = new OffscreenCanvas(1, 1).getContext('webgl');
        offscreenGL = Boolean(probe);
        probe?.getExtension('WEBGL_lose_context')?.loseContext();
      }
      const forced = new URLSearchParams(location.search).has('noworker');
      if (!forced && cores > 2 && offscreenGL && typeof this.canvas.transferControlToOffscreen === 'function' && typeof Worker !== 'undefined') {
        const offscreen = this.canvas.transferControlToOffscreen();
        this.worker = new Worker(new URL('./loaderWorker.js', import.meta.url), { type: 'module' });
        this.worker.addEventListener('error', () => this.fallbackToPage(options));
        this.worker.postMessage({ type: 'init', canvas: offscreen, ...options, ...this.measure() }, [offscreen]);
        return;
      }
    } catch {
      this.worker = null;
    }
    const scene = new LoaderGL(this.canvas, options);
    // No WebGL at all: the CSS sea behind the canvas stays on its own.
    if (scene.ok) this.scene = scene;
  }

  sendGlyphs(glyphs) {
    this.glyphs = glyphs;
    if (this.worker) this.worker.postMessage({ type: 'glyphs', glyphs });
    else this.scene?.setGlyphs(glyphs);
  }

  // The worker could not run: draw on the page instead, on a fresh canvas
  // (the original one now belongs to the worker).
  fallbackToPage(options) {
    this.worker?.terminate();
    this.worker = null;
    if (!this.canvas) return;
    const canvas = this.canvas.cloneNode(false);
    this.canvas.replaceWith(canvas);
    this.canvas = canvas;
    const scene = new LoaderGL(canvas, options);
    if (scene.ok) {
      this.scene = scene;
      this.resize();
      if (this.glyphs) scene.setGlyphs(this.glyphs);
    }
  }

  // Something went wrong or is taking too long: say so plainly and offer a
  // way forward instead of leaving the visitor on the loader.
  trouble(message, { onLight } = {}) {
    const box = this.root.querySelector('[data-loader-trouble]');
    if (!box) return;
    this.root.setAttribute('data-trouble', '');
    box.querySelector('[data-loader-trouble-text]').textContent = message;
    box.hidden = false;
    box.querySelector('[data-loader-retry]').onclick = () => window.location.reload();
    box.querySelector('[data-loader-light]').onclick = () => onLight?.();
    box.querySelector('[data-loader-retry]').focus({ preventScroll: true });
  }

  clearTrouble() {
    const box = this.root.querySelector('[data-loader-trouble]');
    if (box) box.hidden = true;
    this.root.removeAttribute('data-trouble');
  }

  measure() {
    return { w: window.innerWidth, h: window.innerHeight, ratio: Math.min(window.devicePixelRatio || 1, 2) };
  }

  setTotal(total) {
    this.total = total;
  }

  setProgress(value) {
    this.target = Math.max(this.target, Math.min(1, value));
  }

  resize() {
    const size = this.measure();
    if (this.worker) {
      this.worker.postMessage({ type: 'resize', ...size });
    } else if (this.scene) {
      this.scene.setSize(size.w, size.h, size.ratio);
    }
  }

  send(state) {
    if (this.worker) this.worker.postMessage({ type: 'state', ...state });
    else this.scene?.setState(state);
  }

  render(now) {
    if (!this.running) return;
    // real elapsed time (all easing here is exponential, so large steps are
    // safe): the figure settles on time even when frames are scarce
    const dt = Math.min(0.5, (now - this.last) / 1000);
    this.last = now;
    // A brisk count that never runs ahead of real progress.
    const ceiling = this.reducedMotion ? 1 : Math.min(1, (now - this.startedAt) / 1200);
    const goal = Math.min(this.target, ceiling);
    this.shown += (goal - this.shown) * (1 - Math.exp(-dt * 7));
    if (goal >= 1 && this.shown > 0.995) this.shown = 1;

    const percent = Math.round(this.shown * 100);
    if (this.count && this.count.textContent !== String(percent)) this.count.textContent = String(percent);
    this.root.setAttribute('aria-valuenow', String(percent));
    if (this.rule) this.rule.style.transform = `scaleX(${this.shown})`;
    if (this.depth) this.depth.textContent = Math.round(this.shown * 4000).toLocaleString('en-US');
    if (this.particles) this.particles.textContent = Math.round(this.shown * this.total).toLocaleString('en-US');
    if (this.name && !this.reducedMotion && this.shown < 1 && Math.random() < 0.2) {
      this.name.textContent = Array.from('XXXXXXXXXXXX', () => (
        Math.random() < 0.16 ? REDACTION_GLYPHS[Math.floor(Math.random() * REDACTION_GLYPHS.length)] : 'X'
      )).join('');
    }
    this.send({ shown: this.shown, completed: this.completed });
    if (this.scene) this.scene.step(dt);

    if (this.shown >= 1 && !this.completed) {
      this.completed = true;
      if (this.name) this.name.textContent = 'XXXXXXXXXXXX';
      this.onComplete?.();
    }
    requestAnimationFrame(this.render);
  }

  // Resolves with 'sound' or 'silent' once the visitor chooses.
  waitForChoice() {
    return new Promise((resolve) => {
      this.onComplete = () => {
        this.root.setAttribute('data-ready', '');
        const buttons = Array.from(this.root.querySelectorAll('[data-enter]'));
        buttons[0]?.focus({ preventScroll: true });
        const choose = (event) => {
          const Orientation = window.DeviceOrientationEvent;
          if (Orientation && typeof Orientation.requestPermission === 'function') Orientation.requestPermission().catch(() => {});
          buttons.forEach((button) => button.removeEventListener('click', choose));
          resolve(event.currentTarget.dataset.enter);
        };
        buttons.forEach((button) => button.addEventListener('click', choose));
      };
      if (this.completed) this.onComplete();
    });
  }

  // Enter: the loader's sea hands over to the same composition in the scene.
  finish() {
    this.send({ exiting: true });
    this.root.setAttribute('data-done', '');
    window.setTimeout(() => {
      this.running = false;
      window.removeEventListener('resize', this.resize);
      this.worker?.terminate();
      this.root.remove();
    }, 1400);
  }
}
