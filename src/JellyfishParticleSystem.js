import * as THREE from 'three';
import { createJellyfishGeometry } from './lib/jellyfishGeometry.js';
import { JellyfishMotionController, JELLYFISH_MOTION } from './lib/JellyfishMotionController.js';
import jellyfishVertexShader from './shaders/jellyfish.vert.glsl?raw';
import jellyfishFragmentShader from './shaders/jellyfish.frag.glsl?raw';

const JELLYFISH_SETTINGS = [
  { position: [1.82, 0.84, 0.5], heading: [0.25, 0.3, 0.92], interval: 4.2, strength: 0.88, timeOffset: 0 },
  { position: [-1.92, 0.76, -0.5], heading: [-0.52, 0.22, 0.82], interval: 4.55, strength: 0.82, timeOffset: 1.7 },
  { position: [0, -1.12, 0.76], heading: [0.76, 0.18, -0.42], interval: 3.95, strength: 0.86, timeOffset: 3.1 },
  { position: [2.16, -0.92, -0.66], heading: [-0.68, 0.25, -0.58], interval: 4.75, strength: 0.78, timeOffset: 4.6 },
  { position: [-2.2, -1.0, 0.62], heading: [0.48, 0.2, 0.74], interval: 4.3, strength: 0.9, timeOffset: 6.2 },
];

const DISTANT_JELLYFISH_SETTINGS = [
  {
    position: [-2.35, 1.28, -2.7],
    heading: [0.42, 0.18, 0.88],
    interval: 5.8,
    strength: 0.46,
    timeOffset: 2.2,
    scale: 0.72,
    opacity: 0.2,
  },
  {
    position: [2.62, 0.12, -3.65],
    heading: [-0.38, 0.14, 0.91],
    interval: 6.4,
    strength: 0.4,
    timeOffset: 5.5,
    scale: 0.66,
    opacity: 0.15,
  },
  {
    position: [-1.35, -1.42, -4.5],
    heading: [0.55, 0.12, 0.82],
    interval: 7.1,
    strength: 0.34,
    timeOffset: 8.1,
    scale: 0.58,
    opacity: 0.11,
  },
];

export class JellyfishParticleSystem {
  constructor({ scene, distantScene = scene, pixelRatio }) {
    this.scene = scene;
    this.distantScene = distantScene;
    this.instances = JELLYFISH_SETTINGS.map((settings, index) => this.createInstance(
      settings,
      pixelRatio,
      index,
      false,
    ));
    this.distantInstances = DISTANT_JELLYFISH_SETTINGS.map((settings, index) => this.createInstance(
      settings,
      pixelRatio,
      index + JELLYFISH_SETTINGS.length,
      true,
    ));
    this.allInstances = [...this.instances, ...this.distantInstances];
    this.progress = 0;
    this.separationOffset = new THREE.Vector3();
  }

