import * as THREE from 'three';
import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { WORKS, displayHost } from './works.js';
import { TextReveal } from './TextReveal.js';
import { CAPABILITIES } from './capabilities.js';
import { FORM, textTargets } from '../gl/targets.js';
import { workLayout, cameraForPanel } from '../gl/workLayout.js';

gsap.registerPlugin(Observer);

// Scrolling is one continuous dive. Every value below is a function of a
// single number, the position along the dive (in stations), so moving back
// and forth scrubs the whole world: the camera's curved path, the swarms'
// shapes, the water, the video, the text.

const SEASONS = {
  prologue: { water: 0.14, tint: '#e6f6fb', drift: { petal: 0, leaf: 0, firefly: 0, fall: 0.07, sway: 0.2, opacity: 0.55, a: '#ffffff', b: '#bfeeff' }, bloom: 0.32, threshold: 0.78, accent: '#9fdcea', school: 7 },
  spring: { water: 0.03, tint: '#fff1f7', drift: { petal: 1, leaf: 0, fall: 0.28, sway: 0.4, opacity: 0.9, a: '#ffe3ec', b: '#ff9dbf' }, bloom: 0.3, threshold: 0.78, accent: '#ff9dbf', school: 4 },
  summer: { water: 0.32, tint: '#dfe6ff', drift: { petal: 0, leaf: 0, firefly: 1, fall: -0.06, sway: 0.6, opacity: 0.95, a: '#dcff86', b: '#f6ffb8' }, bloom: 0.34, threshold: 0.74, accent: '#ffb86b', school: 5 },
  autumn: { water: 0.62, tint: '#ffe0c6', drift: { petal: 0, leaf: 1, fall: 0.24, sway: 0.75, opacity: 0.95, a: '#d9402a', b: '#f2a33a' }, bloom: 0.26, threshold: 0.82, accent: '#ff8f6b', school: 3 },
  winter: { water: 1, tint: '#dbeeff', drift: { petal: 0, leaf: 0, fall: 0.12, sway: 0.15, opacity: 1, a: '#ffffff', b: '#c4f0ff' }, bloom: 0.38, threshold: 0.7, accent: '#9fe6ff', school: 2 },
};

const ID = { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0 };
const PANELS = workLayout(WORKS.length);
// Autumn: one great maple leaf holds the centre; the works float around it.
const COSMOS_AT = { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0 };

