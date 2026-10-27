import { describe, it, expect } from 'vitest';
import { GENS, UPS, ACHS } from '../src/data.js';
import * as L from '../src/logic.js';
import { simulate } from './sim.js';

const g = (id) => GENS.find((x) => x.id === id);
const u = (id) => UPS.find((x) => x.id === id);
const NOW = 1_000_000;
const D = (y, m, d) => new Date(y, m - 1, d, 12);
const state = (patch = {}) => Object.assign(L.fresh(NOW), patch);

describe('data', () => {
  it('has 7 vessels, 9 upgrades and 32 commendations with unique ids', () => {
    expect(GENS).toHaveLength(7);
    expect(UPS).toHaveLength(9);
    expect(ACHS).toHaveLength(32);
    expect(new Set(ACHS.map((a) => a.id)).size).toBe(32);
  });
});

describe('costs and buying', () => {
  it('unit cost is base * 1.15^owned', () => {
    const S = state({ owned: { drone: 3 } });
    expect(L.unitCost(S, g('drone'))).toBeCloseTo(15 * 1.15 ** 3, 9);
    expect(L.unitCost(state(), g('laser'))).toBe(100);
  });

  it('bulk cost of 1 is the ceiling of the unit cost', () => {
    expect(L.bulkCost(state(), g('drone'), 1)).toBe(15);
    const S = state({ owned: { drone: 1 } }); // 17.25
    expect(L.bulkCost(S, g('drone'), 1)).toBe(18);
  });

  it('bulk cost of n matches the geometric sum', () => {
    const S = state();
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += 15 * 1.15 ** i;
    expect(L.bulkCost(S, g('drone'), 10)).toBe(Math.ceil(sum));
    expect(L.bulkCost(S, g('drone'), 10)).toBe(305);
  });

  it('maxBuy buys the most affordable and never overspends', () => {
    expect(L.maxBuy(state({ ore: 14 }), g('drone'))).toBe(0);
    expect(L.maxBuy(state({ ore: 15 }), g('drone'))).toBe(1);
    expect(L.maxBuy(state({ ore: 305 }), g('drone'))).toBe(10);
    expect(L.maxBuy(state({ ore: 304 }), g('drone'))).toBe(9);
    for (const ore of [50, 999, 1e4, 1e6, 1e9]) {
      const S = state({ ore });
      const n = L.maxBuy(S, g('drone'));
      expect(L.bulkCost(S, g('drone'), n)).toBeLessThanOrEqual(ore);
      if (n < 1000) expect(L.bulkCost(S, g('drone'), n + 1)).toBeGreaterThan(ore);
    }
  });

  it('maxBuy is capped at 1000 per press', () => {
    expect(L.maxBuy(state({ ore: 1e300 }), g('drone'))).toBe(1000);
  });

  it('max mode always shows at least 1, even when unaffordable', () => {
    expect(L.buyQty(state({ ore: 0 }), g('drone'), 'max')).toBe(1);
    expect(L.buyQty(state({ ore: 305 }), g('drone'), 'max')).toBe(10);
    expect(L.buyQty(state(), g('drone'), 10)).toBe(10);
  });

  it('buyVessel spends ore, adds units and refuses when short', () => {
    const S = state({ ore: 20 });
    S.daily = null;
    const r = L.buyVessel(S, g('drone'), 1);
    expect(r).toMatchObject({ ok: true, n: 1, cost: 15 });
    expect(S.ore).toBe(5);
    expect(L.own(S, 'drone')).toBe(1);
    const r2 = L.buyVessel(S, g('drone'), 10);
    expect(r2.ok).toBe(false);
    expect(S.ore).toBe(5);
    expect(L.own(S, 'drone')).toBe(1);
  });

  it('buyVessel reports every milestone crossed', () => {
    const S = state({ ore: 1e9, owned: { drone: 8 } });
    expect(L.buyVessel(S, g('drone'), 20).milestones).toEqual([10, 25]);
    expect(L.buyVessel(S, g('drone'), 1).milestones).toEqual([]);
  });

  it('bulk buys count units toward the buy mission', () => {
    const S = state({ ore: 1e9 });
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'buy', target: 20, progress: 0, claimed: false },
      { type: 'tap', target: 5, progress: 0, claimed: false },
      { type: 'mine', target: 5, progress: 0, claimed: false }] };
    L.buyVessel(S, g('drone'), 10);
    expect(S.daily.missions[0].progress).toBe(10);
    L.buyVessel(S, g('drone'), 10);
    L.buyVessel(S, g('drone'), 10);
    expect(S.daily.missions[0].progress).toBe(20); // clamped at target
  });

  it('buyUpgrade is one-time and needs enough ore', () => {
    const S = state({ ore: 99 });
    expect(L.buyUpgrade(S, u('bits'))).toBe(false);
    S.ore = 150;
    expect(L.buyUpgrade(S, u('bits'))).toBe(true);
    expect(S.ore).toBe(50);
    S.ore = 1000;
    expect(L.buyUpgrade(S, u('bits'))).toBe(false);
    expect(S.ore).toBe(1000);
  });
});

