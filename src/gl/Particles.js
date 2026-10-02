import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { FORM, textTargets, scatterPositions, SCREEN_ASPECT } from './targets.js';

// Simplex noise with analytic gradient (Ashima Arts / Stefan Gustavson, MIT).
// The flow field is the cross product of two noise gradients: divergence-free
// like curl noise, but 2 noise evaluations per particle instead of 18.
const NOISE = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v, out vec3 gradient) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    vec4 m2 = m * m;
    vec4 m4 = m2 * m2;
    vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
    vec4 temp = m2 * m * pdotx;
    gradient = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
    gradient += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
    gradient *= 105.0;
    return 105.0 * dot(m4, pdotx);
  }
  vec3 curlNoise(vec3 p) {
    vec3 ga;
    vec3 gb;
    snoise(p, ga);
    snoise(p + vec3(31.416, -47.853, 12.793), gb);
    return normalize(cross(ga, gb) + vec3(1e-5));
  }
`;

// Shared between simulation and render so both agree on each particle's
// progress through a morph. Particles leave in a cascade (seeded delay).
const MORPH = /* glsl */ `
  float localMorph(float morph, float seed) {
    return smoothstep(0.0, 1.0, clamp((morph - seed * 0.45) / 0.55, 0.0, 1.0));
  }
`;

const ANIMATE = /* glsl */ `
  uniform float uPulse;
  vec3 animateTarget(vec4 t, vec4 c, float form, float time) {
    vec3 p = t.xyz;
    if (form < 0.5) {
      // flower: petals breathe from the centre out
      p.z += sin(time * 1.1 - t.w * 4.0) * 0.035 * t.w;
    } else if (form < 1.5) {
      // medusa: bell contracts, tentacles and arms undulate
      if (t.w < 0.5) {
        float u = t.w * 2.0;
        p.xz *= 1.0 - uPulse * 0.16 * u;
        p.y += uPulse * 0.1 * (1.0 - u);
      } else if (t.w < 3.0) {
        float along = fract(t.w);
        float phase = atan(t.z, t.x);
        p.x += sin(along * 5.0 - time * 0.9 + phase * 3.0) * 0.09 * along;
        p.z += cos(along * 4.0 - time * 0.7 + phase * 2.0) * 0.09 * along;
        p.xz *= 1.0 - uPulse * 0.12 * (1.0 - along);
        p.y += uPulse * 0.08 * (1.0 - along);
      }

    } else if (form < 2.5) {
      p.z += sin(time * 1.3 + t.x * 1.7) * 0.04;
      p.y += sin(time * 0.9 + t.x * 0.8) * 0.025;
    } else if (form < 3.5) {
      p.z += sin(length(t.xy) * 5.0 - time * 1.6) * 0.018;
    } else if (form > 5.5) {
      // falling leaves / snow: each piece falls, sways and tumbles on its own
      float kind = step(1.5, c.w);
      float seed = fract(c.w);
      float speed = mix(0.3 + seed * 0.32, 0.13 + seed * 0.14, kind);
      float sway = mix(0.75 + seed * 0.55, 0.25 + seed * 0.2, kind);
      vec3 centre = c.xyz;
      centre.y = mod(centre.y - time * speed + 7.0, 14.0) - 7.0;
      centre.x += sin(time * (0.35 + seed * 0.45) + seed * 20.0) * sway;
      centre.z += cos(time * (0.27 + seed * 0.3) + seed * 11.0) * sway * 0.5;
      vec3 local = t.xyz - c.xyz;
      float angle = time * mix(0.55 + seed * 1.3, 0.2 + seed * 0.45, kind) + seed * 6.2832;
      vec3 axis = normalize(vec3(sin(seed * 17.0), cos(seed * 23.0) * 0.6, sin(seed * 5.0 + 1.0)));
      local = local * cos(angle) + cross(axis, local) * sin(angle) + axis * dot(axis, local) * (1.0 - cos(angle));
      p = centre + local;
    } else if (form > 4.5) {
      // service organs: slow drift
      p.y += sin(time * 0.8 + t.x * 0.7) * 0.03;
      p.z += cos(time * 0.6 + t.y * 1.3) * 0.04;
    } else {
      float r = length(t.xz);
      float a = time * 0.32 / (0.35 + r * 0.6);
      float c = cos(a);
      float s = sin(a);
      p.xz = mat2(c, -s, s, c) * t.xz;
      p.y += sin(r * 2.0 - time) * 0.06;
    }
    return p;
  }
