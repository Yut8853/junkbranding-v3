import * as THREE from 'three';

// Every shape the particle swarm can take is baked into a pair of textures:
//   positions (RGBA float): xyz + w, an animation parameter read by the simulation
//   colors    (RGBA byte):  rgb + a, a per-particle brightness/alpha
// Form ids must match the GLSL in Particles.js.
export const FORM = { FLOWER: 0, JELLY: 1, TEXT: 2, SCREEN: 3, VORTEX: 4, NETWORK: 5, FALL: 6 };

// The flower head in /textures/cosmos-photo.webp (1024 x 1536).
const PHOTO = { width: 1024, height: 1536, cx: 521, cy: 368, radius: 355 };
export const SCREEN_ASPECT = 960 / 424;

function makeTextures(size) {
  const count = size * size;
  const positions = new Float32Array(count * 4);
  const colors = new Uint8Array(count * 4);
  return { count, positions, colors };
}

function finish(size, positions, colors) {
  const position = new THREE.DataTexture(positions, size, size, THREE.RGBAFormat, THREE.FloatType);
  position.needsUpdate = true;
  const color = new THREE.DataTexture(colors, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  color.needsUpdate = true;
  return { position, color };
}

const gauss = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Real photograph → particles. Each particle takes one pixel's colour; the
// flat photo is lifted into a shallow 3D cup so it reads as a flower in space.
export function flowerTargets(size, image) {
  const { count, positions, colors } = makeTextures(size);
  const scale = 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO.width * scale;
  canvas.height = PHOTO.height * scale;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

  const head = [];
  const stem = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      if (data[index + 3] < 150) continue;
      const px = x / scale;
      const py = y / scale;
      const r = Math.hypot(px - PHOTO.cx, py - PHOTO.cy) / PHOTO.radius;
      (r < 1.05 && py < PHOTO.cy + PHOTO.radius * 1.02 ? head : stem).push(index);
    }
  }
  const world = 1.45 / PHOTO.radius;
  for (let particle = 0; particle < count; particle += 1) {
    const fromStem = Math.random() < 0.07 && stem.length;
    const pool = fromStem ? stem : head;
    const index = pool[(Math.random() * pool.length) | 0];
    const pixel = index / 4;
    const px = (pixel % canvas.width) / scale + (Math.random() - 0.5) / scale;
    const py = Math.floor(pixel / canvas.width) / scale + (Math.random() - 0.5) / scale;
    const x = (px - PHOTO.cx) * world;
    const y = -(py - PHOTO.cy) * world + 0.15;
    const r = Math.hypot(px - PHOTO.cx, py - PHOTO.cy) / PHOTO.radius;
    let z = fromStem ? 0.02 * Math.sin(py * 0.01) : r * r * 0.42;
    if (!fromStem && r < 0.2) z += (0.2 - r) * 0.55; // domed yellow disc
    z += (Math.random() - 0.5) * 0.02;
    const o = particle * 4;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
    positions[o + 3] = r; // radial distance, used for the breathing motion
    colors[o] = data[index];
    colors[o + 1] = data[index + 1];
    colors[o + 2] = data[index + 2];
    colors[o + 3] = 255;
  }
  return finish(size, positions, colors);
}

// Procedural medusa. w encodes the body part for the simulation:
//   [0, 0.5)  bell, w*2 = distance from apex to rim
//   [1, 2)    rim tentacle, fract = position along it
//   [2, 3)    oral arm, fract = position along it
//   3         glowing gonads
export function jellyTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const bellRadius = 1.15;
  const rimAngle = 1.75;
  const tentacles = 40;
  const set = (o, x, y, z, w, r, g, b, a) => {
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
    positions[o + 3] = w;
    colors[o] = r;
    colors[o + 1] = g;
    colors[o + 2] = b;
    colors[o + 3] = a;
  };
  const bellPoint = (u, theta, shell) => {
    const phi = u * rimAngle;
    const lobes = 1 + 0.07 * Math.sin(theta * 8) * u * u;
    const radius = bellRadius * shell * lobes;
    return [radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi) * 0.78 + 0.9, radius * Math.sin(phi) * Math.sin(theta)];
  };
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    if (pick < 0.46) {
      const u = Math.sqrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const inner = Math.random() < 0.3;
      const [x, y, z] = bellPoint(u, theta, inner ? 0.9 : 1 + gauss() * 0.008);
      const rim = Math.pow(u, 6);
      const glow = inner ? 90 : 150 + rim * 105;
      set(o, x, y, z, u * 0.499, 255, 90 + rim * 120, 170 + rim * 80, glow);
    } else if (pick < 0.86) {
      const k = Math.floor(Math.random() * tentacles);
      const theta = (k / tentacles) * Math.PI * 2 + Math.sin(k * 12.9) * 0.05;
      const t = Math.pow(Math.random(), 0.8);
      const [rx, ry, rz] = bellPoint(0.985, theta, 1);
      const length = 3.4 + Math.sin(k * 7.3) * 0.8;
      const drift = 0.18 * Math.sin(t * Math.PI * 0.5);
      set(
        o,
        rx * (1 + drift) + gauss() * 0.006,
        ry - t * length,
        rz * (1 + drift) + gauss() * 0.006,
        1 + t * 0.999,
        255 - t * 170,
        110 + t * 120,
        200 + t * 55,
        200 - t * 120,
      );
    } else if (pick < 0.97) {
      const k = Math.floor(Math.random() * 4);
      const theta = (k / 4) * Math.PI * 2 + 0.4;
      const t = Math.random();
      const frill = 0.12 * t * Math.sin(t * 24 + Math.random() * 6);
      set(
        o,
        Math.cos(theta) * (0.1 + t * 0.2) + Math.cos(theta + 1.57) * frill,
        0.55 - t * 2.3,
        Math.sin(theta) * (0.1 + t * 0.2) + Math.sin(theta + 1.57) * frill,
        2 + t * 0.999,
        255,
        120,
        190,
        170,
      );
    } else {
      const k = Math.floor(Math.random() * 4);
      const angle = (k / 4) * Math.PI * 2 + Math.random() * 1.3;
      const ring = 0.32 + gauss() * 0.02;
      set(o, Math.cos(angle) * ring, 1.35 + gauss() * 0.03, Math.sin(angle) * ring, 3, 255, 214, 120, 255);
    }
  }
  return finish(size, positions, colors);
}