describe('reveal rules', () => {
  it('first vessel is always visible; others at 40% of base cost', () => {
    const S = state();
    expect(L.revealed(S, GENS[0], 0)).toBe(true);
    expect(L.revealed(S, GENS[1], 1)).toBe(false);
    S.total = 39.9;
    expect(L.revealed(S, GENS[1], 1)).toBe(false);
    S.total = 40;
    expect(L.revealed(S, GENS[1], 1)).toBe(true);
  });

  it('an owned vessel stays revealed after a reset of the run total', () => {
    expect(L.revealed(state({ total: 0, owned: { laser: 1 } }), GENS[1], 1)).toBe(true);
  });

  it('upgrades are listed at 30% of cost and hidden once installed', () => {
    const S = state({ total: 29 });
    expect(L.visibleUps(S).map((x) => x.id)).toEqual([]);
    S.total = 30;
    expect(L.visibleUps(S).map((x) => x.id)).toEqual(['bits']);
    S.ups.bits = true;
    expect(L.visibleUps(S)).toEqual([]);
  });
});

describe('milestones', () => {
  it('each threshold doubles output and they stack', () => {
    const expected = { 0: 1, 9: 1, 10: 2, 24: 2, 25: 4, 49: 4, 50: 8, 100: 16, 149: 16, 150: 32, 199: 32, 200: 64, 500: 64 };
    for (const [n, m] of Object.entries(expected)) expect(L.milestoneMult(+n)).toBe(m);
  });

  it('applies to vessel output', () => {
    expect(L.ops(state({ owned: { drone: 9 } }))).toBeCloseTo(0.9, 9);
    expect(L.ops(state({ owned: { drone: 10 } }))).toBeCloseTo(2, 9);
    expect(L.ops(state({ owned: { drone: 200 } }))).toBeCloseTo(200 * 0.1 * 64, 9);
  });
});

describe('output and tap formulas', () => {
  it('sums every vessel', () => {
    const S = state({ owned: { drone: 1, laser: 1, tug: 1, barge: 1, refinery: 1, foundry: 1, collector: 1 } });
    expect(L.ops(S)).toBeCloseTo(0.1 + 1 + 8 + 47 + 260 + 1400 + 7800, 6);
  });

  it('each tune upgrade multiplies output, and they stack', () => {
    const base = { owned: { laser: 10 } }; // 10 * 1 * 2 = 20
    expect(L.ops(state(base))).toBe(20);
    expect(L.ops(state({ ...base, ups: { tune1: true } }))).toBeCloseTo(25, 9);
    expect(L.ops(state({ ...base, ups: { tune2: true } }))).toBeCloseTo(30, 9);
    expect(L.ops(state({ ...base, ups: { tune3: true } }))).toBeCloseTo(40, 9);
    expect(L.ops(state({ ...base, ups: { tune1: true, tune2: true, tune3: true } }))).toBeCloseTo(20 * 1.25 * 1.5 * 2, 9);
  });

  it('tap and uplink upgrades do not change ore per second', () => {
    const S = state({ owned: { laser: 10 }, ups: { bits: true, plasma: true, hammer: true, pulse: true, uplink: true, uplink2: true } });
    expect(L.ops(S)).toBe(20);
  });

  it('survey points add 10% each and commendations 1% each', () => {
    const S = state({ owned: { laser: 10 }, points: 3 });
    S.ach = { t1: true, t2: true, o1: true, f1: true, c1: true };
    expect(L.surveyMult(S)).toBeCloseTo(1.3, 9);
    expect(L.achMult(S)).toBeCloseTo(1.05, 9);
    expect(L.ops(S)).toBeCloseTo(20 * 1.3 * 1.05, 9);
  });

  it('base tap is 1 and each tap upgrade multiplies it', () => {
    expect(L.tapValue(state(), NOW, 0)).toBe(1);
    expect(L.tapValue(state({ ups: { bits: true } }), NOW, 0)).toBe(2);
    expect(L.tapValue(state({ ups: { bits: true, plasma: true } }), NOW, 0)).toBe(4);
    expect(L.tapValue(state({ ups: { bits: true, plasma: true, hammer: true } }), NOW, 0)).toBe(12);
    expect(L.tapValue(state({ ups: { bits: true, plasma: true, hammer: true, pulse: true } }), NOW, 0)).toBe(60);
  });

  it('uplinks add 5% then another 10% of ore per second', () => {
    expect(L.tapValue(state({ ups: { uplink: true } }), NOW, 1000)).toBeCloseTo(1 + 50, 9);
    expect(L.tapValue(state({ ups: { uplink: true, uplink2: true } }), NOW, 1000)).toBeCloseTo(1 + 150, 9);
  });

  it('with every upgrade, survey points and commendations', () => {
    const S = state({ points: 2, ups: Object.fromEntries(UPS.map((x) => [x.id, true])), owned: { drone: 10 } });
    S.ach = { t1: true, t2: true };
    const o = L.ops(S);
    // output: 10*0.1*2 = 2, tunes 1.25*1.5*2 = 3.75, survey 1.2, ach 1.02
    expect(o).toBeCloseTo(2 * 3.75 * 1.2 * 1.02, 9);
    // tap: 2*2*3*5 = 60, survey 1.2, ach 1.02, plus 15% of ops
    expect(L.tapValue(S, NOW, o)).toBeCloseTo(60 * 1.2 * 1.02 + o * 0.15, 9);
  });

  it('frenzy multiplies ops and the base part of a tap by 7, not the uplink part', () => {
    const S = state({ owned: { laser: 10 }, ups: { uplink: true }, frenzyUntil: NOW + 5000 });
    expect(L.ops(S, NOW)).toBe(140);
    expect(L.ops(S)).toBe(20); // no-frenzy rate used for rewards
    expect(L.ops(S, NOW + 6000)).toBe(20); // expired
    expect(L.tapValue(S, NOW, 140)).toBeCloseTo(7 + 7, 9);
  });

  it('tap() adds ore, counts the tap and advances the tap mission', () => {
    const S = state({ ups: { bits: true } });
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'tap', target: 3, progress: 0, claimed: false },
      { type: 'mine', target: 100, progress: 0, claimed: false },
      { type: 'comet', target: 2, progress: 0, claimed: false }] };
    expect(L.tap(S, NOW)).toBe(2);
    expect(S).toMatchObject({ ore: 2, total: 2, allTime: 2, taps: 1 });
    expect(S.daily.missions[0].progress).toBe(1);
    expect(S.daily.missions[1].progress).toBe(2);
  });
});

