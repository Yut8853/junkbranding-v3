// The studio name stays redacted as twelve X's until the visitor reaches
// Contact. This module owns every write to the redacted name so the reveal
// can scramble instead of swapping letters, and so hovering the redaction
// flickers it without ever giving the full name away early.

const WORD = 'JUNKBRANDING';
const MASK = 'X';
export const REDACTION_GLYPHS = 'JUNKBRADIG#/+×';
const TICK_MS = 55;
const CHAR_WINDOW = 0.22;

export class BrandRedaction {
  constructor({ elements = [], hoverElements = [], reducedMotion = false }) {
    this.elements = elements.filter((element) => element instanceof HTMLElement);
    this.hoverElements = hoverElements.filter((element) => element instanceof HTMLElement);
    this.reducedMotion = reducedMotion;
    this.resolve = 0;
    this.hoverTarget = 0;
    this.hoverEnergy = 0;
    this.lastTick = 0;
    this.lastFrame = 0;
    this.seeds = new Float32Array(WORD.length);
    this.glyphs = Array.from(WORD, () => MASK);
    this.text = MASK.repeat(WORD.length);
    this.frameId = 0;
    this.disposed = false;

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.render = this.render.bind(this);
    if (!reducedMotion) {
      window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    }
    this.write(this.text);
  }

  // amount: 0 keeps the name fully redacted, 1 shows it in full.
  setResolve(amount) {
    const next = Math.min(1, Math.max(0, amount));
    if (Math.abs(next - this.resolve) < 0.0005 && next !== 0 && next !== 1) return;
    this.resolve = next;
    if (this.reducedMotion) {
      const count = Math.floor(next * WORD.length + 0.0001);
      this.write(WORD.slice(0, count) + MASK.repeat(WORD.length - count));
      return;
    }
    this.wake();
  }

  handlePointerMove(event) {
    const hovered = this.hoverElements.some((element) => {
      const style = getComputedStyle(element);
      if (Number.parseFloat(style.opacity) < 0.2 || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return event.clientX >= rect.left - 8
        && event.clientX <= rect.right + 8
        && event.clientY >= rect.top - 8
        && event.clientY <= rect.bottom + 8;
    });
    const target = hovered ? 1 : 0;
    if (target !== this.hoverTarget) {
      this.hoverTarget = target;
      this.wake();
    }
  }

  wake() {
    if (!this.frameId && !this.disposed) this.frameId = requestAnimationFrame(this.render);
  }

  render(now) {
    this.frameId = 0;
    const delta = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;
    const approach = this.hoverTarget > this.hoverEnergy ? 9 : 2.6;
    this.hoverEnergy += (this.hoverTarget - this.hoverEnergy) * (1 - Math.exp(-approach * delta));
    if (this.hoverEnergy < 0.002) this.hoverEnergy = 0;

    const tick = now - this.lastTick >= TICK_MS;
    if (tick) this.lastTick = now;

    let animating = this.hoverEnergy > 0 || this.hoverTarget > 0;
    for (let index = 0; index < WORD.length; index += 1) {
      const start = (index / WORD.length) * (1 - CHAR_WINDOW);
      const local = (this.resolve - start) / CHAR_WINDOW;
      if (local >= 1) {
        this.glyphs[index] = WORD[index];
        continue;
      }
      if (local > 0) {
        animating = true;
        if (tick) this.glyphs[index] = randomGlyph(WORD[index], local);
        continue;
      }
      if (this.hoverEnergy > 0) {
        if (tick) {
          const roll = Math.random();
          if (roll < this.hoverEnergy * 0.08) this.glyphs[index] = WORD[index];
          else if (roll < this.hoverEnergy * 0.42) this.glyphs[index] = randomGlyph(WORD[index], 0);
          else this.glyphs[index] = MASK;
        }
        continue;
      }
      this.glyphs[index] = MASK;
    }

    this.write(this.glyphs.join(''));
    if (animating) this.wake();
  }

  write(text) {
    if (text === this.text && this.elements.every((element) => element.textContent === text)) return;
    this.text = text;
    this.elements.forEach((element) => {
      if (element.textContent !== text) element.textContent = text;
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('pointermove', this.handlePointerMove);
  }
}

function randomGlyph(target, closeness) {
  // As a character nears resolution it lands on its real letter more often,
  // which reads as the name "locking in" rather than random noise stopping.
  if (Math.random() < closeness * 0.55) return target;
  return REDACTION_GLYPHS[Math.floor(Math.random() * REDACTION_GLYPHS.length)];
}