// A curved display made of particles. Positions only: colours come from the
// project video in the render shader, using the per-particle screen UV.
export function screenTargets(size, screenUv, width = 3.9) {
  const { count, positions, colors } = makeTextures(size);
  const height = width / SCREEN_ASPECT;
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const u = screenUv[particle * 2];
    const v = screenUv[particle * 2 + 1];
    const x = (u - 0.5) * width;
    positions[o] = x;
    positions[o + 1] = (v - 0.5) * height + 0.1;
    positions[o + 2] = -x * x * 0.07 + (Math.random() - 0.5) * 0.015;
    positions[o + 3] = u;
    colors[o] = 255;
    colors[o + 1] = 255;
    colors[o + 2] = 255;
    colors[o + 3] = 255;
  }
  return finish(size, positions, colors);
}

// Spiral abyss for the contact chapter.
export function vortexTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const arms = 3;
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const r = Math.pow(Math.random(), 0.75) * 3.6 + 0.05;
    const arm = Math.floor(Math.random() * arms);
    const theta = (arm / arms) * Math.PI * 2 + r * 1.6 + gauss() * (0.16 + r * 0.05);
    const thickness = (1 - r / 3.7) * 0.22 + 0.02;
    positions[o] = Math.cos(theta) * r;
    positions[o + 1] = gauss() * thickness;
    positions[o + 2] = Math.sin(theta) * r;
    positions[o + 3] = r;
    const core = Math.max(0, 1 - r / 1.4);
    colors[o] = 255 * (0.35 + core * 0.65);
    colors[o + 1] = 120 + (1 - core) * 110;
    colors[o + 2] = 190 + (1 - core) * 65;
    colors[o + 3] = 90 + core * 165;
  }
  return finish(size, positions, colors);
}

// Typography → particles. lines: [{ text, font, color }]. Returns textures
// sized to 'width' world units, centred on the origin.
export function textTargets(size, lines, { width = 6.2, into = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const lineHeight = canvas.height / (lines.length + 0.6);
  const colorsByLine = [];
  lines.forEach((line, index) => {
    let fontSize = line.size ?? 300;
    context.font = line.font.replace('{size}', `${fontSize}px`);
    const measured = context.measureText(line.text).width;
    const maxWidth = canvas.width * 0.94;
    if (measured > maxWidth) fontSize *= maxWidth / measured;
    context.font = line.font.replace('{size}', `${fontSize}px`);
    const color = `rgb(${index + 1}, 0, 0)`;
    context.fillStyle = color;
    context.fillText(line.text, canvas.width / 2, lineHeight * (index + 0.8));
    const hex = new THREE.Color(line.color).getHex(); // sRGB bytes
    colorsByLine.push([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]);
  });
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const hits = [];
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] > 140) hits.push(index / 4);
  }
  const { count, positions, colors } = into ?? makeTextures(size);
  const world = width / canvas.width;
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pixel = hits.length ? hits[(Math.random() * hits.length) | 0] : 0;
    const px = (pixel % canvas.width) + Math.random() - 0.5;
    const py = Math.floor(pixel / canvas.width) + Math.random() - 0.5;
    const line = Math.max(0, (data[pixel * 4] || 1) - 1);
    positions[o] = (px - canvas.width / 2) * world;
    positions[o + 1] = -(py - canvas.height / 2) * world + 0.1;
    positions[o + 2] = gauss() * 0.03;
    positions[o + 3] = px / canvas.width;
    const color = colorsByLine[Math.min(line, colorsByLine.length - 1)];
    colors[o] = color[0];
    colors[o + 1] = color[1];
    colors[o + 2] = color[2];
    colors[o + 3] = 230;
  }
  if (into) return into;
  return { ...finish(size, positions, colors), positions, colors, count };
}

// Starting cloud for the intro.
export function scatterPositions(size) {
  const count = size * size;
  const data = new Float32Array(count * 4);
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const r = 4 + Math.random() * 5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Above the frame: the flower falls into the sea and gathers as it sinks.
    data[o] = r * Math.sin(phi) * Math.cos(theta) * 0.6;
    data[o + 1] = Math.abs(r * Math.cos(phi)) + 5;
    data[o + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.6 - 2;
    data[o + 3] = Math.random(); // per-particle seed, kept for life
  }
  return data;
}