describe('survey points and relocate', () => {
  it('gain is floor(sqrt(total / 1e6))', () => {
    expect(L.prestigeGain(state({ total: 999_999 }))).toBe(0);
    expect(L.prestigeGain(state({ total: 1e6 }))).toBe(1);
    expect(L.prestigeGain(state({ total: 3_999_999 }))).toBe(1);
    expect(L.prestigeGain(state({ total: 4e6 }))).toBe(2);
    expect(L.prestigeGain(state({ total: 1e10 }))).toBe(100);
  });

  it('next point needs (gain+1)^2 * 1e6', () => {
    expect(L.nextPointAt(state({ total: 1e6 }))).toBe(4e6);
    expect(L.nextPointAt(state({ total: 0 }))).toBe(1e6);
  });

  it('is refused below 1 point and leaves state alone', () => {
    const S = state({ total: 5e5, ore: 7, owned: { drone: 3 } });
    expect(L.relocate(S)).toBe(0);
    expect(S.owned.drone).toBe(3);
    expect(S.runs).toBe(0);
  });

  it('resets the run and keeps permanent progress', () => {
    const S = state({
      ore: 1e6, total: 9e6, allTime: 5e7, taps: 123, points: 2, runs: 1,
      owned: { drone: 40 }, ups: { bits: true }, sound: false, streak: 4, lastSupply: '2026-01-02',
      frenzyUntil: NOW + 1000,
    });
    S.ach = { t1: true };
    S.stats = { comets: 5, missions: 6, best: 7 };
    S.daily = { day: '2026-01-02', chest: true, missions: [] };
    expect(L.relocate(S)).toBe(3);
    expect(S).toMatchObject({ ore: 0, total: 0, owned: {}, ups: {}, points: 5, runs: 2 });
    expect(S).toMatchObject({ allTime: 5e7, taps: 123, sound: false, streak: 4, lastSupply: '2026-01-02' });
    expect(S.ach).toEqual({ t1: true });
    expect(S.stats).toEqual({ comets: 5, missions: 6, best: 7 });
    expect(S.daily.chest).toBe(true);
  });

  it('each point boosts output by 10%', () => {
    const S = state({ total: 4e6, owned: { laser: 10 } });
    const before = L.ops(S);
    L.relocate(S);
    S.owned = { laser: 10 };
    expect(L.ops(S)).toBeCloseTo(before * 1.2, 9);
  });
});

