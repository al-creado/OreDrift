/* Synthesized blips (Web Audio). No audio files. Haptics live in native.js. */

let actx = null;
let enabled = true;

export function setSoundEnabled(on) { enabled = !!on; }

/** The shared context (music uses it too). Created lazily, which must happen inside a user tap. */
export function audioContext() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch (e) {
    return null;
  }
}

/** The context for sound effects, or null while sound effects are switched off. */
function ctx() {
  return enabled ? audioContext() : null;
}

const ATTACK = 0.006;   // fade-in, so a tone never starts mid-wave (that step is an audible click)
const MAX_VOICES = 10;  // blips playing at once; further ones are dropped instead of piling up
let voices = 0;
let bus = null;

/** Sound effects share one gentle compressor, so many overlapping blips cannot add up into distortion. */
function effectsBus(a) {
  if (bus && bus.context === a) return bus;
  const c = a.createDynamicsCompressor();
  c.threshold.value = -18; c.knee.value = 12; c.ratio.value = 6; c.attack.value = 0.003; c.release.value = 0.12;
  const trim = a.createGain();
  trim.gain.value = 0.5; // the compressor's automatic make-up gain roughly doubles the level; bring it back
  c.connect(trim); trim.connect(a.destination);
  bus = c;
  return bus;
}

export function blip(freq, dur, vol, type) {
  const a = ctx();
  if (!a || voices >= MAX_VOICES) return;
  try {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime, atk = Math.min(ATTACK, dur / 2);
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(effectsBus(a));
    voices++;
    o.onended = () => { voices--; o.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t + dur);
  } catch (e) { /* audio is optional */ }
}

/** Plays notes as [freq, dur, vol, delayMs] steps. */
export function chime(steps, type) {
  steps.forEach(([f, d, v, delay]) => {
    if (delay) setTimeout(() => blip(f, d, v, type), delay);
    else blip(f, d, v, type);
  });
}

const TAP_GAP_MS = 40;
let lastTap = 0;

export const sounds = {
  // Taps can come ten or more times a second; skip any that land within a few ms of the last so they stay distinct.
  tap: () => {
    const now = performance.now();
    if (now - lastTap < TAP_GAP_MS) return;
    lastTap = now;
    blip(170 + Math.random() * 70, 0.07, 0.05, 'square');
  },
  buy: () => chime([[440, 0.09, 0.05, 0], [660, 0.12, 0.05, 70]]),
  install: () => chime([[520, 0.1, 0.05, 0], [780, 0.16, 0.05, 80]]),
  relocate: () => chime([[330, 0.2, 0.06, 0], [494, 0.2, 0.06, 120], [740, 0.3, 0.06, 240]]),
  claim: () => chime([[520, 0.1, 0.05, 0], [780, 0.14, 0.05, 80]]),
  chest: () => chime([[392, 0.15, 0.05, 0], [587, 0.15, 0.05, 90], [880, 0.25, 0.05, 180]]),
  supply: () => chime([[440, 0.12, 0.05, 0], [660, 0.18, 0.05, 90]]),
  comet: () => chime([[700, 0.1, 0.06, 0], [1050, 0.2, 0.06, 70]]),
  // A comet has appeared: a short rising three-note chime, then a soft ping every second or so while it is on screen.
  cometSpawn: () => chime([[880, 0.14, 0.05, 0], [1175, 0.14, 0.05, 120], [1568, 0.24, 0.05, 240]], 'sine'),
  cometPing: () => blip(1568, 0.09, 0.03, 'sine'),
  // A supply ship is passing: a lower two-tone horn, then a soft double beep, so it sounds different from a comet.
  shipSpawn: () => chime([[330, 0.28, 0.05, 0], [440, 0.4, 0.05, 220]], 'triangle'),
  shipPing: () => chime([[660, 0.07, 0.03, 0], [660, 0.07, 0.03, 140]], 'triangle'),
  achievement: () => chime([[600, 0.12, 0.05, 0], [900, 0.2, 0.05, 100]]),
};