// Services: one glowing organ per capability, strung together by filaments,
// like a siphonophore. Node positions come from the DOM cards (in world
// units), so each orb sits exactly above its card. w = node index for orbs
// (used to light one up on hover), -1 elsewhere.
export function networkTargets(size, nodes, { into, path = null, style = 'orb' }) {
  const { count, positions, colors } = into;
  const n = nodes.length;
  const order = path ?? nodes.map((_, index) => index);
  const set = (o, x, y, z, w, r, g, b, a) => {
    positions[o] = x; positions[o + 1] = y; positions[o + 2] = z; positions[o + 3] = w;
    colors[o] = r; colors[o + 1] = g; colors[o + 2] = b; colors[o + 3] = a;
  };
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
  });
  const orb = Math.max(0.12, Math.min(0.3, (maxX - minX) / Math.max(1, n) * 0.28));
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    if (style === 'burst' && pick < 0.66) {
      // 花火: rays from each node, denser toward the tips, drooping as they fall.
      const k = particle % n;
      const node = nodes[k];
      const ray = Math.floor(Math.random() * 30);
      const angle = (ray / 30) * Math.PI * 2 + Math.sin(ray * 3.7 + k) * 0.05;
      const t = Math.pow(Math.random(), 0.55);
      const radius = orb * 1.35 * t;
      const tip = t > 0.92;
      set(o,
        node.x + Math.cos(angle) * radius,
        node.y + Math.sin(angle) * radius - t * t * orb * 0.35,
        Math.sin(angle * 2.0) * radius * 0.3,
        k,
        tip ? 255 : 255, tip ? 240 : 150 + (1 - t) * 90, tip ? 200 : 70 + (1 - t) * 60, tip ? 255 : 150 + (1 - t) * 100);
      continue;
    }
    if (pick < 0.56) {
      const k = particle % n;
      const node = nodes[k];
      const radius = orb * Math.pow(Math.random(), 1.7);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const core = 1 - radius / orb;
      set(o,
        node.x + radius * Math.sin(phi) * Math.cos(theta),
        node.y + radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
        k,
        255, 120 + core * 110, 170 + core * 40, 120 + core * 135);
    } else if (pick < 0.66) {
      const k = particle % n;
      const node = nodes[k];
      const angle = Math.random() * Math.PI * 2;
      const ring = orb * 1.55 + gauss() * orb * 0.03;
      set(o, node.x + Math.cos(angle) * ring, node.y + Math.sin(angle) * ring * 0.32, Math.sin(angle) * ring * 0.5, k, 150, 240, 255, 150);
    } else if (pick < 0.92) {
      // Filament between consecutive organs, sagging like a tentacle.
      const k = Math.floor(Math.random() * (order.length - 1));
      const a = nodes[order[k]];
      const b = nodes[order[k + 1]];
      const t = Math.random();
      const sag = Math.sin(t * Math.PI) * orb * 1.1;
      set(o,
        a.x + (b.x - a.x) * t + gauss() * 0.012,
        a.y + (b.y - a.y) * t - sag + gauss() * 0.012,
        gauss() * 0.02,
        -1,
        style === 'burst' ? 255 : 120, style === 'burst' ? 190 : 225, style === 'burst' ? 120 : 255, 90);
    } else {
      set(o,
        minX + (Math.random() * 1.3 - 0.15) * (maxX - minX + 0.01),
        minY + (Math.random() * 1.6 - 0.3) * (maxY - minY + 0.5),
        gauss() * 0.6,
        -1,
        220, 235, 255, 45);
    }
  }
  return into;
}

// ---------------------------------------------------------------------------
// Four seasons. Every flower that falls into the sea becomes a jellyfish:
// each season has a flower (spring 桜, summer 花火, autumn 秋桜, winter 六花)
// and a jellyfish. Jellies share the medusa w-encoding used by jellyTargets.
// ---------------------------------------------------------------------------

const hex = (value) => {
  const color = new THREE.Color(value).getHex();
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
};
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const writer = (positions, colors) => (o, x, y, z, w, rgb, a) => {
  positions[o] = x; positions[o + 1] = y; positions[o + 2] = z; positions[o + 3] = w;
  colors[o] = rgb[0]; colors[o + 1] = rgb[1]; colors[o + 2] = rgb[2]; colors[o + 3] = a;
};

// 春: cherry blossom, five notched petals, stamens with anthers.
export function sakuraTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const R = 1.45;
  const deep = hex('#d9467a');
  const mid = hex('#ffb3cb');
  const pale = hex('#fff1f5');
  const anther = hex('#f4c24d');
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    if (pick < 0.84) {
      const k = Math.floor(Math.random() * 5);
      const phi = (Math.random() * 2 - 1) * 0.6;
      const shape = Math.pow(Math.max(0.0001, Math.cos(phi * 2.45)), 0.55);
      const notch = 1 - 0.22 * Math.exp(-((phi / 0.085) ** 2));
      const rmax = R * shape * notch;
      const r = Math.sqrt(Math.random()) * rmax;
      const angle = (k / 5) * Math.PI * 2 + Math.PI / 2 + phi;
      const t = r / Math.max(0.001, rmax);
      const vein = 1 + Math.sin(phi * 46) * 0.035;
      const rgb = (t < 0.35 ? mixRgb(deep, mid, t / 0.35) : mixRgb(mid, pale, (t - 0.35) / 0.65)).map((c) => Math.min(255, c * vein));
      set(o, Math.cos(angle) * r, Math.sin(angle) * r, (r / R) ** 2 * 0.38 + gauss() * 0.006, r / R, rgb, 235);
    } else if (pick < 0.96) {
      const k = Math.floor(Math.random() * 38);
      const angle = (k / 38) * Math.PI * 2 + Math.sin(k * 7.1) * 0.08;
      const length = 0.3 + (k % 3) * 0.07;
      const isAnther = Math.random() < 0.32;
      const t = isAnther ? 1 : Math.random();
      const r = t * length + (isAnther ? gauss() * 0.012 : 0);
      set(o, Math.cos(angle) * r + (isAnther ? gauss() * 0.012 : 0), Math.sin(angle) * r, 0.1 + t * 0.14, r / R, isAnther ? anther : mixRgb(deep, pale, t), 255);
    } else {
      const r = Math.sqrt(Math.random()) * 0.11;
      const angle = Math.random() * Math.PI * 2;
      set(o, Math.cos(angle) * r, Math.sin(angle) * r, 0.06, r / R, hex('#b8325f'), 255);
    }
  }
  return finish(size, positions, colors);
}

// 冬: 六花, the six-flowered snow crystal (a hexagonal dendrite).
export function snowCrystalTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const R = 1.6;
  const white = hex('#f6fcff');
  const ice = hex('#9fe6ff');
  const branchAt = [0.28, 0.42, 0.56, 0.7, 0.84];
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    const k = Math.floor(Math.random() * 6);
    const armAngle = (k / 6) * Math.PI * 2 + Math.PI / 2;
    let x;
    let y;
    let r;
    if (pick < 0.3) {
      const t = Math.random();
      r = t * R;
      const thick = 0.016 * (1 - t * 0.6);
      x = Math.cos(armAngle) * r + gauss() * thick;
      y = Math.sin(armAngle) * r + gauss() * thick;
    } else if (pick < 0.82) {
      const s = branchAt[Math.floor(Math.random() * branchAt.length)];
      const length = (1 - s) * 0.62 * R;
      const side = Math.random() < 0.5 ? 1 : -1;
      const angle = armAngle + side * Math.PI / 3;
      const t = Math.random();
      const bx = Math.cos(armAngle) * s * R;
      const by = Math.sin(armAngle) * s * R;
      x = bx + Math.cos(angle) * t * length + gauss() * 0.009;
      y = by + Math.sin(angle) * t * length + gauss() * 0.009;
      r = Math.hypot(x, y);
    } else if (pick < 0.94) {
      const a = Math.random() * Math.PI * 2;
      const hexR = 0.24 * R / Math.cos(((a % (Math.PI / 3)) - Math.PI / 6));
      const t = Math.random() < 0.5 ? 1 : Math.sqrt(Math.random());
      r = hexR * t;
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
    } else {
      r = Math.sqrt(Math.random()) * R * 1.15;
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
      set(o, x, y, gauss() * 0.2, r / R, white, 50);
      continue;
    }
    set(o, x, y, gauss() * 0.012, r / R, mixRgb(white, ice, Math.min(1, r / R)), 240);
  }
  return finish(size, positions, colors);
}

