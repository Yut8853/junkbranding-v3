// The loader's picture: the sea (one full-screen shader — sunlit surface,
// shafts of light, marine snow, deepening as loading progresses) and the
// percentage drawn in particles that flow from figure to figure. At 100%
// those particles hand over to the scene, where the same figure becomes the
// key visual's medusa. Runs in a worker (OffscreenCanvas) when possible.

const VERTEX = `
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDepth;
uniform float uExit;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }


void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float d = clamp(uDepth + uExit * 0.25, 0.0, 1.0);

  // the water column: turquoise near the light, deepening as we sink
  vec3 top = mix(vec3(0.24, 0.62, 0.7), vec3(0.04, 0.17, 0.22), smoothstep(0.0, 1.0, d));
  vec3 bottom = mix(vec3(0.03, 0.17, 0.23), vec3(0.006, 0.022, 0.035), smoothstep(0.0, 0.9, d));
  vec3 col = mix(bottom, top, pow(uv.y, 1.25));

  // the surface overhead: rippling light, climbing away as we sink
  float surfaceY = 1.02 + d * 0.9;
  float nearSurface = smoothstep(0.35, 0.0, surfaceY - uv.y);
  float ripple = fbm(vec2(p.x * 2.4 + uTime * 0.05, uTime * 0.07));
  float lines = smoothstep(0.62, 0.7, fbm(vec2(p.x * 5.5, p.x * 1.3 + uTime * 0.11) + ripple * 1.6));
  col += vec3(0.62, 0.92, 0.98) * nearSurface * (0.45 * ripple + 0.55 * lines) * (1.0 - d);

  // shafts of light falling from above
  float angle = atan(p.x + 0.25, 1.9 - uv.y);
  float shafts = fbm(vec2(angle * 7.0, uTime * 0.05)) * fbm(vec2(angle * 17.0 + 3.0, uTime * 0.03));
  col += vec3(0.55, 0.88, 0.95) * pow(shafts, 1.6) * smoothstep(0.0, 1.0, uv.y) * 0.55 * (1.0 - d * 0.8);

  // marine snow: three depths, drifting up past us as we sink
  for (int layer = 0; layer < 3; layer++) {
    float l = float(layer);
    float scale = 16.0 + l * 13.0;
    vec2 q = p * scale + vec2(0.0, -(uTime * (0.18 + l * 0.1) + uDepth * (5.0 + l * 6.0)));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id);
    vec2 off = vec2(hash(id + 1.3), hash(id + 2.7)) - 0.5;
    off.x += sin(uTime * 0.4 + h * 20.0) * 0.12;
    float r = length(f - off * 0.7);
    float speck = smoothstep(0.09 + 0.05 * h, 0.0, r) * step(0.72, h);
    col += vec3(0.78, 0.94, 0.98) * speck * (0.12 + l * 0.12);
  }

  // quiet vignette and the dive on entering
  col *= mix(1.0, smoothstep(1.35, 0.25, length((uv - 0.5) * vec2(aspect, 1.0))), 0.55);
  col *= 1.0 - uExit * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`;

const POINT_VERTEX = `
attribute vec2 position;
attribute float seed;
uniform vec2 uRes;
uniform float uSize;
varying float vSeed;
void main() {
  vSeed = seed;
  vec2 clip = position / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = uSize * (0.7 + seed * 0.6);
}
`;

const POINT_FRAGMENT = `
precision mediump float;
uniform float uAlpha;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * uAlpha * (0.75 + 0.25 * vSeed);
  gl_FragColor = vec4(vec3(1.0, 0.99, 0.96) * a * 1.15, a);
}
`;

// The numeral's particles. Each digit's shape arrives as normalised points
// (sampled from the same serif as the site); particles are dealt round the
// digits of the current number and spring toward their places, so the
// figure flows from one value to the next.
class Numerals {
  constructor(count) {
    this.count = count;
    this.pos = new Float32Array(count * 2);
    this.vel = new Float32Array(count * 2);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      this.seed[i] = Math.random();
      this.pos[i * 2] = Math.random();
      this.pos[i * 2 + 1] = Math.random();
    }
    this.text = '';
    this.targets = null;
    this.glyphs = null;
  }

  layout(text, w, h) {
    if (!this.glyphs) return;
    const glyphs = this.glyphs;
    const chars = Array.from(text).filter((c) => glyphs[c]);
    if (!chars.length) return;
    // 28% of the screen height, but "100" always fits within 78% of its width
    const widest = glyphs['1'].advance + glyphs['0'].advance * 2;
    const height = Math.min(h * 0.28, (w * 0.78) / widest);
    const total = chars.reduce((sum, c) => sum + glyphs[c].advance, 0) * height;
    let x = w / 2 - total / 2;
    const slots = chars.map((c) => {
      const slot = { glyph: glyphs[c], x, y: h * 0.5 - height * 0.5 };
      x += glyphs[c].advance * height;
      return slot;
    });
    const targets = new Float32Array(this.count * 2);
    for (let i = 0; i < this.count; i += 1) {
      const slot = slots[i % slots.length];
      const points = slot.glyph.points;
      const j = (Math.floor(i / slots.length) * 7919) % (points.length / 2);
      targets[i * 2] = slot.x + points[j * 2] * height;
      targets[i * 2 + 1] = slot.y + points[j * 2 + 1] * height;
    }
    this.targets = targets;
    this.text = text;
    this.size = { w, h };
  }

  // Loading done: the figure has no more to say. Its particles scatter
  // across the screen and become marine snow drifting slowly upward.
  scatter(w, h) {
    this.scattered = true;
    this.size = { w, h };
    for (let i = 0; i < this.count; i += 1) {
      this.targets[i * 2] = Math.random() * w;
      this.targets[i * 2 + 1] = Math.random() * h;
    }
  }

  // Ease every particle toward its place in the figure. Frame-rate
  // independent: the figure always settles, at 20 fps or at 120.
  step(dt, time) {
    if (!this.targets) return;
    if (this.scattered) {
      for (let i = 0; i < this.count; i += 1) {
        const y = i * 2 + 1;
        this.targets[y] -= dt * (6 + this.seed[i] * 14);
        if (this.targets[y] < -10) { this.targets[y] += this.size.h + 20; this.pos[y] = this.targets[y]; }
      }
    }
    const follow = 1 - Math.exp(-dt * (this.scattered ? 1.6 : 7));
    for (let i = 0; i < this.count; i += 1) {
      const seed = this.seed[i];
      const wobbleX = Math.sin(time * (1.1 + seed) + i * 2.3) * 0.6;
      const wobbleY = Math.cos(time * (0.9 + seed) + i * 1.7) * 0.6;
      const x = i * 2;
      this.pos[x] += (this.targets[x] + wobbleX - this.pos[x]) * follow * (0.6 + seed * 0.8);
      this.pos[x + 1] += (this.targets[x + 1] + wobbleY - this.pos[x + 1]) * follow * (0.6 + seed * 0.8);
    }
  }
}

