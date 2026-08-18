import * as THREE from 'three';

const fullscreenVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const gravityVertex = `
  varying vec2 vUv;
  uniform float uStretchY;
  uniform float uDistortion;
  uniform float uDirection;
  void main() {
    vUv = uv;
    vec3 p = position;
    vec2 centered = uv - 0.5;
    float axis = 1.0 - smoothstep(0.03, 0.42, abs(centered.x));
    float pull = axis * uStretchY;
    p.y *= 1.0 + pull * 0.52;
    p.x += centered.y * pull * 0.11 * uDirection;
    p.z += axis * uDistortion * 0.064;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const gravityFragment = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uGravity;
  uniform float uProgress;
  uniform float uStretchY;
  uniform float uDistortion;
  uniform float uLightColumn;
  uniform float uDirection;
  uniform float uAspect;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(19.19, 73.31))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= uAspect;
    float peak = pow(max(0.0, sin(clamp(uProgress, 0.0, 1.0) * 3.14159265)), 0.72);
    float reach = mix(0.15, 1.34, uStretchY);
    float softness = mix(0.07, 0.3, uStretchY);
    float vertical = 1.0 - smoothstep(reach, reach + softness, abs(p.y));
    float seed = 1.0 - smoothstep(0.0, 0.13, abs(p.y));
    float tips = exp(-pow((abs(p.y) - reach) / max(softness, 0.001), 2.0));
    float trace = smoothstep(0.0, reach, abs(p.y)) * vertical;
    float edge = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
    float flow = noise(vec2(p.x * 16.0 + uDirection * uTime * 0.08,
      p.y * mix(42.0, 13.0, uStretchY) - uTime * mix(0.22, 1.18, uStretchY) * uDirection));
    float bentX = p.x + (flow - 0.5) * 0.1 * uDistortion * vertical
      + p.y * 0.06 * uDistortion * uDirection * trace;
    float axis = exp(-abs(bentX) * mix(18.0, 7.0, uStretchY));
    float halo = exp(-abs(bentX) * mix(8.0, 2.6, uStretchY));
    float grain = smoothstep(0.48, 0.9, flow) * trace;
    float grown = axis * vertical * mix(seed, 1.0, uStretchY);
    float side = halo * grain * uStretchY;
    vec3 color = mix(vec3(0.2, 1.0, 0.68), vec3(1.0, 0.1, 0.54), smoothstep(-0.18, 0.18, bentX));
    color = mix(color, vec3(1.0), axis * 0.78);
    color *= uGravity * edge * uLightColumn * (grown * 1.3 + tips * 0.72 + side * 0.38);
    float alpha = clamp(uGravity * edge * (grown * 0.62 + tips * 0.42 + side * 0.22) * peak, 0.0, 0.72);
    gl_FragColor = vec4(color, alpha);
  }
`;

