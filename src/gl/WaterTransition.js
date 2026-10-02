import * as THREE from 'three';

// Between one work and the next the camera passes through water.
//
// 1) WATER: a screen pass. A curved wall of water sweeps across the frame in
//    the direction the camera turns; behind it the picture refracts through
//    a flowing normal field, splits into colour at the wall's edge, and
//    caustic filaments of light play inside it, with ripples riding along.
// 2) Bubbles: a burst of glassy bubbles rising in front of the lens while
//    the camera travels, and gone when it arrives.
// Both are driven by the travel between two works (strength 0 at rest), so
// scrolling back plays them in reverse.

const NOISE = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

export const WATER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uFront: { value: -2 },
    uDir: { value: new THREE.Vector2(1, 0.3) },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uStrength;
    uniform float uFront;
    uniform vec2 uDir;
    uniform float uAspect;
    varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 uv = vUv;
      if (uStrength < 0.002) { gl_FragColor = texture2D(tDiffuse, uv); return; }
      vec2 dir = normalize(uDir);
      vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
      // the wall is gently curved, like the face of a passing current
      float s = dot(p, dir) + 0.18 * pow(dot(p, vec2(-dir.y, dir.x)), 2.0);
      float d = s - uFront;
      float wall = exp(-d * d * 9.0);
      float wake = smoothstep(0.0, -0.9, d) * 0.45;        // still disturbed behind it
      // the whole frame is under water while travelling; the wall adds more
      float swell = (0.75 + wall + wake * 0.6) * uStrength;
      // a flowing normal field
      vec2 q = p * 2.6 + vec2(uTime * 0.22, -uTime * 0.16);
      float n1 = fbm(q);
      float n2 = fbm(q + vec2(5.2, 1.3));
      vec2 normal = vec2(n1, n2) - 0.5;
      float ripple = sin(d * 42.0 - uTime * 5.0) * wall;
      vec2 offset = normal * 0.085 * swell + dir * ripple * 0.016 * uStrength;
      // long, slow waves across the full screen
      offset += vec2(
        sin(uv.y * 8.0 + uTime * 2.4 + n1 * 3.0),
        cos(uv.x * 6.5 - uTime * 2.0 + n2 * 3.0)
      ) * 0.02 * uStrength;
      offset.x /= uAspect;
      // a water lens: the image bends away toward the edges
      vec2 centred = uv - 0.5;
      float edge = dot(centred * vec2(uAspect, 1.0), centred * vec2(uAspect, 1.0));
      offset += centred * edge * 0.3 * uStrength;
      // dispersion along the wall's edge
      vec2 split = dir * (0.0015 + 0.011 * wall) * uStrength;
      split.x /= uAspect;
      // motion blur along the travel: strongest in the wall, gone on arrival
      vec2 streak = dir * (0.006 + 0.026 * (wall + wake * 0.5)) * uStrength;
      streak.x /= uAspect;
      vec3 col = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < 7; i++) {
        float k = float(i) / 6.0 - 0.5;
        float w = 1.0 - abs(k) * 1.2;
        vec2 at = uv + offset + streak * k;
        col += w * vec3(texture2D(tDiffuse, at + split).r, texture2D(tDiffuse, at).g, texture2D(tDiffuse, at - split).b);
        total += w;
      }
      col /= total;
      // caustics: the thin, bright mesh light makes on a seabed — ridged
      // noise, warped by the same flow, two layers drifting apart
      vec2 cq = q * 1.7 + vec2(n1, n2) * 1.6;
      float r1 = 1.0 - abs(fbm(cq + uTime * 0.08) * 2.0 - 1.0);
      float r2 = 1.0 - abs(fbm(cq * 1.9 - uTime * 0.06 + 3.1) * 2.0 - 1.0);
      // only inside the wall, and in patches, as light falls on real water
      float patches = smoothstep(0.42, 0.72, fbm(q * 0.7 + 8.0));
      // soft, glowing lines rather than sharp ones: light, not lightning
      float caustic = (pow(r1, 12.0) * 0.6 + pow(r2, 18.0) * 0.4) * wall * patches;
      col += vec3(0.62, 0.9, 1.0) * caustic * 0.2 * uStrength;
      // the leading edge catches the light
      col += vec3(0.6, 0.9, 1.0) * exp(-d * d * 120.0) * 0.18 * uStrength;
      // a cooler, deeper tone while passing through
      col = mix(col, col * vec3(0.84, 0.96, 1.04), 0.3 * uStrength);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Bubbles {
  constructor(scene, { count = 260 } = {}) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions.set([(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, -1.2 - Math.random() * 6], i * 3);
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.uniforms = {
      uTime: { value: 0 },
      uRise: { value: 0 },
      uStrength: { value: 0 },
      uPixelRatio: { value: 1 },
    };
    this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uRise;
        uniform float uPixelRatio;
        attribute float aSeed;
        varying float vSeed;
        void main() {
          vSeed = aSeed;
          vec3 p = position;
          // rise (faster for small ones), wobble, wrap
          p.y = mod(p.y + uRise * (0.7 + aSeed * 1.3) + 2.5, 5.0) - 2.5;
          p.x += sin(uTime * (2.0 + aSeed * 3.0) + aSeed * 40.0) * 0.06;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (6.0 + aSeed * 26.0) * uPixelRatio * (3.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        varying float vSeed;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q);
          if (r > 0.5) discard;
          // a glass bubble: bright thin rim, clear centre, one highlight
          float rim = smoothstep(0.5, 0.44, r) - smoothstep(0.44, 0.32, r) * 0.85;
          float glint = smoothstep(0.12, 0.0, length(q - vec2(-0.16, 0.16)));
          float a = (rim * 0.55 + glint * 0.8) * uStrength * (0.5 + vSeed * 0.5);
          gl_FragColor = vec4(vec3(0.78, 0.94, 1.0) * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.rise = 0;
  }

  update({ camera, time, dt, strength, pixelRatio }) {
    const visible = strength > 0.002;
    this.points.visible = visible;
    if (!visible) return;
    // the burst rises with the travel
    this.rise += dt * (0.6 + strength * 2.4);
    this.points.position.copy(camera.position);
    this.points.quaternion.copy(camera.quaternion);
    this.uniforms.uTime.value = time;
    this.uniforms.uRise.value = this.rise;
    this.uniforms.uStrength.value = strength;
    this.uniforms.uPixelRatio.value = pixelRatio;
  }
}
