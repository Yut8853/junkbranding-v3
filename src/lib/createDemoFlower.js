import * as THREE from 'three';

function makeCanvasTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  draw(context, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createPetalTexture({ base, highlight, shadow, accent }) {
  return makeCanvasTexture((context, width, height) => {
    context.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.5;

    context.save();
    context.translate(cx, cy);

    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + Math.PI * 0.15;
      const falloff = 0.92 + (i % 3) * 0.08;
      const petalGradient = context.createRadialGradient(
        Math.cos(angle) * 70,
        Math.sin(angle) * 70,
        30,
        Math.cos(angle) * 150,
        Math.sin(angle) * 150,
        260 * falloff,
      );
      petalGradient.addColorStop(0, highlight);
      petalGradient.addColorStop(0.3, base);
      petalGradient.addColorStop(0.75, accent);
      petalGradient.addColorStop(1, shadow);

      context.rotate(angle * 0.8);
      context.beginPath();
      context.moveTo(0, -30);
      context.bezierCurveTo(130, -120, 260, -70, 220, 0);
      context.bezierCurveTo(260, 70, 130, 120, 0, 30);
      context.bezierCurveTo(-100, 120, -180, 60, -110, 0);
      context.bezierCurveTo(-180, -60, -100, -120, 0, -30);
      context.closePath();
      context.fillStyle = petalGradient;
      context.fill();

      context.strokeStyle = 'rgba(255,255,255,0.38)';
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(0, -170);
      context.quadraticCurveTo(16, -40, 0, 160);
      context.stroke();

      context.rotate(-angle * 0.8);
    }

    context.restore();

    for (let i = 0; i < 4000; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const alpha = 0.04 + Math.random() * 0.18;
      const dot = Math.random() > 0.5 ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(188,36,74,' + alpha + ')';
      context.fillStyle = dot;
      context.fillRect(x, y, 2, 2);
    }

    context.globalCompositeOperation = 'screen';
    const vignetting = context.createRadialGradient(cx, cy, 150, cx, cy, width * 0.7);
    vignetting.addColorStop(0, 'rgba(255,255,255,0.05)');
    vignetting.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    vignetting.addColorStop(1, 'rgba(70,10,30,0.34)');
    context.fillStyle = vignetting;
    context.fillRect(0, 0, width, height);
  });
}

function createStemTexture() {
  return makeCanvasTexture((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#24432a');
    gradient.addColorStop(0.35, '#3c6d45');
    gradient.addColorStop(1, '#96b477');

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(255,255,255,0.19)';
    context.lineWidth = 10;
    for (let i = 0; i < 15; i += 1) {
      const x = (i / 15) * width;
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(x + 14, height * 0.25, x - 12, height * 0.75, x, height);
      context.stroke();
    }
  });
}