  createInstance(settings, pixelRatio, index, isDistant) {
    const motion = new JellyfishMotionController({
      pulseInterval: settings.interval,
      pulseStrength: settings.strength,
    });
    motion.position.fromArray(settings.position);
    motion.home.copy(motion.position);
    motion.heading.fromArray(settings.heading).normalize();

    const material = new THREE.ShaderMaterial({
      vertexShader: jellyfishVertexShader,
      fragmentShader: jellyfishFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uGoldenPhase: { value: -1 },
        uSpiralOffset: { value: (index + 1) / (JELLYFISH_SETTINGS.length + 1) },
        uSpiralRadius: { value: 1.71 },
        uWorksBandHeight: { value: 1.2 },
        uWorksBandY: { value: 1.8 },
        uProgress: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uPointScale: { value: isDistant ? 1.35 : 1 },
        uOpacity: { value: settings.opacity ?? 1 },
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
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(
      createJellyfishGeometry(isDistant ? 1600 : 9000),
      material,
    );
    points.scale.setScalar(settings.scale ?? 1);
    points.frustumCulled = false;
    const ownerScene = isDistant ? this.distantScene : this.scene;
    ownerScene.add(points);

    return {
      motion,
      material,
      points,
      timeOffset: settings.timeOffset,
      euler: new THREE.Euler(),
      inverseQuaternion: new THREE.Quaternion(),
      localVelocity: new THREE.Vector3(),
      localAcceleration: new THREE.Vector3(),
      isDistant,
      ownerScene,
    };
  }

  setProgress(progress) {
    this.progress = progress;
    const worksFade = 1 - THREE.MathUtils.smoothstep(progress, 1.085, 1.127);
    for (const instance of this.instances) {
      instance.material.uniforms.uProgress.value = progress;
    }
    for (const instance of this.allInstances) {
      instance.material.uniforms.uWorksFade.value = worksFade;
    }
  }

  setPixelRatio(pixelRatio) {
    for (const instance of this.allInstances) {
      instance.material.uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  setSpiralRadius(radius) {
    for (const instance of this.allInstances) {
      instance.material.uniforms.uSpiralRadius.value = radius;
    }
  }

  setWorksBandHeight(height) {
    for (const instance of this.allInstances) {
      instance.material.uniforms.uWorksBandHeight.value = height;
    }
  }

  setWorksBandY(y) {
    for (const instance of this.allInstances) {
      instance.material.uniforms.uWorksBandY.value = y;
    }
  }

  update(elapsed, delta, goldenPulsePhase) {
    this.updateSeparation();

    for (const instance of this.allInstances) {
      instance.material.uniforms.uTime.value = elapsed + instance.timeOffset;
      instance.material.uniforms.uGoldenPhase.value = instance.isDistant
        ? -1
        : goldenPulsePhase;
      const motion = instance.motion.update(delta);
      this.updateInstance(instance, motion);
    }
  }

  updateInstance(instance, motion) {
    const { points, material, euler, inverseQuaternion, localVelocity, localAcceleration } = instance;
    points.position.copy(motion.position);
    if (instance.isDistant) {
      const depth = Math.abs(motion.home.z);
      points.position.x += (this.progress - 0.5) * (0.08 + depth * 0.035);
      points.position.y += (this.progress - 0.5) * (0.025 + depth * 0.012);
    }
    euler.set(motion.orientation.x, motion.orientation.y, motion.orientation.z);
    points.quaternion.setFromEuler(euler);
    inverseQuaternion.copy(points.quaternion).invert();
    localVelocity.copy(motion.velocitySmooth).applyQuaternion(inverseQuaternion);
    localAcceleration.copy(motion.accelerationSmooth).applyQuaternion(inverseQuaternion);
    material.uniforms.uPulsePhase.value = motion.pulsePhase;
    material.uniforms.uContraction.value = motion.contraction;
    material.uniforms.uContractionVelocity.value = motion.contractionVelocity;
    material.uniforms.uBodyVelocityLocal.value.copy(localVelocity);
    material.uniforms.uBodyAccelerationLocal.value.copy(localAcceleration);
  }

  updateSeparation() {
    for (const instance of this.instances) instance.motion.separationForce.set(0, 0, 0);

    for (let i = 0; i < this.instances.length; i += 1) {
      for (let j = i + 1; j < this.instances.length; j += 1) {
        const first = this.instances[i].motion;
        const second = this.instances[j].motion;
        this.separationOffset.copy(first.position).sub(second.position);
        const distance = this.separationOffset.length();
        const minimum = Math.min(first.config.separationDistance, second.config.separationDistance);
        if (distance <= 0.0001 || distance >= minimum) continue;
        const force = (1 - distance / minimum)
          * Math.min(first.config.separationStrength, second.config.separationStrength);
        this.separationOffset.multiplyScalar(force / distance);
        first.separationForce.add(this.separationOffset);
        second.separationForce.sub(this.separationOffset);
      }
    }
  }

  dispose() {
    for (const instance of this.allInstances) {
      instance.points.geometry.dispose();
      instance.material.dispose();
      instance.ownerScene.remove(instance.points);
    }
    this.instances.length = 0;
    this.distantInstances.length = 0;
    this.allInstances.length = 0;
  }
}
