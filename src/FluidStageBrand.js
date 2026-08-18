import * as THREE from 'three';
import { FluidSimulation } from 'three-fluid-fx';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform sampler2D uText;
  uniform sampler2D uFluid;
  uniform vec4 uFluidRect;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 fluidUv = uFluidRect.xy + vUv * uFluidRect.zw;
    vec3 fluid = texture2D(uFluid, clamp(fluidUv, 0.0, 1.0)).rgb;
    vec2 velocity = fluid.rg;
    float density = clamp(fluid.b, 0.0, 1.0);
    float speed = max(length(velocity), 0.0001);
    vec2 direction = velocity / speed;
    vec2 distortion = velocity * 0.00075 + direction * pow(density, 1.2) * 0.045;

    float red = texture2D(uText, clamp(vUv - distortion * 1.35, 0.0, 1.0)).a;
    float green = texture2D(uText, clamp(vUv - distortion, 0.0, 1.0)).a;
    float blue = texture2D(uText, clamp(vUv - distortion * 0.58, 0.0, 1.0)).a;
    float alpha = max(red, max(green, blue));
    if (alpha < 0.002 || uOpacity < 0.002) discard;

    vec3 color = vec3(red, green, blue);
    color = mix(vec3(0.82, 0.96, 1.0), color, 0.72);
    color += vec3(1.0, 0.06, 0.48) * density * 0.34;
    color += vec3(0.08, 0.86, 1.0) * speed * 0.018;
    gl_FragColor = vec4(min(color, vec3(1.0)), alpha * uOpacity);
  }