// Shared medusa builder: bell + tentacles + arms + gonads with palettes.
function medusa(size, spec) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const bell = (u, theta, shell = 1) => {
    const phi = u * spec.rim;
    const lobes = 1 + (spec.lobes ?? 0.06) * Math.sin(theta * 8) * u * u;
    const radius = spec.radius * shell * lobes;
    return [radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi) * spec.height + spec.top, radius * Math.sin(phi) * Math.sin(theta)];
  };
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    const [pBell, pTent, pArm] = spec.share;
    if (pick < pBell) {
      const u = Math.sqrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const inner = Math.random() < 0.28;
      const [x, y, z] = bell(u, theta, inner ? 0.9 : 1 + gauss() * 0.008);
      const rim = Math.pow(u, 6);
      set(o, x, y, z, u * 0.499, spec.bellColor(u, theta, rim, inner), inner ? spec.bellAlpha * 0.6 : spec.bellAlpha + rim * (255 - spec.bellAlpha));
    } else if (pick < pBell + pTent) {
      const k = Math.floor(Math.random() * spec.tentacles);
      const theta = (k / spec.tentacles) * Math.PI * 2 + Math.sin(k * 12.9) * 0.05;
      const t = Math.pow(Math.random(), spec.tentacleBias ?? 0.8);
      const [rx, ry, rz] = bell(0.985, theta);
      const length = spec.length * (0.8 + Math.abs(Math.sin(k * 7.3)) * 0.4);
      const spread = spec.spread ?? 0.18;
      const flare = spread * Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) * (spec.burst ? 6 * t : 1);
      set(o,
        rx * (1 + flare) + gauss() * 0.006,
        ry - t * length * (spec.burst ? 0.75 : 1),
        rz * (1 + flare) + gauss() * 0.006,
        1 + t * 0.999, spec.tentacleColor(t, k), spec.tentacleAlpha(t));
    } else if (pick < pBell + pTent + pArm && spec.ribbonArms) {
      // Oral arms as soft, ruffled ribbons that curl as they hang.
      const k = Math.floor(Math.random() * 4);
      const theta = (k / 4) * Math.PI * 2 + 0.4;
      const t = Math.random();
      const across = Math.random() - 0.5;
      const width = 0.13 * (1 - t * 0.55);
      const curl = Math.sin(t * 3.2 + k) * 0.12 * t;
      const ruffle = Math.sin(t * 22 + across * 5 + k * 2) * 0.035 * (0.4 + t);
      const radial = 0.07 + t * 0.13 + curl;
      const nx = Math.cos(theta + Math.PI / 2);
      const nz = Math.sin(theta + Math.PI / 2);
      set(o,
        Math.cos(theta) * radial + nx * (across * width + ruffle),
        spec.top - 0.28 - t * spec.armLength + Math.abs(across) * 0.04 * (1 - t),
        Math.sin(theta) * radial + nz * (across * width + ruffle),
        2 + t * 0.999, spec.armColor(t), Math.round(spec.armAlpha * (1 - t * 0.6)));
    } else if (pick < pBell + pTent + pArm) {
      const k = Math.floor(Math.random() * 4);
      const theta = (k / 4) * Math.PI * 2 + 0.4;
      const t = Math.random();
      const frill = 0.13 * t * Math.sin(t * 24 + Math.random() * 6);
      set(o,
        Math.cos(theta) * (0.1 + t * 0.2) + Math.cos(theta + 1.57) * frill,
        spec.top - 0.35 - t * spec.armLength,
        Math.sin(theta) * (0.1 + t * 0.2) + Math.sin(theta + 1.57) * frill,
        2 + t * 0.999, spec.armColor(t), 190);
    } else {
      spec.inner(o, set);
    }
  }
  return finish(size, positions, colors);
}

// 春: moon jelly (ミズクラゲ): a flat glassy disc with four pink rings.
export function moonJellyTargets(size) {
  // Aurelia aurita, as it looks in water: nearly clear, the rim catching a
  // little light, four soft gonad rings, fine hair-like marginal tentacles.
  const glass = hex('#cfe6ee');
  const rimLight = hex('#eef8fb');
  const gonad = hex('#e6b2cc');
  const gonadDeep = hex('#c7a6dc');
  const arm = hex('#ead7e2');
  return medusa(size, {
    radius: 1.55, rim: 1.22, height: 0.4, top: 0.6, lobes: 0.035,
    share: [0.55, 0.2, 0.12], tentacles: 160, length: 0.5, tentacleBias: 1, spread: 0.015, armLength: 0.95,
    ribbonArms: true, armAlpha: 105,
    bellAlpha: 46,
    bellColor: (u, theta, rim) => mixRgb(glass, rimLight, rim),
    tentacleColor: (t) => mixRgb(rimLight, glass, t),
    tentacleAlpha: (t) => 95 - t * 75,
    armColor: (t) => mixRgb(arm, glass, t),
    inner: (o, set) => {
      const k = Math.floor(Math.random() * 4);
      const cx = Math.cos((k / 4) * Math.PI * 2 + Math.PI / 4) * 0.5;
      const cz = Math.sin((k / 4) * Math.PI * 2 + Math.PI / 4) * 0.5;
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + Math.PI + (Math.random() - 0.5) * Math.PI * 1.65;
      const ring = 0.26 + gauss() * 0.022;
      set(o, cx + Math.cos(a) * ring, 0.6 + 1.55 * 0.4 * 0.93, cz + Math.sin(a) * ring, 3, mixRgb(gonad, gonadDeep, Math.random()), 150);
    },
  });
}

