/** Cosmetic input only: no cards, plans, resources or private decision eligibility. */
export type TableSoundFrame = {
  room: string;
  phase: string;
  sequence: number;
  automaticSequence: number;
};
export type TableSoundCue = 'phase' | 'automatic';

/** Consume silent snapshots too, so enabling sound never replays old events. */
export class TableSoundCursor {
  private previous: TableSoundFrame | null = null;

  consume(frame: TableSoundFrame): TableSoundCue | null {
    const previous = this.previous;
    if (!previous || previous.room !== frame.room) {
      this.previous = { ...frame };
      return null;
    }
    if (frame.sequence < previous.sequence) return null;
    this.previous = {
      ...frame,
      automaticSequence: Math.max(previous.automaticSequence, frame.automaticSequence),
    };
    // Coalesce a polling batch into one cue, with phase changes taking priority.
    if (previous.phase !== frame.phase) return 'phase';
    return frame.automaticSequence > previous.automaticSequence ? 'automatic' : null;
  }
}

export const DEFAULT_SOUND_VOLUME = 35;
export function soundVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : DEFAULT_SOUND_VOLUME;
}

/** Short original tones synthesized locally; no downloads, permissions or game writes. */
export class LocalTableAudio {
  private context: AudioContext | null = null;
  private voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private generation = 0;
  private lastPlayed = -Infinity;

  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  // Call directly from a user gesture, never from a game update or storage event.
  async unlock(): Promise<boolean> {
    const generation = this.generation;
    try {
      const context = this.context ?? (this.context = this.createContext());
      if (context.state !== 'running') await context.resume();
      return generation === this.generation && this.context === context && context.state === 'running';
    } catch {
      return false;
    }
  }

  play(cue: TableSoundCue, volume: number, preview = false): boolean {
    const context = this.context;
    const level = soundVolume(volume);
    if (!context || context.state !== 'running' || level === 0) return false;
    if (!preview && context.currentTime - this.lastPlayed < 0.7) return false;
    this.stop();
    try {
      const start = context.currentTime;
      const notes = cue === 'phase' ? [330, 495] : [440];
      for (const [index, frequency] of notes.entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain };
        this.voices.add(voice);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        const at = start + index * 0.12;
        gain.gain.setValueAtTime(0, start);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.12 * level / 100, at + 0.015);
        gain.gain.linearRampToValueAtTime(0, at + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          this.voices.delete(voice);
        };
        oscillator.start(at);
        oscillator.stop(at + 0.18);
      }
      this.lastPlayed = start;
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  stop() {
    this.generation++;
    for (const { oscillator, gain } of this.voices) {
      try {
        gain.gain.cancelScheduledValues(0);
        gain.gain.setValueAtTime(0, this.context?.currentTime ?? 0);
        oscillator.stop();
      } catch { /* Already ended or audio is unavailable. */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = null;
    this.lastPlayed = -Infinity;
    if (context) void context.close().catch(() => {});
  }
}
