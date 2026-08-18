import * as THREE from 'three';

const MAX_ABOUT_PARTICLES = 16000;
const PORTRAIT_SHARE = 0.62;
const ARTWORK_WIDTH = 1440;
const ARTWORK_HEIGHT = 708;
const DESIGN_WIDTH = 2.4;
const DESIGN_HEIGHT = 1.18;
const PORTRAIT_RECT = { x: 24, y: 0, width: 492, height: 708 };
const PORTRAIT_FOCUS = { x: 0.642, y: 0.42 };
const TEXT_LEFT = 672;

export async function attachAboutParticleTargets(
  geometry,
  {
    silhouetteUrl = '/images/about-silhouette-v2.png',
    artworkCanvas = null,
  } = {},
) {
  const particleCount = geometry.getAttribute('position')?.count ?? 0;
  const aboutCount = Math.min(MAX_ABOUT_PARTICLES, Math.floor(particleCount * 0.55));
  const portraitCount = Math.floor(aboutCount * PORTRAIT_SHARE);
  const silhouette = await loadImage(silhouetteUrl);
  const canvas = artworkCanvas instanceof HTMLCanvasElement
    ? artworkCanvas
    : document.createElement('canvas');
  const artwork = createAboutArtwork(canvas, silhouette);
  const pixels = artwork.context.getImageData(
    0,
    0,
    ARTWORK_WIDTH,
    ARTWORK_HEIGHT,
  ).data;
  const destinations = [
    ...createPortraitTargets(pixels, portraitCount),
    ...createTextTargets(pixels, aboutCount - portraitCount),
  ];

  const targets = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const strengths = new Float32Array(particleCount);
  const pointScales = new Float32Array(particleCount);
  const indices = shuffledIndices(particleCount);

  destinations.forEach((destination, targetIndex) => {
    const particleIndex = indices[targetIndex];
    const offset = particleIndex * 3;
    targets[offset] = destination.x;
    targets[offset + 1] = destination.y;
    targets[offset + 2] = (Math.random() - 0.5) * 0.006;
    colors[offset] = destination.color[0];
    colors[offset + 1] = destination.color[1];
    colors[offset + 2] = destination.color[2];
    strengths[particleIndex] = 1;
    pointScales[particleIndex] = destination.pointScale;
  });

  geometry.setAttribute('aAboutTarget', new THREE.BufferAttribute(targets, 3));
  geometry.setAttribute('aAboutColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aAboutStrength', new THREE.BufferAttribute(strengths, 1));
  geometry.setAttribute('aAboutPointScale', new THREE.BufferAttribute(pointScales, 1));
  geometry.userData.aboutParticleCount = aboutCount;
  return {
    count: aboutCount,
    selectionData: {
      canvas,
      textRuns: artwork.textRuns,
    },
  };
}

function createAboutArtwork(canvas, silhouette) {
  canvas.width = ARTWORK_WIDTH;
  canvas.height = ARTWORK_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not create the About artwork.');

  drawPortrait(context, silhouette);
  const textRuns = drawJapaneseCopy(context);
  return { context, textRuns };
}