// 夏: a jellyfish that bursts like a firework (花火 = fire-flower).
export function fireworkJellyTargets(size) {
  const gold = hex('#ffe08a');
  const orange = hex('#ff8a3d');
  const red = hex('#ff3f6e');
  return medusa(size, {
    radius: 0.75, rim: 1.45, height: 0.8, top: 0.9, lobes: 0.1,
    share: [0.3, 0.58, 0.07], tentacles: 72, length: 3.1, tentacleBias: 0.7, spread: 0.2, burst: true, armLength: 1.1,
    bellAlpha: 170,
    bellColor: (u, theta, rim) => mixRgb(gold, orange, u),
    tentacleColor: (t) => (t < 0.5 ? mixRgb(gold, orange, t * 2) : mixRgb(orange, red, (t - 0.5) * 2)),
    tentacleAlpha: (t) => 230 - t * 150,
    armColor: (t) => mixRgb(gold, red, t),
    inner: (o, set) => {
      const r = Math.pow(Math.random(), 2) * 0.35;
      const a = Math.random() * Math.PI * 2;
      set(o, Math.cos(a) * r, 1.3 + gauss() * 0.05, Math.sin(a) * r, 3, hex('#fff6d8'), 255);
    },
  });
}

// 秋: the cosmos medusa, in autumn colours (rose, coral, gold).
export function autumnJellyTargets(size) {
  const rose = hex('#ff6f9d');
  const coral = hex('#ff9a6b');
  const gold = hex('#ffd38a');
  const wine = hex('#a8325a');
  return medusa(size, {
    radius: 1.15, rim: 1.75, height: 0.78, top: 0.9, lobes: 0.07,
    share: [0.46, 0.4, 0.11], tentacles: 40, length: 3.4, spread: 0.18, armLength: 2.3,
    bellAlpha: 150,
    bellColor: (u, theta, rim) => mixRgb(rose, gold, rim),
    tentacleColor: (t) => mixRgb(coral, wine, t),
    tentacleAlpha: (t) => 200 - t * 120,
    armColor: (t) => mixRgb(rose, coral, t),
    inner: (o, set) => {
      const k = Math.floor(Math.random() * 4);
      const angle = (k / 4) * Math.PI * 2 + Math.random() * 1.3;
      const ring = 0.32 + gauss() * 0.02;
      set(o, Math.cos(angle) * ring, 1.35 + gauss() * 0.03, Math.sin(angle) * ring, 3, gold, 255);
    },
  });
}

// 冬: comb jelly (クシクラゲ): a glass egg with eight rainbow comb rows.
export function combJellyTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const glass = hex('#e8f7ff');
  const color = new THREE.Color();
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    if (pick < 0.46) {
      const u = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const lat = u * Math.PI;
      set(o, Math.sin(lat) * Math.cos(theta) * 0.62, Math.cos(lat) * 1.05, Math.sin(lat) * Math.sin(theta) * 0.62, u * 0.499, glass, 60 + Math.random() * 50);
    } else if (pick < 0.86) {
      const row = Math.floor(Math.random() * 8);
      const theta = (row / 8) * Math.PI * 2;
      const v = 0.14 + Math.random() * 0.72;
      const lat = v * Math.PI;
      color.setHSL(((row / 8) + v * 0.7) % 1, 0.95, 0.62);
      const rgb = hex(`#${color.getHexString()}`);
      set(o, Math.sin(lat) * Math.cos(theta) * 0.66, Math.cos(lat) * 1.09, Math.sin(lat) * Math.sin(theta) * 0.66, v * 0.499, rgb, 230);
    } else {
      const side = Math.random() < 0.5 ? -1 : 1;
      const t = Math.random();
      const filament = Math.random() < 0.4 ? Math.sin(t * 60) * 0.12 * t : 0;
      set(o, side * (0.5 + t * 0.4) + filament, -0.1 - t * 3.1, gauss() * 0.02, 1 + t * 0.999, mixRgb(glass, hex('#ffc3dc'), t), 170 - t * 110);
    }
  }
  return finish(size, positions, colors);
}

// The protagonist medusa (tall bell, long tentacles) in natural colour:
// clear glassy bell, the margin catching light, soft pink gonads, fine
// tentacles fading out, ruffled oral arms.
export function medusaTargets(size) {
  const glass = hex('#cfe4ec');
  const rimLight = hex('#f3fbfd');
  const blush = hex('#f1c3d2');
  const tentacle = hex('#e9dfe8');
  const arm = hex('#efd6e1');
  const R = 1.15;
  const RIM = 1.72;
  const HEIGHT = 0.8;
  const TOP = 0.9;
  const rimRadius = R * Math.sin(RIM);
  const rimY = R * Math.cos(RIM) * HEIGHT + TOP;
  const apexInner = R * 0.9 * HEIGHT + TOP;
  return medusa(size, {
    radius: R, rim: RIM, height: HEIGHT, top: TOP, lobes: 0.05,
    share: [0.47, 0.34, 0.09], tentacles: 36, length: 3.3, spread: 0.12, armLength: 2,
    ribbonArms: true, armAlpha: 95,
    bellAlpha: 52,
    bellColor: (u, theta, rimAmount) => mixRgb(glass, rimLight, rimAmount),
    tentacleColor: (t) => mixRgb(tentacle, glass, t),
    tentacleAlpha: (t) => 120 - t * 100,
    armColor: (t) => mixRgb(arm, glass, t),
    // The parts that hold the animal together: the stalk from the crown to
    // the arms, the bright margin where the tentacles grow, the gonads.
    inner: (o, set) => {
      const pick = Math.random();
      if (pick < 0.4) {
        // manubrium: a ruffled stalk from inside the crown down to the arms
        const t = Math.random();
        const angle = Math.random() * Math.PI * 2;
        const radius = (0.08 + t * 0.07) * (1 + 0.25 * Math.sin(angle * 4 + t * 9));
        set(o, Math.cos(angle) * radius, apexInner - 0.12 - t * (apexInner - 0.12 - (TOP - 0.28)), Math.sin(angle) * radius, 2 + t * 0.04, mixRgb(arm, glass, 0.3), 110);
      } else if (pick < 0.75) {
        // margin: a dense ring where bell and tentacles meet
        const angle = Math.random() * Math.PI * 2;
        const lobes = 1 + 0.05 * Math.sin(angle * 8);
        const r = rimRadius * lobes * (0.97 + Math.random() * 0.04);
        set(o, Math.cos(angle) * r, rimY + gauss() * 0.015, Math.sin(angle) * r, 0.495, rimLight, 175);
      } else {
        const k = Math.floor(Math.random() * 4);
        const angle = (k / 4) * Math.PI * 2 + (Math.random() - 0.5) * 1.1;
        const ring = 0.3 + gauss() * 0.02;
        set(o, Math.cos(angle) * ring, 1.36 + gauss() * 0.03, Math.sin(angle) * ring, 3, blush, 150);
      }
    },
  });
}

