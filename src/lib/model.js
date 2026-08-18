import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createDemoFlower } from './createDemoFlower.js';

export async function loadFlowerModel(modelUrl) {
  if (!modelUrl) {
    return { root: createDemoFlower(), source: 'procedural' };
  }

  const loader = new GLTFLoader();

  try {
    const gltf = await loader.loadAsync(modelUrl);
    const root = gltf.scene || gltf.scenes?.[0];

    if (!root) {
      throw new Error('The GLTF did not contain a scene.');
    }

    return { root, source: 'gltf' };
  } catch (error) {
    console.warn(
      `[flower-particle-scroll] Could not load "${modelUrl}". Using the built-in demo flower instead.`,
      error,
    );

    return { root: createDemoFlower(), source: 'procedural' };
  }
}

export function prepareFlowerModel(root, { targetHeight = 3.3, baseY = -1.62 } = {}) {
  const pivot = new THREE.Group();
  pivot.name = 'flower-pivot';
  pivot.add(root);

  root.updateMatrixWorld(true);

  const initialBox = new THREE.Box3().setFromObject(root);
  const initialSize = initialBox.getSize(new THREE.Vector3());

  if (initialSize.y <= 0.0001) {
    throw new Error('Flower model has an invalid height.');
  }

  const scale = targetHeight / initialSize.y;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  root.position.x -= scaledCenter.x;
  root.position.z -= scaledCenter.z;
  root.position.y -= scaledBox.min.y;

  pivot.position.y = baseY;
  pivot.updateMatrixWorld(true);

  const normalizedBox = new THREE.Box3().setFromObject(pivot);

  cloneRenderableMaterials(root);

  return {
    pivot,
    bounds: normalizedBox,
  };
}

function cloneRenderableMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;

    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => cloneMaterial(material));
    } else {
      object.material = cloneMaterial(object.material);
    }
  });
}

function cloneMaterial(material) {
  const cloned = material.clone();
  cloned.transparent = true;
  cloned.depthWrite = true;
  cloned.userData.baseOpacity = material.opacity ?? 1;
  return cloned;
}

export function setFlowerOpacity(root, opacity) {
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      const baseOpacity = material.userData.baseOpacity ?? 1;
      material.opacity = baseOpacity * opacity;
      if (material.uniforms?.uOpacity) {
        material.uniforms.uOpacity.value = baseOpacity * opacity;
      }
      material.depthWrite = opacity > 0.96;
    }
  });
}

export function disposeFlowerModel(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (!object.isMesh) return;

    if (object.geometry) geometries.add(object.geometry);

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);

      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
