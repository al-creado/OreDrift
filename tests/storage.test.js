import { describe, it, expect } from 'vitest';
import { parseSave, serializeState } from '../src/storage.js';
import { fresh } from '../src/logic.js';

const NOW = 2_000_000_000_000;
const goodSave = () => ({
  ore: 12.5, total: 500, allTime: 9000, taps: 40, points: 2, runs: 1,
  owned: { drone: 5, laser: 2 }, ups: { bits: true }, last: NOW - 60_000, sound: false, notify: true,
  ach: { t1: true }, gifts: { t1: 250 }, stats: { comets: 3, missions: 4, best: 5, ships: 2, drops: 6, chests: 1, capped: 1 }, streak: 3, lastSupply: '2026-03-10',
  daily: { day: '2026-03-10', chest: true, missions: [
    { type: 'tap', target: 150, progress: 20, claimed: false },
    { type: 'buy', target: 10, progress: 10, claimed: true },
    { type: 'comet', target: 3, progress: 1, claimed: false }] },
  frenzyUntil: NOW + 5000, podReadyAt: NOW + 1000,
  iap: { removeAds: true, boost: true }, granted: ['GPA.1', 'GPA.2'],
});
const parse = (o) => parseSave(typeof o === 'string' ? o : JSON.stringify(o), NOW);

describe('parseSave', () => {
  it('round-trips a good save', () => {
    const S = parse(goodSave());
    expect(S).toMatchObject({ ore: 12.5, total: 500, allTime: 9000, taps: 40, points: 2, runs: 1, sound: false, notify: true, streak: 3, lastSupply: '2026-03-10', frenzyUntil: NOW + 5000, podReadyAt: NOW + 1000 });
    expect(S.owned).toEqual({ drone: 5, laser: 2 });
    expect(S.ups).toEqual({ bits: true });
    expect(S.ach).toEqual({ t1: true });
    expect(S.gifts).toEqual({ t1: 250 });
    expect(S.stats).toEqual({ comets: 3, missions: 4, best: 5, ships: 2, drops: 6, chests: 1, capped: 1, night: 0, bare: 0, bestRun: 0, overdrive: 0, played: 0, peak: 0 });
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
    const S = parse({ ...goodSave(), ore: -5, total: 'lots', taps: NaN, points: Infinity, runs: null, allTime: -1, streak: -2, frenzyUntil: 'x', podReadyAt: -1 });
    expect(S).toMatchObject({ podReadyAt: 0, ore: 0, total: 0, taps: 0, points: 0, runs: 0, allTime: 0, streak: 0, frenzyUntil: 0 });
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

  it('keeps waiting gifts only for earned commendations, and an older save has none', () => {
    const S = parse({ ...goodSave(), gifts: { t1: 300, t2: 500, zz: 9, h1: 'x' } });
    expect(S.gifts).toEqual({ t1: 300 });
    const { gifts, ...old } = goodSave();
    expect(parse(old).gifts).toEqual({});
  });

  it('reads play time and peak output, and an older save has zeros', () => {
    const S = parse({ ...goodSave(), stats: { comets: 1, played: 3600.5, peak: 42.5 } });
    expect(S.stats).toMatchObject({ played: 3600.5, peak: 42.5 });
    expect(parse({ ...goodSave(), stats: { played: -5, peak: 'x' } }).stats).toMatchObject({ played: 0, peak: 0 });
  });
  it('vibration defaults on and only an explicit false turns it off', () => {
    expect(parse({}).haptics).toBe(true);
    expect(parse({ haptics: false }).haptics).toBe(false);
    expect(parse({ haptics: 'no' }).haptics).toBe(true);
  });

  it('wrong container types are ignored, not fatal', () => {
    const S = parse({ ...goodSave(), owned: [1, 2], ups: 'x', ach: 5, stats: null, daily: 'x' });
    expect(S.owned).toEqual({});
    expect(S.ups).toEqual({});
    expect(S.ach).toEqual({});
    expect(S.stats).toEqual({ comets: 0, missions: 0, best: 0, ships: 0, drops: 0, chests: 0, capped: 0, night: 0, bare: 0, bestRun: 0, overdrive: 0, played: 0, peak: 0 });
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

  it('reads purchases and ignores junk', () => {
    const S = parse(goodSave());
    expect(S.iap).toEqual({ removeAds: true, starter: false, boost: true });
    expect(S.granted).toEqual(['GPA.1', 'GPA.2']);
    const T = parse({ ...goodSave(), iap: { removeAds: 'yes', boost: 1, starter: true, gold: true }, granted: ['ok', 5, '', null, 'x'.repeat(300)] });
    expect(T.iap).toEqual({ removeAds: false, starter: true, boost: false });
    expect(T.granted).toEqual(['ok']);
    expect(parse({ ...goodSave(), iap: 'x', granted: 'y' })).toMatchObject({ iap: { removeAds: false, starter: false, boost: false }, granted: [] });
  });

  it('an older save without the newer stats gets zeros, and ships never exceed flyers caught', () => {
    const old = parse({ ...goodSave(), stats: { comets: 7, missions: 2, best: 3 } });
    expect(old.stats).toEqual({ comets: 7, missions: 2, best: 3, ships: 0, drops: 0, chests: 0, capped: 0, night: 0, bare: 0, bestRun: 0, overdrive: 0, played: 0, peak: 0 });
    expect(parse({ ...goodSave(), stats: { comets: 3, ships: 50 } }).stats.ships).toBe(3);
    expect(parse({ ...goodSave(), stats: { comets: 3, ships: -4, drops: 'x', chests: NaN } }).stats).toMatchObject({ ships: 0, drops: 0, chests: 0 });
  });

  it('reads the journal progress and the newer secret counters', () => {
    const S = parse({ ...goodSave(), journalSeen: 4, stats: { comets: 5, night: 12, bare: 2, bestRun: 6, overdrive: 1 } });
    expect(S.journalSeen).toBe(4);
    expect(S.stats).toMatchObject({ night: 12, bare: 2, bestRun: 6, overdrive: 1 });
    expect(parse({ ...goodSave(), journalSeen: 999 }).journalSeen).toBe(10); // never more than there are chapters
    expect(parse({ ...goodSave(), journalSeen: -3 }).journalSeen).toBe(0);
    expect(parse({ ...goodSave(), journalSeen: 'x' }).journalSeen).toBe(0);
    expect(parse(goodSave()).journalSeen).toBe(0); // older saves have none
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
    expect(S.music).toBe(true);
    expect(parse({ music: false }).music).toBe(false);
    expect(parse({ music: 0 }).music).toBe(true);
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
