/*
 * Slow space-ambient background music, synthesized with Web Audio (no audio files).
 * Four soft chords, 16 seconds each, played as slowly swelling pads through a lowpass filter and a long reverb,
 * with the occasional high, quiet "star" note. It loops forever and never repeats exactly (star notes are random).
 *
 * scheduleChord() and buildBus() take any AudioContext, so the same code can be rendered offline in a test.
 */
import { audioContext } from './audio.js';

export const CHORD_SECONDS = 16;
const MUSIC_LEVEL = 0.8;      // master gain after the fade-in; the voices themselves are already quiet
const LOOKAHEAD_S = 8;        // schedule a chord this long before it starts
const FADE_IN_S = 4;
const FADE_OUT_S = 1.5;

// A minor, slow: Am(add9), Fmaj7, Cmaj7(add9), Gsus. Frequencies in Hz.
export const CHORDS = [
  [110.0, 164.81, 220.0, 261.63, 493.88],
  [87.31, 130.81, 220.0, 329.63, 440.0],
  [130.81, 196.0, 246.94, 293.66, 392.0],
  [98.0, 146.83, 220.0, 293.66, 440.0],
];
const STARS = [440.0, 523.25, 659.25, 783.99, 880.0, 1046.5]; // A minor pentatonic, high and sparse

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/** Builds the effects chain. Returns { input, master, stop() }. Connect voices to `input`. */
export function buildBus(ctx, destination) {
  const input = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.4;
  const dry = ctx.createGain(); dry.gain.value = 0.7;
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 3.4, 2.4);
  const wet = ctx.createGain(); wet.gain.value = 0.65;
  const master = ctx.createGain(); master.gain.value = 0;
  input.connect(lp); lp.connect(dry); lp.connect(verb); verb.connect(wet);
  dry.connect(master); wet.connect(master); master.connect(destination);

  // A very slow wobble of the filter makes the pad breathe.
  const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.045; lfoDepth.gain.value = 420;
  lfo.connect(lfoDepth); lfoDepth.connect(lp.frequency); lfo.start();

  return { input, master, lfo, nodes: [input, lp, dry, verb, wet, master, lfoDepth] };
}

/**
 * Schedules one chord (pad voices plus a few star notes) starting at audio time `t`.
 * `voices` is an optional Set that collects the oscillators so they can be cut short.
 */
export function scheduleChord(ctx, input, t, chord, rand = Math.random, voices = null) {
  const peak = 0.07 / Math.sqrt(chord.length);
  const attack = 4.5, release = 5.5;
  const track = (o) => { if (voices) { voices.add(o); o.onended = () => voices.delete(o); } };
  for (const f of chord) {
    for (const [type, detune, level] of [['sine', -5, 1], ['triangle', 5, 0.35]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak * level, t + attack);
      g.gain.setValueAtTime(peak * level, t + CHORD_SECONDS - 1);
      g.gain.linearRampToValueAtTime(0, t + CHORD_SECONDS + release);
      o.connect(g); g.connect(input);
      o.start(t); o.stop(t + CHORD_SECONDS + release + 0.1);
      track(o);
    }
  }
  const stars = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < stars; i++) {
    const at = t + 2 + rand() * (CHORD_SECONDS - 5), f = STARS[Math.floor(rand() * STARS.length)];
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.03, at + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 4.5);
    o.connect(g); g.connect(input);
    o.start(at); o.stop(at + 4.6);
    track(o);
  }
}

/* ---------- live playback ---------- */
let live = null;

export const musicPlaying = () => !!live;

/** Starts the music (fading in). Safe to call repeatedly. Needs a user gesture the first time. */
export function startMusic() {
  if (live) return;
  const ctx = audioContext();
  if (!ctx) return;
  try {
    const bus = buildBus(ctx, ctx.destination);
    const now = ctx.currentTime;
    bus.master.gain.setValueAtTime(0, now);
    bus.master.gain.linearRampToValueAtTime(MUSIC_LEVEL, now + FADE_IN_S);
    const voices = new Set();
    const state = { bus, voices, idx: 0, nextT: now + 0.2, timer: 0 };
    const pump = () => {
      while (state.nextT - ctx.currentTime < LOOKAHEAD_S) {
        scheduleChord(ctx, bus.input, state.nextT, CHORDS[state.idx % CHORDS.length], Math.random, voices);
        state.nextT += CHORD_SECONDS;
        state.idx++;
      }
      state.timer = setTimeout(pump, 2000);
    };
    pump();
    live = state;
  } catch (e) {
    live = null;
  }
}

/** Fades out and releases everything (used when the app is hidden, the player turns music off, or an ad is shown). */
export function stopMusic() {
  if (!live) return;
  const state = live;
  live = null;
  clearTimeout(state.timer);
  const ctx = audioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    state.bus.master.gain.cancelScheduledValues(now);
    state.bus.master.gain.setValueAtTime(state.bus.master.gain.value, now);
    state.bus.master.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    for (const o of state.voices) { try { o.stop(now + FADE_OUT_S + 0.05); } catch (e) { /* already stopped */ } }
    try { state.bus.lfo.stop(now + FADE_OUT_S + 0.05); } catch (e) { /* ignore */ }
    setTimeout(() => state.bus.nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* ignore */ } }), (FADE_OUT_S + 0.3) * 1000);
  } catch (e) { /* ignore */ }
}
