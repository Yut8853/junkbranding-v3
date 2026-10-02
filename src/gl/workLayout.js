import * as THREE from 'three';

// Where each project floats around the photographed cosmos (at the origin).
// Angles and heights zigzag, so going from one project to the next the camera
// has to travel left, right, up and down, never along a line.
const ANGLES = [-22, 56, -62, 12, 66, -44, 34, -8];
const HEIGHTS = [1.7, -1.3, 0.5, 2.3, -2.2, -0.3, 1.2, -2.6];
const RADIUS = 3.9;
export const PANEL_WIDTH = 2.4;
export const PANEL_HEIGHT = PANEL_WIDTH * (424 / 960);

export function workLayout(count = 6) {
  return Array.from({ length: count }, (_, index) => {
    const angle = THREE.MathUtils.degToRad(ANGLES[index % ANGLES.length]);
    const height = HEIGHTS[index % HEIGHTS.length];
    const position = new THREE.Vector3(Math.sin(angle) * RADIUS, height, Math.cos(angle) * RADIUS);
    // Face outward from the flower, tipped toward the middle height.
    const normal = new THREE.Vector3(Math.sin(angle), -height * 0.08, Math.cos(angle)).normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(position.clone().add(normal), position, new THREE.Vector3(0, 1, 0)),
    );
    const tangent = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
    return { position, normal, tangent, quaternion, tilt: (index % 2 ? 1 : -1) * 0.05 };
  });
}

// Camera pose that frames a panel: square on, panel to the right of centre
// (text sits bottom-left) on wide screens, above centre on narrow ones.
export function cameraForPanel(panel, narrow) {
  const look = panel.position.clone();
  if (narrow) {
    look.y -= 0.95;
    const position = look.clone().add(panel.normal.clone().multiplyScalar(4.2));
    return { x: position.x, y: position.y, z: position.z, tx: look.x, ty: look.y, tz: look.z };
  }
  look.addScaledVector(panel.tangent, -0.85);
  look.y -= 0.32;
  const position = look.clone().add(panel.normal.clone().multiplyScalar(3.4));
  return { x: position.x, y: position.y, z: position.z, tx: look.x, ty: look.y, tz: look.z };
}
