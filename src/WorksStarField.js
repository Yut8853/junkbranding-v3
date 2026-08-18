import * as THREE from 'three';
import vertexShader from './shaders/works-stars.vert.glsl?raw';
import fragmentShader from './shaders/works-stars.frag.glsl?raw';

const STAR_COUNT = 100;

export class WorksStarField {
  constructor({ scene, pixelRatio }) {
    this.scene = scene;
    this.geometry = createStarGeometry();
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPixelRatio: { value: pixelRatio },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.position.set(0, 0.05, -1.8);
    this.points.renderOrder = -10;
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  setProgress(progress) {
    this.material.uniforms.uProgress.value = progress;
  }

  update(elapsed) {
    this.material.uniforms.uTime.value = elapsed;
  }

  resize(camera, pixelRatio) {
    const distance = camera.position.z - this.points.position.z;
    const viewHeight = 2
      * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      * distance;
    const viewWidth = viewHeight * camera.aspect;
    this.points.scale.set(viewWidth * 1.04, viewHeight * 1.04, 1);
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}

function createStarGeometry() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const seeds = new Float32Array(STAR_COUNT);
  const sizes = new Float32Array(STAR_COUNT);
  const speeds = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const offset = i * 3;
    positions[offset] = Math.random() - 0.5;
    positions[offset + 1] = Math.random() - 0.5;
    positions[offset + 2] = (Math.random() - 0.5) * 0.7;
    seeds[i] = Math.random();
    sizes[i] = 24 + Math.random() * 24;
    speeds[i] = 0.55 + Math.random() * 1.25;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  return geometry;
}