`;

const POSITION_SHADER = /* glsl */ `
  uniform float uDelta;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 position = texture2D(texturePosition, uv);
    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    position.xyz += velocity * uDelta;
    gl_FragColor = position;
  }
`;

const VELOCITY_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDelta;
  uniform float uMorph;
  uniform float uFormA;
  uniform float uFormB;
  uniform sampler2D uTargetA;
  uniform sampler2D uTargetB;
  uniform sampler2D uCenterA;
  uniform sampler2D uCenterB;
  uniform float uSpring;
  uniform float uNoise;
  uniform float uFlight;
  uniform float uScatter;
  uniform float uDamping;
  uniform vec3 uPointer;
  uniform vec3 uPointerVelocity;
  uniform float uPointerRadius;
  uniform float uPointerStrength;
  ${NOISE}
  ${MORPH}
  ${ANIMATE}

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 position = texture2D(texturePosition, uv);
    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    float seed = position.w;
    float m = localMorph(uMorph, seed);
    vec3 target = mix(
      animateTarget(texture2D(uTargetA, uv), texture2D(uCenterA, uv), uFormA, uTime),
      animateTarget(texture2D(uTargetB, uv), texture2D(uCenterB, uv), uFormB, uTime),
      m
    );
    // A falling piece that wraps from the bottom back to the top jumps there
    // instead of streaking across the screen.
    if (uFormA > 5.5 && uFormB > 5.5) {
      if (length(velocity) > 60.0) velocity = vec3(0.0);
      else if (distance(target, position.xyz) > 4.0) {
        gl_FragColor = vec4((target - position.xyz) / max(uDelta, 0.001), 1.0);
        return;
      }
    }
    float flight = sin(m * 3.14159265);
    vec3 acceleration = (target - position.xyz) * uSpring * (1.0 - flight * 0.8);
    vec3 current = curlNoise(position.xyz * 0.32 + vec3(0.0, uTime * 0.06, seed * 0.2));
    acceleration += current * (uNoise + flight * uFlight + uScatter * 7.0 * (0.4 + seed));

    // The cursor stirs the water: a soft push plus a swirl, dragged along.
    vec3 away = position.xyz - uPointer;
    away.z *= 0.35;
    float falloff = exp(-dot(away, away) / (uPointerRadius * uPointerRadius));
    vec3 direction = normalize(away + vec3(1e-4));
    acceleration += (direction * 1.0 + cross(vec3(0.0, 0.0, 1.0), direction) * 1.4) * uPointerStrength * falloff;
    acceleration += uPointerVelocity * falloff * 2.4;

    velocity += acceleration * uDelta;
    velocity *= pow(uDamping, uDelta * 60.0);
    gl_FragColor = vec4(velocity, 1.0);
  }
`;

