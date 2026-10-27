import { describe, it, expect } from 'vitest';
import { GENS } from '../src/data.js';
import { rng } from '../src/logic.js';
import { BELTS, beltFor, allocateShips, MAX_SHIPS } from '../src/belts.js';
import { SHIP_SCALE } from '../src/ships.js';

const ORDER = GENS.map((g) => g.id);

describe('belts', () => {
  it('belt 0 is exactly the original asteroid', () => {
    // The original scene built its outline from rng(11) like this.
    const R1 = rng(11), pts = [];
    for (let i = 0; i < 16; i++) {
      const r = 0.8 + 0.2 * R1() - (i % 5 === 0 ? 0.05 : 0), a = i / 16 * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const b = beltFor(0);
    expect(b.pts).toEqual(pts);
    expect(b.craters).toHaveLength(5);
    expect(b.veins).toHaveLength(6);
    expect(b.veins.every((v) => v.length === 5)).toBe(true);
    expect(b.squash).toEqual([1, 1]);
    expect(b.ring).toBeNull();
    expect(b).toMatchObject({ name: 'Slate Reach', rock: '#464c68', vein: '#f2a24e', veinHi: '#ffd9a8' });
  });

  it('is deterministic: the same relocation count always gives the same belt', () => {
    for (const n of [0, 1, 2, 7, 8, 25]) expect(beltFor(n)).toEqual(beltFor(n));
  });

  it('every relocation changes the look', () => {
    const seen = new Set();
    for (let n = 0; n < 24; n++) seen.add(JSON.stringify(beltFor(n).pts));
    expect(seen.size).toBe(24); // no two of the first 24 belts share an outline
    for (let n = 0; n < 7; n++) {
      expect(beltFor(n).rock).not.toBe(beltFor(n + 1).rock);
      expect(beltFor(n).vein === beltFor(n + 1).vein && beltFor(n).rock === beltFor(n + 1).rock).toBe(false);
    }
  });

  it('cycles through the colour schemes and numbers the repeats', () => {
    expect(BELTS).toHaveLength(8);
    expect(new Set(BELTS.map((b) => b.name)).size).toBe(8);
    expect(beltFor(1).name).toBe(BELTS[1].name);
    expect(beltFor(7).name).toBe(BELTS[7].name);
    expect(beltFor(8).name).toBe('Slate Reach 2');
    expect(beltFor(8).rock).toBe(BELTS[0].rock);
    expect(beltFor(8).pts).not.toEqual(beltFor(0).pts); // same colours, new shape
    expect(beltFor(17).name).toBe('Rust Drift 3');
  });

  it('generates sane shapes for many belts', () => {
    let rings = 0;
    for (let n = 1; n <= 80; n++) {
      const b = beltFor(n);
      expect(b.pts.length).toBeGreaterThanOrEqual(12);
      expect(b.pts.length).toBeLessThanOrEqual(20);
      for (const [x, y] of b.pts) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        const r = Math.hypot(x, y);
        expect(r).toBeGreaterThan(0.6);
        expect(r).toBeLessThan(1.01);
      }
      expect(b.craters.length).toBeGreaterThanOrEqual(4);
      expect(b.veins.length).toBeGreaterThanOrEqual(4);
      for (const v of b.veins) for (const [x, y] of v) expect(Math.hypot(x, y)).toBeLessThanOrEqual(0.7 + 1e-9);
      for (const s of b.squash) { expect(s).toBeGreaterThanOrEqual(0.9); expect(s).toBeLessThanOrEqual(1.1); }
      if (b.ring) { rings++; expect(b.ring.w).toBeGreaterThan(1.4); expect(b.ring.h).toBeLessThan(0.6); }
    }
    expect(rings).toBe(27);             // belts 2, 5, 8, ... up to 80
  });

  it('every third belt has a ring, starting with the second relocation', () => {
    expect([1, 2, 3, 4, 5, 6, 8].map((n) => !!beltFor(n).ring)).toEqual([false, true, false, false, true, false, true]);
    expect(beltFor(0).ring).toBeNull();
  });

  it('tolerates odd input', () => {
    expect(beltFor(-3)).toEqual(beltFor(0));
    expect(beltFor(2.9)).toEqual(beltFor(2));
    expect(beltFor(NaN)).toEqual(beltFor(0));
    expect(beltFor(undefined)).toEqual(beltFor(0));
  });
});

describe('fleet ships', () => {
  const count = (arr, id) => arr.filter((x) => x === id).length;

  it('shows nothing without vessels', () => {
    expect(allocateShips({}, ORDER)).toEqual([]);
    expect(allocateShips({ drone: 0 }, ORDER)).toEqual([]);
  });

  it('shows one ship per vessel up to the maximum', () => {
    expect(allocateShips({ drone: 1 }, ORDER)).toEqual(['drone']);
    expect(allocateShips({ drone: 3 }, ORDER)).toEqual(['drone', 'drone', 'drone']);
    expect(allocateShips({ drone: 100 }, ORDER)).toHaveLength(MAX_SHIPS);
    expect(allocateShips({ drone: 50, laser: 50, tug: 50 }, ORDER)).toHaveLength(14);
  });

  it('every owned kind shows at least one ship, even a single big vessel among many drones', () => {
    const s = allocateShips({ drone: 200, collector: 1 }, ORDER);
    expect(s).toHaveLength(14);
    expect(count(s, 'collector')).toBe(1);
    expect(count(s, 'drone')).toBe(13);
    const all = allocateShips(Object.fromEntries(ORDER.map((id) => [id, 30])), ORDER);
    for (const id of ORDER) expect(count(all, id)).toBeGreaterThanOrEqual(1);
    expect(all).toHaveLength(14);
  });

  it('never shows more ships of a kind than are owned', () => {
    const s = allocateShips({ drone: 2, laser: 1, tug: 40 }, ORDER);
    expect(count(s, 'drone')).toBeLessThanOrEqual(2);
    expect(count(s, 'laser')).toBe(1);
    expect(s).toHaveLength(14);
  });

  it('shares spare slots in proportion to ownership', () => {
    const s = allocateShips({ drone: 90, laser: 10 }, ORDER);
    expect(count(s, 'drone')).toBeGreaterThan(count(s, 'laser'));
    expect(count(s, 'laser')).toBeGreaterThanOrEqual(1);
  });

  it('lists ships in vessel order', () => {
    const s = allocateShips({ tug: 2, drone: 2, collector: 1 }, ORDER);
    expect(s).toEqual(['drone', 'drone', 'tug', 'tug', 'collector']);
  });

  it('ignores unknown vessel ids', () => {
    expect(allocateShips({ ghost: 5, drone: 1 }, ORDER)).toEqual(['drone']);
  });

  it('has a size for every vessel, growing with tier', () => {
    for (const id of ORDER) expect(SHIP_SCALE[id]).toBeGreaterThan(0);
    for (let i = 1; i < ORDER.length; i++) expect(SHIP_SCALE[ORDER[i]]).toBeGreaterThanOrEqual(SHIP_SCALE[ORDER[i - 1]]);
  });
});
