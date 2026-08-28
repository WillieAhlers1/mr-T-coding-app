export class SoundEffects {
  constructor() {
    this.enabled = true;
    this.context = null;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  tone(frequency, duration = 0.08, delay = 0, type = "square", volume = 0.05) {
    if (!this.enabled) return;

    this.context ??= new AudioContext();
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  step() {
    this.tone(150, 0.06);
  }

  turn() {
    this.tone(220, 0.05);
    this.tone(290, 0.05, 0.05);
  }

  crystal() {
    [440, 660, 880].forEach((frequency, index) => this.tone(frequency, 0.12, index * 0.07));
  }

  bump() {
    this.tone(90, 0.18, 0, "sawtooth", 0.04);
  }

  key() {
    this.tone(520, 0.09);
    this.tone(780, 0.14, 0.08);
  }

  fall() {
    [180, 140, 100].forEach((frequency, index) => this.tone(frequency, 0.14, index * 0.08, "sawtooth", 0.035));
  }

  win() {
    [330, 440, 554, 660].forEach((frequency, index) => this.tone(frequency, 0.18, index * 0.09));
  }
}