// 夏: a single kiku (chrysanthemum) firework, the firework named after a
// flower. Rays leave evenly in every direction (Fibonacci sphere), dense at
// the tips, drooping under gravity. w = one of eight sectors (0-7) around the
// centre, so each service can light its own sector; -1 for falling sparks.
export function hanabiTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const R = 1.55;
  const rays = 140;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const core = hex('#f4ffd2');
  const gold = hex('#d8f27a');
  const peach = hex('#f2c965');
  const rose = hex('#e8a24c');
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    if (pick < 0.88) {
      const ray = Math.floor(Math.random() * rays);
      const y = 1 - (2 * (ray + 0.5)) / rays;
      const ring = Math.sqrt(1 - y * y);
      const theta = ray * golden;
      const dx = Math.cos(theta) * ring;
      const dz = Math.sin(theta) * ring;
      const t = Math.pow(Math.random(), 0.5);
      const r = R * t;
      const tip = t > 0.95;
      const sector = Math.floor((((Math.atan2(y, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 8) % 8;
      const rgb = t < 0.45 ? mixRgb(core, gold, t / 0.45) : mixRgb(gold, ray % 3 === 0 ? rose : peach, (t - 0.45) / 0.55);
      set(o,
        dx * r + gauss() * 0.006 * (1 + t),
        y * r - t * t * 0.32 + gauss() * 0.006,
        dz * r + gauss() * 0.006 * (1 + t),
        sector, tip ? core : rgb, tip ? 255 : 70 + t * 150);
    } else if (pick < 0.94) {
      const r = Math.pow(Math.random(), 2.2) * 0.2;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const sector = Math.floor((((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 8) % 8;
      set(o, Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r, sector, core, 230);
    } else {
      set(o, gauss() * R * 0.55, -0.2 - Math.random() * R * 1.3, gauss() * 0.35, -1, gold, 45);
    }
  }
  return finish(size, positions, colors);
}

// 秋: a Japanese maple leaf (Acer palmatum), built like the real thing.
// Seven slender, pointed lobes fan out from the base where the petiole
// attaches (not from a centre); the sinuses between them are cut deep, the
// margins are doubly serrate, a main vein runs from the base to every tip.
// The two lowest lobes point out and down beside the petiole.
const MAPLE_LOBES = [
  { angle: 0, length: 1, width: 0.16 },
  { angle: 40, length: 0.95, width: 0.155 },
  { angle: -40, length: 0.95, width: 0.155 },
  { angle: 80, length: 0.78, width: 0.135 },
  { angle: -80, length: 0.78, width: 0.135 },
  { angle: 120, length: 0.46, width: 0.095 },
  { angle: -120, length: 0.46, width: 0.095 },
].map((lobe) => {
  const radians = (lobe.angle * Math.PI) / 180;
  return { ...lobe, dx: Math.sin(radians), dy: Math.cos(radians) };
});

// Half-width of a lobe at distance s along its axis: narrow at the sinus,
// widest a little under halfway, drawn to a long point, with double serration.
function lobeHalfWidth(lobe, s) {
  const u = s / lobe.length;
  if (u <= 0 || u >= 1) return -1;
  const body = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.3) * Math.pow(1 - u, 0.14);
  const teeth = 1 + (0.08 * Math.abs(Math.sin(u * 44)) + 0.04 * Math.abs(Math.sin(u * 93))) * Math.min(1, u * 2.2);
  return lobe.width * body * teeth;
}

function insideMaple(x, y) {
  if (Math.hypot(x, y - 0.04) < 0.16) return true; // the palm where lobes join
  for (const lobe of MAPLE_LOBES) {
    const s = x * lobe.dx + y * lobe.dy;
    const d = Math.abs(x * lobe.dy - y * lobe.dx);
    if (d < lobeHalfWidth(lobe, s)) return true;
  }
  return false;
}

export function mapleTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const R = 1.75;
  const gold = hex('#f0a93c');
  const vermilion = hex('#e0492a');
  const crimson = hex('#b3172f');
  const vein = hex('#8e1b24');
  const stem = hex('#7a2a20');
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const pick = Math.random();
    if (pick < 0.86) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 40; tries += 1) {
        x = Math.random() * 2 - 1;
        y = Math.random() * 1.45 - 0.45;
        if (insideMaple(x, y)) break;
      }
      const r = Math.hypot(x, y);
      // warm at the base, reddening toward the tips, with a soft blush
      const blush = 0.08 * Math.sin(x * 5.3 + y * 3.1);
      const t = Math.min(1, Math.max(0, r * 1.1 + blush));
      const rgb = t < 0.35 ? mixRgb(gold, vermilion, t / 0.35) : mixRgb(vermilion, crimson, (t - 0.35) / 0.65);
      set(o, x * R, y * R, (x * x) * 0.12 - r * 0.08 + gauss() * 0.004, r, rgb, 235);
    } else if (pick < 0.97) {
      const lobe = MAPLE_LOBES[Math.floor(Math.random() * MAPLE_LOBES.length)];
      const s = Math.random() * lobe.length * 0.95;
      const x = lobe.dx * s + gauss() * 0.003;
      const y = lobe.dy * s + gauss() * 0.003;
      set(o, x * R, y * R, (x * x) * 0.12 + 0.012, s, vein, 200);
    } else {
      const t = Math.random();
      set(o, Math.sin(t * 1.1) * 0.05 * R, -t * 0.42 * R, 0.02, t * 0.3, stem, 230);
    }
  }
  return finish(size, positions, colors);
}