// Stations: where the dive rests. swing: which way the camera arcs on the way
// to the next station (the path is a curve around the creatures, never a line).
const STATIONS = [
  {
    id: 'hero', clear: [-1, -1, 0.15, -0.1], panel: 'hero', season: 'prologue', depth: 10, flower: 'seasonsRing', jelly: 'medusa', swing: 1,
    // Looking up from beneath a colossal medusa: its bell a dome overhead,
    // its tentacles curtains of light falling past into the deep. Inside the
    // bell, the ring of the year turns. The same medusa as everywhere else.
    cam: { x: 0, y: -1.4, z: 7.6, tx: 0, ty: 3.6, tz: -4 },
    flowerAt: { x: 0, y: 7.9, z: -8, s: 4.9, rx: 0.08, ry: 0, rz: 0.04 },
    jellyAt: { x: 0, y: 1.3, z: -8, s: 7.6 },
    narrow: {
      cam: { x: 0, y: -1.6, z: 7.4, tx: 0, ty: 3.4, tz: -4 },
      flowerAt: { x: 0, y: 7.2, z: -8, s: 4.2, rx: 0.08, ry: 0, rz: 0.04 },
      jellyAt: { x: 0, y: 1.1, z: -8, s: 6.6 },
    },
    echo: { a: 0, x: 0, y: 0, z: -50, s: 12 },
  },
  {
    id: 'about', clear: [-1, -1, 0.35, 0.3], panel: 'about', season: 'spring', depth: 60, flower: 'sakuraFall', jelly: 'medusa', swing: -1,
    cam: { x: 0.8, y: 0.3, z: 6.4, tx: 0.6, ty: 0, tz: 0 },
    flowerAt: { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0 },
    jellyAt: { x: 2.1, y: -0.4, z: -1.6, s: 1.6 },
    narrow: { cam: { x: 0, tx: 0, ty: -0.8 }, jellyAt: { x: 0.2, y: 1.3, z: -2.8, s: 0.85 } },
    echo: { a: 0.24, x: -13, y: 4, z: -50, s: 12 },
  },
  {
    id: 'services', clear: [-1, -1, 0.12, 0.75], panel: 'services', season: 'summer', depth: 200, flower: 'hanabi', jelly: 'medusa', swing: 1,
    cam: { x: 0, y: 0, z: 7.2, tx: 0, ty: 0, tz: 0 },
    // One kiku firework, to the right of the list; hovering a service lights its sector.
    flowerAt: { x: 2.7, y: 0.55, z: -0.6, s: 2.05, rx: 0.1, ry: -0.25, rz: 0 },
    jellyAt: { x: 5.4, y: 3.1, z: -7.5, s: 1.1 },
    narrow: { flowerAt: { x: 0.5, y: 3.9, z: -1.6, s: 1.05 }, jellyAt: { x: 1.8, y: 5.6, z: -9, s: 1 } },
    echo: { a: 0, x: 0, y: 0, z: -50, s: 12 },
  },
  {
    id: 'autumn', clear: [-1, -1, 0.15, -0.35], panel: 'autumn', season: 'autumn', depth: 800, flower: 'mapleFall', jelly: 'medusa', swing: -1,
    // Establishing shot: the flower and the ring of works around it.
    cam: { x: 0.6, y: 1.4, z: 10.8, tx: 0, ty: 0.1, tz: 0 },
    flowerAt: COSMOS_AT,
    jellyAt: { x: 0.9, y: -3, z: -1.2, s: 1.1 },
    narrow: { cam: { x: 0, y: 1.4, z: 9, tx: 0, ty: -0.9, tz: 0 }, jellyAt: { x: 0.6, y: -3.6, z: -2, s: 0.9 } },
    echo: { a: 0.2, x: 18, y: 2, z: -54, s: 13 },
  },
  ...WORKS.map((_, index) => ({
    id: 'works', work: index, clear: [-1, -1, 0.3, -0.15], panel: 'works', season: 'autumn', depth: 1000 + index * 120, flower: 'mapleFall', jelly: 'medusa',
    swing: index % 2 ? 1 : -1,
    // Keep the work in frame: less look-around while reading a project.
    parallax: 0.55,
    cam: cameraForPanel(PANELS[index], false),
    // The flower steps back and dims: the work comes forward.
    flowerAt: { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0 },
    flowerOpacity: 0.75,
    jellyAt: { x: 0.9, y: -3.2, z: -3, s: 1 },
    narrow: { cam: cameraForPanel(PANELS[index], true), jellyAt: { x: 0.6, y: -3.8, z: -3, s: 0.85 } },
    echo: { a: 0.2, x: 18, y: 2, z: -54, s: 13 },
  })),
  {
    id: 'contact', clear: [-1, -1, 0.15, 0.6], panel: 'contact', season: 'winter', depth: 4000, flower: 'snowFall', jelly: 'medusa', swing: 1,
    cam: { x: 0, y: 0, z: 7, tx: 0, ty: 0, tz: 0 },
    flowerAt: { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0 },
    jellyAt: { x: 2.5, y: 0.3, z: 0.4, s: 0.75 },
    narrow: { cam: { ty: -0.6 }, jellyAt: { x: -1.3, y: 2.3, z: 0, s: 0.55 } },
    echo: { a: 0.2, x: 24, y: 6, z: -62, s: 14 },
  },
  {
    id: 'finale', clear: [-0.9, -0.35, 0.9, 0.35], panel: 'finale', season: 'spring', depth: 0, flower: 'wordmark', jelly: 'medusa', swing: -1,
    cam: { x: 0, y: 0, z: 7, tx: 0, ty: -0.1, tz: 0 },
    flowerAt: ID,
    jellyAt: { x: 3.4, y: 3.2, z: -6.5, s: 1.2 },
    narrow: { jellyAt: { x: 0.8, y: 4.4, z: -7, s: 1 } },
    echo: { a: 0.16, x: 16, y: 6, z: -56, s: 13 },
  },
];

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const pad = (value) => String(value).padStart(2, '0');
// Rest at each station, travel between them.
const hold = (t) => THREE.MathUtils.smootherstep(clamp((t - 0.1) / 0.8, 0, 1), 0, 1);

export class Director {
  constructor({ world, redaction, reducedMotion = false }) {
    this.world = world;
    this.flower = world.flower;
    this.jelly = world.jelly;
    this.redaction = redaction;
    this.reducedMotion = reducedMotion;
    this.count = STATIONS.length;
    this.target = 0;
    this.current = 0;
    this.rest = 0;
    this.lastInput = 0;
    this.lockUntil = 0;
    // the opening: k (camera rising into place), light (the dark sea dawning),
    // ignite (light running through the medusa), ring (the year lighting up),
    // reveal (text, snow and the small medusae appearing)
    this.intro = { k: 1, reveal: 0, light: 0, ignite: 0, ring: 0, morph: 1 };
    this.faceProxy = new THREE.Object3D();
    this.heroQuat = new THREE.Quaternion();
    this.busy = true;
    this.media = new Map();
    this.workShown = -1;
    this.posterLoader = new THREE.TextureLoader();
    this.panels = Array.from(document.querySelectorAll('[data-panel]'));
    this.panelById = Object.fromEntries(this.panels.map((panel) => [panel.dataset.panel, panel]));
    this.hud = {
      root: document.querySelector('[data-hud]'),
      seasons: Array.from(document.querySelectorAll('[data-hud-season]')),
      depth: document.querySelector('[data-hud-depth]'),
    };
    this.navLinks = Array.from(document.querySelectorAll('[data-go]'));
    this.colors = Object.fromEntries(Object.entries(SEASONS).map(([key, season]) => [key, {
      tint: new THREE.Color(season.tint),
      a: new THREE.Color(season.drift.a),
      b: new THREE.Color(season.drift.b),
      accent: new THREE.Color(season.accent),
    }]));
    this.tmp = { color: new THREE.Color(), accent: new THREE.Color() };
    this.reveal = new TextReveal({ reducedMotion });
    this.tick = this.tick.bind(this);
  }

