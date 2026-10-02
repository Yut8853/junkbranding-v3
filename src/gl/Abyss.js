import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
`;

// Scrolling the page is a dive: sunlit water at the top of the site, the
// abyss by the contact form. uDepth runs 0 (surface) to 1 (abyss).
const WATER_FRAGMENT = /* glsl */ `
  uniform float uDepth;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSpace;
  uniform vec3 uTint;
  varying vec2 vUv;
  ${NOISE}

  vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

  void main() {
    vec2 uv = vUv;
    float d = uDepth;
    vec3 surfaceTop = toLinear(vec3(0.20, 0.44, 0.52));
    vec3 surfaceLow = toLinear(vec3(0.03, 0.10, 0.15));
    vec3 twilightTop = toLinear(vec3(0.05, 0.13, 0.20));
    vec3 twilightLow = toLinear(vec3(0.01, 0.03, 0.06));
    vec3 abyssTop = toLinear(vec3(0.012, 0.02, 0.04));
    vec3 abyssLow = vec3(0.0);

    float a = smoothstep(0.0, 0.42, d);
    float b = smoothstep(0.42, 1.0, d);
    vec3 top = mix(mix(surfaceTop, twilightTop, a), abyssTop, b);
    vec3 low = mix(mix(surfaceLow, twilightLow, a), abyssLow, b);
    vec3 color = mix(low, top, pow(uv.y, 1.35));

    // Slanted light shafts from the surface, gone by the twilight zone.
    float slant = (uv.x - 0.5) * uAspect + (1.0 - uv.y) * 0.32;
    float shafts = noise(vec2(slant * 6.5, uTime * 0.07))
      * noise(vec2(slant * 15.0 + 7.0, uTime * 0.11 + 3.0));
    shafts = smoothstep(0.18, 0.72, shafts) * smoothstep(0.05, 1.0, uv.y);
    color += toLinear(vec3(0.55, 0.85, 0.9)) * shafts * 0.2 * (1.0 - smoothstep(0.0, 0.34, d));

    // Surface caustics shimmer along the very top in the first screen.
    float caustic = noise(vec2(uv.x * uAspect * 18.0, uTime * 0.6)) * noise(vec2(uv.x * uAspect * 31.0 - uTime * 0.4, 2.0));
    color += toLinear(vec3(0.7, 0.95, 1.0)) * caustic * smoothstep(0.8, 1.0, uv.y) * 0.2 * (1.0 - smoothstep(0.0, 0.18, d));

    // Faint bioluminescent haze in the deep.
    float haze = noise(uv * vec2(uAspect, 1.0) * 2.2 + vec2(uTime * 0.015, -uTime * 0.01));
    vec3 hazeColor = mix(toLinear(vec3(0.22, 0.02, 0.14)), toLinear(vec3(0.0, 0.14, 0.2)), uv.x);
    color += hazeColor * smoothstep(0.45, 0.9, haze) * smoothstep(0.35, 1.0, d) * 0.35;

    // Beyond the abyss: water gives way to space. Deep indigo, nebula veils
    // in the site's two lights, and a faint galactic band.
    if (uSpace > 0.001) {
      vec2 q = uv * vec2(uAspect, 1.0);
      float n1 = noise(q * 1.6 + vec2(uTime * 0.01, 0.0));
      float n2 = noise(q * 3.4 - vec2(0.0, uTime * 0.008) + n1 * 1.5);
      float veil = smoothstep(0.35, 1.0, n1 * 0.6 + n2 * 0.6);
      vec3 space = mix(toLinear(vec3(0.004, 0.006, 0.02)), toLinear(vec3(0.02, 0.018, 0.06)), uv.y);
      space += toLinear(vec3(0.28, 0.03, 0.2)) * veil * smoothstep(0.2, 0.9, uv.x) * 0.55;
      space += toLinear(vec3(0.0, 0.16, 0.24)) * veil * (1.0 - smoothstep(0.1, 0.8, uv.x)) * 0.45;
      float band = exp(-pow((uv.y - 0.35 - (uv.x - 0.5) * 0.4) * 5.0, 2.0));
      space += toLinear(vec3(0.16, 0.12, 0.2)) * band * (0.4 + n2 * 0.6) * 0.35;
      color = mix(color, space, uSpace);
    }

    color *= uTint;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const SNOW_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uRise;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float span = 10.0;
    p.y = mod(p.y + uTime * 0.035 * (0.4 + aSeed) + uRise + span * 0.5, span) - span * 0.5;
    p.x += sin(uTime * 0.17 + aSeed * 31.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depthFade = smoothstep(-12.0, -4.0, mv.z) * (1.0 - smoothstep(-1.2, 0.0, mv.z));
    gl_PointSize = (1.5 + aSeed * 3.5) * uPixelRatio * (5.0 / max(0.6, -mv.z));
    vAlpha = (0.12 + aSeed * 0.4) * depthFade;
  }
`;

const SNOW_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vec3(0.78, 0.93, 1.0), alpha);
  }
`;

export class Abyss {
  constructor({ scene, pixelRatio = 1, count = 1800 }) {
    this.scene = scene;
    this.waterMaterial = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
      `,
      fragmentShader: WATER_FRAGMENT,
      uniforms: {
        uDepth: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uSpace: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.waterMaterial);
    this.water.frustumCulled = false;
    this.water.renderOrder = -10;
    scene.add(this.water);

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 16;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[index * 3 + 2] = -11 + Math.random() * 14;
      seeds[index] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.snowMaterial = new THREE.ShaderMaterial({
      vertexShader: SNOW_VERTEX,
      fragmentShader: SNOW_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uRise: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.snow = new THREE.Points(geometry, this.snowMaterial);
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 1;
    scene.add(this.snow);
  }

  resize(width, height, pixelRatio) {
    this.waterMaterial.uniforms.uAspect.value = width / Math.max(1, height);
    this.snowMaterial.uniforms.uPixelRatio.value = pixelRatio;
  }

  update({ time, depth, rise, opacity, space = 0 }) {
    this.waterMaterial.uniforms.uSpace.value = space;
    this.waterMaterial.uniforms.uTime.value = time;
    this.waterMaterial.uniforms.uDepth.value = depth;
    this.snowMaterial.uniforms.uTime.value = time;
    this.snowMaterial.uniforms.uRise.value = rise;
    this.snowMaterial.uniforms.uOpacity.value = opacity;
  }

  dispose() {
    this.water.geometry.dispose();
    this.waterMaterial.dispose();
    this.snow.geometry.dispose();
    this.snowMaterial.dispose();
  }
}
