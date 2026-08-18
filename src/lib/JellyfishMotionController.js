import * as THREE from 'three';

export const JELLYFISH_MOTION = Object.freeze({
  pulseInterval: 4.2,
  contractionDuration: 0.34,
  expansionDuration: 1.58,
  restDuration: 0.52,
  pulseStrength: 0.88,
  propulsionForce: 0.46,
  drag: 1.12,
  tentacleStiffness: 0.35,
  tentacleDamping: 0.7,
  tentacleSwayStrength: 0.08,
  currentStrength: 0.03,
  particlePhaseVariation: 0.075,
  variation: 0.1,
  headingDrift: 1,
  homeStrength: 0.06,
  safeRadius: 1.15,
  maxHomeForce: 0.11,
  separationDistance: 0.82,
  separationStrength: 0.48,
  maxSpeed: 0.31,
  maxAcceleration: 0.82,
  velocitySmoothing: 7.5,
  accelerationSmoothing: 10.0,
  contractionVelocitySmoothing: 13.0,
  orientationDamping: 4.2,
  bellDepth: 0.72,
});

const STATES = Object.freeze({
  REST: 'REST',
  CONTRACT: 'CONTRACT',
  THRUST: 'THRUST',
  EXPAND: 'EXPAND',
  GLIDE: 'GLIDE',
});

export class JellyfishMotionController {
  constructor(config = {}) {
    this.config = { ...JELLYFISH_MOTION, ...config };
    this.state = STATES.REST;
    this.stateTime = 0;
    this.elapsed = 0;
    this.cycle = 0;
    this.pulsePhase = 0;
    this.contraction = 0;
    this.previousContraction = 0;
    this.contractionVelocity = 0;
    this.propulsion = 0;
    this.position = new THREE.Vector3(0.72, 0.08, 0.2);
    this.velocity = new THREE.Vector3();
    this.velocitySmooth = new THREE.Vector3();
    this.acceleration = new THREE.Vector3();
    this.accelerationSmooth = new THREE.Vector3();
    this.heading = new THREE.Vector3(0.25, 0.3, 0.92).normalize();
    this.orientation = new THREE.Vector3();
    this.targetOrientation = new THREE.Vector3();
    this.home = new THREE.Vector3(0, 0.05, 0);
    this.desiredHeading = new THREE.Vector3();
    this.homeOffset = new THREE.Vector3();
    this.currentForce = new THREE.Vector3();
    this.rawAcceleration = new THREE.Vector3();
    this.separationForce = new THREE.Vector3();
    this.cycleSettings = this.createCycleSettings();
  }

  update(delta) {
    const dt = Math.min(delta, 0.05);
    this.elapsed += dt;
    this.stateTime += dt;
    this.previousContraction = this.contraction;

    this.updatePulseState();
    this.updateContractionVelocity(dt);
    this.updateHeading(dt);
    this.integrateBody(dt);
    this.updateOrientation(dt);
    return this;
  }

  updatePulseState() {
    switch (this.state) {
      case STATES.REST: {
        const t = clamp01(this.stateTime / this.cycleSettings.restDuration);
        this.pulsePhase = t * 0.15;
        this.contraction = 0;
        if (t >= 1) this.enter(STATES.CONTRACT);
        break;
      }
      case STATES.CONTRACT: {
        const t = clamp01(this.stateTime / this.cycleSettings.contractionDuration);
        this.pulsePhase = 0.15 + t * 0.21;
        this.contraction = smootherstep(t);
        if (t >= 1) this.enter(STATES.THRUST);
        break;
      }
      case STATES.THRUST: {
        const t = clamp01(this.stateTime / this.cycleSettings.thrustDuration);
        this.pulsePhase = 0.36 + t * 0.08;
        this.contraction = 1;
        if (t >= 1) this.enter(STATES.EXPAND);
        break;
      }
      case STATES.EXPAND: {
        const t = clamp01(this.stateTime / this.cycleSettings.expansionDuration);
        this.pulsePhase = 0.44 + t * 0.46;
        this.contraction = 1 - smootherstep(t);
        if (t >= 1) this.enter(STATES.GLIDE);
        break;
      }
      case STATES.GLIDE: {
        const t = clamp01(this.stateTime / this.cycleSettings.glideDuration);
        this.pulsePhase = 0.9 + t * 0.1;
        this.contraction = 0;
        if (t >= 1) {
          this.cycle += 1;
          this.cycleSettings = this.createCycleSettings();
          this.enter(STATES.REST);
        }
        break;
      }
      default:
        this.enter(STATES.REST);
    }
  }