// ---------------------------------------------------------------------------
// Falling leaves and snow: many small pieces instead of one big one. Each
// particle belongs to one leaf/flake; a second texture stores that piece's
// centre and seed so the simulation can make every piece fall at its own
// speed, sway, and tumble about its own centre.
// ---------------------------------------------------------------------------

function randomRotation() {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2));
  return new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
}

function applyRotation(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
}

function centreTexture(size, data) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}

function makePieces(count, near) {
  return Array.from({ length: count }, () => {
    const close = Math.random() < near;
    return {
      centre: [(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 14, close ? 0.5 + Math.random() * 2.5 : -10 + Math.random() * 10],
      scale: close ? 0.32 + Math.random() * 0.14 : 0.13 + Math.random() * 0.17,
      rotation: randomRotation(),
      tone: Math.random(),
      seed: Math.random(),
    };
  });
}

// 秋: about 110 small Japanese maple leaves, each coloured on its own.
export function mapleFallTargets(size, leaves = 110) {
  const { count, positions, colors } = makeTextures(size);
  const centres = new Float32Array(count * 4);
  const set = writer(positions, colors);
  const pieces = makePieces(leaves, 0.1);
  const gold = hex('#f0a93c');
  const vermilion = hex('#e0492a');
  const crimson = hex('#b3172f');
  const vein = hex('#8e1b24');
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const leaf = pieces[particle % leaves];
    let x = 0;
    let y = 0;
    let isVein = false;
    if (Math.random() < 0.9) {
      for (let tries = 0; tries < 40; tries += 1) {
        x = Math.random() * 2 - 1;
        y = Math.random() * 1.45 - 0.45;
        if (insideMaple(x, y)) break;
      }
    } else {
      const lobe = MAPLE_LOBES[Math.floor(Math.random() * MAPLE_LOBES.length)];
      const along = Math.random() * lobe.length * 0.95;
      x = lobe.dx * along;
      y = lobe.dy * along;
      isVein = true;
    }
    const r = Math.hypot(x, y);
    // each leaf has turned by a different amount: some still gold, some deep red
    const turn = Math.min(1, r * 0.8 + leaf.tone * 0.7);
    const rgb = isVein ? vein : turn < 0.45 ? mixRgb(gold, vermilion, turn / 0.45) : mixRgb(vermilion, crimson, (turn - 0.45) / 0.55);
    const k = leaf.scale * 1.75;
    const [lx, ly, lz] = applyRotation(leaf.rotation, x * k, y * k, x * x * 0.1 * k);
    const [cx, cy, cz] = leaf.centre;
    set(o, cx + lx, cy + ly, cz + lz, leaf.seed, rgb, isVein ? 210 : 235);
    centres.set([cx, cy, cz, leaf.seed], o);
  }
  return { ...finish(size, positions, colors), center: centreTexture(size, centres) };
}

// A six-armed dendrite in unit radius: main arms, side branches, a hexagon.
function sampleSnowflake() {
  const k = Math.floor(Math.random() * 6);
  const armAngle = (k / 6) * Math.PI * 2 + Math.PI / 2;
  const pick = Math.random();
  if (pick < 0.38) {
    const t = Math.random();
    return [Math.cos(armAngle) * t + gauss() * 0.012, Math.sin(armAngle) * t + gauss() * 0.012];
  }
  if (pick < 0.88) {
    const at = [0.3, 0.46, 0.62, 0.78][Math.floor(Math.random() * 4)];
    const length = (1 - at) * 0.6;
    const side = Math.random() < 0.5 ? 1 : -1;
    const angle = armAngle + side * Math.PI / 3;
    const t = Math.random();
    return [Math.cos(armAngle) * at + Math.cos(angle) * t * length, Math.sin(armAngle) * at + Math.sin(angle) * t * length];
  }
  const a = Math.random() * Math.PI * 2;
  const r = 0.2 / Math.cos(((a % (Math.PI / 3)) - Math.PI / 6));
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// 冬: about 150 small snow crystals (六花), slower and steadier than leaves.
export function snowFallTargets(size, flakes = 150) {
  const { count, positions, colors } = makeTextures(size);
  const centres = new Float32Array(count * 4);
  const set = writer(positions, colors);
  const pieces = makePieces(flakes, 0.08).map((piece) => ({ ...piece, scale: piece.scale * 0.8 }));
  const white = hex('#f6fcff');
  const ice = hex('#a9e8ff');
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const flake = pieces[particle % flakes];
    const [x, y] = sampleSnowflake();
    const r = Math.hypot(x, y);
    const k = flake.scale;
    const [lx, ly, lz] = applyRotation(flake.rotation, x * k, y * k, 0);
    const [cx, cy, cz] = flake.centre;
    set(o, cx + lx, cy + ly, cz + lz, 2 + flake.seed, mixRgb(white, ice, Math.min(1, r)), 235);
    // seed + 2 marks snow: the simulation lets it fall slower and sway less
    centres.set([cx, cy, cz, 2 + flake.seed], o);
  }
  return { ...finish(size, positions, colors), center: centreTexture(size, centres) };
}

