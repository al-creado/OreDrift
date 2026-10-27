import { describe, it, expect } from 'vitest';
import { parseSave, serializeState } from '../src/storage.js';
import { fresh } from '../src/logic.js';

const NOW = 2_000_000_000_000;
const goodSave = () => ({
  ore: 12.5, total: 500, allTime: 9000, taps: 40, points: 2, runs: 1,
  owned: { drone: 5, laser: 2 }, ups: { bits: true }, last: NOW - 60_000, sound: false, notify: true,
  ach: { t1: true }, stats: { comets: 3, missions: 4, best: 5 }, streak: 3, lastSupply: '2026-03-10',
  daily: { day: '2026-03-10', chest: true, missions: [
    { type: 'tap', target: 150, progress: 20, claimed: false },
    { type: 'buy', target: 10, progress: 10, claimed: true },
    { type: 'comet', target: 3, progress: 1, claimed: false }] },
  frenzyUntil: NOW + 5000,
});
const parse = (o) => parseSave(typeof o === 'string' ? o : JSON.stringify(o), NOW);

describe('parseSave', () => {
  it('round-trips a good save', () => {
    const S = parse(goodSave());
    expect(S).toMatchObject({ ore: 12.5, total: 500, allTime: 9000, taps: 40, points: 2, runs: 1, sound: false, notify: true, streak: 3, lastSupply: '2026-03-10', frenzyUntil: NOW + 5000 });
    expect(S.owned).toEqual({ drone: 5, laser: 2 });
    expect(S.ups).toEqual({ bits: true });
    expect(S.ach).toEqual({ t1: true });
    expect(S.stats).toEqual({ comets: 3, missions: 4, best: 5 });
    expect(S.daily.missions).toHaveLength(3);
    expect(S.daily.chest).toBe(true);
    expect(parse(serializeState(S, NOW))).toEqual({ ...S, last: NOW });
  });

  it('returns null for text that is not a JSON object', () => {
    for (const raw of ['', 'not json', '{', 'null', '5', '"x"', '[]', '[1,2]', 'true']) expect(parseSave(raw, NOW)).toBeNull();
  });

  it('an empty object gives defaults', () => {
    const S = parse({});
    expect(S).toEqual({ ...fresh(NOW), last: NOW });
  });

  it('bad numbers fall back to defaults', () => {
    const S = parse({ ...goodSave(), ore: -5, total: 'lots', taps: NaN, points: Infinity, runs: null, allTime: -1, streak: -2, frenzyUntil: 'x' });
    expect(S).toMatchObject({ ore: 0, total: 0, taps: 0, points: 0, runs: 0, allTime: 0, streak: 0, frenzyUntil: 0 });
  });

  it('JSON cannot carry NaN or Infinity, but null and strings are rejected too', () => {
    const S = parse('{"ore": null, "total": "5", "points": 1e999}');
    expect(S.ore).toBe(0);
    expect(S.total).toBe(0);
    expect(S.points).toBe(0); // 1e999 parses to Infinity
  });

  it('fractional counts are floored', () => {
    const S = parse({ ...goodSave(), taps: 12.9, points: 1.5, owned: { drone: 3.7 } });
    expect(S.taps).toBe(12);
    expect(S.points).toBe(1);
    expect(S.owned.drone).toBe(3);
  });

  it('drops unknown ids and non-true flags', () => {
    const S = parse({ ...goodSave(), owned: { drone: 1, ghost: 99, laser: -3, tug: 'x' }, ups: { bits: true, nope: true, tune1: 1 }, ach: { t1: true, zz: true, t2: 'yes' } });
    expect(S.owned).toEqual({ drone: 1 });
    expect(S.ups).toEqual({ bits: true });
    expect(S.ach).toEqual({ t1: true });
  });

  it('wrong container types are ignored, not fatal', () => {
    const S = parse({ ...goodSave(), owned: [1, 2], ups: 'x', ach: 5, stats: null, daily: 'x' });
    expect(S.owned).toEqual({});
    expect(S.ups).toEqual({});
    expect(S.ach).toEqual({});
    expect(S.stats).toEqual({ comets: 0, missions: 0, best: 0 });
    expect(S.daily).toBeNull();
  });

  it('lastSupply must look like YYYY-MM-DD', () => {
    for (const bad of ['', 'yesterday', '2026-3-1', '20260310', 5, null]) expect(parse({ ...goodSave(), lastSupply: bad }).lastSupply).toBe('');
    expect(parse({ ...goodSave(), lastSupply: '2026-03-10' }).lastSupply).toBe('2026-03-10');
  });

  it('daily needs exactly 3 valid missions', () => {
    const g = goodSave();
    const m = g.daily.missions;
    expect(parse({ ...g, daily: { ...g.daily, missions: m.slice(0, 2) } }).daily).toBeNull();
    expect(parse({ ...g, daily: { ...g.daily, missions: [...m, m[0]] } }).daily).toBeNull();
    expect(parse({ ...g, daily: { ...g.daily, missions: [m[0], m[1], { type: 'warp', target: 5 }] } }).daily).toBeNull();
    expect(parse({ ...g, daily: { ...g.daily, missions: [m[0], m[1], { type: 'tap', target: 0 }] } }).daily).toBeNull();
    expect(parse({ ...g, daily: { ...g.daily, missions: [m[0], m[1], null] } }).daily).toBeNull();
    expect(parse({ ...g, daily: { ...g.daily, day: 'today' } }).daily).toBeNull();
    expect(parse({ ...g, daily: { ...g.daily, missions: 'x' } }).daily).toBeNull();
  });

  it('clamps mission progress to target and defaults claimed', () => {
    const g = goodSave();
    g.daily.missions[0] = { type: 'tap', target: 150, progress: 99999, claimed: 'yes' };
    const S = parse(g);
    expect(S.daily.missions[0]).toEqual({ type: 'tap', target: 150, progress: 150, claimed: false });
  });

  it('a save from the future cannot create negative time away', () => {
    expect(parse({ ...goodSave(), last: NOW + 1e9 }).last).toBe(NOW);
    expect(parse({ ...goodSave(), last: 'x' }).last).toBe(NOW);
  });

  it('lifetime ore is never below this run total', () => {
    expect(parse({ ...goodSave(), total: 5000, allTime: 10 }).allTime).toBe(5000);
  });

  it('sound defaults on and notify defaults off', () => {
    const S = parse({});
    expect(S.sound).toBe(true);
    expect(S.notify).toBe(false);
    expect(parse({ sound: 0 }).sound).toBe(true);
    expect(parse({ sound: false }).sound).toBe(false);
  });

  it('partial data keeps what is valid', () => {
    const S = parse({ ore: 77, owned: { drone: 4 }, daily: { day: 'broken' } });
    expect(S.ore).toBe(77);
    expect(S.owned).toEqual({ drone: 4 });
    expect(S.daily).toBeNull();
  });
});
