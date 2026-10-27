/* Synthesized blips (Web Audio). No audio files. Haptics live in native.js. */

let actx = null;
let enabled = true;

export function setSoundEnabled(on) { enabled = !!on; }

/** The context is created lazily on the first call, which happens inside a user tap. */
function ctx() {
  if (!enabled) return null;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch (e) {
    return null;
  }
}

export function blip(freq, dur, vol, type) {
  const a = ctx();
  if (!a) return;
  try {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
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

export const sounds = {
  tap: () => blip(170 + Math.random() * 70, 0.07, 0.05, 'square'),
  buy: () => chime([[440, 0.09, 0.05, 0], [660, 0.12, 0.05, 70]]),
  install: () => chime([[520, 0.1, 0.05, 0], [780, 0.16, 0.05, 80]]),
  relocate: () => chime([[330, 0.2, 0.06, 0], [494, 0.2, 0.06, 120], [740, 0.3, 0.06, 240]]),
  claim: () => chime([[520, 0.1, 0.05, 0], [780, 0.14, 0.05, 80]]),
  chest: () => chime([[392, 0.15, 0.05, 0], [587, 0.15, 0.05, 90], [880, 0.25, 0.05, 180]]),
  supply: () => chime([[440, 0.12, 0.05, 0], [660, 0.18, 0.05, 90]]),
  comet: () => chime([[700, 0.1, 0.06, 0], [1050, 0.2, 0.06, 70]]),
  achievement: () => chime([[600, 0.12, 0.05, 0], [900, 0.2, 0.05, 100]]),
};