function createLeafTexture() {
  return makeCanvasTexture((context, width, height) => {
    const gradient = context.createRadialGradient(width * 0.55, height * 0.55, 50, width * 0.5, height * 0.5, width * 0.7);
    gradient.addColorStop(0, '#d7f0b9');
    gradient.addColorStop(0.4, '#5f9b58');
    gradient.addColorStop(1, '#264b2a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(width * 0.5, height * 0.5);
    context.rotate(-0.5);
    context.strokeStyle = 'rgba(255,255,255,0.22)';
    context.lineWidth = 16;
    context.beginPath();
    context.moveTo(-320, 0);
    context.quadraticCurveTo(0, -280, 320, 0);
    context.quadraticCurveTo(0, 280, -320, 0);
    context.stroke();

    context.strokeStyle = 'rgba(29,54,30,0.28)';
    context.lineWidth = 8;
    for (let i = 0; i < 9; i += 1) {
      const offset = -200 + i * 50;
      context.beginPath();
      context.moveTo(offset, 200);
      context.quadraticCurveTo(offset + 25, 0, offset, -200);
      context.stroke();
    }
    context.restore();
  });
}

export function createDemoFlower() {
  const root = new THREE.Group();
  root.name = 'demo-flower';

  const stemTexture = createStemTexture();
  const leafTexture = createLeafTexture();
  const petalTextureA = createPetalTexture({
    base: '#d56d84',
    highlight: '#ffd9d8',
    shadow: '#8d1a44',
    accent: '#f4bfcb',
  });
  const petalTextureB = createPetalTexture({
    base: '#e69aa5',
    highlight: '#fff2e7',
    shadow: '#8f3d62',
    accent: '#efb5b0',
  });
  const centerTexture = makeCanvasTexture((context, width, height) => {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const radial = context.createRadialGradient(cx, cy, 30, cx, cy, width * 0.38);
    radial.addColorStop(0, '#ffe7ad');
    radial.addColorStop(0.32, '#e8b84a');
    radial.addColorStop(0.7, '#a96a1c');
    radial.addColorStop(1, '#4f2b12');
    context.fillStyle = radial;
    context.fillRect(0, 0, width, height);

    for (let i = 0; i < 1500; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 4.5;
      context.fillStyle = i % 2 === 0 ? 'rgba(255,248,205,0.62)' : 'rgba(123,72,16,0.55)';
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }
  });

  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stemTexture,
    roughness: 0.72,
    metalness: 0.0,
  });

  const petalMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: petalTextureA,
    roughness: 0.58,
    metalness: 0.0,
  });

  const petalMaterial2 = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: petalTextureB,
    roughness: 0.62,
    metalness: 0.0,
  });

  const centerMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: centerTexture,
    roughness: 0.78,
    metalness: 0.0,
  });

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.052, 2.65, 14, 20),
    stemMaterial,
  );
  stem.position.y = 1.325;
  root.add(stem);

  const leafGeometry = new THREE.SphereGeometry(0.3, 18, 12);

  const leftLeaf = new THREE.Mesh(leafGeometry, stemMaterial);
  leftLeaf.scale.set(1.15, 0.12, 0.38);
  leftLeaf.rotation.z = -0.55;
  leftLeaf.rotation.y = -0.2;
  leftLeaf.position.set(-0.24, 1.06, 0.0);
  root.add(leftLeaf);

  const rightLeaf = new THREE.Mesh(leafGeometry, stemMaterial);
  rightLeaf.scale.set(1.0, 0.11, 0.34);
  rightLeaf.rotation.z = 0.62;
  rightLeaf.rotation.y = 0.25;
  rightLeaf.position.set(0.22, 1.55, -0.03);
  root.add(rightLeaf);

  const flowerHead = new THREE.Group();
  flowerHead.position.y = 2.72;
  flowerHead.rotation.x = -0.08;
  root.add(flowerHead);

  const petalGeometry = new THREE.SphereGeometry(0.28, 24, 16);
  const outerCount = 13;

  for (let i = 0; i < outerCount; i += 1) {
    const angle = (i / outerCount) * Math.PI * 2;
    const petal = new THREE.Mesh(
      petalGeometry,
      i % 2 === 0 ? petalMaterial : petalMaterial2,
    );

    petal.scale.set(0.55, 1.18, 0.2);
    petal.rotation.z = -angle + Math.PI / 2;
    petal.rotation.x = Math.sin(angle * 2.0) * 0.12;
    petal.position.set(
      Math.cos(angle) * 0.34,
      Math.sin(angle) * 0.34,
      Math.sin(angle * 1.5) * 0.035,
    );

    flowerHead.add(petal);
  }

  const innerCount = 8;
  for (let i = 0; i < innerCount; i += 1) {
    const angle = (i / innerCount) * Math.PI * 2 + 0.22;
    const petal = new THREE.Mesh(
      petalGeometry,
      i % 2 === 0 ? petalMaterial2 : petalMaterial,
    );

    petal.scale.set(0.42, 0.82, 0.18);
    petal.rotation.z = -angle + Math.PI / 2;
    petal.position.set(
      Math.cos(angle) * 0.18,
      Math.sin(angle) * 0.18,
      0.055,
    );

    flowerHead.add(petal);
  }

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 24, 16),
    centerMaterial,
  );
  center.scale.z = 0.65;
  center.position.z = 0.11;
  flowerHead.add(center);

  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });

  return root;
}