export class LoaderGL {
  constructor(canvas, { reducedMotion = false, small = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.time = 0;
    this.shown = 0;
    this.depth = 0;
    this.completed = false;
    this.exit = 0;
    this.exiting = false;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    this.gl = gl;
    if (!gl) return;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      this.gl = null;
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.program = program;
    this.buffer = buffer;
    this.uniforms = Object.fromEntries(['uRes', 'uTime', 'uDepth', 'uExit'].map((name) => [name, gl.getUniformLocation(program, name)]));

    // the numeral's particles
    const points = gl.createProgram();
    gl.attachShader(points, compile(gl.VERTEX_SHADER, POINT_VERTEX));
    gl.attachShader(points, compile(gl.FRAGMENT_SHADER, POINT_FRAGMENT));
    gl.linkProgram(points);
    this.pointProgram = points;
    this.numerals = new Numerals(small ? 2600 : 4400);
    this.pointBuffer = gl.createBuffer();
    this.seedBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.numerals.seed, gl.STATIC_DRAW);
    this.pointUniforms = Object.fromEntries(['uRes', 'uSize', 'uAlpha'].map((name) => [name, gl.getUniformLocation(points, name)]));
    this.pointAttribs = { position: gl.getAttribLocation(points, 'position'), seed: gl.getAttribLocation(points, 'seed') };
    this.seaPosition = position;
  }

  setGlyphs(glyphs) {
    if (!this.numerals) return;
    this.numerals.glyphs = glyphs;
    this.numerals.text = '';
  }

  get ok() {
    return Boolean(this.gl);
  }

  setSize(w, h, ratio) {
    // the picture is soft: render below device resolution, it is upscaled
    this.css = { w, h };
    const scale = Math.min(ratio, 1.25) * 0.75;
    this.canvas.width = Math.max(1, Math.round(w * scale));
    this.canvas.height = Math.max(1, Math.round(h * scale));
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setState({ shown, completed, exiting }) {
    if (shown !== undefined) this.shown = shown;
    if (completed !== undefined) this.completed = completed;
    if (exiting) this.exiting = true;
  }

  step(dt) {
    const gl = this.gl;
    if (!gl) return;
    this.time += this.reducedMotion ? 0 : dt;
    this.depth += (this.shown - this.depth) * (1 - Math.exp(-dt * 3));
    if (this.exiting) this.exit = Math.min(1, this.exit + dt / 0.9);
    const u = this.uniforms;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.seaPosition);
    gl.vertexAttribPointer(this.seaPosition, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uDepth, this.depth);
    gl.uniform1f(u.uExit, this.exit);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // the percentage, in particles
    const numerals = this.numerals;
    if (numerals?.glyphs && this.css) {
      const text = String(Math.round(this.shown * 100));
      if (this.completed && !numerals.scattered) numerals.scatter(this.css.w, this.css.h);
      else if (!numerals.scattered && text !== numerals.text) numerals.layout(text, this.css.w, this.css.h);
      numerals.step(dt, this.time);
      const scale = this.canvas.width / this.css.w;
      gl.useProgram(this.pointProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, numerals.pos, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.pointAttribs.position);
      gl.vertexAttribPointer(this.pointAttribs.position, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
      gl.enableVertexAttribArray(this.pointAttribs.seed);
      gl.vertexAttribPointer(this.pointAttribs.seed, 1, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.pointUniforms.uRes, this.css.w, this.css.h);
      gl.uniform1f(this.pointUniforms.uSize, Math.max(1.8, 2.7 * scale));
      gl.uniform1f(this.pointUniforms.uAlpha, (1 - this.exit) * (numerals.scattered ? 0.5 : 1));
      gl.drawArrays(gl.POINTS, 0, numerals.count);
      gl.disableVertexAttribArray(this.pointAttribs.seed);
    }
  }
}