describe('offline earnings', () => {
  it('pays half rate and ignores frenzy', () => {
    const S = state({ owned: { laser: 10 }, frenzyUntil: NOW + 1e9 }); // 20 t/s
    const r = L.applyOffline(S, 100);
    expect(r).toEqual({ gain: 1000, capped: false });
    expect(S.ore).toBe(1000);
    expect(S.allTime).toBe(1000);
  });

  it('caps at 8 hours', () => {
    const S = state({ owned: { laser: 10 } });
    const r = L.applyOffline(S, 8 * 3600);
    expect(r).toEqual({ gain: 20 * 8 * 3600 * 0.5, capped: false });
    const S2 = state({ owned: { laser: 10 } });
    const r2 = L.applyOffline(S2, 30 * 3600);
    expect(r2.gain).toBe(20 * 8 * 3600 * 0.5);
    expect(r2.capped).toBe(true);
  });

  it('returns null when there is no fleet', () => {
    const S = state();
    expect(L.applyOffline(S, 3600)).toBeNull();
    expect(S.ore).toBe(0);
  });

  it('counts toward the mine mission', () => {
    const S = state({ owned: { laser: 10 } });
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'mine', target: 5000, progress: 0, claimed: false },
      { type: 'tap', target: 1, progress: 0, claimed: false },
      { type: 'buy', target: 1, progress: 0, claimed: false }] };
    L.applyOffline(S, 100);
    expect(S.daily.missions[0].progress).toBe(1000);
  });
});

describe('frenzy', () => {
  it('starts from now', () => {
    const S = state();
    L.startFrenzy(S, NOW, 30);
    expect(S.frenzyUntil).toBe(NOW + 30000);
    expect(L.frenzyOn(S, NOW)).toBe(true);
    expect(L.frenzyLeft(S, NOW + 10000)).toBe(20);
    expect(L.frenzyOn(S, NOW + 30000)).toBe(false);
    expect(L.frenzyLeft(S, NOW + 40000)).toBe(0);
  });

  it('stacks by extending the current end', () => {
    const S = state();
    L.startFrenzy(S, NOW, 30);
    L.startFrenzy(S, NOW + 10000, 30);
    expect(S.frenzyUntil).toBe(NOW + 60000);
  });

  it('starting after expiry restarts from now', () => {
    const S = state({ frenzyUntil: NOW - 5000 });
    L.startFrenzy(S, NOW, 30);
    expect(S.frenzyUntil).toBe(NOW + 30000);
  });

  it('is capped at 120 seconds from now', () => {
    const S = state();
    for (let i = 0; i < 10; i++) L.startFrenzy(S, NOW, 60);
    expect(S.frenzyUntil).toBe(NOW + 120000);
    L.startFrenzy(S, NOW + 50000, 60); // cap moves with now
    expect(S.frenzyUntil).toBe(NOW + 170000);
  });
});

describe('comets', () => {
  it('schedules the next comet 40-90 s after a miss and 50-110 s after a catch', () => {
    expect(L.FIRST_COMET_MS).toBe(25000);
    expect(L.cometDelayMs(false, 0)).toBe(40000);
    expect(L.cometDelayMs(false, 1)).toBe(90000);
    expect(L.cometDelayMs(true, 0)).toBe(50000);
    expect(L.cometDelayMs(true, 1)).toBe(110000);
  });

  it('70% of rewards are a 30 s frenzy, 30% a pod worth 13 minutes (min 300 t)', () => {
    const S = state();
    expect(L.catchCometReward(S, NOW, 0.69)).toEqual({ kind: 'frenzy', sec: 30 });
    expect(S.frenzyUntil).toBe(NOW + 30000);
    expect(S.stats.comets).toBe(1);
    const T = state(); // no fleet: pod pays the 300 t floor
    expect(L.catchCometReward(T, NOW, 0.7)).toEqual({ kind: 'pod', gain: 300 });
    expect(T.ore).toBe(300);
    const V = state({ owned: { laser: 10 } }); // 20 t/s * 780 s = 15600
    expect(L.catchCometReward(V, NOW, 0.99).gain).toBe(15600);
  });

  it('counts toward the comet mission but pod ore does not count toward mine', () => {
    const S = state();
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'comet', target: 2, progress: 0, claimed: false },
      { type: 'mine', target: 1000, progress: 0, claimed: false },
      { type: 'tap', target: 5, progress: 0, claimed: false }] };
    L.catchCometReward(S, NOW, 0.9);
    expect(S.daily.missions[0].progress).toBe(1);
    expect(S.daily.missions[1].progress).toBe(0);
    expect(S.total).toBe(300);
  });
});

