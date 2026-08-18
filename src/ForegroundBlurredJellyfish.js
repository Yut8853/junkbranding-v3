import * as THREE from 'three';
import { createJellyfishGeometry } from './lib/jellyfishGeometry.js';
import { JellyfishMotionController, JELLYFISH_MOTION } from './lib/JellyfishMotionController.js';
import jellyfishVertexShader from './shaders/jellyfish.vert.glsl?raw';
import jellyfishFragmentShader from './shaders/jellyfish.frag.glsl?raw';

export class ForegroundBlurredJellyfish {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    this.camera.position.set(0, 0.12, 6.35);
    this.camera.lookAt(0, 0.05, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.motion = new JellyfishMotionController({
      pulseInterval: 5.1,
      pulseStrength: 0.62,
      safeRadius: 0.46,
      maxSpeed: 0.16,
      headingDrift: 0.42,
    });
    this.motion.position.set(-1.55, -1.18, 0);
    this.motion.home.copy(this.motion.position);
    this.motion.heading.set(-0.16, 0.24, 0.96).normalize();

    this.material = new THREE.ShaderMaterial({
      vertexShader: jellyfishVertexShader,
      fragmentShader: jellyfishFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uGoldenPhase: { value: -1 },
        uSpiralOffset: { value: 0 },
        uSpiralRadius: { value: 1.71 },
        uWorksBandHeight: { value: 1.2 },
        uWorksBandY: { value: 1.8 },
        uProgress: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointScale: { value: 4.8 },
        uOpacity: { value: 1 },
        uWorksFade: { value: 1 },
        uPulsePhase: { value: 0 },
        uContraction: { value: 0 },
        uContractionVelocity: { value: 0 },
        uBodyVelocityLocal: { value: new THREE.Vector3() },
        uBodyAccelerationLocal: { value: new THREE.Vector3() },
        uTentacleStiffness: { value: JELLYFISH_MOTION.tentacleStiffness },
        uTentacleDamping: { value: JELLYFISH_MOTION.tentacleDamping },
        uTentacleSwayStrength: { value: JELLYFISH_MOTION.tentacleSwayStrength },
        uCurrentStrength: { value: JELLYFISH_MOTION.currentStrength },
        uPhaseVariation: { value: JELLYFISH_MOTION.particlePhaseVariation },
        uBellDepth: { value: JELLYFISH_MOTION.bellDepth },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(createJellyfishGeometry(15600), this.material);
    this.points.scale.setScalar(2.35);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.euler = new THREE.Euler();
    this.inverseQuaternion = new THREE.Quaternion();
    this.localVelocity = new THREE.Vector3();
    this.localAcceleration = new THREE.Vector3();
  }

  resize(width, height, sourcePixelRatio, spiralRadius) {
    const pixelRatio = Math.min(sourcePixelRatio, 1);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    const viewHeight = 2
      * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
      * this.camera.position.z;
    const targetPixels = Math.min(300, height * 0.55);
    const worksBandHeight = viewHeight * (targetPixels / Math.max(1, height));
    const worksBandY = 0.05 + viewHeight * 0.5 - worksBandHeight * 0.5;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uSpiralRadius.value = spiralRadius;
    this.material.uniforms.uWorksBandHeight.value = worksBandHeight;
    this.material.uniforms.uWorksBandY.value = worksBandY;
  }

  setProgress(progress) {
    this.material.uniforms.uProgress.value = progress;
    this.material.uniforms.uWorksFade.value = 1
      - THREE.MathUtils.smoothstep(progress, 1.085, 1.127);
  }

  update(elapsed, delta) {
    const motion = this.motion.update(delta);
    this.material.uniforms.uTime.value = elapsed + 3.4;
    this.material.uniforms.uPulsePhase.value = motion.pulsePhase;
    this.material.uniforms.uContraction.value = motion.contraction;
    this.material.uniforms.uContractionVelocity.value = motion.contractionVelocity;

    this.points.position.copy(motion.position);
    this.euler.set(motion.orientation.x, motion.orientation.y, motion.orientation.z);
    this.points.quaternion.setFromEuler(this.euler);
    this.inverseQuaternion.copy(this.points.quaternion).invert();
    this.localVelocity.copy(motion.velocitySmooth).applyQuaternion(this.inverseQuaternion);
    this.localAcceleration.copy(motion.accelerationSmooth).applyQuaternion(this.inverseQuaternion);
    this.material.uniforms.uBodyVelocityLocal.value.copy(this.localVelocity);
    this.material.uniforms.uBodyAccelerationLocal.value.copy(this.localAcceleration);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
