const COLORS = [
  [255, 22, 132],
  [72, 232, 255],
  [64, 255, 177],
];

export class StainedGlassCursor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stained-glass-cursor';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.append(this.canvas);

    this.context = this.canvas.getContext('2d');
    this.shards = [];
    this.pointer = { x: 0, y: 0, previousX: 0, previousY: 0 };
    this.hasPointer = false;
    this.frameId = 0;
    this.lastTime = performance.now();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.render = this.render.bind(this);

    this.handleResize();
    if (!this.reducedMotion && this.context) {
      window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
      window.addEventListener('resize', this.handleResize, { passive: true });
      this.frameId = requestAnimationFrame(this.render);
    }
  }

  handleResize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * ratio);
    this.canvas.height = Math.round(window.innerHeight * ratio);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  handlePointerMove(event) {
    if (!this.hasPointer) {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.pointer.previousX = event.clientX;
      this.pointer.previousY = event.clientY;
      this.hasPointer = true;
      return;
    }
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    const distance = Math.hypot(dx, dy);
    this.pointer.previousX = this.pointer.x || event.clientX;
    this.pointer.previousY = this.pointer.y || event.clientY;
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;

    const count = Math.min(6, Math.max(1, Math.ceil(distance / 15)));
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 1 : index / (count - 1);
      this.createShard(
        this.pointer.previousX + dx * t,
        this.pointer.previousY + dy * t,
        dx,
        dy,
      );
    }
  }

  createShard(x, y, dx, dy) {
    const speed = Math.min(1, Math.hypot(dx, dy) / 55);
    const angle = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 1.8;
    const drift = 6 + Math.random() * 18 + speed * 10;
    this.shards.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: Math.cos(angle) * drift,
      vy: Math.sin(angle) * drift,
      size: 1.5 + Math.random() * 4.5 + speed * 2.5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 1.8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
      decay: 0.72 + Math.random() * 0.55,
      petal: Math.random() > 0.78,
      phase: Math.random() * Math.PI * 2,
    });
    if (this.shards.length > 120) this.shards.splice(0, this.shards.length - 120);
  }

  render(now) {
    const delta = Math.min((now - this.lastTime) / 1000, 0.04);
    this.lastTime = now;
    const context = this.context;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    context.globalCompositeOperation = 'lighter';

    this.shards = this.shards.filter((shard) => {
      shard.life -= shard.decay * delta;
      if (shard.life <= 0) return false;
      shard.x += shard.vx * delta;
      shard.y += shard.vy * delta;
      shard.vx *= Math.pow(0.08, delta);
      shard.vy *= Math.pow(0.08, delta);
      shard.rotation += shard.rotationSpeed * delta;
      shard.x += Math.sin(now * 0.002 + shard.phase) * delta * 5;

      context.save();
      context.translate(shard.x, shard.y);
      context.rotate(shard.rotation);
      context.globalAlpha = Math.sin(Math.PI * shard.life) * 0.62;
      const [red, green, blue] = shard.color;
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, shard.size * 4.5);
      glow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.95)`);
      glow.addColorStop(0.18, `rgba(${red}, ${green}, ${blue}, 0.52)`);
      glow.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
      context.fillStyle = glow;

      if (shard.petal) {
        for (let petal = 0; petal < 4; petal += 1) {
          context.rotate(Math.PI * 0.5);
          context.beginPath();
          context.ellipse(0, shard.size * 1.4, shard.size * 0.72, shard.size * 2.2, 0, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        context.beginPath();
        context.arc(0, 0, shard.size * 4.5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      return true;
    });

    context.globalCompositeOperation = 'source-over';
    this.frameId = requestAnimationFrame(this.render);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('resize', this.handleResize);
    this.canvas.remove();
  }
}