// Key visual: Jellyfish × Beautiful flower, literally. The photographed
// cosmos is wrapped over a medusa's bell (the flower's centre at the crown,
// petals spreading down the dome) and its stem hangs as the central stalk.
// w follows the medusa encoding (bell u / arm t) so it beats and swims with
// the medusa it is wrapped around.
export function cosmosBellTargets(size, image) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  const scale = 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO.width * scale;
  canvas.height = PHOTO.height * scale;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const head = [];
  const stem = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      if (data[index + 3] < 150) continue;
      const px = x / scale;
      const py = y / scale;
      const r = Math.hypot(px - PHOTO.cx, py - PHOTO.cy) / PHOTO.radius;
      (r < 1.05 && py < PHOTO.cy + PHOTO.radius * 1.02 ? head : stem).push(index);
    }
  }
  const R = 1.2;
  const H = 0.8;
  const TOP = 0.8;
  const stemTop = PHOTO.cy + PHOTO.radius;
  const stemLength = PHOTO.height - stemTop;
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const fromStem = Math.random() < 0.08 && stem.length;
    const pool = fromStem ? stem : head;
    const index = pool[(Math.random() * pool.length) | 0];
    const pixel = index / 4;
    const px = (pixel % canvas.width) / scale + (Math.random() - 0.5) / scale;
    const py = Math.floor(pixel / canvas.width) / scale + (Math.random() - 0.5) / scale;
    const rgb = [data[index], data[index + 1], data[index + 2]];
    if (fromStem) {
      const t = Math.min(1, Math.max(0, (py - stemTop) / stemLength));
      const sway = (px - PHOTO.cx) / PHOTO.radius * R * 0.4;
      set(o, sway, TOP + 0.35 - t * 2.6, gauss() * 0.01, 2 + t * 0.99, rgb, 235);
    } else {
      const r = Math.min(1.05, Math.hypot(px - PHOTO.cx, py - PHOTO.cy) / PHOTO.radius);
      const theta = Math.atan2(py - PHOTO.cy, px - PHOTO.cx);
      const phi = r * 1.62;
      set(o,
        R * Math.sin(phi) * Math.cos(theta),
        R * Math.cos(phi) * H + TOP + gauss() * 0.004,
        R * Math.sin(phi) * Math.sin(theta),
        Math.min(0.499, r * 0.499), rgb, 240);
    }
  }
  return finish(size, positions, colors);
}

// 春: cherry blossoms scattering — small whole flowers and loose petals,
// each falling, swaying and tumbling on its own (FALL form, like autumn).
export function sakuraFallTargets(size, pieces = 120) {
  const { count, positions, colors } = makeTextures(size);
  const centres = new Float32Array(count * 4);
  const set = writer(positions, colors);
  const list = makePieces(pieces, 0.1).map((piece, index) => ({ ...piece, blossom: index % 3 === 0, scale: piece.scale * (index % 3 === 0 ? 0.9 : 0.55) }));
  const deep = hex('#e0508a');
  const mid = hex('#ffb3cb');
  const pale = hex('#fff2f6');
  // one notched petal in unit length, base at the origin, pointing +y
  const petal = () => {
    for (let tries = 0; tries < 30; tries += 1) {
      const u = Math.random();
      const v = Math.random() * 2 - 1;
      const width = 0.36 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8);
      const notch = u > 0.86 && Math.abs(v) < 0.18 * (u - 0.86) / 0.14 * 1.2;
      if (Math.abs(v) < 1 && Math.abs(v * 0.36) < width && !notch) return [v * 0.36, u];
    }
    return [0, 0.5];
  };
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const piece = list[particle % pieces];
    let x;
    let y;
    let t;
    if (piece.blossom) {
      const k = Math.floor(Math.random() * 5);
      const [px, py] = petal();
      const angle = (k / 5) * Math.PI * 2;
      x = px * Math.cos(angle) - py * Math.sin(angle);
      y = px * Math.sin(angle) + py * Math.cos(angle);
      t = py;
    } else {
      [x, y] = petal();
      y -= 0.5;
      t = y + 0.5;
    }
    const rgb = t < 0.25 ? mixRgb(deep, mid, t / 0.25) : mixRgb(mid, pale, Math.min(1, (t - 0.25) / 0.75));
    const k = piece.scale;
    const [lx, ly, lz] = applyRotation(piece.rotation, x * k, y * k, (x * x) * 0.4 * k);
    const [cx, cy, cz] = piece.centre;
    set(o, cx + lx, cy + ly, cz + lz, piece.seed, rgb, 235);
    // petals fall a little slower than leaves: seed stays in [0, 1) (leaf-like)
    centres.set([cx, cy, cz, piece.seed * 0.6], o);
  }
  return { ...finish(size, positions, colors), center: centreTexture(size, centres) };
}

// Key visual: the year as a ring. A slow halo inside the colossal medusa's
// bell, its colour running round the four seasons that follow — sakura,
// fireflies, maple, snow — with a little dust drifting in and out of it.
export function seasonsRingTargets(size) {
  const { count, positions, colors } = makeTextures(size);
  const set = writer(positions, colors);
  // pale, light-like hues rather than paint: a halo, not a colour wheel
  const anchors = [hex('#ffd7e4'), hex('#e6f6b4'), hex('#f5a07e'), hex('#e4f5ff')];
  const accents = [hex('#fff7fa'), hex('#fbffe2'), hex('#ffd8a8'), hex('#ffffff')];
  const seasonColour = (angle) => {
    const u = ((angle / (Math.PI * 2)) % 1 + 1) % 1 * 4;
    const i = Math.floor(u);
    const f = u - i;
    const blend = f < 0.7 ? 0 : (f - 0.7) / 0.3; // hold each season, then turn
    return { base: mixRgb(anchors[i], anchors[(i + 1) % 4], blend * blend * (3 - 2 * blend)), accent: accents[i] };
  };
  for (let particle = 0; particle < count; particle += 1) {
    const o = particle * 4;
    const angle = Math.random() * Math.PI * 2;
    const { base, accent } = seasonColour(angle);
    const pick = Math.random();
    if (pick < 0.8) {
      const r = 1 + gauss() * 0.022;
      const y = gauss() * 0.018;
      set(o, Math.cos(angle) * r, y, Math.sin(angle) * r, r, Math.random() < 0.15 ? accent : base, 190);
    } else {
      // dust leaving and joining the ring
      const r = 0.55 + Math.random() * 0.9;
      set(o, Math.cos(angle) * r, gauss() * 0.16, Math.sin(angle) * r, r, base, 80);
    }
  }
  return finish(size, positions, colors);
}