describe('supply drop', () => {
  const day1 = D(2026, 3, 10), day2 = D(2026, 3, 11), day4 = D(2026, 3, 13);

  it('first claim starts a streak of 1 and pays x1', () => {
    const S = state();
    expect(L.canSupply(S, day1)).toBe(true);
    const r = L.claimSupply(S, day1);
    expect(r).toEqual({ reward: 600, streak: 1 });
    expect(S).toMatchObject({ streak: 1, lastSupply: '2026-03-10', ore: 600 });
    expect(S.stats.best).toBe(1);
  });

  it('cannot claim twice in one day', () => {
    const S = state();
    L.claimSupply(S, day1);
    expect(L.canSupply(S, D(2026, 3, 10))).toBe(false);
    expect(L.claimSupply(S, D(2026, 3, 10))).toBeNull();
    expect(S.ore).toBe(600);
  });

  it('claiming the next day continues the streak', () => {
    const S = state();
    L.claimSupply(S, day1);
    expect(L.nextStreak(S, day2)).toBe(2);
    expect(L.claimSupply(S, day2).streak).toBe(2);
    expect(S.stats.best).toBe(2);
  });

  it('a missed day restarts at 1, but best streak is kept', () => {
    const S = state();
    L.claimSupply(S, day1);
    L.claimSupply(S, day2);
    expect(L.nextStreak(S, day4)).toBe(1);
    expect(L.shownStreak(S, day4)).toBe(0);
    expect(L.claimSupply(S, day4).streak).toBe(1);
    expect(S.stats.best).toBe(2);
  });

  it('streak continues across a month and a year boundary', () => {
    const S = state({ streak: 5, lastSupply: '2026-12-31' });
    expect(L.nextStreak(S, D(2027, 1, 1))).toBe(6);
    const T = state({ streak: 5, lastSupply: '2026-02-28' });
    expect(L.nextStreak(T, D(2026, 3, 1))).toBe(6);
  });

  it('factor is 1 + 0.25 per day up to x2.5 on day 7 and beyond', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 30].map(L.supplyFactor)).toEqual([1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.5, 2.5]);
  });

  it('pays the larger of the floor and 15 minutes of output, scaled by the factor', () => {
    const S = state({ streak: 6, lastSupply: '2026-03-09' }); // day 7 -> x2.5, no fleet
    expect(L.supplyReward(S, day1)).toBe(1500);
    S.owned = { laser: 10 }; // 20 t/s: 20 * 60 * 15 * 2.5 = 45000
    expect(L.supplyReward(S, day1)).toBe(45000);
    const T = state({ owned: { laser: 10 } }); // day 1: 20*60*15 = 18000
    expect(L.supplyReward(T, day1)).toBe(18000);
  });

  it('ignores an active frenzy when paying', () => {
    const S = state({ owned: { laser: 10 }, frenzyUntil: NOW + 1e6 });
    expect(L.supplyReward(S, day1)).toBe(18000);
  });
});

