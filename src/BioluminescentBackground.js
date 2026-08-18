import * as THREE from 'three';
import backgroundVertexShader from './shaders/background.vert.glsl?raw';
import backgroundFragmentShader from './shaders/background.frag.glsl?raw';

const BACKGROUND_SCALE = 0.5;
const DISTANT_CREATURE_SCALE = 0.28;
const MAX_BACKGROUND_WIDTH = 1100;

export class BioluminescentBackground {
  constructor(scene) {
    this.hostScene = scene;
    this.scene = new THREE.Scene();
    this.distantScene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uLoadingReveal: { value: 1 },
        uAspect: { value: 1 },
        uDistantTexture: { value: null },
        uDistantTexel: { value: new THREE.Vector2(0.002, 0.002) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.geometry, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.target.texture.generateMipmaps = false;

    this.distantTarget = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.distantTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.distantTarget.texture.generateMipmaps = false;
    this.material.uniforms.uDistantTexture.value = this.distantTarget.texture;

    this.previousClearColor = new THREE.Color();
    this.displayProgress = 0;
    this.hostScene.background = this.target.texture;
  }

  resize(width, height, pixelRatio) {
    const requestedWidth = Math.max(2, Math.floor(width * pixelRatio * BACKGROUND_SCALE));
    const scaleLimit = Math.min(1, MAX_BACKGROUND_WIDTH / requestedWidth);
    const renderWidth = Math.max(2, Math.floor(requestedWidth * scaleLimit));
    const renderHeight = Math.max(
      2,
      Math.floor(height * pixelRatio * BACKGROUND_SCALE * scaleLimit),
    );
    this.target.setSize(renderWidth, renderHeight);

    const distantWidth = Math.max(
      2,
      Math.floor(width * pixelRatio * DISTANT_CREATURE_SCALE * scaleLimit),
    );
    const distantHeight = Math.max(
      2,
      Math.floor(height * pixelRatio * DISTANT_CREATURE_SCALE * scaleLimit),
    );
    this.distantTarget.setSize(distantWidth, distantHeight);
    this.material.uniforms.uDistantTexel.value.set(
      1 / distantWidth,
      1 / distantHeight,
    );
    this.material.uniforms.uAspect.value = width / Math.max(1, height);
  }

  update(elapsed, progress, delta) {
    const response = 1 - Math.exp(-2.4 * Math.min(delta, 0.05));
    this.displayProgress = THREE.MathUtils.lerp(
      this.displayProgress,
      progress,
      response,
    );
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uProgress.value = this.displayProgress;
  }

  setLoadingReveal(value) {
    this.material.uniforms.uLoadingReveal.value = THREE.MathUtils.clamp(value, 0, 1);
  }

  render(renderer, perspectiveCamera) {
    const previousTarget = renderer.getRenderTarget();
    const previousClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.previousClearColor);

    renderer.setRenderTarget(this.distantTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.distantScene, perspectiveCamera);

    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(this.previousClearColor, previousClearAlpha);
  }

  dispose() {
    if (this.hostScene.background === this.target.texture) {
      this.hostScene.background = null;
    }
    this.scene.remove(this.quad);
    this.geometry.dispose();
    this.material.dispose();
    this.target.dispose();
    this.distantTarget.dispose();
  }
}
