import * as THREE from 'three';

export class LoadingTransitionOverlay {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uFrame: { value: this.target.texture },
        uOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uFrame;
        uniform float uOpacity;
        void main() {
          vec3 color = texture2D(uFrame, vUv).rgb;
          gl_FragColor = vec4(color, uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  resize(width, height, pixelRatio) {
    const ratio = Math.min(pixelRatio, 1.5);
    this.target.setSize(
      Math.max(2, Math.round(width * ratio)),
      Math.max(2, Math.round(height * ratio)),
    );
  }

  capture(scene, camera) {
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear(true, true, true);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(previousTarget);
  }

  render(opacity) {
    if (opacity <= 0.001) return;
    this.material.uniforms.uOpacity.value = opacity;
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = autoClear;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.target.dispose();
  }
}
