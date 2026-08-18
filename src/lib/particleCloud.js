import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const TAU = Math.PI * 2;

export function buildParticleGeometry(root, particleCount) {
  root.updateMatrixWorld(true);

  const sourceMeshes = collectSourceMeshes(root);

  if (sourceMeshes.length === 0) {
    throw new Error('The flower model does not contain any sampleable mesh geometry.');
  }

  const prepared = sourceMeshes
    .map((mesh) => prepareMeshForSampling(mesh))
    .filter((entry) => entry.area > 0);

  if (prepared.length === 0) {
    throw new Error('The flower model has no mesh surface area to sample.');
  }

  const allocations = allocateParticleCounts(prepared, particleCount);
  const bounds = computePreparedBounds(prepared);
  const minY = bounds.min.y;
  const height = Math.max(bounds.max.y - bounds.min.y, 0.0001);

  const positions = new Float32Array(particleCount * 3);
  const normals = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const directions = new Float32Array(particleCount * 3);
  const activations = new Float32Array(particleCount);
  const seeds = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const bandTargets = new Float32Array(particleCount * 3);

  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const sampledColor = new THREE.Color(1, 1, 1);
  const finalColor = new THREE.Color(1, 1, 1);
  const uv = new THREE.Vector2();
  const textureSamplers = new WeakMap();

  let cursor = 0;

  for (let meshIndex = 0; meshIndex < prepared.length; meshIndex += 1) {
    const entry = prepared[meshIndex];
    const count = allocations[meshIndex];
    const material = getPrimaryMaterial(entry.material);
    const hasVertexColor = Boolean(entry.geometry.getAttribute('color'));

    for (let i = 0; i < count; i += 1) {
      sampledColor.setRGB(1, 1, 1);
      uv.set(0, 0);
      normal.set(0, 1, 0);

      entry.sampler.sample(position, normal, sampledColor, uv);

      resolveSurfaceColor({
        material,
        uv,
        sampledColor,
        hasVertexColor,
        output: finalColor,
        textureSamplers,
      });

      const offset = cursor * 3;
      positions[offset] = position.x;
      positions[offset + 1] = position.y;
      positions[offset + 2] = position.z;

      normal.normalize();
      normals[offset] = normal.x;
      normals[offset + 1] = normal.y;
      normals[offset + 2] = normal.z;

      colors[offset] = finalColor.r;
      colors[offset + 1] = finalColor.g;
      colors[offset + 2] = finalColor.b;

      const seed = Math.random();
      const angle = Math.random() * TAU;
      const lateral = 0.55 + Math.random() * 0.85;
      const lift = 0.18 + Math.random() * 0.95;
      const depth = (Math.random() - 0.5) * 1.4;

      directions[offset] = Math.cos(angle) * lateral + normal.x * 0.35;
      directions[offset + 1] = lift + normal.y * 0.18;
      directions[offset + 2] = Math.sin(angle) * lateral + depth + normal.z * 0.35;

      const yNormalized = THREE.MathUtils.clamp((position.y - minY) / height, 0, 1);
      const topFirst = 1 - yNormalized;
      activations[cursor] = THREE.MathUtils.clamp(
        0.12 + topFirst * 0.19 + seed * 0.08,
        0.08,
        0.44,
      );

      seeds[cursor] = seed;
      sizes[cursor] = 0.72 + Math.random() * 0.9;
      bandTargets[offset] = Math.random() * 2 - 1;
      bandTargets[offset + 1] = (Math.random() * 2 - 1)
        + (Math.random() * 2 - 1) * 0.34;
      bandTargets[offset + 2] = Math.random() * 2 - 1;

      cursor += 1;
    }
  }

  for (const entry of prepared) {
    entry.geometry.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('aActivation', new THREE.BufferAttribute(activations, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aBandTarget', new THREE.BufferAttribute(bandTargets, 3));
  geometry.computeBoundingSphere();

  return { geometry, bounds };
}

function collectSourceMeshes(root) {
  const meshes = [];

  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const position = object.geometry.getAttribute('position');
    if (!position || position.count < 3) return;
    meshes.push(object);
  });

  return meshes;
}

function prepareMeshForSampling(mesh) {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);

  const samplingMesh = new THREE.Mesh(geometry, mesh.material);
  const sampler = new MeshSurfaceSampler(samplingMesh).build();
  const area = computeSurfaceArea(geometry);

  return {
    geometry,
    sampler,
    material: mesh.material,
    area,
  };
}