describe('daily missions', () => {
  it('niceRound keeps two significant figures', () => {
    expect(L.niceRound(3000)).toBe(3000);
    expect(L.niceRound(48_765)).toBe(49_000);
    expect(L.niceRound(1_234_567)).toBe(1_200_000);
    expect(L.niceRound(99)).toBe(99);
    expect(L.niceRound(9.2)).toBe(10);
  });

  it('is deterministic for a fixed date', () => {
    const a = L.makeMissions('2026-01-15', 0);
    expect(L.makeMissions('2026-01-15', 0)).toEqual(a);
    expect(a).toEqual([
      { type: 'buy', target: 14, progress: 0, claimed: false },
      { type: 'mine', target: 3000, progress: 0, claimed: false },
      { type: 'tap', target: 150, progress: 0, claimed: false },
    ]);
    expect(L.hashStr('2026-01-15')).toBe(2183670930);
  });

  it('mine target scales with lifetime ore (4%, min 3000)', () => {
    const find = (m) => m.find((x) => x.type === 'mine').target;
    expect(find(L.makeMissions('2026-01-15', 0))).toBe(3000);
    expect(find(L.makeMissions('2026-01-15', 1_234_567))).toBe(49_000);
  });

  it('always gives three different types with targets in range', () => {
    const seen = new Set();
    for (let d = 1; d <= 28; d++) {
      const ms = L.makeMissions(L.dayKey(D(2026, 2, d)), 0);
      expect(ms).toHaveLength(3);
      expect(new Set(ms.map((m) => m.type)).size).toBe(3);
      for (const m of ms) {
        seen.add(m.type);
        if (m.type === 'tap') expect([150, 250, 400]).toContain(m.target);
        if (m.type === 'buy') expect(m.target).toBeGreaterThanOrEqual(8), expect(m.target).toBeLessThanOrEqual(20);
        if (m.type === 'comet') expect(m.target).toBeGreaterThanOrEqual(2), expect(m.target).toBeLessThanOrEqual(4);
        expect(m.progress).toBe(0);
        expect(m.claimed).toBe(false);
      }
    }
    expect(seen.size).toBe(4);
  });

  it('different days produce different sets', () => {
    const keys = new Set();
    for (let d = 1; d <= 20; d++) keys.add(JSON.stringify(L.makeMissions(L.dayKey(D(2026, 5, d)), 0)));
    expect(keys.size).toBeGreaterThan(5);
  });

  it('dayKey is zero padded local date', () => {
    expect(L.dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(L.prevDayKey(new Date(2026, 0, 1, 0, 1))).toBe('2025-12-31');
  });

  it('ensureDaily generates once per day and regenerates at a new day', () => {
    const S = state();
    expect(L.ensureDaily(S, D(2026, 1, 15))).toBe(true);
    expect(S.daily.day).toBe('2026-01-15');
    S.daily.missions[0].progress = 3;
    expect(L.ensureDaily(S, new Date(2026, 0, 15, 23, 59))).toBe(false);
    expect(S.daily.missions[0].progress).toBe(3);
    expect(L.ensureDaily(S, D(2026, 1, 16))).toBe(true);
    expect(S.daily.missions.every((m) => m.progress === 0 && !m.claimed)).toBe(true);
    expect(S.daily.chest).toBe(false);
  });

  it('progress is clamped at target and ignored once claimed', () => {
    const S = state();
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'tap', target: 3, progress: 2, claimed: false },
      { type: 'tap', target: 3, progress: 0, claimed: true },
      { type: 'buy', target: 3, progress: 0, claimed: false }] };
    L.addProg(S, 'tap', 5);
    expect(S.daily.missions.map((m) => m.progress)).toEqual([3, 0, 0]);
  });

  it('reward is 8 minutes of output, at least 400 t', () => {
    expect(L.missionReward(state())).toBe(400);
    expect(L.missionReward(state({ owned: { laser: 10 } }))).toBe(20 * 60 * 8);
    expect(L.missionReward(state({ owned: { laser: 10 }, frenzyUntil: NOW + 1e6 }))).toBe(20 * 60 * 8);
  });

  const withDone = (claimed) => {
    const S = state({ owned: { laser: 10 } });
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'tap', target: 3, progress: 3, claimed },
      { type: 'buy', target: 3, progress: 3, claimed },
      { type: 'comet', target: 3, progress: 3, claimed }] };
    return S;
  };

  it('claiming pays the reward as reward ore (no mine progress) and counts the mission', () => {
    const S = withDone(false);
    S.daily.missions.push();
    S.daily.missions[2] = { type: 'mine', target: 100000, progress: 0, claimed: false };
    expect(L.claimMission(S, 0)).toBe(9600);
    expect(S.stats.missions).toBe(1);
    expect(S.total).toBe(9600);
    expect(S.allTime).toBe(9600);
    expect(S.daily.missions[2].progress).toBe(0);
    expect(L.claimMission(S, 0)).toBe(0); // already claimed
    expect(S.stats.missions).toBe(1);
  });

  it('cannot claim an unfinished mission', () => {
    const S = withDone(false);
    S.daily.missions[0].progress = 2;
    expect(L.claimMission(S, 0)).toBe(0);
    expect(L.claimMission(S, 7)).toBe(0);
  });

  it('cache opens only after all three are claimed, pays 25 minutes and a 60 s frenzy', () => {
    const S = withDone(false);
    expect(L.claimChest(S, NOW)).toBe(0);
    for (let i = 0; i < 3; i++) L.claimMission(S, i);
    const before = S.ore;
    expect(L.claimChest(S, NOW)).toBe(20 * 60 * 25);
    expect(S.ore - before).toBe(30000);
    expect(S.frenzyUntil).toBe(NOW + 60000);
    expect(L.claimChest(S, NOW)).toBe(0); // only once
  });

  it('cache has a 2,500 t floor', () => {
    const S = state();
    S.daily = { day: 'x', chest: false, missions: [1, 2, 3].map(() => ({ type: 'tap', target: 1, progress: 1, claimed: true })) };
    expect(L.claimChest(S, NOW)).toBe(2500);
  });

  it('goalsReady flags a supply, a finished mission or an openable cache', () => {
    const date = D(2026, 3, 10);
    const S = state({ lastSupply: '2026-03-10' });
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'tap', target: 5, progress: 1, claimed: false },
      { type: 'buy', target: 5, progress: 1, claimed: false },
      { type: 'comet', target: 5, progress: 1, claimed: false }] };
    expect(L.goalsReady(S, date)).toBe(false);
    S.daily.missions[0].progress = 5;
    expect(L.goalsReady(S, date)).toBe(true);
    S.daily.missions.forEach((m) => { m.progress = m.target; m.claimed = true; });
    expect(L.goalsReady(S, date)).toBe(true); // cache
    S.daily.chest = true;
    expect(L.goalsReady(S, date)).toBe(false);
    S.lastSupply = '2026-03-09';
    expect(L.goalsReady(S, date)).toBe(true); // supply
  });

  it('describes each mission type', () => {
    expect(L.missionText({ type: 'tap', target: 1500 })).toBe('Tap the asteroid 1.50K times');
    expect(L.missionText({ type: 'mine', target: 49000 })).toBe('Mine 49.0K t of ore');
    expect(L.missionText({ type: 'buy', target: 12 })).toBe('Hire 12 vessels');
    expect(L.missionText({ type: 'comet', target: 3 })).toBe('Catch 3 comets');
  });
});

