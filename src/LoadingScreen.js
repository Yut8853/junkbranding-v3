export class LoadingScreen {
  constructor(root, flowerUrl, onFinished = null, onReveal = null) {
    this.root = root;
    this.canvas = root?.querySelector('[data-loading-flower]') ?? null;
    this.number = root?.querySelector('[data-loading-number]') ?? null;
    this.bar = root?.querySelector('[data-loading-bar]') ?? null;
    this.context = this.canvas?.getContext('2d') ?? null;
    this.flowerCanvas = document.createElement('canvas');
    this.flowerReady = false;
    this.displayProgress = 0;
    this.targetProgress = 6;
    this.startedAt = performance.now();
    this.completed = false;
    this.alignedToKv = false;
    this.disposed = false;
    this.frameId = 0;
    this.onFinished = onFinished;
    this.onReveal = onReveal;
    this.revealStarted = false;
    this.render = this.render.bind(this);
    document.body.classList.add('is-loading');
    if (this.canvas) this.loadFlower(flowerUrl);
    this.frameId = requestAnimationFrame(this.render);
  }

  async loadFlower(url) {
    try {
      const image = await loadImage(url);
      const height = 960;
      const width = Math.round(height * image.naturalWidth / image.naturalHeight);
      this.flowerCanvas.width = width;
      this.flowerCanvas.height = height;
      const context = this.flowerCanvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index] / 255;
        const green = pixels[index + 1] / 255;
        const blue = pixels[index + 2] / 255;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const yellowMask = smoothstep(0.08, 0.3, Math.min(red, green) - blue)
          * smoothstep(0.12, 0.58, red);
        const pixelY = Math.floor((index / 4) / width);
        const imageV = 1 - pixelY / Math.max(1, height - 1);
        const petalRegion = smoothstep(0.54, 0.63, imageV);
        const tint = 0.58 * petalRegion * (1 - yellowMask);
        pixels[index] = Math.round(255 * mix(red, luminance, tint));
        pixels[index + 1] = Math.round(255 * mix(green, luminance * (63 / 255), tint));
        pixels[index + 2] = Math.round(255 * mix(blue, luminance * (159 / 255), tint));
      }
      context.putImageData(imageData, 0, 0);
      this.flowerReady = true;
      this.targetProgress = Math.max(this.targetProgress, 32);
    } catch (error) {
      console.warn('[flower-particle-scroll] Loading flower unavailable.', error);
    }
  }

  complete() {
    this.completed = true;
    this.targetProgress = 100;
  }

  alignToKv(projection) {
    if (!this.canvas || !projection) return;
    this.alignedToKv = true;
    this.canvas.style.left = `${projection.centerX}px`;
    this.canvas.style.top = `${projection.centerY}px`;
    this.canvas.style.width = `${projection.width}px`;
    this.canvas.style.height = `${projection.height}px`;
    this.canvas.style.transform = `translate(-50%, -50%) rotate(${projection.rotation}rad)`;
  }

  showKvFlower() {
    this.root?.setAttribute('data-kv-ready', '');
  }

  render(now) {
    if (this.disposed) return;
    const elapsed = (now - this.startedAt) / 1000;
    const timedProgress = Math.min(92, (elapsed / 3.2) * 100);
    this.targetProgress = this.completed && elapsed >= 3.2 ? 100 : timedProgress;
    this.displayProgress += (this.targetProgress - this.displayProgress) * 0.085;
    if (this.completed && this.displayProgress > 99.86) this.displayProgress = 100;
    this.drawFlower(elapsed);
    this.updateProgress();

    if (this.displayProgress >= 100) {
      if (!this.revealStarted) {
        this.revealStarted = true;
        this.onReveal?.();
        this.onReveal = null;
      }
      this.root?.setAttribute('data-complete', '');
      window.setTimeout(() => this.dispose(), 1200);
      return;
    }
    this.frameId = requestAnimationFrame(this.render);
  }

  drawFlower(elapsed) {
    if (!this.context || !this.canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.clearRect(0, 0, width, height);
    if (!this.flowerReady) return;
    const drawHeight = height;
    const drawWidth = drawHeight * this.flowerCanvas.width / this.flowerCanvas.height;
    this.context.save();
    this.context.translate(width * 0.5, height * 0.52);
    this.context.drawImage(
      this.flowerCanvas,
      -drawWidth * 0.5,
      -drawHeight * 0.5,
      drawWidth,
      drawHeight,
    );
    this.context.restore();
  }

  updateProgress() {
    const rounded = Math.floor(this.displayProgress);
    if (this.number) this.number.textContent = `${String(rounded).padStart(2, '0')}%`;
    this.bar?.style.setProperty('--loading-progress', `${this.displayProgress}%`);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    document.body.classList.remove('is-loading');
    this.onFinished?.();
    this.onFinished = null;
    this.onReveal = null;
    this.root?.remove();
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function mix(from, to, amount) {
  return from + (to - from) * amount;
}