const RENDER_VERTEX = /* glsl */ `
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform sampler2D uColorA;
  uniform sampler2D uColorB;
  uniform sampler2D uVideoA;
  uniform sampler2D uVideoB;
  uniform float uVideoMix;
  uniform float uFormA;
  uniform float uFormB;
  uniform float uMorph;
  uniform float uGlowA;
  uniform float uGlowB;
  uniform float uPointSize;
  uniform float uPixelRatio;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uOpacity;
  uniform float uMaxPoint;
  uniform sampler2D uTargetA;
  uniform float uJelly;
  uniform float uTime;
  uniform float uIgnite;
  uniform float uIgniteMode;
  uniform float uPhase;
  uniform float uBob;
  uniform mat3 uOrient;
  uniform vec3 uOffset;
  uniform vec3 uDrift;
  uniform float uHighlight;
  uniform float uHighlightAmount;
  attribute vec2 aRef;
  attribute vec2 aScreenUv;
  attribute float aRand;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  ${MORPH}

  vec4 videoColor() {
    vec3 a = texture2D(uVideoA, aScreenUv).rgb;
    vec3 b = texture2D(uVideoB, aScreenUv).rgb;
    float t = smoothstep(aRand - 0.12, aRand + 0.12, uVideoMix * 1.24 - 0.12);
    return vec4(mix(a, b, t), 1.0);
  }

  vec4 formColor(float form, sampler2D colors) {
    if (form > 2.5 && form < 3.5) return videoColor();
    return texture2D(colors, aRef);
  }

  // One swim stroke: a quick contraction, then a long, slow release.
  float contraction(float phase) {
    return phase < 0.3 ? sin(phase / 0.3 * 1.5707963) : 0.5 + 0.5 * cos((phase - 0.3) / 0.7 * 3.1415927);
  }

  void main() {
    vec4 position = texture2D(texturePosition, aRef);
    vec3 velocity = texture2D(textureVelocity, aRef).xyz;
    float m = localMorph(uMorph, position.w);
    if (uJelly > 0.001) {
      vec3 original = position.xyz;
      float part = texture2D(uTargetA, aRef).w;
      float c = contraction(uPhase);
      if (part < 0.5) {
        // bell: the margin draws in and down, the crown lifts
        float u = part * 2.0;
        position.xz *= 1.0 - c * 0.16 * u * u;
        position.y += c * (0.08 * (1.0 - u) - 0.06 * u * u);
      } else if (part < 2.0) {
        // tentacles: the root moves exactly with the margin, the rest trails
        float t = fract(part);
        float lag = contraction(fract(uPhase - 0.06 - t * 0.3));
        float free = smoothstep(0.0, 0.35, t);
        position.xz *= 1.0 - mix(c * 0.16, lag * 0.1, free);
        position.y += mix(-0.06 * c, lag * 0.05 * (1.0 - t), free);
      } else if (part < 3.0) {
        // stalk and oral arms: the top rides the crown, the ends trail
        float t = fract(part);
        float lag = contraction(fract(uPhase - 0.1 - t * 0.3));
        float free = smoothstep(0.0, 0.3, t);
        position.xz *= 1.0 - lag * 0.08 * free;
        position.y += mix(0.08 * c, lag * 0.04, free);
      } else {
        position.xz *= 1.0 - c * 0.1;
        position.y += c * 0.07;
      }
      // The body tilts a little as it swims; strands leave the bell with it,
      // then hang back toward straight down under gravity and trail against
      // the direction of travel, so they curve instead of pointing.
      const vec3 pivot = vec3(0.0, 1.2, 0.0);
      vec3 local = position.xyz;
      vec3 turned = uOrient * (local - pivot) + pivot;
      if (part >= 1.0 && part < 3.0) {
        float t = fract(part);
        bool arm = part >= 2.0;
        vec3 root = arm ? vec3(local.x * 0.2, 0.62, local.z * 0.2) : vec3(local.x, 0.76, local.z);
        vec3 rootTurned = uOrient * (root - pivot) + pivot;
        vec3 hang = local - root;
        float settle = smoothstep(0.0, 1.0, t) * 0.85;
        turned = rootTurned + mix(uOrient * hang, hang, settle) - uDrift * t * t * 1.4;
      }
      position.xyz = mix(original, turned + uOffset, uJelly);
    }
    vec4 a = formColor(uFormA, uColorA);
    vec4 b = formColor(uFormB, uColorB);
    vec3 color = mix(a.rgb * uGlowA, b.rgb * uGlowB, m);
    if (uFormA > 4.5 && uFormA < 5.5) {
      float glow = 0.5 + 0.5 * sin(uTime * (0.7 + aRand * 1.6) + aRand * 60.0);
      color *= mix(1.0, 0.35 + 0.95 * smoothstep(0.35, 1.0, glow), 1.0 - m);
    }
    // Hovered service card lights its organ.
    if (uFormA > 4.5 && uHighlightAmount > 0.0) {
      float node = texture2D(uTargetA, aRef).w;
      float lit = step(abs(node - uHighlight), 0.4) * step(0.0, node);
      color *= 1.0 + lit * uHighlightAmount * 1.6;
      color = mix(color, color * 0.45, (1.0 - lit) * step(-0.5, node) * uHighlightAmount * 0.6);
    }
    float alpha = mix(a.a, b.a, m);

    // Fast particles burn hot: light trails during transitions and stirring.
    float speed = length(velocity);
    color = mix(color, vec3(0.75, 0.95, 1.0) * 1.6, smoothstep(1.2, 6.0, speed) * 0.7);
    color += vec3(1.0, 0.35, 0.7) * smoothstep(0.4, 2.5, speed) * 0.25;

    vec4 mvPosition = modelViewMatrix * vec4(position.xyz, 1.0);
    float distance = max(0.3, -mvPosition.z);
    float coc = clamp(abs(distance - uFocus) * uAperture, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Bokeh grows with defocus, but is capped: huge points cost fill rate.
    float nearFade = smoothstep(0.9, 2.4, distance);
    float size = uPointSize * (0.55 + aRand * 0.9) * uPixelRatio * (6.0 / distance) * (1.0 + coc * 3.0);
    gl_PointSize = nearFade > 0.001 ? min(size, uMaxPoint * uPixelRatio) : 0.0;
    // Dense swarms stay opaque when alpha drops, so dimming also darkens.
    vColor = color * (0.3 + 0.7 * uOpacity);
    vAlpha = alpha * uOpacity * nearFade / (1.0 + coc * coc * 22.0);
    if (uIgnite < 0.999 && uIgniteMode > 0.5) {
      vec3 rest = texture2D(uTargetA, aRef).xyz;
      float lit;
      float band;
      if (uIgniteMode < 1.5) {
        // a thin ring of light starting at the rim (d = 0), rising up the
        // bell and running down the tentacles
        float d = abs(rest.y - 0.76);
        float front = uIgnite * 3.9 - 0.15;
        lit = smoothstep(front, front - 0.3, d);
        band = exp(-pow((d - front) * 11.0, 2.0)) * step(0.001, uIgnite);
      } else {
        float u = fract(atan(rest.z, rest.x) / 6.2831853);
        float front = uIgnite * 1.06;
        lit = smoothstep(front, front - 0.03, u);
        band = exp(-pow((u - front) * 28.0, 2.0)) * step(0.001, uIgnite);
      }
      // dense swarms stay visible through low alpha, so dim the colour too:
      // unlit parts are only a ghost; the travelling front glows
      float vis = max(lit, band);
      vAlpha *= mix(0.06, 1.0, vis);
      vColor *= mix(0.05, 1.0, vis);
      vColor = mix(vColor, vec3(0.7, 0.96, 1.0) * 1.9, band * 0.85);
    }
    vSoft = coc;
  }
`;