function drawPortrait(context, silhouette) {
  const imageAspect = silhouette.naturalWidth / silhouette.naturalHeight;
  const targetAspect = PORTRAIT_RECT.width / PORTRAIT_RECT.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = silhouette.naturalWidth;
  let sourceHeight = silhouette.naturalHeight;

  // Fill the portrait panel without distortion and keep the face centered
  // when the landscape source is cropped into the tall About panel.
  if (imageAspect > targetAspect) {
    sourceWidth = sourceHeight * targetAspect;
    const subjectCenterX = silhouette.naturalWidth * PORTRAIT_FOCUS.x;
    sourceX = Math.max(
      0,
      Math.min(silhouette.naturalWidth - sourceWidth, subjectCenterX - sourceWidth * 0.5),
    );
  } else {
    sourceHeight = sourceWidth / targetAspect;
    sourceY = Math.max(
      0,
      Math.min(
        silhouette.naturalHeight - sourceHeight,
        silhouette.naturalHeight * PORTRAIT_FOCUS.y - sourceHeight * 0.5,
      ),
    );
  }

  const drawCroppedPortrait = () => context.drawImage(
    silhouette,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    PORTRAIT_RECT.x - 8,
    PORTRAIT_RECT.y - 8,
    PORTRAIT_RECT.width + 16,
    PORTRAIT_RECT.height + 16,
  );

  context.save();
  context.beginPath();
  context.rect(PORTRAIT_RECT.x, PORTRAIT_RECT.y, PORTRAIT_RECT.width, PORTRAIT_RECT.height);
  context.clip();
  context.filter = 'grayscale(1) contrast(1.3) brightness(0.76) blur(0.7px)';
  drawCroppedPortrait();
  context.filter = 'none';
  carvePortraitRelief(context, PORTRAIT_RECT);
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = 'rgba(3, 10, 16, 0.12)';
  context.fillRect(PORTRAIT_RECT.x, PORTRAIT_RECT.y, PORTRAIT_RECT.width, PORTRAIT_RECT.height);
  const glassVeil = context.createLinearGradient(
    PORTRAIT_RECT.x,
    PORTRAIT_RECT.y,
    PORTRAIT_RECT.x + PORTRAIT_RECT.width,
    PORTRAIT_RECT.y + PORTRAIT_RECT.height,
  );
  glassVeil.addColorStop(0, 'rgba(235, 250, 255, 0.1)');
  glassVeil.addColorStop(0.42, 'rgba(170, 218, 232, 0.035)');
  glassVeil.addColorStop(1, 'rgba(255, 255, 255, 0.075)');
  context.fillStyle = glassVeil;
  context.fillRect(PORTRAIT_RECT.x, PORTRAIT_RECT.y, PORTRAIT_RECT.width, PORTRAIT_RECT.height);
  context.restore();
}

function carvePortraitRelief(context, rect) {
  const image = context.getImageData(rect.x, rect.y, rect.width, rect.height);
  const { data, width, height } = image;
  const luminance = new Float32Array(width * height);

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    luminance[index] = data[offset] * 0.2126
      + data[offset + 1] * 0.7152
      + data[offset + 2] * 0.0722;
  }

  const sample = (x, y) => luminance[
    Math.max(0, Math.min(height - 1, y)) * width
      + Math.max(0, Math.min(width - 1, x))
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const gx = sample(x + 1, y - 1) + sample(x + 1, y) * 2 + sample(x + 1, y + 1)
        - sample(x - 1, y - 1) - sample(x - 1, y) * 2 - sample(x - 1, y + 1);
      const gy = sample(x - 1, y + 1) + sample(x, y + 1) * 2 + sample(x + 1, y + 1)
        - sample(x - 1, y - 1) - sample(x, y - 1) * 2 - sample(x + 1, y - 1);
      const edge = Math.min(255, Math.hypot(gx, gy) * 0.72);
      const bevel = Math.max(-42, Math.min(42, (gx - gy) * 0.16));
      const glass = luminance[index] * 0.32 + 42;
      const engraving = edge * 0.82;

      data[offset] = Math.max(0, Math.min(255, glass + engraving + bevel + 8));
      data[offset + 1] = Math.max(0, Math.min(255, glass + engraving + bevel + 24));
      data[offset + 2] = Math.max(0, Math.min(255, glass + engraving - bevel + 35));
      data[offset + 3] = Math.max(38, Math.min(242, 42 + edge * 1.9));
    }
  }

  context.putImageData(image, rect.x, rect.y);
}

function prepareTextContext(context) {
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
}