function computeSurfaceArea(geometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let area = 0;

  const readTriangle = (ia, ib, ic) => {
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += ab.cross(ac).length() * 0.5;
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      readTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      readTriangle(i, i + 1, i + 2);
    }
  }

  return area;
}

function allocateParticleCounts(entries, totalCount) {
  const totalArea = entries.reduce((sum, entry) => sum + entry.area, 0);
  const raw = entries.map((entry) => (entry.area / totalArea) * totalCount);
  const counts = raw.map((value) => Math.floor(value));

  let remaining = totalCount - counts.reduce((sum, count) => sum + count, 0);

  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remaining; i += 1) {
    counts[byFraction[i % byFraction.length].index] += 1;
  }

  return counts;
}

function computePreparedBounds(entries) {
  const bounds = new THREE.Box3();
  bounds.makeEmpty();

  for (const entry of entries) {
    entry.geometry.computeBoundingBox();
    if (entry.geometry.boundingBox) {
      bounds.union(entry.geometry.boundingBox);
    }
  }

  return bounds;
}

function getPrimaryMaterial(material) {
  if (Array.isArray(material)) {
    return material[0] ?? null;
  }
  return material ?? null;
}

function resolveSurfaceColor({
  material,
  uv,
  sampledColor,
  hasVertexColor,
  output,
  textureSamplers,
}) {
  output.setRGB(1, 1, 1);

  if (material?.color?.isColor) {
    output.multiply(material.color);
  }

  if (hasVertexColor) {
    output.multiply(sampledColor);
  }

  if (!material?.map?.isTexture) return output;

  let sampler = textureSamplers.get(material.map);

  if (!sampler) {
    sampler = createTextureSampler(material.map);
    if (sampler) textureSamplers.set(material.map, sampler);
  }

  if (sampler) {
    const textureColor = sampler.sample(uv);
    if (textureColor) output.multiply(textureColor);
  }

  return output;
}

function createTextureSampler(texture) {
  const image = texture.image ?? texture.source?.data;

  if (!image) return null;

  if (image.data && Number.isFinite(image.width) && Number.isFinite(image.height)) {
    return createDataTextureSampler(texture, image);
  }

  if (!Number.isFinite(image.width) || !Number.isFinite(image.height)) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) return null;

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return createImageDataSampler(texture, imageData);
  } catch (error) {
    console.warn(
      '[flower-particle-scroll] Texture pixels could not be sampled. Particle color will use the material base color.',
      error,
    );
    return null;
  }
}

function createImageDataSampler(texture, imageData) {
  const uv = new THREE.Vector2();
  const color = new THREE.Color();

  return {
    sample(sourceUv) {
      uv.copy(sourceUv);
      texture.transformUv(uv);

      const x = THREE.MathUtils.clamp(Math.floor(uv.x * (imageData.width - 1)), 0, imageData.width - 1);
      const y = THREE.MathUtils.clamp(Math.floor((1 - uv.y) * (imageData.height - 1)), 0, imageData.height - 1);
      const offset = (y * imageData.width + x) * 4;
      const data = imageData.data;

      color.setRGB(
        data[offset] / 255,
        data[offset + 1] / 255,
        data[offset + 2] / 255,
        THREE.SRGBColorSpace,
      );

      return color;
    },
  };
}

function createDataTextureSampler(texture, image) {
  const uv = new THREE.Vector2();
  const color = new THREE.Color();
  const channels = image.data.length / (image.width * image.height);

  if (channels < 3) return null;

  return {
    sample(sourceUv) {
      uv.copy(sourceUv);
      texture.transformUv(uv);

      const x = THREE.MathUtils.clamp(Math.floor(uv.x * (image.width - 1)), 0, image.width - 1);
      const y = THREE.MathUtils.clamp(Math.floor((1 - uv.y) * (image.height - 1)), 0, image.height - 1);
      const offset = Math.floor((y * image.width + x) * channels);
      const data = image.data;
      const scale = data instanceof Float32Array ? 1 : 1 / 255;

      color.setRGB(
        data[offset] * scale,
        data[offset + 1] * scale,
        data[offset + 2] * scale,
        texture.colorSpace || THREE.NoColorSpace,
      );

      return color;
    },
  };
}