const RENDER_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = mix(smoothstep(0.5, 0.32, d), smoothstep(0.5, 0.0, d), clamp(vSoft * 3.0, 0.0, 1.0));
    float alpha = disc * vAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const FORM_GLOW = {
  [FORM.FLOWER]: 1.0,
  [FORM.JELLY]: 1.0,
  [FORM.TEXT]: 0.95,
  [FORM.SCREEN]: 0.82,
  [FORM.VORTEX]: 1.45,
  [FORM.NETWORK]: 1.15,
  [FORM.FALL]: 1.0,
};

export class Particles {
  constructor(renderer, { size = 512, halfFloat = false } = {}) {
    this.renderer = renderer;
    this.size = size;
    this.count = size * size;
    this.halfFloat = halfFloat;
    this.forms = {};
    this.textSlot = 0;
    this.current = null;
    this.next = null;
  }

  // build(size, screenUv) returns the forms this swarm can take:
  // { key: { id, position, color } }. The first one is the starting form.
  // tasks: [[key, (size, screenUv) => form], …]. Each form is built in its own
  // frame so the page (and the loader) never freezes while they are made.
  async init({ build, tasks, onProgress }) {
    const size = this.size;
    this.screenUv = this.createScreenUv();
    let built = {};
    if (tasks) {
      for (let index = 0; index < tasks.length; index += 1) {
        const [key, make] = tasks[index];
        built[key] = make(size, this.screenUv);
        onProgress?.((index + 1) / tasks.length);
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      }
    } else {
      built = build(size, this.screenUv);
    }
    Object.assign(this.forms, built);
    const blank = [{ text: ' ', font: '800 {size} serif', color: '#edf2f3' }];
    this.forms.textA = { id: FORM.TEXT, ...textTargets(size, blank) };
    this.forms.textB = { id: FORM.TEXT, ...textTargets(size, blank) };
    for (const form of Object.values(this.forms)) form.color.colorSpace = THREE.SRGBColorSpace;
    const first = Object.values(built)[0];

    this.gpu = new GPUComputationRenderer(size, size, this.renderer);
    if (this.halfFloat) this.gpu.setDataType(THREE.HalfFloatType);
    const position = this.gpu.createTexture();
    position.image.data.set(scatterPositions(size));
    const velocity = this.gpu.createTexture();
    this.positionVariable = this.gpu.addVariable('texturePosition', POSITION_SHADER, position);
    this.velocityVariable = this.gpu.addVariable('textureVelocity', VELOCITY_SHADER, velocity);
    this.gpu.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
    this.gpu.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

    this.sim = {
      uTime: { value: 0 },
      uDelta: { value: 0.016 },
      uMorph: { value: 0 },
      uFormA: { value: first.id },
      uFormB: { value: first.id },
      uTargetA: { value: first.position },
      uTargetB: { value: first.position },
      uCenterA: { value: first.center ?? this.zeroCenter() },
      uCenterB: { value: first.center ?? this.zeroCenter() },
      uSpring: { value: 0.6 },
      uNoise: { value: 2.2 },
      uFlight: { value: 5.5 },
      uScatter: { value: 0 },
      uDamping: { value: 0.9 },
      uPulse: { value: 0 },
      uPointer: { value: new THREE.Vector3(99, 99, 99) },
      uPointerVelocity: { value: new THREE.Vector3() },
      uPointerRadius: { value: 0.55 },
      uPointerStrength: { value: 0 },
    };
    this.velocityVariable.material.uniforms = this.sim;
    this.positionVariable.material.uniforms = { uDelta: this.sim.uDelta };
    const error = this.gpu.init();
    if (error) throw new Error(error);

    this.createPoints(first);
    this.current = first;
    this.next = first;
  }

