import * as THREE from 'three';
import vertexShader from './shaders/contact-fluid.vert.glsl?raw';
import velocityFragmentShader from './shaders/contact-fluid-velocity.frag.glsl?raw';
import maskFragmentShader from './shaders/contact-fluid-mask.frag.glsl?raw';
import compositeFragmentShader from './shaders/contact-fluid-composite.frag.glsl?raw';

export class ContactFluidReveal {
  constructor(canvas, backgroundCanvas = null) {
    this.canvas = canvas;
    this.backgroundCanvas = backgroundCanvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // The foreground is already the tone-mapped output of the main renderer.
    // Avoid applying a second tone curve when passing that frame through.
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.titleCanvas = document.createElement('canvas');
    this.titleTexture = new THREE.CanvasTexture(this.titleCanvas);
    this.titleTexture.colorSpace = THREE.SRGBColorSpace;
    this.titleTexture.minFilter = THREE.LinearFilter;
    this.titleTexture.magFilter = THREE.LinearFilter;
    this.sceneTexture = backgroundCanvas instanceof HTMLCanvasElement
      ? new THREE.CanvasTexture(backgroundCanvas)
      : null;
    if (this.sceneTexture) {
      this.sceneTexture.colorSpace = THREE.SRGBColorSpace;
      this.sceneTexture.minFilter = THREE.LinearFilter;
      this.sceneTexture.magFilter = THREE.LinearFilter;
      this.sceneTexture.generateMipmaps = false;
    }

    this.pointer = new THREE.Vector2(0.5, 0.5);
    this.pointerPrevious = new THREE.Vector2(0.5, 0.5);
    this.pointerDelta = new THREE.Vector2();
    this.pointerEnergy = 0;
    this.progress = 0;
    this.active = false;
    this.interactive = false;
    this.wasActive = false;
    this.wasInteractive = false;
    this.aspect = 1;
    this.simulationWidth = 1;
    this.simulationHeight = 1;

    this.velocityMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: velocityFragmentShader,
      uniforms: {
        uVelocity: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: this.pointer },
        uPointerPrevious: { value: this.pointerPrevious },
        uPointerDelta: { value: this.pointerDelta },
        uPointerEnergy: { value: 0 },
        uDelta: { value: 1 / 60 },
        uAspect: { value: 1 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    this.maskMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: maskFragmentShader,
      uniforms: {
        uMask: { value: null },
        uVelocity: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: this.pointer },
        uPointerPrevious: { value: this.pointerPrevious },
        uPointerEnergy: { value: 0 },
        uDelta: { value: 1 / 60 },
        uAspect: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: compositeFragmentShader,
      uniforms: {
        uMask: { value: null },
        uVelocity: { value: null },
        uTitle: { value: this.titleTexture },
        uScene: { value: this.sceneTexture },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uAspect: { value: 1 },
        uSectionOffset: { value: -1.15 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.quad = new THREE.Mesh(this.geometry, this.compositeMaterial);
    this.scene.add(this.quad);

    this.handlePointerMove = this.handlePointerMove.bind(this);
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
  }

  createRenderTarget(width, height) {
    return new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  recreateSimulationTargets(width, height) {
    this.velocityRead?.dispose();
    this.velocityWrite?.dispose();
    this.maskRead?.dispose();
    this.maskWrite?.dispose();

    this.velocityRead = this.createRenderTarget(width, height);
    this.velocityWrite = this.createRenderTarget(width, height);
    this.maskRead = this.createRenderTarget(width, height);
    this.maskWrite = this.createRenderTarget(width, height);
    this.clearSimulation();
  }

  clearSimulation() {
    if (!this.velocityRead || !this.maskRead) return;
    const previousTarget = this.renderer.getRenderTarget();
    for (const target of [
      this.velocityRead,
      this.velocityWrite,
      this.maskRead,
      this.maskWrite,
    ]) {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
    }
    this.renderer.setRenderTarget(previousTarget);
  }

  clearOutput() {
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.setRenderTarget(previousTarget);
  }

  setProgress(progress) {
    this.progress = progress;
    // Keep rendering the foreground while CONTACT travels into view, but only
    // let the centered view accumulate an interactive fluid mask.
    this.active = progress >= 1.72;
    this.interactive = progress >= 1.86;
    this.compositeMaterial.uniforms.uOpacity.value = this.active ? 1 : 0;
    const travel = smoothstep(1.73, 1.86, progress);
    this.compositeMaterial.uniforms.uSectionOffset.value = THREE.MathUtils.lerp(
      -1.15,
      0,
      travel,
    );

    if (this.wasInteractive && !this.interactive) {
      this.pointerEnergy = 0;
    }
    if (this.wasActive && !this.active) {
      this.clearOutput();
      this.pointerEnergy = 0;
    }
    this.wasActive = this.active;
    this.wasInteractive = this.interactive;
  }

  handlePointerMove(event) {
    if (!this.active || !this.interactive) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (
      event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom
    ) return;

    const nextX = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const nextY = 1 - (event.clientY - bounds.top) / Math.max(1, bounds.height);
    const next = new THREE.Vector2(nextX, nextY);
    this.pointerPrevious.copy(this.pointer);
    this.pointerDelta.copy(next).sub(this.pointer);
    if (this.pointerDelta.length() > 0.09) {
      this.pointerDelta.setLength(0.09);
    }
    this.pointer.copy(next);
    this.pointerEnergy = Math.min(1, 0.42 + this.pointerDelta.length() * 13);
  }

  resize(width, height, pixelRatio) {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const renderRatio = Math.min(pixelRatio, 1.5);
    this.aspect = safeWidth / safeHeight;
    this.renderer.setPixelRatio(renderRatio);
    this.renderer.setSize(safeWidth, safeHeight, false);

    const simulationHeight = safeWidth < 720 ? 192 : 256;
    const simulationWidth = Math.max(
      192,
      Math.round(simulationHeight * this.aspect),
    );
    if (
      simulationWidth !== this.simulationWidth
      || simulationHeight !== this.simulationHeight
    ) {
      this.simulationWidth = simulationWidth;
      this.simulationHeight = simulationHeight;
      this.recreateSimulationTargets(simulationWidth, simulationHeight);
    }

    const texel = new THREE.Vector2(1 / simulationWidth, 1 / simulationHeight);
    this.velocityMaterial.uniforms.uTexel.value.copy(texel);
    this.velocityMaterial.uniforms.uAspect.value = this.aspect;
    this.maskMaterial.uniforms.uTexel.value.copy(texel);
    this.maskMaterial.uniforms.uAspect.value = this.aspect;
    this.compositeMaterial.uniforms.uAspect.value = this.aspect;
    this.redrawTitle(safeWidth, safeHeight, renderRatio);
  }

  redrawTitle(width, height, pixelRatio) {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    this.titleCanvas.width = canvasWidth;
    this.titleCanvas.height = canvasHeight;
    const context = this.titleCanvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    let fontSize = Math.min(canvasHeight * 0.29, canvasWidth * 0.2);
    context.font = `700 ${fontSize}px "Syne", sans-serif`;
    const measured = context.measureText('CONTACT').width;
    fontSize *= Math.min(1, canvasWidth * 0.92 / Math.max(1, measured));
    context.font = `700 ${fontSize}px "Syne", sans-serif`;
    context.fillText('CONTACT', canvasWidth * 0.5, canvasHeight * 0.5);
    this.titleTexture.needsUpdate = true;
  }

  update(elapsed, delta) {
    if (!this.active || !this.velocityRead || !this.maskRead) return;

    if (this.sceneTexture) this.sceneTexture.needsUpdate = true;

    const safeDelta = THREE.MathUtils.clamp(delta, 1 / 120, 1 / 24);
    this.velocityMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.velocityMaterial.uniforms.uPointerEnergy.value = this.pointerEnergy;
    this.velocityMaterial.uniforms.uDelta.value = safeDelta;
    this.velocityMaterial.uniforms.uTime.value = elapsed;
    this.renderPass(this.velocityMaterial, this.velocityWrite);
    [this.velocityRead, this.velocityWrite] = [this.velocityWrite, this.velocityRead];

    this.maskMaterial.uniforms.uMask.value = this.maskRead.texture;
    this.maskMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.maskMaterial.uniforms.uPointerEnergy.value = this.pointerEnergy;
    this.maskMaterial.uniforms.uDelta.value = safeDelta;
    this.renderPass(this.maskMaterial, this.maskWrite);
    [this.maskRead, this.maskWrite] = [this.maskWrite, this.maskRead];

    this.compositeMaterial.uniforms.uMask.value = this.maskRead.texture;
    this.compositeMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.compositeMaterial.uniforms.uTime.value = elapsed;
    this.renderPass(this.compositeMaterial, null);

    this.pointerEnergy *= Math.pow(0.28, safeDelta);
    this.pointerPrevious.lerp(this.pointer, 0.72);
    this.pointerDelta.multiplyScalar(0.48);
  }

  renderPass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('pointermove', this.handlePointerMove);
    this.scene.remove(this.quad);
    this.geometry.dispose();
    this.velocityMaterial.dispose();
    this.maskMaterial.dispose();
    this.compositeMaterial.dispose();
    this.titleTexture.dispose();
    this.sceneTexture?.dispose();
    this.velocityRead?.dispose();
    this.velocityWrite?.dispose();
    this.maskRead?.dispose();
    this.maskWrite?.dispose();
    this.renderer.dispose();
  }
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}
