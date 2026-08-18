import * as THREE from 'three';

export function createJellyfishGeometry(count = 9000) {
  const positions = new Float32Array(count * 3);
  const u = new Float32Array(count);
  const v = new Float32Array(count);
  const kinds = new Float32Array(count);
  const strands = new Float32Array(count);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const bandTargets = new Float32Array(count * 3);
  const bellCount = Math.floor(count * 0.32);
  const tentacleCount = 13;

  for (let i = 0; i < count; i += 1) {
    const seed = Math.random();
    const isBell = i < bellCount;
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    if (isBell) {
      // Golden-angle placement avoids visible rows while preserving one dome.
      u[i] = (i * 0.61803398875) % 1;
      v[i] = Math.sqrt((i + 0.5) / bellCount);
      kinds[i] = 0;
      strands[i] = 0;
    } else {
      const localIndex = i - bellCount;
      const strand = localIndex % tentacleCount;
      const along = Math.floor(localIndex / tentacleCount);
      const strandLength = Math.ceil((count - bellCount) / tentacleCount);
      u[i] = seed;
      v[i] = THREE.MathUtils.clamp((along + seed * 0.45) / strandLength, 0, 1);
      kinds[i] = 1;
      strands[i] = strand / tentacleCount;
    }

    seeds[i] = seed;
    sizes[i] = 0.58 + Math.random() * 1.18;
    bandTargets[i * 3] = Math.random() * 2 - 1;
    bandTargets[i * 3 + 1] = (Math.random() * 2 - 1)
      + (Math.random() * 2 - 1) * 0.34;
    bandTargets[i * 3 + 2] = Math.random() * 2 - 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aU', new THREE.BufferAttribute(u, 1));
  geometry.setAttribute('aV', new THREE.BufferAttribute(v, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('aStrand', new THREE.BufferAttribute(strands, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aBandTarget', new THREE.BufferAttribute(bandTargets, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  return geometry;
}
