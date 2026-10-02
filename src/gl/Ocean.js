import * as THREE from 'three';

// The sea at scale: a sunlit surface far overhead, a seabed of dunes far
// below, and shafts of light standing in the distance. Everything fades into
// the water with distance (no hard horizon), and the surface dims as the
// seasons go deeper. Mostly seen when the camera pulls back between scenes.

const NOISE = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

const FADE = /* glsl */ `
  uniform float uFogDensity;
  float fogAlpha(vec3 world) { return exp(-length(world - cameraPosition) * uFogDensity); }
`;

export class Ocean {
  constructor(scene) {
    this.uniforms = {
      uTime: { value: 0 },
      uDepth: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uFogDensity: { value: 0.022 },
    };
    const shared = this.uniforms;

    // Surface, seen from below: a bright window overhead, rippling caustics.
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(420, 420, 1, 1), new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uDepth; uniform vec3 uTint;
        varying vec3 vWorld;
        ${NOISE}
        ${FADE}
        void main() {
          vec2 p = vWorld.xz;
          float window = exp(-length(p) / 70.0);
          float ripples = fbm(p * 0.06 + vec2(uTime * 0.03, -uTime * 0.02));
          float lines = smoothstep(0.55, 0.62, fbm(p * 0.12 - vec2(uTime * 0.05, uTime * 0.04) + ripples));
          vec3 deep = vec3(0.04, 0.14, 0.2);
          vec3 light = vec3(0.62, 0.9, 0.98);
          vec3 color = mix(deep, light, window * (0.55 + ripples * 0.45)) + light * lines * window * 0.35;
          float strength = pow(1.0 - uDepth, 2.2);
          gl_FragColor = vec4(color * uTint, fogAlpha(vWorld) * strength * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    this.surface.rotation.x = Math.PI / 2;
    this.surface.position.y = 22;
    this.surface.renderOrder = -5;
    this.surface.frustumCulled = false;

    // Seabed: dunes shaped in the vertex shader, lit from above, speckled with
    // faint light in the deep.
    const bedGeometry = new THREE.PlaneGeometry(360, 360, 160, 160);
    bedGeometry.rotateX(-Math.PI / 2);
    this.seabed = new THREE.Mesh(bedGeometry, new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        ${NOISE}
        float dunes(vec2 p) { return fbm(p * 0.035) * 7.0 + sin(p.x * 0.09 + fbm(p * 0.02) * 4.0) * 1.4; }
        void main() {
          vec3 p = position;
          p.y += dunes(p.xz);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uDepth; uniform vec3 uTint;
        varying vec3 vWorld;
        ${NOISE}
        ${FADE}
        void main() {
          vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
          float light = 0.35 + 0.65 * max(n.y, 0.0);
          vec3 sand = mix(vec3(0.08, 0.12, 0.14), vec3(0.2, 0.26, 0.26), fbm(vWorld.xz * 0.3));
          float caustic = smoothstep(0.58, 0.66, fbm(vWorld.xz * 0.18 + vec2(uTime * 0.04, uTime * 0.03))) * (1.0 - uDepth);
          vec3 color = sand * light * (0.5 + (1.0 - uDepth) * 0.7) + vec3(0.5, 0.8, 0.85) * caustic * 0.25;
          // bioluminescent specks in the deep
          vec2 cell = floor(vWorld.xz * 1.6);
          float speck = step(0.996, hash21(cell)) * (0.5 + 0.5 * sin(uTime * 1.3 + hash21(cell + 3.0) * 20.0));
          color += vec3(0.5, 0.9, 1.0) * speck * uDepth * 0.9;
          gl_FragColor = vec4(color * uTint, fogAlpha(vWorld) * 0.95);
        }
      `,
      transparent: true,
      depthWrite: false,
    }));
    this.seabed.position.y = -20;
    this.seabed.renderOrder = -6;
    this.seabed.frustumCulled = false;

    // Distant shafts of light from the surface.
    this.pillars = new THREE.Group();
    const pillarMaterial = new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWorld;
        void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uDepth; uniform vec3 uTint;
        varying vec2 vUv; varying vec3 vWorld;
        ${FADE}
        void main() {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float shaft = pow(across, 3.0) * smoothstep(0.0, 0.7, vUv.y) * (0.75 + 0.25 * sin(uTime * 0.4 + vWorld.x));
          float strength = pow(1.0 - uDepth, 1.8);
          gl_FragColor = vec4(vec3(0.6, 0.9, 1.0) * uTint, shaft * strength * 0.14 * (0.3 + fogAlpha(vWorld) * 0.7));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 26 + Math.random() * 40;
      const width = 4 + Math.random() * 7;
      const pillar = new THREE.Mesh(new THREE.PlaneGeometry(width, 48, 1, 1), pillarMaterial);
      pillar.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius - 10);
      pillar.rotation.z = (Math.random() - 0.5) * 0.25;
      pillar.userData.billboard = true;
      pillar.renderOrder = -4;
      pillar.frustumCulled = false;
      this.pillars.add(pillar);
    }

    scene.add(this.surface, this.seabed, this.pillars);
  }

  update({ time, depth, tint, camera }) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uDepth.value = depth;
    u.uTint.value.copy(tint);
    // The surface climbs away and the seabed rises to meet the dive.
    this.surface.position.y = 18 + depth * 40;
    this.seabed.position.y = -24 + depth * 6;
    this.pillars.children.forEach((pillar) => {
      pillar.lookAt(camera.x, pillar.position.y, camera.z);
    });
  }
}
