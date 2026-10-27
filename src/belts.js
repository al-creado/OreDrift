/*
 * What each belt (planet) looks like, and which ships orbit it. Pure data, no canvas, so it can be tested.
 * The belt is derived from the relocation count, so it needs no extra saved data: belt 0 is the original
 * grey asteroid, and every relocation picks the next colour scheme with a freshly generated shape.
 */
import { rng, hashStr } from './logic.js';

export const MAX_SHIPS = 14;
const TAU = Math.PI * 2;

/** Colour schemes, cycled by relocation count. rock/light are the stone, vein/veinHi the glowing ore. */
export const BELTS = [
  { name: 'Slate Reach', rock: '#464c68', light: '#8b93b3', vein: '#f2a24e', veinHi: '#ffd9a8' },
  { name: 'Rust Drift', rock: '#6a4538', light: '#b9806a', vein: '#ffcf5a', veinHi: '#fff0b8' },
  { name: 'Glacier Field', rock: '#4f6f8a', light: '#a9d0ea', vein: '#7fe3ff', veinHi: '#e0f8ff' },
  { name: 'Verdant Shoal', rock: '#3f5a47', light: '#8fbf9a', vein: '#b6f26b', veinHi: '#eaffc8' },
  { name: 'Violet Veil', rock: '#5a4a7a', light: '#a794d6', vein: '#ff7ad9', veinHi: '#ffd0f3' },
  { name: 'Ember Belt', rock: '#4a2f35', light: '#9a5a62', vein: '#ff6a3d', veinHi: '#ffc2a8' },
  { name: 'Bone Yard', rock: '#7a7566', light: '#cfc8b4', vein: '#5fd0b8', veinHi: '#d5fff4' },
  { name: 'Obsidian Deep', rock: '#2b3045', light: '#5a6590', vein: '#ffd24a', veinHi: '#fff3b0' },
];

/** Shape parameters of the original asteroid. Belt 0 must keep looking exactly like this. */
const ORIGINAL = { n: 16, base: 0.8, amp: 0.2, craters: 5, veins: 6, segs: 4 };

/** Builds outline points, craters and ore veins from three random streams (same call order as the original). */
function genBody(R1, R2, R3, p) {
  const pts = [];
  for (let i = 0; i < p.n; i++) {
    const r = p.base + p.amp * R1() - (i % 5 === 0 ? 0.05 : 0), a = i / p.n * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const craters = [];
  for (let i = 0; i < p.craters; i++) {
    const a = R2() * TAU, d = 0.12 + 0.5 * R2();
    craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.08 + 0.1 * R2() });
  }
  const veins = [];
  for (let v = 0; v < p.veins; v++) {
    const a = R3() * TAU, d = 0.15 + 0.5 * R3();
    let x = Math.cos(a) * d, y = Math.sin(a) * d, dir = R3() * TAU;
    const line = [[x, y]];
    for (let k = 0; k < p.segs; k++) {
      dir += (R3() - 0.5) * 1.4; x += Math.cos(dir) * 0.13; y += Math.sin(dir) * 0.13;
      const l = Math.hypot(x, y);
      if (l > 0.7) { x *= 0.7 / l; y *= 0.7 / l; }
      line.push([x, y]);
    }
    veins.push(line);
  }
  return { pts, craters, veins };
}

const cache = new Map();

/**
 * The look of belt number `runs` (0 = the starting belt).
 * Returns { index, name, rock, light, vein, veinHi, pts, craters, veins, squash: [sx, sy], ring: null | { tilt, w, h } }.
 */
export function beltFor(runs) {
  runs = Math.max(0, Math.floor(runs) || 0);
  if (cache.has(runs)) return cache.get(runs);
  const index = runs % BELTS.length, pal = BELTS[index], lap = Math.floor(runs / BELTS.length);
  const name = lap ? pal.name + ' ' + (lap + 1) : pal.name;
  let belt;
  if (runs === 0) {
    belt = { ...pal, index, name, ...genBody(rng(11), rng(23), rng(5), ORIGINAL), squash: [1, 1], ring: null };
  } else {
    const r = rng(hashStr('belt:' + runs));
    const amp = 0.12 + r() * 0.18;
    const params = { n: 12 + Math.floor(r() * 9), amp, base: 1 - amp, craters: 4 + Math.floor(r() * 5), veins: 4 + Math.floor(r() * 5), segs: 3 + Math.floor(r() * 3) };
    const squash = [0.9 + r() * 0.2, 0.9 + r() * 0.2];
    // Every third belt (the 2nd, 5th, 8th relocation...) has a ring, so players see one early.
    const ringShape = { tilt: (r() - 0.5) * 0.8, w: 1.5 + r() * 0.25, h: 0.34 + r() * 0.14 };
    const ring = runs % 3 === 2 ? ringShape : null;
    const body = genBody(rng(hashStr('belt:' + runs + ':a')), rng(hashStr('belt:' + runs + ':b')), rng(hashStr('belt:' + runs + ':c')), params);
    belt = { ...pal, index, name, ...body, squash, ring };
  }
  if (cache.size > 64) cache.clear();
  cache.set(runs, belt);
  return belt;
}

/**
 * Which ships to draw: one orbiting ship per owned vessel, at most `max`, and every owned kind shows at least one.
 * `owned` maps vessel id to count; `order` lists the ids (the order ships are listed in).
 * Spare slots go to the kinds with the most vessels per ship already shown.
 */
export function allocateShips(owned, order, max = MAX_SHIPS) {
  const types = order.filter((id) => (owned[id] || 0) > 0);
  const total = types.reduce((a, id) => a + owned[id], 0);
  const slots = Math.min(max, total);
  if (slots <= 0) return [];
  const alloc = {};
  for (const id of types) alloc[id] = 1;
  let left = slots - types.length;
  while (left > 0) {
    let best = null, bestScore = -1;
    for (const id of types) {
      if (alloc[id] >= owned[id]) continue;
      const score = owned[id] / (alloc[id] + 1);
      if (score > bestScore) { bestScore = score; best = id; }
    }
    if (!best) break;
    alloc[best]++; left--;
  }
  const out = [];
  for (const id of types) for (let i = 0; i < alloc[id]; i++) out.push(id);
  return out;
}
