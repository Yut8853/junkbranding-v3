import * as THREE from 'three';
import cloudVertexShader from './shaders/secret-earth-clouds.vert.glsl?raw';
import cloudFragmentShader from './shaders/secret-earth-clouds.frag.glsl?raw';
import atmosphereVertexShader from './shaders/secret-earth-atmosphere.vert.glsl?raw';
import atmosphereFragmentShader from './shaders/secret-earth-atmosphere.frag.glsl?raw';

const EARTH_RADIUS = 2.55;

export class SecretEarthPage {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('[data-secret-earth-canvas]');
    this.surfaceContainer = root.querySelector('.secret-earth__surface');
    if (!(this.canvas instanceof HTMLCanvasElement)) {
      throw new Error('Secret Earth canvas was not found.');
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    this.camera.position.set(0, 0, 7.2);

    this.earthGroup = new THREE.Group();
    this.earthGroup.position.y = -2.75;
    this.scene.add(this.earthGroup);

    this.surfaceGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 72);
    this.surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b5278,
      roughness: 0.94,
      metalness: 0,
    });
    this.surface = new THREE.Mesh(this.surfaceGeometry, this.surfaceMaterial);
    this.surface.rotation.y = -1.42;
    this.earthGroup.add(this.surface);

    this.cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 96, 72);
    this.cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.clouds = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
    this.clouds.rotation.y = -1.34;
    this.earthGroup.add(this.clouds);

    this.atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.045, 96, 72);
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.atmosphere = new THREE.Mesh(this.atmosphereGeometry, this.atmosphereMaterial);
    this.earthGroup.add(this.atmosphere);

    this.scene.add(new THREE.HemisphereLight(0x8fc9ff, 0x001018, 0.42));
    const sunlight = new THREE.DirectionalLight(0xffffff, 3.4);
    sunlight.position.set(-4.2, 4.6, 7.5);
    this.scene.add(sunlight);

    // The Earth is only reachable after a successful contact submission, so
    // its texture is requested on first reveal instead of during page load.
    this.earthTexture = null;
    this.visible = false;
    this.frameId = 0;
    this.startedAt = 0;
    this.last = 0;
    this.pointerTarget = new THREE.Vector2(0.5, 0.5);
    this.pointer = new THREE.Vector2(0.5, 0.5);
    this.closeButton = root.querySelector('[data-earth-close]');
    this.title = root.querySelector('#earth-title');
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.render = this.render.bind(this);
    this.hide = this.hide.bind(this);
    this.closeButton?.addEventListener('click', () => this.hide());
    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('deviceorientation', (event) => {
      if (!this.visible || event.gamma == null) return;
      this.pointerTarget.set(0.5 + Math.max(-1, Math.min(1, event.gamma / 40)) * 0.5, 0.5 - Math.max(-1, Math.min(1, (event.beta - 50) / 40)) * 0.5);
    });
    document.addEventListener('keydown', this.handleKeyDown);
    this.handleResize();
  }

  loadEarthTexture() {
    if (this.earthTexture) return;
    this.earthTexture = new THREE.TextureLoader().load(
      '/textures/earth-blue-marble.webp',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        this.surfaceMaterial.map = texture;
        this.surfaceMaterial.color.set(0xffffff);
        this.surfaceMaterial.needsUpdate = true;
      },
    );
  }

  // origin: where the circle opens from (the send button), onClose: called
  // after the dialog has closed so the page can resume the sea.
  show({ origin = null, onClose = null, returnTo = null } = {}) {
    if (this.visible) return;
    this.loadEarthTexture();
    this.onClose = onClose;
    this.returnFocus = returnTo ?? document.activeElement;
    this.visible = true;
    this.startedAt = performance.now();
    this.last = this.startedAt;
    if (origin) {
      this.root.style.setProperty('--x', `${Math.round(origin.x)}px`);
      this.root.style.setProperty('--y', `${Math.round(origin.y)}px`);
    }
    this.root.hidden = false;
    // next frame: start the circle opening and the globe turning
    requestAnimationFrame(() => {
      this.root.setAttribute('data-open', '');
      this.title?.focus({ preventScroll: true });
    });
    this.frameId = requestAnimationFrame(this.render);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.root.removeAttribute('data-open');
    const done = () => {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.root.hidden = true;
      this.onClose?.();
      if (this.returnFocus instanceof HTMLElement) this.returnFocus.focus({ preventScroll: true });
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(done, reduced ? 0 : 1400);
  }

  handleResize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  handlePointerMove(event) {
    if (!this.visible) return;
    this.pointerTarget.set(
      event.clientX / Math.max(1, window.innerWidth),
      1 - event.clientY / Math.max(1, window.innerHeight),
    );
  }

  handleKeyDown(event) {
    if (!this.visible) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
      return;
    }
    // keep keyboard focus inside the dialog
    if (event.key === 'Tab') {
      const focusable = [this.title, this.closeButton].filter(Boolean);
      const index = focusable.indexOf(document.activeElement);
      event.preventDefault();
      const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
      next?.focus();
    }
  }

  render(now) {
    if (!this.root.hidden) this.frameId = requestAnimationFrame(this.render);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const elapsed = (now - this.startedAt) / 1000;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.pointer.lerp(this.pointerTarget, 1 - Math.exp(-dt * 2.5));
    // the globe rises into view, turns, and leans with the pointer
    const rise = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, elapsed / 2.4), 3);
    this.earthGroup.position.y = -2.75 - (1 - rise) * 2.2;
    this.earthGroup.rotation.x = 0.08 + (this.pointer.y - 0.5) * 0.22;
    this.earthGroup.rotation.z = -0.055 + (this.pointer.x - 0.5) * 0.08;
    const spin = reduced ? 0 : elapsed * 0.06;
    this.surface.rotation.y = -1.42 + spin + (this.pointer.x - 0.5) * 0.35;
    this.clouds.rotation.y = -1.34 + spin * 1.35 + (this.pointer.x - 0.5) * 0.35;
    this.cloudMaterial.uniforms.uTime.value = elapsed;
    this.camera.position.x = (this.pointer.x - 0.5) * 0.6;
    this.camera.lookAt(0, -0.35, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.visible = false;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.scene.remove(this.earthGroup);
    this.surfaceGeometry.dispose();
    this.surfaceMaterial.dispose();
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
    this.atmosphereGeometry.dispose();
    this.atmosphereMaterial.dispose();
    this.earthTexture?.dispose();
    this.renderer.dispose();
  }
}
