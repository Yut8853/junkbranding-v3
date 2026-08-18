import * as THREE from 'three';
import titleVertexShader from './shaders/title.vert.glsl?raw';
import titleFragmentShader from './shaders/title.frag.glsl?raw';

const TEXT = 'JUNKBRANDING';
const PARTICLE_COUNT = 16000;

export class ParticleTitleSystem {
  constructor({ scene, titleElement, pixelRatio }) {
    this.scene = scene;
    this.titleElement = titleElement;
    this.geometry = createTitleGeometry(TEXT, PARTICLE_COUNT);
    this.material = new THREE.ShaderMaterial({
      vertexShader: titleVertexShader,
      fragmentShader: titleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uPointSize: { value: 18 },
        uSpiralRadius: { value: 1.71 },
        uWorksBandHeight: { value: 1.2 },
        uWorksBandY: { value: 1.8 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.position.z = 1;
    this.points.renderOrder = 12;
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.titleElement?.classList.add('intro-title--particles');
    this.titleElement?.style.setProperty('--intro-title-solid-opacity', 1);
    this.titleElement?.style.setProperty('--intro-title-solid-blur', '0px');
  }

  setProgress(progress) {
    this.material.uniforms.uProgress.value = progress;
    const solidTransition = smoothstep(0.055, 0.24, progress);
    const solidOpacity = 1 - solidTransition;
    this.titleElement?.style.setProperty('--intro-title-solid-opacity', solidOpacity);
    this.titleElement?.style.setProperty(
      '--intro-title-solid-blur',
      `${solidTransition * 5}px`,
    );
  }

  update(elapsed) {
    this.material.uniforms.uTime.value = elapsed;
  }

  resize(camera, pixelRatio, compact, spiralRadius, worksBandHeight, worksBandY) {
    const distance = camera.position.z - this.points.position.z;
    const viewHeight = 2
      * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      * distance;
    const viewWidth = viewHeight * camera.aspect;
    const viewCenterY = 0.05;
    const viewportWidth = Math.max(1, document.documentElement.clientWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    let titleRect = this.titleElement?.getBoundingClientRect();
    if (this.titleElement) {
      const range = document.createRange();
      range.selectNodeContents(this.titleElement);
      const textRect = range.getBoundingClientRect();
      if (textRect.width > 0 && textRect.height > 0) titleRect = textRect;
      range.detach?.();
    }
    const targetWidth = titleRect?.width > 0
      ? viewWidth * (titleRect.width / viewportWidth)
      : viewWidth * 0.99;
    const titleCenterX = titleRect
      ? titleRect.left + titleRect.width * 0.5
      : viewportWidth * 0.5;
    const titleCenterY = titleRect
      ? titleRect.top + titleRect.height * 0.5
      : viewportHeight * 0.9;

    this.points.scale.setScalar(targetWidth);
    this.points.position.x = (titleCenterX / viewportWidth - 0.5) * viewWidth;
    this.points.position.y = viewCenterY
      + (0.5 - titleCenterY / viewportHeight) * viewHeight;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uPointSize.value = compact ? 16 : 18;
    this.material.uniforms.uSpiralRadius.value = spiralRadius;
    this.material.uniforms.uWorksBandHeight.value = worksBandHeight;
    this.material.uniforms.uWorksBandY.value = worksBandY;
  }

  dispose() {
    this.titleElement?.classList.remove('intro-title--particles');
    this.titleElement?.style.removeProperty('--intro-title-solid-opacity');
    this.titleElement?.style.removeProperty('--intro-title-solid-blur');
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}

function createTitleGeometry(text, count) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 360;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Unable to create the particle title canvas.');

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  const baseSize = 260;
  context.font = `700 ${baseSize}px "Syne", sans-serif`;
  const measured = measureTrackedTitle(context, text, baseSize);
  const fittedSize = Math.floor(baseSize * Math.min(1, 1900 / Math.max(1, measured)));
  context.font = `700 ${fittedSize}px "Syne", sans-serif`;
  const joinedWidth = measureTrackedTitle(context, text, fittedSize);
  const startX = (canvas.width - joinedWidth) * 0.5;
  const baseline = canvas.height * 0.5 + fittedSize * 0.035;
  drawTrackedTitle(context, text, startX, baseline, fittedSize);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const candidates = [];
  let minX = canvas.width;
  let maxX = 0;
  let minY = canvas.height;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 96) continue;
      candidates.push(y * canvas.width + x);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (!candidates.length) throw new Error('No pixels were found for the particle title.');

  const textWidth = Math.max(1, maxX - minX);
  const textHeight = Math.max(1, maxY - minY);
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const bandTargets = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    const x = candidate % canvas.width;
    const y = Math.floor(candidate / canvas.width);
    const jitterX = (Math.random() - 0.5) * 1.7;
    const jitterY = (Math.random() - 0.5) * 1.7;
    positions[i * 3] = (x + jitterX - centerX) / textWidth;
    positions[i * 3 + 1] = -(y + jitterY - centerY) / textWidth;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.006;
    seeds[i] = Math.random();
    sizes[i] = 0.62 + Math.random() * 1.08;
    bandTargets[i * 3] = Math.random() * 2 - 1;
    bandTargets[i * 3 + 1] = (Math.random() * 2 - 1)
      + (Math.random() * 2 - 1) * 0.34;
    bandTargets[i * 3 + 2] = Math.random() * 2 - 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aBandTarget', new THREE.BufferAttribute(bandTargets, 3));
  geometry.userData.textAspect = textHeight / textWidth;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  return geometry;
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function measureTrackedTitle(context, text, fontSize) {
  const tracking = fontSize * -0.065;
  const joinOverlap = fontSize * 0.075;
  let width = 0;
  for (let index = 0; index < text.length; index += 1) {
    width += context.measureText(text[index]).width;
    if (index < text.length - 1) width += tracking;
    if (index === 3) width -= joinOverlap;
  }
  return width;
}

function drawTrackedTitle(context, text, startX, baseline, fontSize) {
  const tracking = fontSize * -0.065;
  const joinOverlap = fontSize * 0.075;
  let cursorX = startX;
  for (let index = 0; index < text.length; index += 1) {
    const letter = text[index];
    context.fillText(letter, cursorX, baseline);
    cursorX += context.measureText(letter).width + tracking;
    if (index === 3) cursorX -= joinOverlap;
  }
}