  updateContractionVelocity(dt) {
    const raw = dt > 0 ? (this.contraction - this.previousContraction) / dt : 0;
    const clamped = THREE.MathUtils.clamp(raw, -5, 5);
    const response = 1 - Math.exp(-this.config.contractionVelocitySmoothing * dt);
    this.contractionVelocity = THREE.MathUtils.lerp(this.contractionVelocity, clamped, response);
    const thrustGate = smoothstep(0.22, 0.36, this.pulsePhase);
    this.propulsion = Math.max(0, this.contractionVelocity)
      * this.config.propulsionForce
      * this.config.pulseStrength
      * thrustGate;
  }

  updateHeading(dt) {
    const drift = this.config.headingDrift;
    this.desiredHeading.set(
      (Math.sin(this.elapsed * 0.17) + Math.sin(this.elapsed * 0.053 + 1.4) * 0.32) * drift,
      0.22 + Math.sin(this.elapsed * 0.081 + 2.1) * 0.1,
      (Math.cos(this.elapsed * 0.14) + Math.sin(this.elapsed * 0.061 - 0.7) * 0.28) * drift,
    );
    this.homeOffset.copy(this.home).sub(this.position);
    const distance = this.homeOffset.length();
    if (distance > this.config.safeRadius) {
      const homeForce = Math.min(
        (distance - this.config.safeRadius) * this.config.homeStrength,
        this.config.maxHomeForce,
      );
      this.desiredHeading.addScaledVector(
        this.homeOffset.normalize(),
        homeForce,
      );
    }
    this.desiredHeading.normalize();
    this.heading.lerp(this.desiredHeading, 1 - Math.exp(-0.32 * dt)).normalize();
  }

  integrateBody(dt) {
    this.currentForce.set(
      Math.sin(this.elapsed * 0.14 + 1.3),
      Math.sin(this.elapsed * 0.087) * 0.22,
      Math.sin(this.elapsed * 0.11 + 4.2) * 0.65,
    ).multiplyScalar(this.config.currentStrength);

    this.homeOffset.copy(this.home).sub(this.position);
    const homeDistance = this.homeOffset.length();
    this.rawAcceleration.copy(this.currentForce);
    if (homeDistance > this.config.safeRadius) {
      const homeForce = Math.min(
        (homeDistance - this.config.safeRadius) * this.config.homeStrength,
        this.config.maxHomeForce,
      );
      this.rawAcceleration.addScaledVector(this.homeOffset.normalize(), homeForce);
    }
    this.rawAcceleration.add(this.separationForce);
    this.rawAcceleration.addScaledVector(this.heading, this.propulsion);

    if (this.rawAcceleration.length() > this.config.maxAcceleration) {
      this.rawAcceleration.setLength(this.config.maxAcceleration);
    }

    this.acceleration.copy(this.rawAcceleration);
    this.accelerationSmooth.lerp(
      this.rawAcceleration,
      1 - Math.exp(-this.config.accelerationSmoothing * dt),
    );
    this.velocity.addScaledVector(this.rawAcceleration, dt);
    this.velocity.multiplyScalar(Math.exp(-this.config.drag * dt));
    if (this.velocity.length() > this.config.maxSpeed) this.velocity.setLength(this.config.maxSpeed);
    this.velocitySmooth.lerp(
      this.velocity,
      1 - Math.exp(-this.config.velocitySmoothing * dt),
    );
    this.position.addScaledVector(this.velocity, dt);
  }

  updateOrientation(dt) {
    this.targetOrientation.set(
      THREE.MathUtils.clamp(this.velocitySmooth.z * 0.16, -0.065, 0.065),
      THREE.MathUtils.clamp(-this.velocitySmooth.x * 0.1, -0.045, 0.045),
      THREE.MathUtils.clamp(-this.velocitySmooth.x * 0.18, -0.075, 0.075),
    );
    this.orientation.lerp(
      this.targetOrientation,
      1 - Math.exp(-this.config.orientationDamping * dt),
    );
  }

  enter(state) {
    this.state = state;
    this.stateTime = 0;
  }

  createCycleSettings() {
    const vary = (salt) => 1 + signedNoise(this.cycle * 4.17 + salt) * this.config.variation;
    const expansionDuration = this.config.expansionDuration * vary(1.3);
    const contractionDuration = this.config.contractionDuration * vary(5.7);
    const restDuration = this.config.restDuration * vary(9.1);
    const thrustDuration = contractionDuration * 0.6;
    const used = expansionDuration + contractionDuration + restDuration + thrustDuration;
    return {
      expansionDuration,
      contractionDuration,
      restDuration,
      thrustDuration,
      glideDuration: Math.max(0.72, this.config.pulseInterval * vary(13.4) - used),
    };
  }
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smootherstep(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function smoothstep(edge0, edge1, value) {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function signedNoise(value) {
  const raw = Math.sin(value * 12.9898) * 43758.5453;
  return (raw - Math.floor(raw)) * 2 - 1;
}
