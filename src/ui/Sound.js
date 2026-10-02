// Background score. Nothing is downloaded until the visitor asks for sound.
export class Sound {
  constructor(button, source) {
    this.button = button;
    this.source = source;
    this.label = button?.querySelector('[data-sound-label]') ?? null;
    this.bars = Array.from(button?.querySelectorAll('.sound__bars i') ?? []);
    this.audio = null;
    this.context = null;
    this.analyser = null;
    this.data = null;
    this.frameId = 0;
    this.resumeOnVisible = false;
    this.render = this.render.bind(this);
    this.toggle = this.toggle.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
    button?.addEventListener('click', this.toggle);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  ensureAudio() {
    if (this.audio) return;
    this.audio = new Audio(this.source);
    this.audio.loop = true;
    this.audio.volume = 0.18;
    this.audio.preload = 'auto';
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
    this.context.createMediaElementSource(this.audio).connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  }

  get playing() {
    return Boolean(this.audio && !this.audio.paused);
  }

  async play() {
    this.ensureAudio();
    try {
      await this.context?.resume();
      await this.audio.play();
    } catch {
      return;
    }
    this.sync();
    if (!this.frameId) this.frameId = requestAnimationFrame(this.render);
  }

  pause() {
    this.audio?.pause();
    this.sync();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  sync() {
    const on = this.playing;
    this.button?.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (this.label) this.label.textContent = on ? 'Sound on' : 'Sound off';
  }

  handleVisibility() {
    if (document.hidden) {
      this.resumeOnVisible = this.playing;
      this.pause();
    } else if (this.resumeOnVisible) {
      this.resumeOnVisible = false;
      this.play();
    }
  }

  render() {
    this.frameId = 0;
    if (this.playing && this.analyser && this.data) {
      this.analyser.getByteFrequencyData(this.data);
      this.bars.forEach((bar, index) => {
        const value = this.data[Math.min(this.data.length - 1, 1 + index * 3)] / 255;
        bar.style.transform = `scaleY(${0.18 + value * 0.82})`;
      });
      this.frameId = requestAnimationFrame(this.render);
      return;
    }
    this.bars.forEach((bar) => { bar.style.transform = ''; });
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.button?.removeEventListener('click', this.toggle);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.audio?.pause();
    this.context?.close();
  }
}
