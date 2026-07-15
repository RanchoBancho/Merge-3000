type AudioEffect = (context: AudioContext, output: AudioNode) => void;

/**
 * Tiny, asset-free sound palette for the game.
 *
 * Every public method is deliberately fail-safe: unsupported WebAudio, blocked
 * autoplay, or a closed context must never interrupt gameplay.
 */
export class SynthAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  public unlock(): void {
    try {
      const audio = this.ensureAudio();
      if (!audio || audio.context.state === 'running' || audio.context.state === 'closed') {
        return;
      }

      void audio.context.resume().catch(() => undefined);
    } catch {
      // Audio is optional. Never let browser/device audio quirks block the game.
    }
  }

  public drop(): void {
    this.play((context, output) => {
      this.tone(context, output, 170, 0.09, 0, 'triangle', 0.16, 105);
      this.tone(context, output, 330, 0.05, 0.006, 'sine', 0.055, 190);
    });
  }

  public merge(level: number): void {
    this.play((context, output) => {
      const safeLevel = this.safeIndex(level, 11);
      const root = 220 * 2 ** (safeLevel / 18);

      this.tone(context, output, root, 0.14, 0, 'triangle', 0.13, root * 1.28);
      this.tone(context, output, root * 1.5, 0.18, 0.035, 'sine', 0.08, root * 2);
    });
  }

  public scaleBreak(stage: number): void {
    this.play((context, output) => {
      const safeStage = this.safeIndex(stage, 8);
      const root = 196 * 2 ** (safeStage / 15);
      const intervals = [1, 1.25, 1.5, 2];

      intervals.forEach((interval, index) => {
        this.tone(
          context,
          output,
          root * interval,
          0.2,
          index * 0.055,
          index % 2 === 0 ? 'triangle' : 'sine',
          0.09,
          root * interval * 1.08,
        );
      });
      this.tone(context, output, 82, 0.34, 0, 'sawtooth', 0.028, 164);
    });
  }

  public gameOver(): void {
    this.play((context, output) => {
      [246.94, 196, 146.83].forEach((frequency, index) => {
        this.tone(context, output, frequency, 0.24, index * 0.115, 'triangle', 0.09, frequency * 0.82);
      });
      this.tone(context, output, 98, 0.38, 0.25, 'sine', 0.05, 65);
    });
  }

  public button(): void {
    this.play((context, output) => {
      this.tone(context, output, 520, 0.055, 0, 'sine', 0.065, 690);
    });
  }

  private play(effect: AudioEffect): void {
    try {
      const audio = this.ensureAudio();
      if (!audio) {
        return;
      }

      if (audio.context.state !== 'running' && audio.context.state !== 'closed') {
        void audio.context.resume().catch(() => undefined);
      }

      effect(audio.context, audio.output);
    } catch {
      // Sound feedback is best-effort and must not affect game state.
    }
  }

  private ensureAudio(): { context: AudioContext; output: AudioNode } | null {
    if (this.context?.state === 'closed') {
      this.context = null;
      this.master = null;
    }

    if (this.context && this.master) {
      return { context: this.context, output: this.master };
    }

    const audioGlobals = globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = audioGlobals.AudioContext ?? audioGlobals.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    try {
      const context = new AudioContextConstructor();
      const master = context.createGain();
      const limiter = context.createDynamicsCompressor();

      master.gain.setValueAtTime(0.2, context.currentTime);
      limiter.threshold.setValueAtTime(-12, context.currentTime);
      limiter.knee.setValueAtTime(8, context.currentTime);
      limiter.ratio.setValueAtTime(5, context.currentTime);
      limiter.attack.setValueAtTime(0.003, context.currentTime);
      limiter.release.setValueAtTime(0.15, context.currentTime);
      master.connect(limiter);
      limiter.connect(context.destination);

      this.context = context;
      this.master = master;
      return { context, output: master };
    } catch {
      this.context = null;
      this.master = null;
      return null;
    }
  }

  private tone(
    context: AudioContext,
    output: AudioNode,
    frequency: number,
    duration: number,
    delay: number,
    type: OscillatorType,
    peakGain: number,
    endFrequency: number,
  ): void {
    const start = context.currentTime + Math.max(0.005, delay);
    const end = start + Math.max(0.025, duration);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect();
        envelope.disconnect();
      },
      { once: true },
    );
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  }

  private safeIndex(value: number, maximum: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
  }
}

export default SynthAudio;