describe('commendations', () => {
  // One probe per achievement: set the underlying stat to just below, then exactly at, the threshold.
  const setStat = (S, stat, v) => {
    switch (stat) {
      case 'taps': S.taps = v; break;
      case 'allTime': S.allTime = v; break;
      case 'runs': S.runs = v; break;
      case 'comets': S.stats.comets = v; break;
      case 'missions': S.stats.missions = v; break;
      case 'best': S.stats.best = v; break;
      case 'fleet': S.owned = { drone: v }; break;
      case 'kinds': S.owned = Object.fromEntries(GENS.slice(0, v).map((x) => [x.id, 1])); break;
      case 'upgrades': S.ups = Object.fromEntries(UPS.slice(0, v).map((x) => [x.id, true])); break;
      default: throw new Error(stat);
    }
  };

  const expectedThresholds = {
    t1: 100, t2: 1000, t3: 10000, t4: 100000, o1: 1000, o2: 1e6, o3: 1e9, o4: 1e12,
    f1: 10, f2: 50, f3: 150, f4: 400, k1: 3, k2: 5, k3: 7, u1: 3, u2: 9,
    r1: 1, r2: 5, r3: 10, c1: 1, c2: 25, c3: 100, m1: 3, m2: 30, m3: 100,
    s1: 3, s2: 7, s3: 30, p1: 100, p2: 10000, p3: 1e6,
  };

  it('has the 32 thresholds from the spec', () => {
    expect(Object.fromEntries(ACHS.map((a) => [a.id, a.t]))).toEqual(expectedThresholds);
  });

  for (const a of ACHS.filter((x) => x.stat !== 'rate')) {
    it(`${a.name} unlocks at exactly ${a.t}`, () => {
      const S = state();
      setStat(S, a.stat, a.t - 1);
      expect(L.checkAch(S).map((x) => x.id)).not.toContain(a.id);
      setStat(S, a.stat, a.t);
      expect(L.checkAch(S).map((x) => x.id)).toContain(a.id);
      expect(S.ach[a.id]).toBe(true);
      expect(L.checkAch(S).map((x) => x.id)).not.toContain(a.id); // reported once
    });
  }

  for (const a of ACHS.filter((x) => x.stat === 'rate')) {
    it(`${a.name} unlocks at ${a.t} t/s (no frenzy)`, () => {
      const S = state({ owned: { drone: 1 }, frenzyUntil: NOW + 1e9 });
      // 1 laser = 1 t/s; scale with a stack of collectors to land on each side of the threshold
      const probe = (n) => { S.owned = { collector: n }; return L.achValue(S, a); };
      let n = 1;
      while (probe(n) < a.t && n < 2000) n++;
      expect(probe(n)).toBeGreaterThanOrEqual(a.t);
      expect(probe(n - 1)).toBeLessThan(a.t);
      S.owned = { collector: n };
      expect(L.checkAch(S).map((x) => x.id)).toContain(a.id);
    });
  }

  it('lifetime ore uses allTime, not the run total', () => {
    const S = state({ total: 0, allTime: 1000 });
    expect(L.checkAch(S).map((x) => x.id)).toContain('o1');
  });

  it('upgrade and vessel counts are per run (they fall after relocate)', () => {
    const S = state({ total: 1e6 });
    S.ups = Object.fromEntries(UPS.map((x) => [x.id, true]));
    L.checkAch(S);
    expect(S.ach.u2).toBe(true);
    L.relocate(S);
    expect(L.upCount(S)).toBe(0);
    expect(S.ach.u2).toBe(true); // earned ones persist
  });

  it('each one adds exactly 1% to output and taps', () => {
    const S = state({ owned: { laser: 10 } });
    expect(L.achMult(S)).toBe(1);
    S.ach = { t1: true, t2: true, t3: true };
    expect(L.achMult(S)).toBeCloseTo(1.03, 12);
    expect(L.ops(S)).toBeCloseTo(20 * 1.03, 9);
    expect(L.tapValue(S, NOW, 0)).toBeCloseTo(1.03, 9);
  });
});