  // Stratified random UVs so the video screen has no holes.
  createScreenUv() {
    const uv = new Float32Array(this.count * 2);
    const cols = Math.round(Math.sqrt(this.count * SCREEN_ASPECT));
    const rows = Math.floor(this.count / cols);
    for (let index = 0; index < this.count; index += 1) {
      if (index < cols * rows) {
        uv[index * 2] = ((index % cols) + Math.random()) / cols;
        uv[index * 2 + 1] = (Math.floor(index / cols) + Math.random()) / rows;
      } else {
        uv[index * 2] = Math.random();
        uv[index * 2 + 1] = Math.random();
      }
    }
    return uv;
  }

  createPoints(first) {
    const refs = new Float32Array(this.count * 2);
    const random = new Float32Array(this.count);
    for (let index = 0; index < this.count; index += 1) {
      refs[index * 2] = ((index % this.size) + 0.5) / this.size;
      refs[index * 2 + 1] = (Math.floor(index / this.size) + 0.5) / this.size;
      random[index] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    geometry.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));
    geometry.setAttribute('aScreenUv', new THREE.BufferAttribute(this.screenUv, 2));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(random, 1));

    const dark = new THREE.DataTexture(new Uint8Array([8, 10, 16, 255]), 1, 1);
    dark.needsUpdate = true;
    this.render = {
      texturePosition: { value: null },
      textureVelocity: { value: null },
      uColorA: { value: first.color },
      uColorB: { value: first.color },
      uVideoA: { value: dark },
      uVideoB: { value: dark },
      uVideoMix: { value: 0 },
      uFormA: this.sim.uFormA,
      uFormB: this.sim.uFormB,
      uMorph: this.sim.uMorph,
      uGlowA: { value: FORM_GLOW[first.id] },
      uGlowB: { value: FORM_GLOW[first.id] },
      uPointSize: { value: 1.7 },
      uPixelRatio: { value: 1 },
      uFocus: { value: 6.2 },
      uAperture: { value: 0.09 },
      uOpacity: { value: 1 },
      uMaxPoint: { value: 14 },
      uTargetA: this.sim.uTargetA,
      uIgnite: { value: 1 },
      uIgniteMode: { value: 0 },
      uJelly: { value: 0 },
      uTime: this.sim.uTime,
      uPhase: { value: 0 },
      uBob: { value: 0 },
      uOrient: { value: new THREE.Matrix3() },
      uOffset: { value: new THREE.Vector3() },
      uDrift: { value: new THREE.Vector3() },
      uHighlight: { value: -1 },
      uHighlightAmount: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: RENDER_VERTEX,
      fragmentShader: RENDER_FRAGMENT,
      uniforms: this.render,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  setPixelRatio(ratio) {
    this.render.uPixelRatio.value = ratio;
  }

  // Refill the text slot that is not on screen and return it as a form.
  textForm(lines, width) {
    this.textSlot = 1 - this.textSlot;
    const form = this.textSlot ? this.forms.textB : this.forms.textA;
    if (form === this.current) return this.textForm(lines, width);
    textTargets(this.size, lines, { width, into: form });
    form.id = FORM.TEXT;
    form.position.needsUpdate = true;
    form.color.needsUpdate = true;
    return form;
  }

  // Fill a free dynamic slot with any generator (used for the service organs).
  customForm(id, fill) {
    this.textSlot = 1 - this.textSlot;
    const form = this.textSlot ? this.forms.textB : this.forms.textA;
    if (form === this.current) return this.customForm(id, fill);
    fill(this.size, form);
    form.id = id;
    form.position.needsUpdate = true;
    form.color.needsUpdate = true;
    return form;
  }

  zeroCenter() {
    if (!this.emptyCenter) {
      this.emptyCenter = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
      this.emptyCenter.needsUpdate = true;
    }
    return this.emptyCenter;
  }

  // A persistent generated form (service organs, wordmark): its own textures.
  addForm(key, id, fill) {
    let form = this.forms[key];
    if (!form) {
      form = { id, ...textTargets(this.size, [{ text: ' ', font: '800 {size} serif', color: '#ffffff' }]) };
      form.color.colorSpace = THREE.SRGBColorSpace;
      this.forms[key] = form;
    }
    fill(this.size, form);
    form.id = id;
    form.position.needsUpdate = true;
    form.color.needsUpdate = true;
    return form;
  }

  // Scroll-driven: show the blend of two forms directly (no commit step).
  // Swapping A/B only ever happens where the blend is exactly 0 or 1, so the
  // swarm never jumps.
  setPair(a, b, morph) {
    if (this.pairA !== a) {
      this.pairA = a;
      this.current = a;
      this.sim.uTargetA.value = a.position;
      this.sim.uCenterA.value = a.center ?? this.zeroCenter();
      this.sim.uFormA.value = a.id;
      this.render.uColorA.value = a.color;
      this.render.uGlowA.value = FORM_GLOW[a.id];
    }
    if (this.pairB !== b) {
      this.pairB = b;
      this.next = b;
      this.sim.uTargetB.value = b.position;
      this.sim.uCenterB.value = b.center ?? this.zeroCenter();
      this.sim.uFormB.value = b.id;
      this.render.uColorB.value = b.color;
      this.render.uGlowB.value = FORM_GLOW[b.id];
    }
    this.sim.uMorph.value = a === b ? 0 : morph;
  }

  // Point slot B at a new form; the caller tweens uMorph 0 → 1, then commit().
  prepare(form) {
    if (this.sim.uMorph.value > 0 && this.next !== this.current) this.commit();
    this.next = form;
    this.sim.uTargetB.value = form.position;
    this.sim.uFormB.value = form.id;
    this.render.uColorB.value = form.color;
    this.render.uGlowB.value = FORM_GLOW[form.id];
    this.sim.uMorph.value = 0;
  }

  commit() {
    this.current = this.next;
    this.sim.uTargetA.value = this.current.position;
    this.sim.uFormA.value = this.current.id;
    this.render.uColorA.value = this.current.color;
    this.render.uGlowA.value = FORM_GLOW[this.current.id];
    this.sim.uMorph.value = 0;
  }

  setVideo(textureA, textureB, mix = 0) {
    if (textureA) this.render.uVideoA.value = textureA;
    if (textureB) this.render.uVideoB.value = textureB;
    this.render.uVideoMix.value = mix;
  }

  update(dt, time) {
    this.sim.uTime.value = time;
    this.sim.uDelta.value = dt;
    this.gpu.compute();
    this.render.texturePosition.value = this.gpu.getCurrentRenderTarget(this.positionVariable).texture;
    this.render.textureVelocity.value = this.gpu.getCurrentRenderTarget(this.velocityVariable).texture;
  }

  dispose() {
    this.gpu?.dispose();
    this.points?.geometry.dispose();
    this.material?.dispose();
    for (const form of Object.values(this.forms)) {
      form.position.dispose();
      form.color.dispose();
    }
  }
}