function drawJapaneseCopy(context) {
  prepareTextContext(context);
  const runs = [];
  const drawRun = (text, x, baseline, font, color, kind) => {
    if (!text) return;
    context.font = font;
    context.fillStyle = color;
    context.fillText(text, x, baseline);
    const metrics = context.measureText(text);
    const fontSize = Number(font.match(/([0-9.]+)px/)?.[1]) || 16;
    runs.push({
      text,
      x,
      baseline,
      font,
      color,
      kind,
      ascent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
      descent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
    });
  };

  drawRun(
    'ABOUT',
    TEXT_LEFT + 12,
    108,
    '700 104px "Syne", sans-serif',
    '#ecf8ff',
    'heading',
  );
  drawRun(
    'クリエイティブディレクション／デザイン／開発',
    TEXT_LEFT + 16,
    178,
    '600 22px "Hiragino Sans", "Yu Gothic", sans-serif',
    '#7fcfff',
    'role',
  );

  const lines = [
    ['JUNKBRANDINGは、デザインと', 235],
    ['テクノロジーを横断し、ブランドの個性を', 273],
    ['デジタル体験へと変えるクリエイティブチームです。', 311],
    ['企画、デザイン、モーション、インタラクション、', 367],
    ['フロントエンド開発まで。', 405],
    ['表現と実装を切り離さず、そのブランドにしか', 443],
    ['つくれない体験を設計します。', 481],
    ['きれいなだけでは終わらない。', 537],
    ['見た瞬間、触れた瞬間に何かが残る。', 575],
    ['そんなWebをつくっています。', 613],
  ];
  lines.forEach(([line, baseline]) => {
    drawRun(
      line,
      TEXT_LEFT + 16,
      baseline,
      '500 24px "Hiragino Sans", "Yu Gothic", sans-serif',
      '#d9f0ff',
      'body',
    );
  });
  return runs;
}

function createPortraitTargets(pixels, count) {
  const candidates = [];
  const right = PORTRAIT_RECT.x + PORTRAIT_RECT.width;
  const bottom = PORTRAIT_RECT.y + PORTRAIT_RECT.height;
  for (let y = PORTRAIT_RECT.y; y < bottom; y += 3) {
    for (let x = PORTRAIT_RECT.x; x < right; x += 3) {
      const offset = (y * ARTWORK_WIDTH + x) * 4;
      if (pixels[offset + 3] > 72) {
        candidates.push({ x, y });
      }
    }
  }
  shuffle(candidates);

  return Array.from({ length: count }, (_, index) => {
    const pixel = candidates[index % candidates.length];
    return createDestination(
      pixel.x + (Math.random() - 0.5) * 1.1,
      pixel.y + (Math.random() - 0.5) * 1.1,
      pixels,
      0.58,
      0.68,
    );
  });
}

function createTextTargets(pixels, count) {
  const candidates = [];
  for (let y = 0; y < ARTWORK_HEIGHT; y += 2) {
    for (let x = TEXT_LEFT; x < ARTWORK_WIDTH; x += 2) {
      const offset = (y * ARTWORK_WIDTH + x) * 4;
      if (pixels[offset + 3] > 72) candidates.push({ x, y });
    }
  }
  shuffle(candidates);

  return Array.from({ length: count }, (_, index) => {
    const pixel = candidates[index % candidates.length];
    return createDestination(
      pixel.x + (Math.random() - 0.5) * 0.7,
      pixel.y + (Math.random() - 0.5) * 0.7,
      pixels,
      0.68,
      0.78,
    );
  });
}

function createDestination(pixelX, pixelY, pixels, minScale, maxScale) {
  const safeX = THREE.MathUtils.clamp(Math.round(pixelX), 0, ARTWORK_WIDTH - 1);
  const safeY = THREE.MathUtils.clamp(Math.round(pixelY), 0, ARTWORK_HEIGHT - 1);
  const offset = (safeY * ARTWORK_WIDTH + safeX) * 4;
  return {
    x: -DESIGN_WIDTH * 0.5 + (pixelX / ARTWORK_WIDTH) * DESIGN_WIDTH,
    y: DESIGN_HEIGHT * 0.5 - (pixelY / ARTWORK_HEIGHT) * DESIGN_HEIGHT,
    color: [
      srgbToLinear(pixels[offset] / 255),
      srgbToLinear(pixels[offset + 1] / 255),
      srgbToLinear(pixels[offset + 2] / 255),
    ],
    pointScale: THREE.MathUtils.lerp(minScale, maxScale, Math.random()),
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load About silhouette: ${url}`));
    image.src = url;
  });
}

function shuffledIndices(count) {
  const indices = Array.from({ length: count }, (_, index) => index);
  shuffle(indices);
  return indices;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
