import { LoaderGL } from './loaderGL.js';

// Runs the loader's sea off the main thread, so it keeps moving while the
// page compiles shaders and builds the particle forms.
let scene = null;
let canvas = null;
let last = 0;
const frame = (now) => {
  const dt = Math.min(0.5, Math.max(0, (now - last) / 1000));
  last = now;
  scene?.step(dt);
  schedule();
};
const schedule = () => {
  if (typeof self.requestAnimationFrame === 'function') self.requestAnimationFrame(frame);
  else setTimeout(() => frame(performance.now()), 16);
};

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    canvas = data.canvas;
    scene = new LoaderGL(canvas, data);
    resize(data);
    last = performance.now();
    schedule();
  } else if (data.type === 'resize') {
    resize(data);
  } else if (data.type === 'state') {
    scene?.setState(data);
  } else if (data.type === 'glyphs') {
    scene?.setGlyphs(data.glyphs);
  }
};

function resize({ w, h, ratio }) {
  if (!canvas || !scene) return;
  scene.setSize(w, h, ratio);
}