  init() {
    // The medusa's particles hold the loader's figure crisply from the start.
    this.jelly.sim.uSpring.value = 18;
    this.jelly.sim.uNoise.value = 0.05;
    this.buildServices();
    this.buildWorks();
    this.generateForms();
    this.buildPath();
    this.bindInput();
    this.apply(0);
    gsap.ticker.add(this.tick);
    let timer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        this.world.resize();
        this.generateForms();
        this.buildPath();
      }, 180);
    });
  }

  // ------------------------------------------------------------ content

  buildServices() {
    const list = document.querySelector('[data-services]');
    if (!list) return;
    const render = this.flower.render;
    list.replaceChildren(...CAPABILITIES.map((item, index) => {
      const row = document.createElement('li');
      row.className = 'service';
      row.tabIndex = 0;
      row.innerHTML = `
        <span class="service__no">${pad(index + 1)}</span>
        <span class="service__title">${item.ja}</span>
        <span class="service__tags">${item.tags.join(' / ')}</span>`;
      const on = () => {
        render.uHighlight.value = index;
        gsap.to(render.uHighlightAmount, { value: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      };
      const off = () => gsap.to(render.uHighlightAmount, { value: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
      row.addEventListener('pointerenter', on);
      row.addEventListener('pointerleave', off);
      row.addEventListener('focus', on);
      row.addEventListener('blur', off);
      return row;
    }));
  }

  buildWorks() {
    const list = document.querySelector('[data-work-list]');
    if (list) {
      list.replaceChildren(...WORKS.map((work, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = `<span class="works__no">${pad(index + 1)}</span><span class="works__label"></span>`;
        button.querySelector('.works__label').textContent = work.name;
        button.addEventListener('click', () => this.goTo(this.stationOf('works', index), { cut: true }));
        item.append(button);
        return item;
      }));
      this.workButtons = Array.from(list.querySelectorAll('button'));
    }
    const total = document.querySelector('[data-work-total]');
    if (total) total.textContent = pad(WORKS.length);
    this.work = {
      root: document.querySelector('[data-work-info]'),
      name: document.querySelector('[data-work-name]'),
      summary: document.querySelector('[data-work-summary]'),
      year: document.querySelector('[data-work-year]'),
      role: document.querySelector('[data-work-role]'),
      link: document.querySelector('[data-work-link]'),
      host: document.querySelector('[data-work-host]'),
      index: document.querySelector('[data-work-index]'),
      ja: document.querySelector('[data-work-ja]'),
      stack: document.querySelector('[data-work-stack]'),
      highlights: document.querySelector('[data-work-highlights]'),
      repo: document.querySelector('[data-work-repo]'),
    };
    this.announcer = document.querySelector('[data-announce]');
  }

  isNarrow() {
    return window.innerWidth / window.innerHeight < 0.9;
  }

  station(index) {
    const base = STATIONS[index];
    const narrow = this.isNarrow() ? base.narrow ?? {} : {};
    return {
      ...base,
      cam: { ...base.cam, ...(narrow.cam ?? {}) },
      flowerAt: { ...ID, ...base.flowerAt, ...(narrow.flowerAt ?? {}) },
      jellyAt: { ...ID, ...base.jellyAt, ...(narrow.jellyAt ?? {}) },
    };
  }

  stationOf(id, work = null) {
    return STATIONS.findIndex((station) => station.id === id && (work === null || station.work === work));
  }

  worldPointsFor(cam, points) {
    const fit = this.world.aspectFit;
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(cam.tx + (cam.x - cam.tx) * fit, cam.ty + (cam.y - cam.ty) * fit, cam.tz + (cam.z - cam.tz) * fit);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    return points.map(([x, y]) => {
      ray.setFromCamera(new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
      const hit = new THREE.Vector3();
      ray.ray.intersectPlane(plane, hit);
      return hit;
    });
  }

  // The wordmark is fitted to the frame, so it is generated after layout.
  // So is the loader's last figure, "100": the medusa's particles hold it at
  // exactly the size and place the loader drew it (28% of the screen height,
  // centred), so when the loader fades the same figure is already there.
  generateForms() {
    const finale = this.station(this.stationOf('finale'));
    const distance = Math.hypot(finale.cam.x - finale.cam.tx, finale.cam.y - finale.cam.ty, finale.cam.z - finale.cam.tz) * this.world.aspectFit;
    const visible = 2 * Math.tan(THREE.MathUtils.degToRad(20)) * distance * (window.innerWidth / window.innerHeight);
    this.flower.addForm('wordmark', FORM.TEXT, (size, into) => textTargets(size, [{ text: 'JUNKBRANDING', font: '800 {size} "Shippori Mincho", serif', color: '#f6efe8', size: 300 }], { width: Math.min(7.4, visible * 0.86), into }));
  }

  // The camera path: a centripetal Catmull-Rom spline through every station,
  // with a control point between each pair that swings around the creatures
  // and dips, so every passage between scenes is an arc.
  buildPath() {
    const positions = [];
    const looks = [];
    for (let index = 0; index < this.count; index += 1) {
      const a = this.station(index);
      positions.push(new THREE.Vector3(a.cam.x, a.cam.y, a.cam.z));
      looks.push(new THREE.Vector3(a.cam.tx, a.cam.ty, a.cam.tz));
      if (index === this.count - 1) break;
      const b = this.station(index + 1);
      const look = new THREE.Vector3((a.cam.tx + b.cam.tx) / 2, (a.cam.ty + b.cam.ty) / 2 - 0.3, 0);
      const mid = new THREE.Vector3((a.cam.x + b.cam.x) / 2, (a.cam.y + b.cam.y) / 2, (a.cam.z + b.cam.z) / 2).sub(look);
      if (a.id === 'works' && b.id === 'works') {
        // Between works: swing wide around the flower, climbing over it or
        // diving under it in turn, looking back at the flower mid-flight.
        const from = new THREE.Vector3(a.cam.x, a.cam.y, a.cam.z);
        const to = new THREE.Vector3(b.cam.x, b.cam.y, b.cam.z);
        const arc = from.add(to).multiplyScalar(0.5);
        const radial = new THREE.Vector3(arc.x, 0, arc.z);
        if (radial.lengthSq() < 0.01) radial.set(0, 0, 1);
        radial.normalize().multiplyScalar(Math.max(8.2, Math.hypot(arc.x, arc.z) * 1.35));
        const climb = a.work % 2 ? -2.6 : 3.1;
        positions.push(new THREE.Vector3(radial.x, arc.y + climb, radial.z));
        looks.push(new THREE.Vector3(0, (a.cam.ty + b.cam.ty) / 2 + climb * 0.25, 0));
        continue;
      }
      // Between scenes: pull far back into the open sea, so the creatures
      // shrink against the surface light above and the seabed below, then
      // swoop into the next scene. Season changes go furthest.
      const seasonChange = a.season !== b.season;
      const reach = seasonChange ? 27 : 15;
      const lift = [6, -5, 7, -6.5, 5, -5.5][index % 6] * (seasonChange ? 1 : 0.6);
      const out = mid.lengthSq() > 0.01 ? mid.clone().normalize() : new THREE.Vector3(0, 0, 1);
      out.applyAxisAngle(new THREE.Vector3(0, 1, 0), a.swing * 0.8);
      positions.push(look.clone().addScaledVector(out, reach).add(new THREE.Vector3(0, lift, 0)));
      looks.push(look.clone().add(new THREE.Vector3(0, lift * 0.15, 0)));
    }
    this.posCurve = new THREE.CatmullRomCurve3(positions, false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
  }

  // ------------------------------------------------------------ input

  bindInput() {
    this.observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      tolerance: 4,
      preventDefault: true,
      ignore: '[data-observer-ignore]',
      onChangeY: (self) => {
        if (this.busy) return;
        const now = performance.now();
        // Trackpad momentum keeps firing after a scene has settled: ignore
        // that tail so one gesture never carries on into a second scene.
        if (now < this.lockUntil) return;
        const touch = self.event?.type?.startsWith('touch') || self.event?.pointerType === 'touch';
        const delta = touch ? -self.deltaY * 0.0048 : self.deltaY * 0.0014;
        // One gesture moves at most to the neighbouring scene.
        const low = Math.max(0, this.rest - 1.3);
        const high = Math.min(this.count - 1, this.rest + 1.3);
        this.target = clamp(this.target + clamp(delta, -0.35, 0.35), low, high);
        this.lastInput = now;
      },
    });
    window.addEventListener('keydown', (event) => {
      const tag = event.target instanceof HTMLElement ? event.target.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || this.busy) return;
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); this.goTo(this.rest + 1); }
      else if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); this.goTo(this.rest - 1); }
      else if (event.key === 'Home') this.goTo(0);
      else if (event.key === 'End') this.goTo(this.count - 1);
    });
    this.navLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const [id, work] = link.dataset.go.split(':');
        this.goTo(this.stationOf(id, work === undefined ? null : Number(work)), { cut: true });
        if (event.detail === 0) {
          const target = id === 'contact' ? document.getElementById('contact-name') : document.querySelector(`[data-panel="${STATIONS[this.stationOf(id, work === undefined ? null : Number(work))]?.panel}"] [tabindex="-1"]`);
          gsap.delayedCall(this.reducedMotion ? 0.3 : 2.2, () => target?.focus({ preventScroll: true }));
        }
      });
    });
  }

  // cut: for shortcuts (works index, navigation). A jump of more than one
  // scene does not fly through everything in between: a short veil, a cut to
  // the scene next to the destination, and only the last arc is travelled.
  goTo(index, { cut = false } = {}) {
    if (index < 0) return;
    const target = clamp(Math.round(index), 0, this.count - 1);
    const distance = target - this.current;
    if (cut && Math.abs(distance) > 1.5 && !this.reducedMotion) {
      if (!this.veil) {
        this.veil = document.createElement('div');
        this.veil.className = 'cut-veil';
        this.veil.setAttribute('aria-hidden', 'true');
        document.body.append(this.veil);
      }
      gsap.timeline({ overwrite: true })
        .to(this.veil, { opacity: 1, duration: 0.22, ease: 'power2.in' })
        .call(() => {
          this.current = target - Math.sign(distance) * 0.98;
          this.apply(this.current);
        })
        .to(this.veil, { opacity: 0, duration: 0.55, ease: 'power2.out' });
    }
    this.rest = target;
    this.target = target;
    this.lastInput = 0;
  }

  // ------------------------------------------------------------ media

  mediaFor(index) {
    let media = this.media.get(index);
    if (media) return media;
    const work = WORKS[index];
    const poster = this.posterLoader.load(work.poster ?? work.video.replace(/\.mp4$/, '.jpg'));
    poster.colorSpace = THREE.SRGBColorSpace;
    if (!work.video) {
      media = { video: null, texture: poster, poster, playing: false };
      this.media.set(index, media);
      return media;
    }
    const video = document.createElement('video');
    video.src = work.video;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    media = { video, texture, poster, playing: false };
    this.media.set(index, media);
    return media;
  }

  textureFor(index) {
    const media = this.mediaFor(index);
    return media.video && media.video.readyState >= 2 ? media.texture : media.poster;
  }

  playOnly(indices) {
    this.media.forEach((media, index) => {
      if (!media.video) return;
      const want = indices.includes(index);
      if (want && !media.playing) media.video.play().catch(() => {});
      if (!want && media.playing) media.video.pause();
      media.playing = want;
    });
    indices.forEach((index) => {
      const media = this.mediaFor(index);
      if (media.video && !media.playing) { media.video.play().catch(() => {}); media.playing = true; }
    });
  }

  setWorkInfo(index) {
    if (index === this.workShown || index < 0) return;
    this.workShown = index;
    const work = WORKS[index];
    const w = this.work;
    const swap = () => {
      if (w.name) w.name.textContent = work.name;
      if (w.summary) w.summary.textContent = work.summary;
      if (w.year) w.year.textContent = String(work.year);
      if (w.role) w.role.textContent = work.role;
      if (w.host) w.host.textContent = displayHost(work.href);
      if (w.ja) w.ja.textContent = work.nameJa ?? '';
      if (w.stack) w.stack.replaceChildren(...work.stack.map((tag) => Object.assign(document.createElement('li'), { textContent: tag })));
      if (w.highlights) w.highlights.replaceChildren(...work.highlights.map((line) => Object.assign(document.createElement('li'), { textContent: line })));
      if (w.repo) {
        w.repo.hidden = !work.repo;
        if (work.repo) w.repo.href = work.repo;
      }
      if (w.link) {
        w.link.href = work.href;
        w.link.setAttribute('aria-label', `${work.name}（新しいタブで開く）`);
      }
      if (w.index) w.index.textContent = pad(index + 1);
      this.workButtons?.forEach((button, buttonIndex) => button.toggleAttribute('aria-current', buttonIndex === index));
    };
    if (!w.root || this.reducedMotion) { swap(); return; }
    const warp = document.querySelector('[data-water-warp]');
    const ripple = document.querySelector('[data-water-ripple]');
    w.root.classList.add('is-flowing');
    gsap.timeline({ overwrite: true, onComplete: () => w.root.classList.remove('is-flowing') })
      .to(w.root, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0)
      .fromTo(warp, { attr: { scale: 0 } }, { attr: { scale: 26 }, duration: 0.2, ease: 'power2.in' }, 0)
      .fromTo(ripple, { attr: { baseFrequency: '0.012 0.05' } }, { attr: { baseFrequency: '0.02 0.09' }, duration: 0.8, ease: 'none' }, 0)
      .call(() => {
        swap();
        // only when switching works in view; arriving is handled by the panel
        if (this.reveal.isShown(this.panelById.works)) this.reveal.replay(w.root);
      }, null, 0.2)
      .to(w.root, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.2)
      .to(warp, { attr: { scale: 0 }, duration: 0.7, ease: 'power3.out' }, 0.2);
  }

  // ------------------------------------------------------------ frame

  tick(time, deltaMs) {
    const dt = Math.min(0.1, (deltaMs || 16) / 1000);
    // Settle: once input stops, drift to the station the visitor was heading for.
    if (this.lastInput && performance.now() - this.lastInput > 200) {
      const direction = Math.sign(this.target - this.rest);
      const next = clamp(Math.round(this.target + direction * 0.38), 0, this.count - 1);
      if (next !== this.rest) this.lockUntil = performance.now() + 450;
      this.rest = next;
      this.target = this.rest;
      this.lastInput = 0;
    }
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    this.current += (this.target - this.current) * k;
    if (Math.abs(this.target - this.current) < 0.0004) this.current = this.target;
    this.apply(this.current);
  }

  apply(position) {
    const world = this.world;
    const i = clamp(Math.floor(position), 0, this.count - 2);
    const t = clamp(position - i, 0, 1);
    const e = hold(t);
    const a = this.station(i);
    const b = this.station(i + 1);
    const travel = Math.sin(e * Math.PI);

    // Camera along the curved path.
    const u = (2 * i + 2 * e) / (2 * this.count - 2);
    const pos = this.posCurve.getPoint(u);
    const look = this.lookCurve.getPoint(u);
    const intro = this.intro.k;
    const rig = world.rig;
    rig.tx = look.x;
    rig.ty = look.y;
    rig.tz = look.z;
    rig.x = look.x + (pos.x - look.x) * (1 + intro * 0.9);
    // the opening rises from the deep: start lower and further off
    rig.y = look.y + (pos.y - look.y) * (1 + intro * 0.9) - intro * 2.2;
    rig.z = look.z + (pos.z - look.z) * (1 + intro * 0.9);
    // Bank into the arc; a touch wider lens while travelling.
    const betweenWorks = a.id === 'works' && b.id === 'works';
    const longArc = !betweenWorks && a.panel !== b.panel;
    rig.roll = a.swing * travel * (betweenWorks ? 0.13 : longArc ? 0.08 : 0.045);
    rig.fov = 40 + travel * (betweenWorks ? 7 : longArc ? 9 : 3);
    // While the camera is out in the open sea, the season's form breaks into a
    // vast drifting cloud, and gathers again on arrival.
    const segmentScatter = longArc ? travel * (a.season !== b.season ? 1.25 : 0.6) : 0;
    // Between two works the camera passes through a wall of water: it sweeps
    // across the frame in the direction of the turn, crossing the centre at
    // mid-travel (when the text changes too).
    world.water.strength = betweenWorks && !this.reducedMotion ? travel : 0;
    // the works' text and index warp with the same water (SVG displacement)
    this.warpDom(world.water.strength, position);
    world.water.front = -1.5 + e * 3;
    world.water.dir = a.swing;
    rig.fovKick = 0;
    rig.rollKick = 0;
    world.parallax = lerp(a.parallax ?? 1, b.parallax ?? 1, e);
    world.flowerOpacity = lerp(a.flowerOpacity ?? 1, b.flowerOpacity ?? 1, e);
    world.flowerJelly = lerp(a.flower === 'cosmosBell' ? 1 : 0, b.flower === 'cosmosBell' ? 1 : 0, e);

    // Creatures: transforms and shapes follow the dive.
    this.place(this.flower.points, a.flowerAt, b.flowerAt, e);
    this.place(this.jelly.points, a.jellyAt, b.jellyAt, e);
    const morph = this.intro.morph;
    const flowerA = this.flower.forms[a.flower];
    const flowerB = this.flower.forms[b.flower];
    this.flower.setPair(flowerA, flowerB, e);
    this.jelly.setPair(this.jelly.forms[a.jelly], this.jelly.forms[b.jelly], e);
    world.jellyDeform = 1;
    world.jellyIgnite = this.intro.ignite;
    world.ringIgnite = this.intro.ring;
    const focus = pos.distanceTo(look) * world.aspectFit;
    this.flower.render.uFocus.value = focus;
    this.jelly.render.uFocus.value = focus;

    // Works: the panels around the flower. The visited one lights up.
    const inAutumn = (station) => station.id === 'autumn' || station.id === 'works';
    const weight = (inAutumn(a) ? 1 - e : 0) + (inAutumn(b) ? e : 0);
    let workFocus = -10;
    if (a.work !== undefined && b.work !== undefined) workFocus = a.work + e;
    else if (b.work !== undefined) workFocus = e > 0.5 ? b.work : -10;
    else if (a.work !== undefined) workFocus = e < 0.5 ? a.work : -10;
    if (weight > 0.005) {
      const near = Math.round(Math.max(0, workFocus));
      this.playOnly(workFocus < 0 ? [] : [near, Math.min(WORKS.length - 1, near + 1)].filter((v, i, list) => list.indexOf(v) === i));
      this.textures = WORKS.map((_, index) => this.textureFor(index));
    } else {
      this.playOnly([]);
    }
    world.workPanels.update({
      weight: weight * this.intro.reveal,
      focus: workFocus,
      speed: betweenWorks ? travel : 0,
      textures: this.textures ?? [],
      accent: this.tmp.accent,
      dt: 1 / 60,
    });
    this.flower.sim.uScatter.value = segmentScatter;
    const nearest = STATIONS[Math.round(position)];
    if (nearest.work !== undefined) this.setWorkInfo(nearest.work);

    // Water, drift, light.
    const sa = SEASONS[a.season];
    const sb = SEASONS[b.season];
    const ca = this.colors[a.season];
    const cb = this.colors[b.season];
    rig.depth = lerp(1, lerp(sa.water, sb.water, e), this.intro.light);
    world.abyss.waterMaterial.uniforms.uTint.value.copy(ca.tint).lerp(cb.tint, e);
    const drift = world.environment.drift;
    drift.uPetal.value = lerp(sa.drift.petal, sb.drift.petal, e);
    drift.uLeaf.value = lerp(sa.drift.leaf ?? 0, sb.drift.leaf ?? 0, e);
    drift.uFirefly.value = lerp(sa.drift.firefly ?? 0, sb.drift.firefly ?? 0, e);
    drift.uFall.value = lerp(sa.drift.fall, sb.drift.fall, e);
    drift.uSway.value = lerp(sa.drift.sway, sb.drift.sway, e);
    drift.uOpacity.value = lerp(sa.drift.opacity, sb.drift.opacity, e) * this.intro.reveal;
    drift.uColorA.value.copy(ca.a).lerp(cb.a, e);
    drift.uColorB.value.copy(ca.b).lerp(cb.b, e);
    world.fx.bloom = lerp(sa.bloom, sb.bloom, e);
    world.fx.threshold = lerp(sa.threshold, sb.threshold, e);
    world.fx.travel = position * 6;
    this.tmp.accent.copy(ca.accent).lerp(cb.accent, e);
    document.documentElement.style.setProperty('--accent', `#${this.tmp.accent.getHexString()}`);

    // How many moon jellies drift around: more in spring and summer, few in winter.
    world.schoolCount = Math.round(lerp(sa.school, sb.school, e) * this.intro.reveal);
    // …and never drift across the text: the reading area of the nearer scene.
    world.schoolClear = (e < 0.5 ? a : b).clear;

    this.applyPanels(position);
    this.applyHud(position, lerp(a.depth, b.depth, e));
  }

  warpDom(strength, position) {
    const panel = this.panelById.works;
    if (!panel) return;
    if (!this.worksWarp) {
      this.worksWarp = document.querySelector('[data-works-warp]');
      this.worksRipple = document.querySelector('[data-works-ripple]');
    }
    const on = strength > 0.02;
    if (panel.classList.contains('is-travelling') !== on) panel.classList.toggle('is-travelling', on);
    if (!on || !this.worksWarp) return;
    this.worksWarp.setAttribute('scale', (strength * 46).toFixed(1));
    // the ripple drifts with the travel so the warp flows rather than sits
    const f = 0.006 + Math.sin(position * 3.1) * 0.0015;
    this.worksRipple.setAttribute('baseFrequency', `${f.toFixed(4)} ${(f * 3.6).toFixed(4)}`);
  }

  place(points, from, to, e) {
    points.position.set(lerp(from.x, to.x, e), lerp(from.y, to.y, e), lerp(from.z, to.z, e));
    points.scale.setScalar(lerp(from.s, to.s, e));
    points.rotation.set(lerp(from.rx, to.rx, e), lerp(from.ry, to.ry, e), lerp(from.rz, to.rz, e));
  }

  // Text belongs to its station: it is fully present only at rest there, and
  // drifts through as the camera passes, each layer at its own rate.
  applyPanels(position) {
    const reveal = this.intro.reveal;
    this.panels.forEach((panel) => {
      let best = Infinity;
      let offset = 0;
      STATIONS.forEach((station, index) => {
        if (station.panel !== panel.dataset.panel) return;
        const distance = position - index;
        if (Math.abs(distance) < Math.abs(best)) best = distance;
      });
      // Works holds one panel across six stations: measure from the run.
      if (panel.dataset.panel === 'works') {
        const first = this.stationOf('works', 0);
        const last = this.stationOf('works', WORKS.length - 1);
        best = position < first ? position - first : position > last ? position - last : 0;
      }
      offset = best;
      const weight = (1 - THREE.MathUtils.smoothstep(Math.abs(offset), 0.12, 0.4)) * (panel.dataset.panel === 'hero' ? reveal : 1);
      const visible = weight > 0.01;
      if (panel.style.visibility !== (visible ? 'visible' : 'hidden')) panel.style.visibility = visible ? 'visible' : 'hidden';
      panel.style.opacity = weight.toFixed(3);
      panel.style.setProperty('--drift', offset.toFixed(4));
      this.reveal.track(panel, weight);
      const active = weight > 0.6;
      if (panel.inert === active) {
        panel.inert = !active;
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      }
    });
  }

  applyHud(position, depth) {
    const nearestIndex = Math.round(position);
    const nearest = STATIONS[nearestIndex];
    if (this.announced !== nearestIndex && this.announcer && Math.abs(position - nearestIndex) < 0.05) {
      this.announced = nearestIndex;
      const names = { hero: 'トップ', about: 'About', services: 'Services', autumn: 'Works', contact: 'Contact', finale: 'フッター' };
      const work = nearest.work !== undefined ? WORKS[nearest.work] : null;
      this.announcer.textContent = work ? `Works ${nearest.work + 1} / ${WORKS.length}：${work.nameJa ?? work.name}` : names[nearest.id] ?? '';
    }
    const season = SEASON_ORDER.indexOf(nearest.season);
    const finale = nearest.id === 'finale';
    this.hud.seasons.forEach((element, index) => element.toggleAttribute('aria-current', !finale && index === season));
    if (this.hud.depth) {
      const text = Math.round(depth).toLocaleString('en-US');
      if (this.hud.depth.textContent !== text) this.hud.depth.textContent = text;
    }
    this.hud.root?.style.setProperty('--progress', (position / (this.count - 1)).toFixed(4));
    this.navLinks.forEach((link) => {
      const [id] = link.dataset.go.split(':');
      const on = id === nearest.panel || (id === 'works' && nearest.panel === 'autumn');
      link.toggleAttribute('aria-current', on);
    });
    if (finale && !this.nameRevealed) {
      this.nameRevealed = true;
      const proxy = { v: 0 };
      gsap.to(proxy, { v: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: () => this.redaction?.setResolve(proxy.v) });
    }
  }

  // ------------------------------------------------------------ opening

  introPlay() {
    const world = this.world;
    const tl = gsap.timeline({ onComplete: () => { this.busy = false; } });
    if (this.reducedMotion) {
      Object.assign(this.intro, { k: 0, reveal: 1, light: 1, ignite: 1, ring: 1 });
      for (const system of [this.flower, this.jelly]) {
        system.sim.uSpring.value = 18;
        system.sim.uNoise.value = 0.05;
      }
      this.busy = false;
      return tl;
    }
    // The swarms gather out of falling petals while the camera settles in.
    // 1. darkness: only the faint outline of the colossal medusa
    // 2. ignition: light runs from the bell's rim up the dome and down the
    //    tentacles while the camera rises from the deep to beneath it
    // 3. dawn: the black water brightens, light reaches down from the surface
    // 4. the year begins: the ring lights spring → summer → autumn → winter
    // 5. the title surfaces; the navigation arrives last
    tl.fromTo(this.flower.sim.uSpring, { value: 0.2 }, { value: 18, duration: 2.6, ease: 'power2.inOut' }, 0);
    tl.fromTo(this.flower.sim.uNoise, { value: 1.6 }, { value: 0.05, duration: 2.8, ease: 'power2.inOut' }, 0);
    tl.to(this.intro, { k: 0, duration: 5.2, ease: 'power3.inOut' }, 0);
    tl.to(this.intro, { ignite: 1, duration: 2.4, ease: 'power2.inOut' }, 0.4);
    tl.to(this.intro, { light: 1, duration: 2.4, ease: 'power1.inOut' }, 1.5);
    tl.to(this.intro, { ring: 1, duration: 1.9, ease: 'power2.inOut' }, 2.4);
    tl.to(this.intro, { reveal: 1, duration: 1.2, ease: 'power1.inOut' }, 3.6);
    tl.call(() => document.body.classList.remove('is-loading'), null, 4.4);
    tl.set(this, { busy: false }, 4.2);
    return tl;
  }
}
