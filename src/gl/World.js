import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Particles } from './Particles.js';
import { Abyss } from './Abyss.js';
import { Environment } from './Environment.js';
import { WorkPanels } from './WorkPanels.js';
import { Ocean } from './Ocean.js';
import { WATER, Bubbles } from './WaterTransition.js';
import { workLayout } from './workLayout.js';
import { WORKS } from '../ui/works.js';

// Lens: radial blur + barrel warp during transitions, chromatic aberration,
// vignette and grain always.
const FINISH = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uWarp: { value: 0 },
    uAberration: { value: 0.0025 },
    uGrain: { value: 0.045 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uWarp;
    uniform float uAberration;
    uniform float uGrain;
    uniform vec2 uResolution;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 uv = 0.5 + c * (1.0 - uWarp * 0.22 * (0.4 + r2 * 2.5));
      vec2 dir = c * (uAberration + uWarp * 0.03) * (0.4 + r2 * 3.0);
      vec3 color = vec3(0.0);
      if (uWarp < 0.002) {
        color = vec3(texture2D(tDiffuse, uv + dir).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir).b);
      } else {
        const int TAPS = 8;
        for (int i = 0; i < TAPS; i++) {
          float t = float(i) / float(TAPS - 1);
          vec2 blur = -c * uWarp * 0.09 * t;
          color.r += texture2D(tDiffuse, uv + blur + dir).r;
          color.g += texture2D(tDiffuse, uv + blur).g;
          color.b += texture2D(tDiffuse, uv + blur - dir).b;
        }
        color /= float(TAPS);
      }
      color *= mix(1.0, 0.42, smoothstep(0.1, 0.72, r2 * 1.8));
      float grain = fract(sin(dot(floor(vUv * uResolution) + floor(uTime * 24.0) * 7.13, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      color += grain * uGrain * sqrt(max(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0006));
      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export class World {
  constructor({ canvas, reducedMotion = false, tier = 'high', lite = false, capture = 0 }) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.tier = tier;
    this.lite = lite; // verification mode for software renderers
    // capture: stills for submissions — fast simulation stepping like lite,
    // but full drawing quality at the given pixel ratio
    this.capture = capture;
    this.cheap = lite && !capture;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    // Tweened by the Director (GSAP).
    this.rig = { x: 0, y: 3, z: 14, tx: 0, ty: 0, tz: 0, roll: 0.2, fov: 50, depth: 0, fovKick: 0, rollKick: 0 };
    this.fx = {
      trail: 0, warp: 0, bloom: 0.4, threshold: 0.7, exposure: 1,
      streak: 0, travel: 0, space: 0,
      echo: 0, echoX: 0, echoY: 0, echoZ: -40, echoScale: 10,
    };
    this.parallax = 1;
    this.look = new THREE.Vector2();
    this.tilt = { x: 0, y: 0, active: false };
    this.aspectFit = 1;
    this.time = 0;
    this.last = performance.now();
    this.pointer = { ndc: new THREE.Vector2(), world: new THREE.Vector3(99, 99, 99), velocity: new THREE.Vector3(), active: false, energy: 0 };
    this.pulsePhase = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
    this.tmp = { ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3(), look: new THREE.Vector3(), ndc: new THREE.Vector3() };
  }

  async init({ photoUrl, flowerTasks, jellyTasks, onProgress }) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x03050a, 1);

    // A photograph is only fetched if a form asks for one.
    let photo = null;
    if (photoUrl) {
      photo = new Image();
      photo.decoding = 'async';
      photo.crossOrigin = 'anonymous';
      photo.src = photoUrl;
      await photo.decode();
    }

    const high = this.tier === 'high';
    this.abyss = new Abyss({ scene: this.scene, count: high ? 900 : 400 });
    // Two protagonists, two swarms: the flower and the jellyfish.
    // Losing the GPU (driver reset, memory pressure on phones) must not
    // leave a broken page: fall back to the plain, readable layout.
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
      this.stop();
      // the page decides: reload once, or fall back to the light version
      window.dispatchEvent(new CustomEvent('junkbranding:gl-lost'));
    });
    const total = flowerTasks.length + jellyTasks.length;
    this.flower = new Particles(this.renderer, { size: high ? 512 : 256, halfFloat: !high });
    await this.flower.init({
      tasks: flowerTasks.map(([key, make]) => [key, (size, uv) => make(size, uv, photo)]),
      onProgress: (done) => onProgress?.((done * flowerTasks.length) / total),
    });
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    await nextFrame();
    this.jelly = new Particles(this.renderer, { size: high ? 384 : 192, halfFloat: !high });
    await this.jelly.init({
      tasks: jellyTasks,
      onProgress: (done) => onProgress?.((flowerTasks.length + done * jellyTasks.length) / total),
    });
    this.flower.render.uPointSize.value = high ? 1.7 : 2.9;
    this.jelly.render.uPointSize.value = high ? 1.9 : 3.2;
    this.systems = [this.flower, this.jelly];
    for (const system of this.systems) {
      this.scene.add(system.points);
      this.guardUniforms(system);
    }
    this.environment = new Environment({ scene: this.scene, tier: this.tier });
    this.jelly.render.uJelly.value = 1;
    this.workPanels = new WorkPanels(this.scene, workLayout(WORKS.length));
    this.ocean = new Ocean(this.scene);
    this.bubbles = new Bubbles(this.scene, { count: high ? 260 : 120 });
    this.water = { strength: 0, front: -2, dir: 1 };
    await this.warmUp();
    this.jellyPhase = Math.random();
    this.createSchool();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.afterimage = new AfterimagePass(0);
    this.composer.addPass(this.afterimage);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.8, 0.7);
    this.composer.addPass(this.bloom);
    // between works: the camera passes through a wall of water
    this.waterPass = new ShaderPass(WATER);
    this.waterPass.enabled = false;
    this.composer.addPass(this.waterPass);
    this.finish = new ShaderPass(FINISH);
    this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());

    this.resize();
    // Look-around and stirring follow a mouse or pen; a finger is for scrolling.
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      this.setPointer(event.clientX, event.clientY);
    }, { passive: true });
    window.addEventListener('pointerleave', () => { this.pointer.active = false; });
    // Phones: look around by tilting the device.
    window.addEventListener('deviceorientation', (event) => {
      if (event.gamma == null || event.beta == null) return;
      this.tilt.x = THREE.MathUtils.clamp(event.gamma / 32, -1, 1);
      this.tilt.y = THREE.MathUtils.clamp((event.beta - 50) / 34, -1, 1);
      this.tilt.active = true;
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.start();
  }

  // Each swarm shares its material with anything else drawing it (the echo),
  // so it restores its own uniforms right before it is drawn.
  guardUniforms(system) {
    const render = system.render;
    const base = render.uPointSize.value;
    system.points.onBeforeRender = () => {
      // Scaling a swarm spreads its points apart; grow them with it so a
      // flower three times the screen still reads as solid petals.
      const grow = Math.pow(Math.max(1, system.points.scale.x), 0.85);
      render.uOpacity.value = system === this.flower ? this.flowerOpacity ?? 1 : 1;
      render.uAperture.value = this.cheap ? 0 : 0.085;
      render.uMaxPoint.value = this.cheap ? 7 : 22;
      render.uPointSize.value = base * grow;
      render.uPhase.value = this.jellyPhase % 1;
      render.uBob.value = 0;
      if (system === this.flower) render.uJelly.value = this.flowerJelly ?? 0;
      else render.uJelly.value = this.jellyDeform ?? 1;
      // the opening: light running through the medusa, then round the ring
      render.uIgniteMode.value = system === this.jelly ? 1 : 2;
      render.uIgnite.value = system === this.jelly ? this.jellyIgnite ?? 1 : this.ringIgnite ?? 1;
      // The key visual's cosmos is wrapped around the medusa: it gets the
      // medusa's stroke, heading and drift so the two move as one animal.
      if ((system === this.jelly || (system === this.flower && render.uJelly.value > 0.001)) && this.mainSwim) {
        render.uOrient.value.copy(this.mainSwim.orient);
        render.uOffset.value.copy(this.mainSwim.offset).multiplyScalar(Math.min(1, 1.6 / system.points.scale.x));
        render.uDrift.value.copy(this.mainSwim.velocity);
      } else {
        render.uOrient.value.identity();
        render.uOffset.value.set(0, 0, 0);
        render.uDrift.value.set(0, 0, 0);
      }
      system.material.uniformsNeedUpdate = true;
    };
  }

  // A loose group of moon jellies at different depths and sizes. They share
  // the protagonist's simulation (same species), but each is drawn with its
  // own stroke phase, period, drift and size, and with fewer particles.
  createSchool() {
    const system = this.jelly;
    const render = system.render;
    const base = render.uPointSize.value;
    const source = system.points.geometry;
    const geometry = new THREE.BufferGeometry();
    for (const name of Object.keys(source.attributes)) geometry.setAttribute(name, source.getAttribute(name));
    geometry.setDrawRange(0, Math.floor(system.count * 0.45));
    this.schoolCount = 5;
    this.school = Array.from({ length: this.tier === 'high' ? 8 : 5 }, (_, index) => {
      const points = new THREE.Points(geometry, system.material);
      points.frustumCulled = false;
      points.renderOrder = 1;
      const near = index % 3 === 0;
      const member = {
        points,
        t: Math.random(),
        period: 2.3 + Math.random() * 1.7,
        x: (index / 8 - 0.5) * 20 + (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 12,
        // Kept behind the scene's plane so they never sit on the text.
        z: near ? -8 - Math.random() * 4 : -13 - Math.random() * 14,
        scale: near ? 0.6 + Math.random() * 0.3 : 0.8 + Math.random() * 1,
        vx: (Math.random() - 0.5) * 0.06,
        spin: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.6,
        seed: Math.random() * 10,
        fade: 0,
        yaw: Math.random() * Math.PI * 2,
        heading: new THREE.Vector3(0, 1, 0),
        velocity: new THREE.Vector3(),
        orient: new THREE.Matrix3(),
      };
      points.onBeforeRender = () => {
        render.uOpacity.value = member.fade * 0.55;
        render.uAperture.value = this.cheap ? 0 : 0.085;
        render.uMaxPoint.value = this.cheap ? 5 : 16;
        render.uPointSize.value = base * 1.45 * Math.pow(Math.max(1, member.scale), 0.85);
        render.uPhase.value = member.t % 1;
        render.uBob.value = 0;
        render.uIgnite.value = 1;
        render.uOrient.value.copy(member.orient);
        render.uOffset.value.set(0, 0, 0);
        render.uDrift.value.copy(member.velocity).divideScalar(member.scale);
        system.material.uniformsNeedUpdate = true;
      };
      this.scene.add(points);
      return member;
    });
  }

  // Swimming, as moon jellies and their kin actually do it: the body stays
  // close to upright and only leans a little into its turns (tilt), each
  // stroke lifts it along its axis, it sinks slowly between strokes, and a
  // slow current carries it sideways. That is what makes it travel up, down,
  // left, right and at every angle, without ever lying on its side.
  steer(state, dt, time, tilt) {
    state.yaw += (Math.sin(time * 0.11 + state.seed) * 0.5 + Math.sin(time * 0.053 + state.seed * 2.3) * 0.5) * dt * 0.6;
    const lean = tilt * (0.5 + 0.5 * Math.sin(time * 0.09 + state.seed * 1.7));
    const want = this.tmp.want.set(Math.sin(lean) * Math.cos(state.yaw), Math.cos(lean), Math.sin(lean) * Math.sin(state.yaw));
    state.heading.lerp(want, 1 - Math.exp(-dt * 0.5)).normalize();
    this.tmp.quat.setFromUnitVectors(this.tmp.up, state.heading);
    state.orient.setFromMatrix4(this.tmp.m4.makeRotationFromQuaternion(this.tmp.quat));
  }

  swim(state, dt, time, phase, thrust, current, sink) {
    const stroke = phase < 0.3 ? Math.sin((phase / 0.3) * Math.PI * 0.5) : 0.5 + 0.5 * Math.cos(((phase - 0.3) / 0.7) * Math.PI);
    const drift = time * 0.045 + state.seed * 1.9;
    state.velocity.addScaledVector(state.heading, stroke * thrust * dt);
    state.velocity.x += Math.cos(drift) * current * dt;
    state.velocity.z += Math.sin(drift) * current * 0.6 * dt;
    state.velocity.y -= sink * dt;
    state.velocity.multiplyScalar(Math.exp(-dt * 1.2));
  }

  updateSchool(dt, time) {
    if (!this.tmp.want) {
      Object.assign(this.tmp, { want: new THREE.Vector3(), quat: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0), m4: new THREE.Matrix4(), center: new THREE.Vector3(0, 0, -15) });
    }
    // The protagonist: stays near its place in the composition (local units).
    if (!this.mainSwim) {
      this.mainSwim = { seed: 3.7, yaw: 0.6, heading: new THREE.Vector3(0, 1, 0), velocity: new THREE.Vector3(), offset: new THREE.Vector3(), orient: new THREE.Matrix3() };
    }
    this.jellyPhase += dt / 2.8;
    const main = this.mainSwim;
    this.steer(main, dt, time, 0.32);
    this.swim(main, dt, time, this.jellyPhase % 1, 0.55, 0.1, 0.17);
    const away = main.offset.length();
    if (away > 0.35) main.velocity.addScaledVector(main.offset, -((away - 0.35) / away) * 0.6 * dt);
    main.offset.addScaledVector(main.velocity, dt);

    const box = { x: 14, y: 7.5, z: 10 };
    this.school.forEach((member, index) => {
      member.t += dt / member.period;
      this.steer(member, dt, time, 0.42);
      this.swim(member, dt, time, member.t % 1, 0.8 * member.scale, 0.16 * member.scale, 0.16 * member.scale);
      // a current that turns them back toward the scene when they stray
      const dx = member.x - this.tmp.center.x;
      const dy = member.y - this.tmp.center.y;
      const dz = member.z - this.tmp.center.z;
      if (Math.abs(dx) > box.x) member.velocity.x -= Math.sign(dx) * 0.25 * dt;
      if (Math.abs(dy) > box.y) member.velocity.y -= Math.sign(dy) * 0.25 * dt;
      if (Math.abs(dz) > box.z) member.velocity.z -= Math.sign(dz) * 0.25 * dt;
      member.x += member.velocity.x * dt;
      member.y += member.velocity.y * dt;
      member.z += member.velocity.z * dt;
      let target = index < Math.min(this.schoolCount, this.maxSchool ?? 8) ? 1 : 0;
      const clear = this.schoolClear;
      if (clear) {
        const ndc = this.tmp.ndc.set(member.x, member.y, member.z).project(this.camera);
        const inside = ndc.x > clear[0] && ndc.x < clear[2] && ndc.y > clear[1] && ndc.y < clear[3];
        if (inside) target *= 0.1;
      }
      member.fade += (target - member.fade) * (1 - Math.exp(-dt * 2.4));
      const points = member.points;
      points.visible = member.fade > 0.01;
      points.position.set(member.x, member.y, member.z);
      points.scale.setScalar(member.scale);
      points.rotation.set(0, 0, 0);
    });
  }

  // Compile every shader while the loader is still up (in parallel where the
  // browser supports it), including things that are hidden at first, so the
  // scene never hitches the first time a season, the works or the group of
  // jellies appears. Then render one frame through the whole post chain.
  async warmUp() {
    const hidden = [];
    this.scene.traverse((object) => {
      if (!object.visible) {
        hidden.push(object);
        object.visible = true;
      }
    });
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
      else this.renderer.compile(this.scene, this.camera);
    } catch {
      // compiling ahead is an optimisation only
    }
    hidden.forEach((object) => { object.visible = false; });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    this.composer?.render();
  }

  pixelRatio() {
    if (this.capture) return this.capture;
    if (this.lite) return 0.5;
    return Math.min(window.devicePixelRatio || 1, this.tier === 'high' ? 1.75 : 1.5) * (this.qualityScale ?? 1);
  }

  resize() {
    if (!this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = this.pixelRatio();
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.aspectFit = aspect < 1 ? Math.min(1.9, 1.12 / Math.max(0.45, aspect)) : 1;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.bloom.resolution.set(width * 0.5, height * 0.5);
    this.finish.uniforms.uResolution.value.set(width * ratio, height * ratio);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.abyss.resize(width, height, ratio);
    for (const system of this.systems) system.setPixelRatio(ratio);
    this.environment.setPixelRatio(ratio);
  }

  setPointer(x, y) {
    this.pointer.ndc.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.pointer.active = true;
  }

  start() {
    if (this.lost) return;
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  // Keeps the frame rate steady on slower machines: every 1.5 s it looks at
  // the average frame time and, if it is under ~45 fps, steps quality down
  // one level (lower resolution, fewer drawn particles, no trails). It only
  // steps down, so quality never oscillates.
  govern(rawDt) {
    if (this.lite || this.paused || document.hidden) return;
    const perf = this.perf ?? (this.perf = { time: 0, frames: 0, level: 0, warmup: 3 });
    perf.time += rawDt;
    perf.frames += 1;
    if (perf.time < 1.5) return;
    const average = perf.time / perf.frames;
    perf.time = 0;
    perf.frames = 0;
    if (perf.warmup > 0) { perf.warmup -= 1; return; }
    if (average < 1 / 45 || perf.level >= 3) return;
    perf.level += 1;
    const level = perf.level;
    this.qualityScale = [1, 0.85, 0.72, 0.6][level];
    this.noTrails = true;
    const keep = [1, 0.8, 0.65, 0.5][level];
    for (const system of this.systems) system.points.geometry.setDrawRange(0, Math.floor(system.count * keep));
    this.maxSchool = [8, 6, 4, 3][level];
    this.resize();
  }

  frame(now) {
    if (!this.running) return;
    const rawDt = Math.min(2, Math.max(0.001, (now - this.last) / 1000));
    this.govern(rawDt);
    const dt = this.paused ? 0 : Math.min(0.1, rawDt);
    this.last = now;
    this.time += dt;
    const time = this.time;
    const rig = this.rig;
    const fx = this.fx;

    // Camera: tweened pose × portrait fit + drift + pointer. The pointer also
    // turns the head a little, so the sea visibly continues past the frame.
    // Look-around: the sea is much wider than the window. Near the centre
    // the view barely moves; toward the edges it turns further and further,
    // up to about 60 degrees, so the reachable view is roughly three screens
    // wide. It follows with weight, not instantly. Phones use the tilt of the
    // device instead of a mouse.
    const drift = this.reducedMotion ? 0 : this.parallax;
    const source = this.pointer.active ? this.pointer.ndc : this.tilt.active ? this.tilt : null;
    const curve = (v) => Math.sign(v) * Math.pow(Math.min(1, Math.abs(v)), 1.6);
    const aimX = source ? curve(source.x) : 0;
    const aimY = source ? curve(source.y) : 0;
    const follow = 1 - Math.exp(-dt * 2.2);
    this.look.x += (aimX - this.look.x) * follow;
    this.look.y += (aimY - this.look.y) * follow;
    const px = this.look.x;
    const py = this.look.y;
    this.tmp.look.set(rig.tx, rig.ty, rig.tz);
    this.camera.position.set(
      rig.tx + (rig.x - rig.tx) * this.aspectFit + px * 1.4 * drift + Math.sin(time * 0.13) * 0.12 * drift,
      rig.ty + (rig.y - rig.ty) * this.aspectFit + py * 0.7 * drift + Math.sin(time * 0.17) * 0.08 * drift,
      rig.tz + (rig.z - rig.tz) * this.aspectFit,
    );
    const roll = rig.roll + rig.rollKick;
    this.camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    this.camera.lookAt(this.tmp.look);
    this.camera.rotateY(-px * 1.05 * drift);
    this.camera.rotateX(py * 0.4 * drift);
    const fov = rig.fov + rig.fovKick;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    // Pointer → world, then into each swarm's own space.
    const pointer = this.pointer;
    this.tmp.ray.setFromCamera(pointer.ndc, this.camera);
    this.tmp.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).negate(), this.tmp.look);
    if (pointer.active && this.tmp.ray.ray.intersectPlane(this.tmp.plane, this.tmp.hit)) {
      const velocity = this.tmp.hit.clone().sub(pointer.world).divideScalar(dt);
      if (pointer.world.x > 90) velocity.set(0, 0, 0);
      pointer.velocity.lerp(velocity.clampLength(0, 12), 1 - Math.exp(-dt * 10));
      pointer.world.copy(this.tmp.hit);
      pointer.energy = Math.min(1, pointer.energy + pointer.velocity.length() * dt * 0.8);
    }
    pointer.energy *= Math.exp(-dt * 0.9);

    this.pulsePhase += dt / 2.6;
    const cycle = this.pulsePhase % 1;
    const pulse = cycle < 0.24 ? Math.sin((cycle / 0.24) * Math.PI * 0.5) : 1 - THREE.MathUtils.smoothstep(cycle, 0.24, 1);

    for (const system of this.systems) {
      const sim = system.sim;
      system.points.updateMatrixWorld();
      const scale = Math.max(0.2, system.points.scale.x);
      sim.uPointer.value.copy(system.points.worldToLocal(pointer.world.clone()));
      sim.uPointerVelocity.value.copy(pointer.velocity).multiplyScalar(0.12 / scale);
      sim.uPointerRadius.value = 0.55 / scale;
      sim.uPointerStrength.value = this.reducedMotion ? 0 : (1.2 + pointer.energy * 5) / scale;
      sim.uPulse.value = system === this.jelly ? 0 : pulse;
      if (this.paused) {
        // frozen: keep the last simulated state
      } else if (this.lite) {
        const steps = Math.min(60, Math.max(1, Math.round(rawDt * 30)));
        for (let step = 0; step < steps; step += 1) system.update(rawDt / steps, time);
      } else {
        system.update(dt, time);
      }
    }

    this.abyss.update({ time, depth: rig.depth, rise: time * 0.02 + fx.travel * 0.22, opacity: 0.22, space: fx.space });
    this.environment.update({ time, travel: fx.travel, streak: fx.streak, space: fx.space, camera: this.camera.position });
    this.ocean.update({ time, depth: rig.depth, tint: this.abyss.waterMaterial.uniforms.uTint.value, camera: this.camera.position });
    this.updateSchool(dt, time);
    // the water between works (set by the Director each frame)
    const water = this.water;
    if (water && this.waterPass) {
      const u = this.waterPass.uniforms;
      this.waterPass.enabled = water.strength > 0.002;
      u.uTime.value = time;
      u.uStrength.value = water.strength;
      u.uFront.value = water.front;
      u.uDir.value.set(water.dir, 0.32);
      u.uAspect.value = this.camera.aspect;
      this.bubbles.update({ camera: this.camera, time, dt, strength: water.strength, pixelRatio: this.pixelRatio() });
    }

    this.afterimage.uniforms.damp.value = this.reducedMotion ? 0 : fx.trail;
    this.afterimage.enabled = fx.trail > 0.01 && !this.reducedMotion && !this.lite && !this.noTrails;
    this.bloom.strength = fx.bloom;
    this.bloom.threshold = fx.threshold;
    this.renderer.toneMappingExposure = fx.exposure;
    this.finish.uniforms.uWarp.value = this.reducedMotion ? 0 : fx.warp;
    this.finish.uniforms.uTime.value = time;

    this.composer.render(dt);
    requestAnimationFrame(this.frame);
  }
}
