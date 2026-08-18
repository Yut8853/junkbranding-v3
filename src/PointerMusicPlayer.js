const BAR_COUNT = 12;

export class PointerMusicPlayer {
  constructor(source) {
    this.audio = new Audio(source);
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = 0.05;
    this.context = null;
    this.analyser = null;
    this.frequencyData = null;
    this.frameId = 0;
    this.started = false;
    this.startAttempted = false;
    this.resumeAfterVisibility = false;

    this.root = document.createElement('button');
    this.root.className = 'music-monitor';
    this.root.type = 'button';
    this.root.setAttribute('aria-label', 'Play background music');
    this.root.innerHTML = `
      <span class="music-monitor__bars" aria-hidden="true">
        ${Array.from({ length: BAR_COUNT }, () => '<i></i>').join('')}
      </span>
    `;
    document.body.append(this.root);
    this.bars = Array.from(this.root.querySelectorAll('.music-monitor__bars i'));

    this.handleFirstMove = this.handleFirstMove.bind(this);
    this.handleToggle = this.handleToggle.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.render = this.render.bind(this);
    window.addEventListener('pointermove', this.handleFirstMove, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);
    this.root.addEventListener('click', this.handleToggle);
  }

  setupAudioGraph() {
    if (this.context) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.78;
    const source = this.context.createMediaElementSource(this.audio);
    source.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  async play() {
    this.setupAudioGraph();
    await this.context?.resume();
    await this.audio.play();
    this.started = true;
    this.root.setAttribute('data-playing', '');
    this.root.setAttribute('aria-label', 'Pause background music');
    window.removeEventListener('pointermove', this.handleFirstMove);
    if (!this.frameId) this.frameId = requestAnimationFrame(this.render);
  }

  handleFirstMove() {
    if (this.startAttempted) return;
    this.startAttempted = true;
    this.play().catch(() => {
      // Some browsers require a click even when pointer movement is present.
      this.root.setAttribute('data-awaiting-click', '');
      window.removeEventListener('pointermove', this.handleFirstMove);
    });
  }

  handleToggle() {
    if (this.audio.paused) {
      this.play().catch(() => {});
      return;
    }
    this.pause();
  }

  pause() {
    this.audio.pause();
    this.context?.suspend().catch(() => {});
    this.root.removeAttribute('data-playing');
    this.root.setAttribute('aria-label', 'Play background music');
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.resumeAfterVisibility = !this.audio.paused;
      this.pause();
      return;
    }
    if (this.resumeAfterVisibility) {
      this.resumeAfterVisibility = false;
      this.play().catch(() => {});
    }
  }

  handlePageHide() {
    this.pause();
  }

  render() {
    if (this.analyser && this.frequencyData && !this.audio.paused) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      this.bars.forEach((bar, index) => {
        const bin = Math.min(this.frequencyData.length - 1, index + 1);
        const strength = this.frequencyData[bin] / 255;
        bar.style.transform = `scaleY(${0.14 + strength * 0.86})`;
        bar.style.opacity = `${0.42 + strength * 0.58}`;
      });
    } else {
      this.bars.forEach((bar) => {
        bar.style.transform = 'scaleY(0.14)';
      });
    }
    this.frameId = requestAnimationFrame(this.render);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('pointermove', this.handleFirstMove);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
    this.root.removeEventListener('click', this.handleToggle);
    this.audio.pause();
    this.context?.close();
    this.root.remove();
  }
}
