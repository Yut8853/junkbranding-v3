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

    this.earthTexture = new THREE.TextureLoader().load(
      '/textures/earth-blue-marble.png',
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

    this.visible = false;
    this.frameId = 0;
    this.startedAt = 0;
    this.pointerTarget = new THREE.Vector2(0.5, 0.5);
    this.pointer = new THREE.Vector2(0.5, 0.5);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.render = this.render.bind(this);
    this.hide = this.hide.bind(this);
    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('keydown', this.handleKeyDown);
    this.handleResize();
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.startedAt = performance.now();
    this.root.setAttribute('data-visible', '');
    this.root.setAttribute('aria-hidden', 'false');
    this.frameId = requestAnimationFrame(this.render);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.surfaceContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  hide(returnToContact = true) {
    if (!this.visible) return;
    this.visible = false;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.root.removeAttribute('data-visible');
    this.root.setAttribute('aria-hidden', 'true');
    if (returnToContact !== false) {
      const stage = document.querySelector('[data-flower-stage]');
      if (stage instanceof HTMLElement) {
        requestAnimationFrame(() => {
          const targetTop = stage.offsetTop + stage.offsetHeight - window.innerHeight;
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        });
      }
    }
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
    if (event.key === 'Escape' && this.visible) this.hide();
  }

  render(now) {
    if (!this.visible) return;
    const elapsed = (now - this.startedAt) / 1000;
    this.pointer.lerp(this.pointerTarget, 0.035);
    this.earthGroup.rotation.x = 0.08 + (this.pointer.y - 0.5) * 0.09;
    this.earthGroup.rotation.z = -0.055 + (this.pointer.x - 0.5) * 0.035;
    this.surface.rotation.y = -1.42 + elapsed * 0.012 + (this.pointer.x - 0.5) * 0.11;
    this.clouds.rotation.y = -1.34 + elapsed * 0.016;
    this.cloudMaterial.uniforms.uTime.value = elapsed;
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  }

  dispose() {
    this.hide(false);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('keydown', this.handleKeyDown);
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
