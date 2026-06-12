/**
 * audioAlertService.ts
 *
 * Synthesizes short sound alerts dynamically using the Web Audio API.
 * Zero external assets — no MP3 files, no network requests, no bundle overhead.
 *
 * Design:
 *  - A single AudioContext is lazily created and reused (browsers require
 *    a user-gesture before audio can play; the lazy init means the context
 *    is only created after the user has already interacted with the app).
 *  - Each alert is a brief oscillator chain with an ADSR-style gain envelope
 *    so tones feel crisp rather than clicking on start/stop.
 *  - The public API is fully synchronous from the caller's perspective;
 *    the oscillator nodes are self-disposing (they stop and disconnect once
 *    the envelope has finished).
 */

export type AlertType =
  | 'rep_complete'   // short rising beep  — positive feedback
  | 'form_warning'   // mid double-pulse   — correction cue
  | 'milestone'      // ascending chord    — achievement
  | 'session_end'    // descending sweep   — cool-down / done
  | 'countdown';     // neutral tick       — timer / pacing

interface OscillatorSpec {
  frequency: number;    // Hz
  type: OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'
  startOffset: number;  // seconds from "now"
  duration: number;     // seconds
  peakGain: number;     // 0–1
}

// ---------------------------------------------------------------------------
// Internal context management
// ---------------------------------------------------------------------------

let _ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if the context was suspended (autoplay policy)
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {/* best-effort */});
  }
  return _ctx;
}

// ---------------------------------------------------------------------------
// Low-level tone synthesiser
// ---------------------------------------------------------------------------

/**
 * Plays a single oscillator with a simple attack-sustain-release envelope.
 * The oscillator node self-disposes after `startOffset + duration + releaseTime`.
 */
function playTone(
  ctx: AudioContext,
  spec: OscillatorSpec,
  releaseTime = 0.04,
): void {
  const { frequency, type, startOffset, duration, peakGain } = spec;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now + startOffset);

  // Envelope: attack → sustain → release
  const attackTime = 0.01;
  gain.gain.setValueAtTime(0, now + startOffset);
  gain.gain.linearRampToValueAtTime(peakGain, now + startOffset + attackTime);
  gain.gain.setValueAtTime(peakGain, now + startOffset + duration - releaseTime);
  gain.gain.linearRampToValueAtTime(0, now + startOffset + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now + startOffset);
  osc.stop(now + startOffset + duration);

  // Clean up after the note has finished
  osc.onended = () => {
    try { osc.disconnect(); } catch {/* ignore */}
    try { gain.disconnect(); } catch {/* ignore */}
  };
}

// ---------------------------------------------------------------------------
// Alert presets
// ---------------------------------------------------------------------------

const PRESETS: Record<AlertType, OscillatorSpec[]> = {
  /**
   * rep_complete — single short rising sine beep (440 → 660 Hz)
   * Signals a successful repetition.
   */
  rep_complete: [
    { frequency: 440, type: 'sine', startOffset: 0,    duration: 0.06, peakGain: 0.35 },
    { frequency: 660, type: 'sine', startOffset: 0.07, duration: 0.08, peakGain: 0.30 },
  ],

  /**
   * form_warning — two short mid-range square pulses
   * Draws attention without being harsh.
   */
  form_warning: [
    { frequency: 330, type: 'square', startOffset: 0,    duration: 0.07, peakGain: 0.20 },
    { frequency: 330, type: 'square', startOffset: 0.12, duration: 0.07, peakGain: 0.20 },
  ],

  /**
   * milestone — ascending major-third chord (C5 → E5 → G5)
   * Celebratory but brief.
   */
  milestone: [
    { frequency: 523.25, type: 'sine', startOffset: 0,    duration: 0.12, peakGain: 0.30 },
    { frequency: 659.25, type: 'sine', startOffset: 0.10, duration: 0.12, peakGain: 0.28 },
    { frequency: 783.99, type: 'sine', startOffset: 0.20, duration: 0.18, peakGain: 0.25 },
  ],

  /**
   * session_end — descending sine sweep
   * Calm, conclusive feel.
   */
  session_end: [
    { frequency: 660, type: 'sine', startOffset: 0,    duration: 0.14, peakGain: 0.28 },
    { frequency: 550, type: 'sine', startOffset: 0.16, duration: 0.14, peakGain: 0.24 },
    { frequency: 440, type: 'sine', startOffset: 0.32, duration: 0.20, peakGain: 0.20 },
  ],

  /**
   * countdown — neutral triangle tick
   * Subtle metronome-style cue.
   */
  countdown: [
    { frequency: 880, type: 'triangle', startOffset: 0, duration: 0.05, peakGain: 0.22 },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AudioAlertOptions {
  /** Master volume multiplier, 0–1. Default: 1. */
  volume?: number;
  /** If true, skip playback silently (e.g. user has muted alerts). Default: false. */
  muted?: boolean;
}

/**
 * Plays a synthesised sound alert of the given type.
 *
 * @example
 * import { playAlert } from './audioAlertService';
 * playAlert('rep_complete');
 * playAlert('form_warning', { volume: 0.5 });
 */
export function playAlert(
  alertType: AlertType,
  options: AudioAlertOptions = {},
): void {
  if (options.muted) return;

  const ctx = getContext();
  if (!ctx) return; // Web Audio not available (SSR / old browser)

  const volume = Math.max(0, Math.min(1, options.volume ?? 1));
  const specs = PRESETS[alertType];

  for (const spec of specs) {
    playTone(ctx, {
      ...spec,
      peakGain: spec.peakGain * volume,
    });
  }
}

/**
 * Releases the shared AudioContext.
 * Call this if you need to fully tear down audio (e.g. during testing or
 * when the app unmounts and you want a clean shutdown).
 */
export async function disposeAudioContext(): Promise<void> {
  if (_ctx) {
    await _ctx.close().catch(() => {/* ignore */});
    _ctx = null;
  }
}

/**
 * Returns true when the Web Audio API is available in the current environment.
 * Useful for feature-detection before attempting playback.
 */
export function isAudioSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window.AudioContext || (window as any).webkitAudioContext)
  );
}