const compositeFragment = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSceneA;
  uniform sampler2D tSceneB;
  uniform float uProgress;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uDirection;
  uniform vec2 uResolution;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  vec2 pullUv(vec2 uv, float side) {
    float warped = uv.y + (noise(vec2(uv.x * 2.4, uTime * 0.08)) - 0.5) * 0.08;
    float boundary = smoothstep(0.08, 0.64, warped) * (1.0 - smoothstep(0.68, 1.0, warped));
    float band = pow(max(1.0 - abs(uv.y - 0.5) * 2.0, 0.0), 0.55);
    float n1 = noise(vec2(uv.x * 5.2, uv.y * 7.0 - uTime * 0.22));
    float n2 = noise(vec2(uv.x * 13.0 + uTime * 0.08, uv.y * 4.0));
    float force = (mix(n1, n2, 0.42) * 0.74 + band * 0.42) * boundary;
    float stretch = exp(-uIntensity * 22.0 * force);
    uv.y = (uv.y - 0.5) * stretch + 0.5 - uIntensity * force * 0.84 * side * uDirection;
    uv.x += (n1 - 0.5) * uIntensity * 0.04 * boundary;
    return clamp(uv, vec2(0.001), vec2(0.999));
  }
  vec3 blur9(sampler2D tex, vec2 uv, vec2 axis) {
    vec3 result = vec3(0.0); float total = 0.0;
    for (int i = -4; i <= 4; i++) {
      float x = float(i), weight = 1.0 - abs(x) / 5.0;
      result += texture2D(tex, uv + axis * x).rgb * weight;
      total += weight;
    }
    return result / total;
  }
  void main() {
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    float handoff = smoothstep(0.08, 0.92, uProgress);
    float peak = pow(max(0.0, sin(clamp(uProgress, 0.0, 1.0) * 3.14159265)), 0.72);
    vec2 uvA = pullUv(vUv, -1.0);
    vec2 uvB = pullUv(vUv, 1.0);
    vec2 blurAxis = vec2(0.0, texel.y * (6.0 + uIntensity * 30.0));
    vec3 a = blur9(tSceneA, uvA, blurAxis * uIntensity * 0.76);
    vec3 b = blur9(tSceneB, uvB, blurAxis * uIntensity * 0.92);
    float rows = floor(vUv.y * 54.0);
    float glitch = step(0.82 - uIntensity * 0.18, hash(vec2(rows, floor(uTime * 16.0)))) * uIntensity * peak;
    float split = uIntensity * (2.0 + peak * 5.8);
    vec2 shift = vec2(texel.x, texel.y * 0.35) * (7.0 + peak * 24.0) * uIntensity;
    a = vec3(texture2D(tSceneA, uvA + shift).r, a.g, texture2D(tSceneA, uvA - shift).b);
    b = vec3(texture2D(tSceneB, uvB + shift).r, b.g, texture2D(tSceneB, uvB - shift).b);
    vec3 color = mix(a, b, handoff);
    float center = 1.0 - smoothstep(0.0, 0.84, distance(vUv, vec2(0.5, 0.48)));
    float gravityGlow = pow(max(1.0 - abs(vUv.y - 0.5) * 2.0, 0.0), 2.2) * uIntensity;
    color += mix(vec3(0.0, 0.9, 0.55), vec3(1.0, 0.05, 0.48), vUv.x) * gravityGlow * 0.13;
    color += vec3(1.0) * pow(center, 2.4) * uIntensity * 0.1;
    color += vec3(0.25, 0.8, 1.0) * glitch * 0.12;
    color *= 1.0 + uIntensity * 0.2;
    color += (hash(vUv * uResolution + uTime * 19.0) - 0.5) * 0.018 * uIntensity;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class GravityTransitionEffect {
  constructor(renderer, scene, camera, reduced = false) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.reduced = reduced;
    this.progress = 0;
    this.intensity = 0;
    this.direction = 1;
    this.savedPosition = new THREE.Vector3();
    this.savedQuaternion = new THREE.Quaternion();
    this.targetA = createTarget();
    this.targetB = createTarget();

    this.gravityMaterial = new THREE.ShaderMaterial({
      vertexShader: gravityVertex,
      fragmentShader: gravityFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uGravity: { value: 0 }, uProgress: { value: 0 },
        uStretchY: { value: 0 }, uDistortion: { value: 0 }, uLightColumn: { value: 0 },
        uDirection: { value: 1 }, uAspect: { value: 1 },
      },
    });
    this.gravityGeometry = new THREE.PlaneGeometry(1, 1, 18, 42);
    this.gravityPlane = new THREE.Mesh(this.gravityGeometry, this.gravityMaterial);
    this.gravityPlane.renderOrder = 100;
    this.gravityPlane.frustumCulled = false;
    this.gravityPlane.visible = false;
    this.scene.add(this.gravityPlane);

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSceneA: { value: this.targetA.texture }, tSceneB: { value: this.targetB.texture },
        uProgress: { value: 0 }, uIntensity: { value: 0 }, uTime: { value: 0 },
        uDirection: { value: 1 }, uResolution: { value: new THREE.Vector2(1, 1) },
      },
    });
    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeGeometry = new THREE.PlaneGeometry(2, 2);
    this.compositeScene.add(new THREE.Mesh(this.compositeGeometry, this.compositeMaterial));
  }

  setProgress(sceneProgress, direction = 1) {
    this.progress = THREE.MathUtils.smoothstep(sceneProgress, 1.64, 1.84);
    const peak = Math.pow(Math.max(0, Math.sin(this.progress * Math.PI)), 0.72);
    this.intensity = this.reduced ? 0 : peak;
    this.direction = direction || 1;
  }

  resize(width, height, pixelRatio) {
    const ratio = Math.min(pixelRatio, 1.5);
    this.targetA.setSize(Math.max(2, width * ratio), Math.max(2, height * ratio));
    this.targetB.setSize(Math.max(2, width * ratio), Math.max(2, height * ratio));
    this.gravityMaterial.uniforms.uAspect.value = width / Math.max(1, height);
    this.compositeMaterial.uniforms.uResolution.value.set(width * ratio, height * ratio);
  }

  render(elapsed) {
    if (this.intensity <= 0.01) {
      this.gravityPlane.visible = false;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const strength = this.intensity;
    this.gravityPlane.visible = true;
    this.updateGravityPlane(1.15);
    this.gravityMaterial.uniforms.uTime.value = elapsed;
    this.gravityMaterial.uniforms.uGravity.value = strength;
    this.gravityMaterial.uniforms.uProgress.value = this.progress;
    this.gravityMaterial.uniforms.uStretchY.value = strength;
    this.gravityMaterial.uniforms.uDistortion.value = strength;
    this.gravityMaterial.uniforms.uLightColumn.value = strength;
    this.gravityMaterial.uniforms.uDirection.value = this.direction;

    this.savedPosition.copy(this.camera.position);
    this.savedQuaternion.copy(this.camera.quaternion);
    this.camera.position.y -= strength * 0.34;
    this.camera.position.z += strength * 1.04;
    this.renderTarget(this.targetA);
    this.camera.position.copy(this.savedPosition);
    this.camera.quaternion.copy(this.savedQuaternion);
    this.camera.position.y += strength * 0.3;
    this.camera.position.z -= strength * 0.76;
    this.renderTarget(this.targetB);
    this.camera.position.copy(this.savedPosition);
    this.camera.quaternion.copy(this.savedQuaternion);

    this.compositeMaterial.uniforms.uProgress.value = this.progress;
    this.compositeMaterial.uniforms.uIntensity.value = Math.min(1, strength * 1.18);
    this.compositeMaterial.uniforms.uTime.value = elapsed;
    this.compositeMaterial.uniforms.uDirection.value = this.direction;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.compositeScene, this.compositeCamera);
  }

  renderTarget(target) {
    this.updateGravityPlane(1.15);
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
  }

  updateGravityPlane(distance) {
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5) * distance;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.gravityPlane.position.copy(this.camera.position).addScaledVector(forward, distance);
    this.gravityPlane.quaternion.copy(this.camera.quaternion);
    this.gravityPlane.scale.set(height * this.camera.aspect, height, 1);
  }

  dispose() {
    this.scene.remove(this.gravityPlane);
    this.gravityGeometry.dispose();
    this.gravityMaterial.dispose();
    this.compositeGeometry.dispose();
    this.compositeMaterial.dispose();
    this.targetA.dispose();
    this.targetB.dispose();
  }
}

function createTarget() {
  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.generateMipmaps = false;
  return target;
}