`;

export class FluidStageBrand {
  constructor({ elements, container }) {
    this.elements = elements.filter((element) => element instanceof HTMLElement);
    if (!this.elements.length || !(container instanceof HTMLElement)) {
      throw new Error('FluidStageBrand requires source elements and a container.');
    }
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fluid-stage-brand-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.container.append(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.items = this.elements.map((element) => this.createItem(element));

    const compact = window.matchMedia('(max-width: 720px)').matches;
    this.fluid = new FluidSimulation(this.renderer, {
      profile: compact ? 'performance' : 'balanced',
      splatRadius: compact ? 0.0022 : 0.0015,
      splatForce: 6,
      pressureIterations: compact ? 6 : 10,
      curlStrength: 0.2,
      velocityDissipation: 0.99,
      densityDissipation: 0.95,
      bfecc: true,
      reflectWalls: false,
    });

    this.lastPointer = null;
    this.lastTime = performance.now();
    this.frameId = 0;
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.render = this.render.bind(this);
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();
    this.items.forEach((item) => this.syncText(item, item.element.getBoundingClientRect()));
    this.frameId = requestAnimationFrame(this.render);
  }

  createItem(element) {
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1;
    textCanvas.height = 1;
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.magFilter = THREE.LinearFilter;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uText: { value: textTexture },
        uFluid: { value: null },
        uFluidRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    this.scene.add(mesh);
    return { element, textCanvas, textTexture, material, mesh, lastSignature: '' };
  }

  handlePointerMove(event) {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const previous = this.lastPointer ?? { x: event.clientX, y: event.clientY };
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    if (Math.hypot(dx, dy) < 0.5) return;
    this.fluid.addSplat(
      event.clientX / width,
      1 - event.clientY / height,
      dx,
      -dy,
      { color: [0.72, 0.9, 1] },
    );
  }

  handleResize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.right = width;
    this.camera.top = height;
    this.camera.updateProjectionMatrix();
    this.fluid.resize(width, height);
  }

  syncText(item, rect) {
    const text = item.element.textContent?.trim() || '';
    const style = getComputedStyle(item.element);
    const isWorksLetter = Boolean(item.element.closest('[data-fluid-works-title]'));
    const signature = [
      text,
      Math.round(rect.width * 10),
      Math.round(rect.height * 10),
      style.fontFamily,
      style.fontSize,
      style.fontWeight,
      style.letterSpacing,
    ].join('|');
    if (signature === item.lastSignature || rect.width <= 0 || rect.height <= 0) return;
    item.lastSignature = signature;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    item.textCanvas.width = Math.max(1, Math.ceil(rect.width * ratio));
    item.textCanvas.height = Math.max(1, Math.ceil(rect.height * ratio));
    const context = item.textCanvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = '#fff';
    const textAlign = style.textAlign === 'right' || style.textAlign === 'end'
      ? 'right'
      : style.textAlign === 'center'
        ? 'center'
        : 'left';
    context.textAlign = textAlign;
    context.textBaseline = 'alphabetic';
    const fontSize = Number.parseFloat(style.fontSize) || rect.height;
    context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing;
    let metrics = context.measureText(text);
    if (isWorksLetter) {
      const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
      const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const fittedSize = fontSize * (rect.width * 0.72 / Math.max(1, inkWidth, inkHeight));
      context.font = `${style.fontWeight} ${fittedSize}px ${style.fontFamily}`;
      metrics = context.measureText(text);
    }
    const baselineMetrics = context.measureText('Hg');
    const ascent = baselineMetrics.actualBoundingBoxAscent || fontSize * 0.78;
    const descent = baselineMetrics.actualBoundingBoxDescent || fontSize * 0.18;
    const inkCenterOffset = (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) * 0.5;
    const baseline = rect.height * 0.5 + (ascent - descent) * 0.5;
    const textX = textAlign === 'right'
      ? rect.width
      : textAlign === 'center'
        ? rect.width * 0.5 - (isWorksLetter ? inkCenterOffset : 0)
        : 0;
    context.fillText(text, textX, baseline);
    item.textTexture.needsUpdate = true;
  }

  syncLayout(item) {
    const rect = item.element.getBoundingClientRect();
    this.syncText(item, rect);
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const isWorksLetter = Boolean(item.element.closest('[data-fluid-works-title]'));
    item.mesh.position.set(
      isWorksLetter ? width * 0.5 : rect.left + rect.width * 0.5,
      height - rect.top - rect.height * 0.5,
      0,
    );
    item.mesh.scale.set(rect.width, Math.max(rect.height, 1), 1);
    item.mesh.rotation.z = isWorksLetter ? -Math.PI * 0.5 : 0;
    item.material.uniforms.uFluidRect.value.set(
      rect.left / width,
      (height - rect.bottom) / height,
      rect.width / width,
      rect.height / height,
    );
    const opacity = getFluidTextOpacity(item.element);
    item.material.uniforms.uOpacity.value = opacity;
    item.element.classList.toggle('fluid-text-source', opacity > 0.001);
  }

  render(now) {
    const delta = Math.min(Math.max((now - this.lastTime) / 1000, 1 / 120), 1 / 30);
    this.lastTime = now;
    this.items.forEach((item) => {
      this.syncLayout(item);
    });
    this.fluid.step(delta);
    this.items.forEach((item) => {
      item.material.uniforms.uFluid.value = this.fluid.densityTexture;
    });
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('resize', this.handleResize);
    this.items.forEach((item) => {
      item.element.classList.remove('fluid-text-source');
      this.scene.remove(item.mesh);
      item.material.dispose();
      item.textTexture.dispose();
    });
    this.items.length = 0;
    this.fluid.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

function getFluidTextOpacity(element) {
  if (element.matches('[data-stage-brand]')) {
    return readCustomOpacity(element, '--stage-brand-opacity');
  }
  const worksTitle = element.closest('[data-fluid-works-title]');
  if (worksTitle instanceof HTMLElement) {
    return readCustomOpacity(worksTitle, '--fluid-works-opacity');
  }
  const capabilities = element.closest('[data-capabilities-section]');
  if (capabilities instanceof HTMLElement) {
    const bOffset = readCustomOpacity(capabilities, '--capabilities-b-offset');
    return Math.abs(bOffset) < 1.5
      ? readCustomOpacity(capabilities, '--capabilities-opacity')
      : 0;
  }
  const concept = element.closest('[data-concept-copy]');
  if (concept instanceof HTMLElement) {
    return readCustomOpacity(concept, '--concept-copy-opacity');
  }
  return 1;
}

function readCustomOpacity(element, property) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
  return Number.isFinite(value) ? value : 1;
}
