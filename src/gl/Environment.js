import * as THREE from 'three';

// Scale and travel. Streaks sell the descent between chapters (marine snow
// rushing past the lens); the starfield appears when the abyss opens into space.
export class Environment {
  constructor({ scene, tier = 'high' }) {
    const streakCount = tier === 'high' ? 2600 : 1200;
    const base = new Float32Array(streakCount * 2 * 3);
    const end = new Float32Array(streakCount * 2);
    const seed = new Float32Array(streakCount * 2);
    for (let index = 0; index < streakCount; index += 1) {
      const radius = 1.2 + Math.pow(Math.random(), 0.6) * 10;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = (Math.random() - 0.5) * 24;
      const z = Math.sin(angle) * radius - 3;
      const s = Math.random();
      for (let side = 0; side < 2; side += 1) {
        const o = index * 2 + side;
        base.set([x, y, z], o * 3);
        end[o] = side;
        seed[o] = s;
      }
    }
    const streakGeometry = new THREE.BufferGeometry();
    streakGeometry.setAttribute('position', new THREE.BufferAttribute(base, 3));
    streakGeometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    streakGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.streakUniforms = {
      uTravel: { value: 0 },
      uLength: { value: 0 },
      uOpacity: { value: 0 },
      uTint: { value: new THREE.Color('#bfefff') },
    };
    this.streaks = new THREE.LineSegments(streakGeometry, new THREE.ShaderMaterial({
      uniforms: this.streakUniforms,
      vertexShader: /* glsl */ `
        uniform float uTravel;
        uniform float uLength;
        attribute float aEnd;
        attribute float aSeed;
        varying float vFade;
        void main() {
          vec3 p = position;
          float speed = 0.6 + aSeed * 0.9;
          p.y = mod(p.y + uTravel * speed + 12.0, 24.0) - 12.0;
          p.y -= aEnd * uLength * speed;
          vFade = (1.0 - aEnd) * (0.25 + aSeed * 0.75);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform vec3 uTint;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uTint, vFade * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.streaks.frustumCulled = false;
    this.streaks.renderOrder = 3;
    scene.add(this.streaks);

    const starCount = tier === 'high' ? 9000 : 4000;
    const stars = new Float32Array(starCount * 3);
    const starSeed = new Float32Array(starCount);
    const starColor = new Float32Array(starCount * 3);
    const palette = [new THREE.Color('#ffffff'), new THREE.Color('#ffc2e0'), new THREE.Color('#a8f4ff'), new THREE.Color('#fff0c8')];
    for (let index = 0; index < starCount; index += 1) {
      const radius = 45 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // A denser band, like a galactic plane seen edge-on.
      const band = Math.random() < 0.45;
      const y = band ? (Math.random() - 0.5) * 14 : radius * Math.cos(phi);
      stars.set([radius * Math.sin(phi) * Math.cos(theta), y, radius * Math.sin(phi) * Math.sin(theta)], index * 3);
      starSeed[index] = Math.random();
      palette[(Math.random() * palette.length) | 0].toArray(starColor, index * 3);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1));
    starGeometry.setAttribute('aColor', new THREE.BufferAttribute(starColor, 3));
    this.starUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 } };
    this.stars = new THREE.Points(starGeometry, new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float aSeed;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.8 + pow(aSeed, 6.0) * 3.2) * uPixelRatio;
          vColor = aColor;
          vTwinkle = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 2.0) + aSeed * 40.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.0, d) * vTwinkle * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor * 1.4, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 0;
    scene.add(this.stars);
    this.createDrift(scene, tier);
  }

  // Seasonal drift: petals (spring, autumn), sparks (summer), snow (winter).
  // Some pieces pass right in front of the lens, huge and soft, so the world
  // reads as bigger than the window.
  createDrift(scene, tier) {
    const count = tier === 'high' ? 3200 : 1300;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      positions.set([(Math.random() - 0.5) * 36, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 36], index * 3);
      seeds[index] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.drift = {
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uFall: { value: 0.25 },
      uSway: { value: 0.35 },
      uPetal: { value: 1 },
      uLeaf: { value: 0 },
      uFirefly: { value: 0 },
      uCamera: { value: new THREE.Vector3() },
      uSpan: { value: new THREE.Vector3(36, 22, 36) },
      uOpacity: { value: 0.9 },
      uPixelRatio: { value: 1 },
      uColorA: { value: new THREE.Color('#ffd3e2') },
      uColorB: { value: new THREE.Color('#ff9ec0') },
    };
    this.driftPoints = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: this.drift,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uTravel;
        uniform float uFall;
        uniform float uSway;
        uniform float uPixelRatio;
        uniform vec3 uCamera;
        uniform vec3 uSpan;
        attribute float aSeed;
        varying float vSeed;
        varying float vAngle;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.y += -uTime * uFall * (0.5 + aSeed) + uTravel * 0.35;
          p.x += sin(uTime * (0.3 + aSeed * 0.5) + aSeed * 30.0) * uSway;
          p.z += cos(uTime * 0.23 + aSeed * 17.0) * uSway * 0.5;
          // wrap around the camera: an endless medium
          vec3 rel = p - uCamera;
          rel = mod(rel + uSpan * 0.5, uSpan) - uSpan * 0.5;
          p = uCamera + rel;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float distance = max(0.4, -mv.z);
          gl_PointSize = min((2.4 + aSeed * 3.4) * uPixelRatio * (10.0 / distance), 150.0 * uPixelRatio);
          vSeed = aSeed;
          vAngle = aSeed * 6.2831 + uTime * (aSeed - 0.5) * 1.4;
          // Near pieces are soft (out of focus), far ones fade into the water.
          vFade = smoothstep(-19.0, -8.0, mv.z) * (1.0 - smoothstep(-0.6, -0.1, mv.z)) * (1.0 - smoothstep(2.5, 6.0, 1.0 / max(0.15, distance) * 6.0) * 0.55);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uPetal;
        uniform float uLeaf;
        uniform float uFirefly;
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vSeed;
        varying float vAngle;
        varying float vFade;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float c = cos(vAngle);
          float s = sin(vAngle);
          q = mat2(c, -s, s, c) * q;
          // petal: a rounded teardrop with a notch; snow/spark: a soft dot
          vec2 pq = q * vec2(1.7, 1.15) + vec2(0.0, 0.08);
          float petal = smoothstep(0.42, 0.3, length(pq)) * (1.0 - smoothstep(0.06, 0.0, abs(q.x)) * step(0.28, q.y));
          float disc = smoothstep(0.5, 0.0, length(q));
          // maple leaf: slender pointed lobes fanning from the base, deep sinuses
          vec2 lq = q * 2.3 + vec2(0.0, 0.32);
          float leaf = step(length(lq - vec2(0.0, 0.04)), 0.16);
          for (int i = 0; i < 7; i++) {
            float fi = float(i);
            float a = (fi < 0.5) ? 0.0 : ((mod(fi, 2.0) < 0.5 ? -1.0 : 1.0) * (0.698 * floor((fi + 1.0) / 2.0)));
            float len = (fi < 0.5) ? 0.95 : (fi < 2.5 ? 0.9 : (fi < 4.5 ? 0.74 : 0.44));
            vec2 axis = vec2(sin(a), cos(a));
            float sAlong = dot(lq, axis);
            float across = abs(lq.x * axis.y - lq.y * axis.x);
            float u = sAlong / len;
            float halfWidth = (u > 0.0 && u < 1.0) ? 0.155 * pow(sin(3.14159 * pow(u, 0.8)), 1.3) * pow(1.0 - u, 0.14) : -1.0;
            leaf = max(leaf, step(across, halfWidth));
          }
          leaf = max(leaf, step(abs(lq.x), 0.018) * step(lq.y, 0.0) * step(-0.42, lq.y));
          float shape = mix(mix(disc, petal, uPetal), min(1.0, leaf), uLeaf);
          float alpha = shape * uOpacity * vFade * (0.35 + vSeed * 0.65);
          // fireflies: each one glows and goes dark on its own slow rhythm
          float blink = smoothstep(0.55, 1.0, sin(uTime * (0.45 + vSeed * 0.9) + vSeed * 57.0));
          alpha *= mix(1.0, 0.08 + blink * 1.6, uFirefly);
          if (alpha < 0.01) discard;
          vec3 color = mix(uColorA, uColorB, vSeed) * mix(1.0, 0.8 + (q.y + 0.5) * 0.4, uPetal);
          color *= 1.0 + uFirefly * 1.4;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    }));
    this.driftPoints.frustumCulled = false;
    this.driftPoints.renderOrder = 6;
    scene.add(this.driftPoints);
  }

  setPixelRatio(ratio) {
    this.starUniforms.uPixelRatio.value = ratio;
    if (this.drift) this.drift.uPixelRatio.value = ratio;
  }

  update({ time, travel, streak, space, camera }) {
    if (this.drift) {
      if (camera) this.drift.uCamera.value.copy(camera);
      this.drift.uTime.value = time;
      this.drift.uTravel.value = travel;
    }
    this.streakUniforms.uTravel.value = travel;
    this.streakUniforms.uLength.value = streak;
    this.streakUniforms.uOpacity.value = Math.min(1, streak * 0.6) * (1 - space * 0.6);
    this.streaks.visible = streak > 0.01;
    this.starUniforms.uTime.value = time;
    this.starUniforms.uOpacity.value = space;
    this.stars.visible = space > 0.01;
    // Stars slowly wheel, so space never feels like a backdrop.
    this.stars.rotation.y = time * 0.004;
  }
}
