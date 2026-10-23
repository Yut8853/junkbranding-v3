import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/gl/World.js';

// Exercise the real frame loop and pointer math without a WebGL context.
globalThis.requestAnimationFrame = () => {};
const uniform = (value = 0) => ({ value });
const finiteVector = (vector) => assert.ok(vector.toArray().every(Number.isFinite));

for (const lite of [false, true]) {
  const world = new World({ canvas: null, lite });
  let updates = 0;
  const system = {
    points: new THREE.Object3D(),
    sim: {
      uPointer: uniform(new THREE.Vector3()),
      uPointerVelocity: uniform(new THREE.Vector3()),
      uPointerRadius: uniform(), uPointerStrength: uniform(), uPulse: uniform(),
    },
    update() {
      finiteVector(this.sim.uPointer.value);
      finiteVector(this.sim.uPointerVelocity.value);
      assert.ok(Number.isFinite(this.sim.uPointerStrength.value));
      updates += 1;
    },
  };
  Object.assign(world, {
    systems: [system], running: true, last: 0,
    govern() {}, updateSchool() {},
    abyss: { update() {}, waterMaterial: { uniforms: { uTint: uniform() } } },
    environment: { update() {} }, ocean: { update() {} },
    afterimage: { uniforms: { damp: uniform() } }, bloom: {}, renderer: {},
    finish: { uniforms: { uWarp: uniform(), uTime: uniform() } },
    composer: { render() {} },
  });
  world.pointer.active = true;
  let now = 0;
  const frame = () => {
    world.frame(now += 16);
    finiteVector(world.pointer.world);
    finiteVector(world.pointer.velocity);
    assert.ok(Number.isFinite(world.pointer.energy));
  };
  frame();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    world.paused = true;
    const before = updates;
    const time = world.time;
    frame(); // Stationary pointer during pause.
    world.pointer.ndc.set(0.6, -0.3);
    frame(); // Pointer movement during pause.
    assert.equal(updates, before);
    assert.equal(world.time, time);
    assert.equal(world.pointer.velocity.length(), 0);
    world.paused = false;
    frame();
    assert.ok(updates > before);
    assert.ok(world.time > time);
    world.pointer.ndc.set(-0.2, 0.4);
    frame();
  }
}
console.log('Motion pause/resume regression passed (normal and lite modes).');