describe('number formatting', () => {
  it('small numbers', () => {
    expect(L.fmt(0)).toBe('0');
    expect(L.fmt(0.04)).toBe('0');
    expect(L.fmt(0.1)).toBe('0.1');
    expect(L.fmt(15)).toBe('15');
    expect(L.fmt(15.26)).toBe('15.3');
    expect(L.fmt(99.94)).toBe('99.9');
    expect(L.fmt(100.4)).toBe('100');
    expect(L.fmt(999)).toBe('999');
    expect(L.fmt(-5)).toBe('0');
  });

  it('999.5 rolls over to 1.00K', () => {
    expect(L.fmt(999.4)).toBe('999');
    expect(L.fmt(999.5)).toBe('1.00K');
  });

  it('suffix precision: 2 decimals under 10, 1 under 100, none from 100', () => {
    expect(L.fmt(1234)).toBe('1.23K');
    expect(L.fmt(15_400_000)).toBe('15.4M');
    expect(L.fmt(812e9)).toBe('812B');
    expect(L.fmt(1e6)).toBe('1.00M');
    expect(L.fmt(9.99e6)).toBe('9.99M');
  });

  it('rounding up to 1000 rolls into the next suffix', () => {
    expect(L.fmt(999_999)).toBe('1.00M');
    expect(L.fmt(999_999_999)).toBe('1.00B');
    expect(L.fmt(999_900)).toBe('1.00M');
    expect(L.fmt(999_400)).toBe('999K');
  });

  it('uses every suffix up to Dc, then exponent form', () => {
    const cases = [[1e3, 'K'], [1e6, 'M'], [1e9, 'B'], [1e12, 'T'], [1e15, 'Qa'], [1e18, 'Qi'],
      [1e21, 'Sx'], [1e24, 'Sp'], [1e27, 'Oc'], [1e30, 'No'], [1e33, 'Dc']];
    for (const [n, s] of cases) expect(L.fmt(n)).toBe('1.00' + s);
    expect(L.fmt(1e15)).toBe('1.00Qa');
    expect(L.fmt(1e36)).toBe('1.00e36');
    expect(L.fmt(1e40)).toBe('1.00e40');
    expect(L.fmt(1.5e100)).toBe('1.50e100');
  });

  it('999.9 Dc falls through to exponent form instead of overflowing the suffix list', () => {
    expect(L.fmt(999_999e30)).toBe('1.00e36');
  });

  it('non-finite values', () => {
    expect(L.fmt(Infinity)).toBe('∞');
    expect(L.fmt(NaN)).toBe('∞');
  });

  it('ore readout shows whole tonnes below 1,000', () => {
    expect(L.fmtOre(0)).toBe('0');
    expect(L.fmtOre(0.99)).toBe('0');
    expect(L.fmtOre(15.9)).toBe('15');
    expect(L.fmtOre(999.99)).toBe('999');
    expect(L.fmtOre(1000)).toBe('1.00K');
    expect(L.fmtOre(1.5e6)).toBe('1.50M');
  });

  it('durations', () => {
    expect(L.fmtDur(10)).toBe('1 m');
    expect(L.fmtDur(150)).toBe('2 m');
    expect(L.fmtDur(3 * 3600 + 12 * 60 + 5)).toBe('3 h 12 m');
    expect(L.fmtDur(3600)).toBe('1 h 0 m');
  });
});

describe('save-shape defaults', () => {
  it('fresh state has the documented fields', () => {
    const S = L.fresh(42);
    expect(Object.keys(S).sort()).toEqual(['ach', 'allTime', 'daily', 'frenzyUntil', 'last', 'lastSupply', 'owned',
      'notify', 'points', 'ore', 'runs', 'sound', 'stats', 'streak', 'taps', 'total', 'ups'].sort());
    expect(S.last).toBe(42);
    expect(S.sound).toBe(true);
  });
});

describe('pacing (README 3.12)', () => {
  // Simulated player: taps 5 times a second and, every second, buys the affordable item with the best payback.
  it('reaches the target totals within 15%', () => {
    const targets = { 1e4: 8, 1e5: 19, 1e6: 36, 1e7: 66, 1e9: 200 };
    const hit = simulate({ milestones: Object.keys(targets).map(Number), tapsPerSec: 5, waitForBest: false });
    for (const [ore, minutes] of Object.entries(targets)) {
      const got = hit[ore];
      expect(got, `ore ${ore}`).toBeDefined();
      expect(Math.abs(got / minutes - 1), `${ore} t at ${got.toFixed(1)} min vs ${minutes}`).toBeLessThanOrEqual(0.15);
    }
  });
});
