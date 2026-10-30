import { describe, it, expect } from 'vitest';
import { GENS, UPS, ACHS, PRODUCTS, ACH_GROUPS, RANKS, JOURNAL } from '../src/data.js';
import * as L from '../src/logic.js';
import { simulate } from './sim.js';

const g = (id) => GENS.find((x) => x.id === id);
const u = (id) => UPS.find((x) => x.id === id);
const NOW = 1_000_000;
const D = (y, m, d) => new Date(y, m - 1, d, 12);
const state = (patch = {}) => Object.assign(L.fresh(NOW), patch);

describe('data', () => {
  it('has 7 vessels, 15 upgrades and 71 commendations with unique ids', () => {
    expect(GENS).toHaveLength(7);
    expect(UPS).toHaveLength(15);
    expect(new Set(UPS.map((x) => x.id)).size).toBe(15);
    const tiers = ['u1', 'u2', 'u3', 'u4'].map((id) => ACHS.find((a) => a.id === id));
    expect(tiers.map((a) => a.t)).toEqual([3, 6, 10, UPS.length]);   // spread across the list; the last always asks for every upgrade
    expect(tiers[3].desc).toContain(String(UPS.length));
    expect(ACHS).toHaveLength(71);
    expect(new Set(ACHS.map((a) => a.id)).size).toBe(71);
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
    const S = state({ points: 2, ups: Object.fromEntries(UPS.slice(0, 9).map((x) => [x.id, true])), owned: { drone: 10 } }); // the original nine
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

  it('previews what relocating would do without changing anything', () => {
    const S = state({ points: 2, total: 6.5e6, ore: 1234, owned: { drone: 3, laser: 4 }, ups: { bits: true, tune1: true } });
    const before = JSON.stringify(S);
    const p = L.relocatePreview(S);
    expect(JSON.stringify(S)).toBe(before);
    expect(p.gain).toBe(2);
    expect(p).toMatchObject({ pointsBefore: 2, pointsAfter: 4, nextAt: 9e6 });
    expect(p.surveyBefore).toBeCloseTo(0.2, 9);
    expect(p.surveyAfter).toBeCloseTo(0.4, 9);
    expect(p.bonusBefore).toBeCloseTo(0.2, 9);
    expect(p.bonusAfter).toBeCloseTo(0.4, 9);
    expect(p.ratio).toBeCloseTo(1.4 / 1.2, 9);
    expect(p.progress).toBeCloseTo((6.5e6 - 4e6) / 5e6, 9);
    expect(p.lose).toEqual({ ore: 1234, vessels: 7, upgrades: 2, run: 6.5e6 });
  });

  it('the preview matches what relocating really gives', () => {
    const S = state({ points: 3, total: 9e6, owned: { laser: 10 }, ach: { t1: true }, iap: { removeAds: false, starter: false, boost: true } });
    const p = L.relocatePreview(S), opsBefore = L.ops(S);
    L.relocate(S);
    S.owned = { laser: 10 };
    expect(S.points).toBe(p.pointsAfter);
    expect(L.achMult(S) * L.iapMult(S) * L.surveyMult(S) - 1).toBeCloseTo(p.bonusAfter, 9);
    expect(L.ops(S) / opsBefore).toBeCloseTo(p.ratio, 9);
  });

  it('preview with no points yet shows progress toward the first one', () => {
    const p = L.relocatePreview(state({ total: 4e5 }));
    expect(p.gain).toBe(0);
    expect(p.progress).toBeCloseTo(0.4, 9);
    expect(p.nextAt).toBe(1e6);
    expect(p.ratio).toBe(1);
    expect(L.relocatePreview(state({ total: 0 })).progress).toBe(0);
  });

  it('includes commendations and the shop boost in the total bonus', () => {
    const S = state({ points: 1, total: 1e6, ach: { t1: true, sh1: true }, iap: { removeAds: false, starter: false, boost: true } });
    const p = L.relocatePreview(S);
    const other = 1.015 * 1.25;
    expect(p.bonusBefore).toBeCloseTo(1.1 * other - 1, 9);
    expect(p.bonusAfter).toBeCloseTo(1.2 * other - 1, 9);
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

  it('60% of flyers are supply ships and 40% comets', () => {
    expect(L.SUPPLY_SHIP_CHANCE).toBe(0.6);
    expect(L.pickFlyer(0)).toBe('ship');
    expect(L.pickFlyer(0.599)).toBe('ship');
    expect(L.pickFlyer(0.6)).toBe('comet');
    expect(L.pickFlyer(0.999)).toBe('comet');
  });

  it('two comets in a row guarantee a supply ship next', () => {
    expect(L.GUARANTEE_AFTER).toBe(2);
    expect(L.pickFlyer(0.99, ['comet', 'comet'])).toBe('ship');
    expect(L.pickFlyer(0.99, ['ship', 'comet', 'comet'])).toBe('ship');
    expect(L.pickFlyer(0.99, ['comet'])).toBe('comet');             // one comet is not enough
    expect(L.pickFlyer(0.99, ['comet', 'ship'])).toBe('comet');     // a ship in between resets the count
    expect(L.pickFlyer(0.99, ['comet', 'ship', 'comet'])).toBe('comet');
    expect(L.pickFlyer(0.99, [])).toBe('comet');
    expect(L.pickFlyer(0.1, ['comet', 'comet'])).toBe('ship');
  });

  it('over many flyers there are never three comets in a row, and ships stay at least 60%', () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const history = [];
    let ships = 0, run = 0, longest = 0;
    for (let i = 0; i < 5000; i++) {
      const kind = L.pickFlyer(rand(), history);
      history.push(kind); if (history.length > 4) history.shift();
      if (kind === 'ship') { ships++; run = 0; } else { run++; longest = Math.max(longest, run); }
    }
    expect(longest).toBeLessThanOrEqual(2);
    expect(ships / 5000).toBeGreaterThan(0.6);
    expect(ships / 5000).toBeLessThan(0.8);
  });

  it('a supply ship gives a temporary x7 boost for 30 s and no ore', () => {
    const S = state({ owned: { laser: 10 } });
    expect(L.catchSupplyShip(S, NOW)).toEqual({ kind: 'frenzy', sec: 30 });
    expect(S.frenzyUntil).toBe(NOW + 30000);
    expect(S.ore).toBe(0);
    expect(S.stats.comets).toBe(1);
    expect(L.ops(S, NOW + 1000)).toBe(140); // 20 t/s x 7
  });

  it('catching ships back to back stacks the boost up to the cap', () => {
    const S = state();
    L.catchSupplyShip(S, NOW);
    L.catchSupplyShip(S, NOW + 1000);
    expect(S.frenzyUntil).toBe(NOW + 60000);
  });

  it('a comet drops a random 5 to 25 minutes of output, at least 300 t, and no boost', () => {
    const V = state({ owned: { laser: 10 } }); // 20 t/s
    expect(L.catchComet(V, 0)).toMatchObject({ kind: 'ore', minutes: 5, gain: 20 * 60 * 5 });
    expect(L.catchComet(V, 1)).toMatchObject({ minutes: 25, gain: 20 * 60 * 25 });
    expect(L.catchComet(V, 0.5)).toMatchObject({ minutes: 15, gain: 20 * 60 * 15 });
    expect(V.frenzyUntil).toBe(0);
    expect(V.stats.comets).toBe(3);
    const T = state(); // no fleet: the 300 t floor
    expect(L.catchComet(T, 0.7)).toEqual({ kind: 'ore', gain: 300, minutes: 19 });
    expect(T.ore).toBe(300);
  });

  it('comet ore varies with the random value', () => {
    const gains = new Set();
    for (let i = 0; i <= 10; i++) gains.add(L.catchComet(state({ owned: { laser: 10 } }), i / 10).gain);
    expect(gains.size).toBe(11);
    expect(Math.max(...gains)).toBe(5 * Math.min(...gains));
  });

  it('both count toward the comet mission, and neither adds to the mine mission', () => {
    const S = state();
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'comet', target: 3, progress: 0, claimed: false },
      { type: 'mine', target: 1000, progress: 0, claimed: false },
      { type: 'tap', target: 5, progress: 0, claimed: false }] };
    L.catchComet(S, 0.9);
    L.catchSupplyShip(S, NOW);
    expect(S.daily.missions[0].progress).toBe(2);
    expect(S.daily.missions[1].progress).toBe(0);
    expect(S.total).toBe(300);
    expect(S.stats.comets).toBe(2);
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
    expect(L.missionText({ type: 'comet', target: 3 })).toBe('Catch 3 comets or supply ships');
  });
});

describe('commendations', () => {
  const ORIGINAL = {
    t1: 100, t2: 1000, t3: 10000, t4: 100000, o1: 1000, o2: 1e6, o3: 1e9, o4: 1e12,
    f1: 10, f2: 50, f3: 150, f4: 400, k1: 3, k2: 5, k3: 7, u1: 3, u2: 6,
    r1: 1, r2: 5, r3: 10, c1: 1, c2: 25, c3: 100, m1: 3, m2: 30, m3: 100,
    s1: 3, s2: 7, s3: 30, p1: 100, p2: 10000, p3: 1e6,
  };
  const NEW_IDS = ACHS.filter((a) => !(a.id in ORIGINAL)).map((a) => a.id);

  // One probe per achievement: set the underlying stat to just below, then exactly at, the threshold.
  const setStat = (S, stat, v) => {
    switch (stat) {
      case 'taps': S.taps = v; break;
      case 'allTime': S.allTime = v; break;
      case 'heldOre': S.ore = v; break;
      case 'runs': S.runs = v; break;
      case 'points': S.points = v; break;
      case 'comets': S.stats.comets = v; break;
      case 'ships': S.stats.ships = v; S.stats.comets = v; break;
      case 'cometsOnly': S.stats.comets = v; S.stats.ships = 0; break;
      case 'missions': S.stats.missions = v; break;
      case 'chests': S.stats.chests = v; break;
      case 'best': S.stats.best = v; break;
      case 'drops': S.stats.drops = v; break;
      case 'capped': S.stats.capped = v; break;
      case 'night': S.stats.night = v; break;
      case 'bare': S.stats.bare = v; break;
      case 'bestRun': S.stats.bestRun = v; break;
      case 'overdrive': S.stats.overdrive = v; break;
      case 'fleet': case 'maxVessel': S.owned = { drone: v }; break;
      case 'kinds': S.owned = Object.fromEntries(GENS.slice(0, v).map((x) => [x.id, 1])); break;
      case 'upgrades': S.ups = Object.fromEntries(UPS.slice(0, v).map((x) => [x.id, true])); break;
      default: throw new Error(stat);
    }
  };

  it('keeps the original 32 commendations with the same thresholds and +1% bonus', () => {
    for (const [id, t] of Object.entries(ORIGINAL)) {
      const a = ACHS.find((x) => x.id === id);
      expect(a, id).toBeDefined();
      expect(a.t).toBe(t);
      expect(L.achBonus(a)).toBe(0.01);
      expect(a.secret).toBeUndefined();
    }
    expect(NEW_IDS).toHaveLength(39);
  });

  it('every commendation has a known group and a tier, and the new ones give +0.5%', () => {
    for (const a of ACHS) {
      expect(ACH_GROUPS, a.id).toContain(a.group);
      expect(a.tier, a.id).toBeGreaterThanOrEqual(1);
      expect(a.tier, a.id).toBeLessThanOrEqual(5);
      expect(a.t, a.id).toBeGreaterThan(0);
      expect(typeof L.statValue(state(), a.stat), a.id).toBe('number');
    }
    for (const id of NEW_IDS) expect(L.achBonus(ACHS.find((a) => a.id === id)), id).toBe(0.005);
  });

  describe('chains (one tile for Bronze, Silver, Gold...)', () => {
    it('puts every commendation in exactly one chain, giving 26 tiles', () => {
      const ids = L.CHAINS.flatMap((c) => c.steps.map((a) => a.id));
      expect(ids).toHaveLength(71);
      expect(new Set(ids).size).toBe(71);
      expect(L.CHAINS).toHaveLength(26);
      expect(new Set(L.CHAINS.map((c) => c.id)).size).toBe(26);
      for (const a of ACHS) expect(a.chain, a.id).toBeTruthy();
    });

    it('each chain is one goal measured one way, with rising thresholds and tiers', () => {
      for (const c of L.CHAINS) {
        expect(c.title, c.id).toBeTruthy();
        for (let i = 0; i < c.steps.length; i++) {
          expect(c.steps[i].stat, c.id).toBe(c.steps[0].stat);
          expect(c.steps[i].group, c.id).toBe(c.group);
          if (i) {
            expect(c.steps[i].t, c.id).toBeGreaterThan(c.steps[i - 1].t);
            expect(c.steps[i].tier, c.id).toBeGreaterThanOrEqual(c.steps[i - 1].tier);
          }
        }
      }
    });

    it('the long goals are chains and the eight secrets are single tiles', () => {
      const len = (id) => L.CHAINS.find((c) => c.id === id).steps.length;
      expect([len('taps'), len('ore'), len('fleet'), len('survey'), len('relocations')]).toEqual([4, 5, 5, 4, 4]);
      expect(L.CHAINS.filter((c) => c.secret).map((c) => c.id).sort()).toEqual(['barehands', 'eagleeye', 'hoard', 'nightowl', 'overdrive', 'ringed', 'sleeper', 'spectrum']);
      expect(L.CHAINS.filter((c) => c.secret).every((c) => c.steps.length === 1)).toBe(true);
    });

    it('tracks the tiers earned and the one being worked on', () => {
      const taps = L.CHAINS.find((c) => c.id === 'taps');
      const S = state();
      expect(L.chainState(S, taps)).toMatchObject({ earnedCount: 0, total: 4, complete: false, last: null });
      expect(L.chainState(S, taps).next.id).toBe('t1');
      S.taps = 1500; L.checkAch(S);
      const st = L.chainState(S, taps);
      expect(st.earnedCount).toBe(2);
      expect(st.last.id).toBe('t2');
      expect(st.next.id).toBe('t3');
      S.taps = 1e6; L.checkAch(S);
      const done = L.chainState(S, taps);
      expect(done).toMatchObject({ earnedCount: 4, complete: true, next: null });
      expect(done.last.id).toBe('t4');
    });

    it('a secret chain is hidden until its tier is earned', () => {
      const hoard = L.CHAINS.find((c) => c.id === 'hoard'), taps = L.CHAINS.find((c) => c.id === 'taps');
      const S = state();
      expect(L.chainHidden(S, hoard)).toBe(true);
      expect(L.chainHidden(S, taps)).toBe(false);
      S.ore = 1e9; L.checkAch(S);
      expect(L.chainHidden(S, hoard)).toBe(false);
    });
  });

  it('has eight secret commendations', () => {
    expect(ACHS.filter((a) => a.secret).map((a) => a.id).sort()).toEqual(['br1', 'er1', 'h1', 'n1', 'ov1', 'rb1', 'rb2', 'z1']);
  });

  for (const a of ACHS.filter((x) => x.stat !== 'rate' && x.stat !== 'tapPower' && x.stat !== 'achs')) {
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
      // scale with a stack of collectors to land on each side of the threshold
      const probe = (n) => { S.owned = { collector: n }; return L.achValue(S, a); };
      let n = 1;
      while (probe(n) < a.t && n < 100000) n += n < 2000 ? 1 : 500;
      expect(probe(n)).toBeGreaterThanOrEqual(a.t);
      expect(probe(Math.max(0, n - (n < 2000 ? 1 : 500)))).toBeLessThan(a.t);
      S.owned = { collector: n };
      expect(L.checkAch(S).map((x) => x.id)).toContain(a.id);
    });
  }

  describe('single tap power', () => {
    const tapAch = ACHS.filter((a) => a.stat === 'tapPower');
    it('measures one tap without a frenzy', () => {
      const S = state({ frenzyUntil: NOW + 1e9 });
      expect(L.statValue(S, 'tapPower')).toBe(1);
      S.ups = { bits: true, plasma: true, hammer: true, pulse: true };
      expect(L.statValue(S, 'tapPower')).toBe(60);
    });
    it('Heavy Hand needs a tap worth 100 t', () => {
      const S = state({ ups: { bits: true, plasma: true, hammer: true, pulse: true } });
      expect(L.checkAch(S).map((x) => x.id)).not.toContain('tp1'); // 60 t
      S.points = 7; // 60 x 1.7 = 102
      expect(L.checkAch(S).map((x) => x.id)).toContain('tp1');
    });
    it('uplinks count, so a huge fleet makes huge taps', () => {
      const S = state({ owned: { collector: 1000 }, ups: { uplink: true, uplink2: true } });
      const got = L.checkAch(S).map((x) => x.id);
      for (const a of tapAch) expect(got).toContain(a.id);
    });
  });

  it('Collector, Curator and Archivist count every commendation earned, including each other', () => {
    const mark = (n) => Object.fromEntries(ACHS.filter((x) => x.stat !== 'achs').slice(-n).map((x) => [x.id, true]));
    const run = (n) => { const S = state(); S.ach = mark(n); return L.checkAch(S).map((x) => x.id); };
    expect(run(9)).toEqual([]);
    expect(run(10)).toEqual(['a1']);
    expect(run(23)).toEqual(['a1']);          // 23 + Collector = 24, one short of Curator
    expect(run(24)).toEqual(['a1', 'a2']);    // 24 + Collector = 25
    expect(run(43)).toEqual(['a1', 'a2', 'a3']);
  });

  it('"earn N commendations" can be met by commendations unlocked in the same check', () => {
    const S = state();
    S.ach = Object.fromEntries(ACHS.filter((x) => x.stat !== 'achs').slice(-9).map((x) => [x.id, true])); // 9 earned
    S.taps = 100; // unlocks First Strikes, which makes 10
    const got = L.checkAch(S).map((x) => x.id);
    expect(got).toContain('t1');
    expect(got).toContain('a1');
  });

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

  describe('bonus', () => {
    it('the original ones add exactly 1% each to output and taps', () => {
      const S = state({ owned: { laser: 10 } });
      expect(L.achMult(S)).toBe(1);
      S.ach = { t1: true, t2: true, t3: true };
      expect(L.achMult(S)).toBeCloseTo(1.03, 12);
      expect(L.ops(S)).toBeCloseTo(20 * 1.03, 9);
      expect(L.tapValue(S, NOW, 0)).toBeCloseTo(1.03, 9);
    });
    it('newer ones add 0.5% and the two kinds add up', () => {
      const S = state({ owned: { laser: 10 } });
      S.ach = { sh1: true };
      expect(L.achMult(S)).toBeCloseTo(1.005, 12);
      S.ach = { t1: true, sh1: true, d1: true };
      expect(L.achBonusTotal(S)).toBeCloseTo(0.02, 12);
      expect(L.ops(S)).toBeCloseTo(20 * 1.02, 9);
    });
    it('earning all 71 adds 32% + 19.5%', () => {
      const S = state();
      S.ach = Object.fromEntries(ACHS.map((a) => [a.id, true]));
      expect(L.achBonusTotal(S)).toBeCloseTo(0.32 + 0.195, 9);
    });
  });

  describe('one-time ore gift', () => {
    const byTier = (t) => ACHS.find((a) => a.tier === t);
    it('pays minutes of current output by tier, with a floor', () => {
      const S = state({ owned: { laser: 10 } }); // 20 t/s = 1,200 t/min
      expect(L.achGiftAmount(S, byTier(1))).toBe(3600);    // 3 min
      expect(L.achGiftAmount(S, byTier(2))).toBe(9600);    // 8 min
      expect(L.achGiftAmount(S, byTier(3))).toBe(24000);   // 20 min
      expect(L.achGiftAmount(S, byTier(4))).toBe(54000);   // 45 min
      expect(L.achGiftAmount(S, ACHS.find((a) => a.tier === 5))).toBe(54000); // tier 5 pays like tier 4
      const E = state();
      expect([1, 2, 3, 4].map((t) => L.achGiftAmount(E, byTier(t)))).toEqual([250, 600, 1500, 4000]);
    });
    it('is reward ore: counts toward totals, not the mine mission', () => {
      const S = state();
      S.daily = { day: 'x', chest: false, missions: [
        { type: 'mine', target: 100000, progress: 0, claimed: false },
        { type: 'tap', target: 5, progress: 0, claimed: false },
        { type: 'buy', target: 5, progress: 0, claimed: false }] };
      L.queueAchGift(S, byTier(1));
      expect(L.claimAchGifts(S, null)).toBe(250);
      expect(S.ore).toBe(250);
      expect(S.allTime).toBe(250);
      expect(S.daily.missions[0].progress).toBe(0);
    });
    it('waits to be claimed, at the amount set when earned', () => {
      const S = state({ owned: { laser: 10 } }), a = byTier(1), b = ACHS.find((x) => x.tier === 2 && x.chain !== a.chain);
      L.queueAchGift(S, a); L.queueAchGift(S, b);
      expect(S.ore).toBe(0);
      expect(L.pendingGifts(S)).toEqual({ count: 2, ore: 3600 + 9600 });
      S.owned.laser = 100; // output went up since; the gift does not change
      expect(L.claimAchGifts(S, a.chain)).toBe(3600);
      expect(L.pendingGifts(S)).toEqual({ count: 1, ore: 9600 });
      expect(L.claimAchGifts(S, null)).toBe(9600);
      expect(L.claimAchGifts(S, null)).toBe(0); // nothing left; claiming twice pays once
      expect(S.ore).toBe(3600 + 9600);
    });
    it('a waiting gift lights up the Goals tab', () => {
      const S = state(), d = new Date(2026, 0, 2);
      L.ensureDaily(S, d); S.lastSupply = L.dayKey(d);
      expect(L.goalsReady(S, d)).toBe(false);
      L.queueAchGift(S, byTier(1));
      expect(L.goalsReady(S, d)).toBe(true);
    });
    it('checkAch alone pays nothing (the game pays it when announcing)', () => {
      const S = state({ taps: 100 });
      L.checkAch(S);
      expect(S.ore).toBe(0);
    });
  });

  it('secret commendations are hidden until earned', () => {
    const h1 = ACHS.find((a) => a.id === 'h1'), t1 = ACHS.find((a) => a.id === 't1');
    const S = state();
    expect(L.isHidden(S, h1)).toBe(true);
    expect(L.isHidden(S, t1)).toBe(false);
    S.ore = 1e9; L.checkAch(S);
    expect(L.isHidden(S, h1)).toBe(false);
  });

  it('ranks by number of commendations', () => {
    expect(RANKS[0].min).toBe(0);
    expect([0, 4, 5, 11, 12, 19, 20, 31, 32, 44, 45, 57, 58, 65].map((n) => L.rankFor(n).name)).toEqual([
      'Rookie', 'Rookie', 'Prospector', 'Prospector', 'Miner', 'Miner', 'Foreman', 'Foreman', 'Baron', 'Baron', 'Tycoon', 'Tycoon', 'Legend', 'Legend']);
  });

  describe('new stats are counted', () => {
    it('supply ships and comets', () => {
      const S = state();
      L.catchSupplyShip(S, NOW); L.catchSupplyShip(S, NOW); L.catchComet(S, 0.5);
      expect(S.stats).toMatchObject({ comets: 3, ships: 2 });
      expect(L.statValue(S, 'cometsOnly')).toBe(1);
      expect(L.statValue(S, 'ships')).toBe(2);
    });
    it('supply drops and caches', () => {
      const S = state();
      L.claimSupply(S, D(2026, 3, 10)); L.claimSupply(S, D(2026, 3, 11));
      expect(S.stats.drops).toBe(2);
      S.daily = { day: 'x', chest: false, missions: [1, 2, 3].map(() => ({ type: 'tap', target: 1, progress: 1, claimed: true })) };
      L.claimChest(S, NOW);
      expect(S.stats.chests).toBe(1);
      L.claimChest(S, NOW); // only once
      expect(S.stats.chests).toBe(1);
    });
    it('returning after the offline limit', () => {
      const S = state({ owned: { laser: 10 } });
      L.applyOffline(S, 8 * 3600);
      expect(S.stats.capped).toBe(0);
      L.applyOffline(S, 8 * 3600 + 1);
      expect(S.stats.capped).toBe(1);
    });
  });
});

describe('secret commendation mechanics', () => {
  const at = (h) => new Date(2026, 0, 15, h, 30).getTime();

  it('Night Owl counts only taps made between 2:00 and 3:59 local time', () => {
    const S = state();
    for (const h of [0, 1, 4, 12, 23]) L.tap(S, at(h));
    expect(S.stats.night).toBe(0);
    for (const h of [2, 3]) L.tap(S, at(h));
    expect(S.stats.night).toBe(2);
  });

  it('Bare Hands counts relocating without a single upgrade installed', () => {
    const A = state({ total: 1e6 });
    L.relocate(A);
    expect(A.stats.bare).toBe(1);
    const B = state({ total: 1e6, ups: { bits: true } });
    L.relocate(B);
    expect(B.stats.bare).toBe(0);
    const C = state({ total: 5e5 }); // not enough for a survey point: refused, so nothing counts
    expect(L.relocate(C)).toBe(0);
    expect(C.stats.bare).toBe(0);
  });

  it('Overdrive counts stacking the boost above 100 seconds', () => {
    const S = state();
    for (let i = 0; i < 3; i++) L.catchSupplyShip(S, NOW); // 30, 60, 90 s
    expect(S.stats.overdrive).toBe(0);
    L.catchSupplyShip(S, NOW);                              // capped at 120 s
    expect(S.stats.overdrive).toBe(1);
  });

  it('Eagle Eye keeps the best run of catches without a miss', () => {
    const S = state();
    L.noteCatchRun(S, 1); L.noteCatchRun(S, 2); L.noteCatchRun(S, 3);
    expect(S.stats.bestRun).toBe(3);
    L.noteCatchRun(S, 1); // a miss reset the run; the best stays
    expect(S.stats.bestRun).toBe(3);
    for (let r = 1; r <= 5; r++) L.noteCatchRun(S, r);
    expect(S.stats.bestRun).toBe(5);
    expect(L.checkAch(S).map((a) => a.id)).toContain('er1');
  });
});

describe("the Captain's journal", () => {
  it('has 10 chapters with unique ids, and the first is always open', () => {
    expect(JOURNAL).toHaveLength(10);
    expect(new Set(JOURNAL.map((c) => c.id)).size).toBe(10);
    expect(L.journalCount(state())).toBe(1);
    for (const c of JOURNAL) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('chapters unlock with lifetime progress', () => {
    const S = state();
    const count = (patch) => { Object.assign(S, patch); return L.journalCount(S); };
    expect(count({})).toBe(1);
    expect(count({ allTime: 1000 })).toBe(2);
    expect(count({ stats: { ...S.stats, comets: 1 } })).toBe(3);
    expect(count({ allTime: 1e6 })).toBe(4);
    expect(count({ runs: 1 })).toBe(5);
    expect(count({ runs: 2 })).toBe(6);
    expect(count({ allTime: 1e8 })).toBe(7);
    expect(count({ allTime: 1e9 })).toBe(8);
    expect(count({ runs: 5 })).toBe(9);
    expect(count({ allTime: 1e12 })).toBe(10);
  });

  it('keeps chapters unlocked after relocating', () => {
    const S = state({ allTime: 5e6, total: 5e6 });
    const before = L.journalCount(S);
    L.relocate(S);
    expect(L.journalCount(S)).toBeGreaterThanOrEqual(before);
  });

  it('hints at the secrets without ever naming one', () => {
    const story = JOURNAL.flatMap((c) => [c.title, ...c.text]).join(' ').toLowerCase();
    for (const a of ACHS.filter((x) => x.secret)) expect(story.includes(a.name.toLowerCase()), a.name).toBe(false);
  });

  it('every chapter that needs something says what', () => {
    for (const c of JOURNAL.slice(1)) expect(c.req.length, c.id).toBeGreaterThan(0);
  });
});

describe('late-game upgrades', () => {
  it('has 15 upgrades: the original nine, then six boosts that start where those end', () => {
    expect(UPS.slice(0, 9).map((x) => x.id)).toEqual(['bits', 'tune1', 'uplink', 'plasma', 'tune2', 'hammer', 'uplink2', 'tune3', 'pulse']);
    const late = UPS.slice(9);
    expect(late.map((x) => x.id)).toEqual(['tune4', 'uplink3', 'tune5', 'singular', 'tune6', 'tune7']);
    expect(late.every((x) => x.cost > UPS[8].cost)).toBe(true);
    const costs = late.map((x) => x.cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });
  it('the new boosts do what they say', () => {
    expect(L.tapValue(state({ ups: { uplink3: true } }), NOW, 1000)).toBeCloseTo(1 + 250, 9);
    expect(L.tapValue(state({ ups: { singular: true } }), NOW, 0)).toBeCloseTo(10, 9);
    expect(L.prodMult(state({ ups: { tune4: true, tune5: true } }))).toBeCloseTo(5, 9);
    expect(L.prodMult(state({ ups: { tune6: true, tune7: true } }))).toBeCloseTo(12, 9);
  });
  it('the list is sorted by cost, cheapest first', () => {
    const S = state({ total: 1e13 });
    const costs = L.visibleUps(S).map((x) => x.cost);
    expect(costs.length).toBeGreaterThan(5);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });
  it('the next upgrade is the cheapest one not listed yet, with the ore that reveals it', () => {
    expect(L.nextUpgrade(state({ total: 0 }))).toMatchObject({ up: { id: 'bits' }, ore: 30 });
    expect(L.nextUpgrade(state({ total: 3e9 })).up.id).toBe('tune4');
    expect(L.nextUpgrade(state({ total: 1e30 }))).toBeNull();
  });
  it('the Upgrades commendations are spread across the list', () => {
    const S = state();
    for (const [n, id] of [[3, 'u1'], [6, 'u2'], [10, 'u3'], [UPS.length, 'u4']]) {
      S.ups = Object.fromEntries(UPS.slice(0, n - 1).map((x) => [x.id, true]));
      L.checkAch(S); expect(!!S.ach[id], id + ' one short').toBe(false);
      S.ups = Object.fromEntries(UPS.slice(0, n).map((x) => [x.id, true]));
      L.checkAch(S); expect(S.ach[id], id).toBe(true);
    }
  });
});

describe('weekly missions', () => {
  const D = (y, m, d) => new Date(y, m - 1, d, 12);   // 2026-11-02 is a Monday
  const weekly = (allTime = 1e6) => { const S = L.fresh(0); S.allTime = allTime; L.ensureDaily(S, D(2026, 11, 4)); L.ensureWeekly(S, D(2026, 11, 4)); return S; };
  it('a week runs Monday to Sunday and ends at the next Monday midnight', () => {
    for (const day of [2, 3, 4, 5, 6, 7, 8]) {
      expect(L.weekKey(D(2026, 11, day)), 'Nov ' + day).toBe('2026-11-02');
      expect(L.weekEndsAt(D(2026, 11, day)), 'Nov ' + day).toBe(new Date(2026, 10, 9).getTime());
    }
    expect(L.weekKey(D(2026, 11, 9))).toBe('2026-11-09');
    expect(L.weekKey(D(2026, 11, 1))).toBe('2026-10-26');   // Sunday belongs to the week before
  });
  it('makes three different missions, the same ones for the same week', () => {
    const a = L.makeWeekly('2026-11-02', 1e6), b = L.makeWeekly('2026-11-02', 1e6);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.type)).size).toBe(3);
    expect(a.every((m) => L.WEEKLY_TYPES.includes(m.type) && m.target > 0 && m.progress === 0 && !m.claimed)).toBe(true);
    expect(L.makeWeekly('2026-11-09', 1e6)).not.toEqual(a);
  });
  it('goals are bigger than the daily ones', () => {
    const targets = {};
    for (let w = 0; w < 40; w++) for (const m of L.makeWeekly('2026-' + String(1 + (w % 12)).padStart(2, '0') + '-' + String(1 + w % 27).padStart(2, '0'), 1e6)) targets[m.type] = Math.min(targets[m.type] || Infinity, m.target);
    expect(targets.tap).toBeGreaterThanOrEqual(1050);   // 7 x the smallest daily tap goal
    expect(targets.buy).toBeGreaterThanOrEqual(60);
    expect(targets.comet).toBeGreaterThanOrEqual(12);
    expect(targets.daily).toBeGreaterThanOrEqual(10);
    expect(targets.mine).toBeGreaterThanOrEqual(30000);
  });
  it('a new week replaces the missions; the same week keeps them', () => {
    const S = weekly();
    S.weekly.missions[0].progress = 1;
    expect(L.ensureWeekly(S, D(2026, 11, 8))).toBe(false);     // still the same week (Sunday)
    expect(S.weekly.missions[0].progress).toBe(1);
    expect(L.ensureWeekly(S, D(2026, 11, 9))).toBe(true);      // Monday
    expect(S.weekly.week).toBe('2026-11-09');
    expect(S.weekly.missions.every((m) => m.progress === 0)).toBe(true);
  });
  it('progress counts toward daily and weekly missions together', () => {
    const S = weekly();
    S.daily.missions = [{ type: 'tap', target: 100, progress: 0, claimed: false }, { type: 'mine', target: 100, progress: 0, claimed: false }, { type: 'buy', target: 100, progress: 0, claimed: false }];
    S.weekly.missions = [{ type: 'tap', target: 1000, progress: 0, claimed: false }, { type: 'comet', target: 12, progress: 0, claimed: false }, { type: 'buy', target: 60, progress: 0, claimed: false }];
    L.tap(S, NOW);
    expect(S.daily.missions[0].progress).toBe(1);
    expect(S.weekly.missions[0].progress).toBe(1);
    L.addProg(S, 'comet', 2);
    expect(S.weekly.missions[1].progress).toBe(2);
    L.addProg(S, 'buy', 5);
    expect(S.daily.missions[2].progress).toBe(5); expect(S.weekly.missions[2].progress).toBe(5);
    S.weekly.missions[0].claimed = true;
    L.addProg(S, 'tap', 5);
    expect(S.weekly.missions[0].progress).toBe(1);   // claimed ones stop counting
  });
  it('claiming a daily mission counts toward a weekly "daily missions" goal', () => {
    const S = weekly();
    S.daily.missions[0] = { type: 'tap', target: 5, progress: 5, claimed: false };
    S.weekly.missions[0] = { type: 'daily', target: 10, progress: 0, claimed: false };
    expect(L.claimMission(S, 0)).toBeGreaterThan(0);
    expect(S.weekly.missions[0].progress).toBe(1);
  });
  it('claims once, pays about an hour of output, and does not count as a daily mission', () => {
    const S = weekly(); S.owned = { laser: 10 };       // 20 t/s
    S.weekly.missions[1] = { type: 'tap', target: 10, progress: 10, claimed: false };
    expect(L.weeklyReward(S)).toBe(20 * 3600);
    const missionsBefore = S.stats.missions, oreBefore = S.ore;
    expect(L.claimWeekly(S, 1)).toBe(20 * 3600);
    expect(S.ore).toBe(oreBefore + 20 * 3600);
    expect(S.stats.missions).toBe(missionsBefore);     // the "Complete N daily missions" commendations are for daily ones
    expect(L.claimWeekly(S, 1)).toBe(0);               // already claimed
    S.weekly.missions[0].progress = 0;
    expect(L.claimWeekly(S, 0)).toBe(0);               // not finished
    expect(L.claimWeekly(S, 9)).toBe(0);
    expect(L.claimWeekly(L.fresh(0), 0)).toBe(0);      // no weekly set yet
  });
  it('the reward has a floor for a new player', () => {
    expect(L.weeklyReward(L.fresh(0))).toBe(5000);
  });
  it('a finished weekly mission lights up Goals', () => {
    const S = weekly(), d = D(2026, 11, 4);
    S.lastSupply = L.dayKey(d); S.daily.chest = true;
    expect(L.goalsReady(S, d)).toBe(false);
    S.weekly.missions[2].progress = S.weekly.missions[2].target;
    expect(L.goalsReady(S, d)).toBe(true);
    S.weekly.missions[2].claimed = true;
    expect(L.goalsReady(S, d)).toBe(false);
  });
  it('describes the daily-missions goal', () => {
    expect(L.missionText({ type: 'daily', target: 12 })).toBe('Complete 12 daily missions');
  });
});

describe('swapping a daily mission', () => {
  const daily = (extra = {}) => {
    const S = L.fresh(0); S.allTime = 1e6;
    L.ensureDaily(S, new Date(2026, 10, 2));
    return Object.assign(S, extra);
  };
  it('replaces the mission with the type that is not on the list, so the three stay different', () => {
    const S = daily(), before = S.daily.missions.map((m) => m.type);
    const spare = ['tap', 'mine', 'buy', 'comet'].find((t) => !before.includes(t));
    const m = L.swapMission(S, 1);
    expect(m.type).toBe(spare);
    expect(S.daily.missions[1]).toEqual(m);
    expect(m).toMatchObject({ progress: 0, claimed: false });
    expect(new Set(S.daily.missions.map((x) => x.type)).size).toBe(3);
    expect(S.daily.missions[0].type).toBe(before[0]); // the others are untouched
    expect(S.daily.missions[2].type).toBe(before[2]);
  });
  it('the same swap always gives the same mission, and the next swap differs from it', () => {
    const a = daily(), b = daily();
    expect(L.swapMission(a, 0)).toEqual(L.swapMission(b, 0));
    expect(a.daily.swaps).toBe(1);
    const again = L.swapMission(a, 0);
    expect(again.type).not.toBe(a.daily.missions[1].type);
  });
  it('cannot swap a finished or claimed mission, or one that does not exist', () => {
    const S = daily();
    S.daily.missions[0].progress = S.daily.missions[0].target;
    expect(L.canSwap(S, 0)).toBe(false); expect(L.swapMission(S, 0)).toBeNull();
    S.daily.missions[1].claimed = true;
    expect(L.canSwap(S, 1)).toBe(false);
    expect(L.canSwap(S, 2)).toBe(true);
    expect(L.canSwap(S, 7)).toBe(false);
    expect(L.canSwap(L.fresh(0), 0)).toBe(false); // no missions yet
    expect(S.daily.swaps).toBe(0);                // nothing was spent
  });
  it('the first swap of the day is free, later ones are not unless ads are removed', () => {
    const S = daily();
    expect(L.swapIsFree(S)).toBe(true);
    L.swapMission(S, 0);
    expect(L.swapIsFree(S)).toBe(false);
    S.iap.removeAds = true;
    expect(L.swapIsFree(S)).toBe(true);
  });
  it('a new day starts with a free swap again', () => {
    const S = daily();
    L.swapMission(S, 0);
    L.ensureDaily(S, new Date(2026, 10, 3));
    expect(S.daily.swaps).toBe(0);
    expect(L.swapIsFree(S)).toBe(true);
  });
});

describe('weekly events', () => {
  const D = (y, m, d) => new Date(y, m - 1, d, 12); // 2026-10-31 is a Saturday
  it('the meteor weekend runs Saturday and Sunday and ends at Monday midnight', () => {
    const sat = L.activeEvent(D(2026, 10, 31)), sun = L.activeEvent(D(2026, 11, 1));
    expect(sat.id).toBe('meteor'); expect(sun.id).toBe('meteor');
    expect(sat.endsAt).toBe(new Date(2026, 10, 2).getTime());
    expect(sun.endsAt).toBe(sat.endsAt);
  });
  it('rich comets is Wednesday only', () => {
    const wed = L.activeEvent(D(2026, 11, 4));
    expect(wed.id).toBe('rich');
    expect(wed.endsAt).toBe(new Date(2026, 10, 5).getTime());
    expect(L.activeEvent(D(2026, 11, 2))).toBeNull(); // Monday
    expect(L.activeEvent(D(2026, 11, 5))).toBeNull(); // Thursday
  });
  it('the next event is the one that starts after today, never the one already running', () => {
    expect(L.nextEvent(D(2026, 10, 31)).id).toBe('rich');            // Saturday: next is Wednesday
    expect(L.nextEvent(D(2026, 11, 1)).startsAt).toBe(new Date(2026, 10, 4).getTime()); // Sunday
    expect(L.nextEvent(D(2026, 11, 2)).id).toBe('rich');             // Monday
    expect(L.nextEvent(D(2026, 11, 4)).id).toBe('meteor');           // Wednesday: next is the weekend
    expect(L.nextEvent(D(2026, 11, 5)).id).toBe('meteor');           // Thursday
  });
  it('rates and comet pay follow the event, and are 1 otherwise', () => {
    expect(L.flyerRate(D(2026, 10, 31))).toBe(2); expect(L.cometMult(D(2026, 10, 31))).toBe(1);
    expect(L.flyerRate(D(2026, 11, 4))).toBe(1);  expect(L.cometMult(D(2026, 11, 4))).toBe(2);
    expect(L.flyerRate(D(2026, 11, 2))).toBe(1);  expect(L.cometMult(D(2026, 11, 2))).toBe(1);
  });
  it('a faster flyer rate shortens the delay, and a comet pays its multiple', () => {
    expect(L.cometDelayMs(false, 0, 2)).toBe(20000);
    expect(L.cometDelayMs(true, 1, 2)).toBe(55000);
    const V = L.fresh(0); V.owned = { laser: 10 }; // 20 t/s
    expect(L.catchComet(V, 0.5, 2).gain).toBe(20 * 60 * 15 * 2);
  });
});

describe('play statistics', () => {
  it('counts time played and keeps the highest output', () => {
    const S = L.fresh(0); S.owned = { laser: 10 };
    L.trackPlay(S, 0.25); L.trackPlay(S, 0.25);
    expect(S.stats.played).toBe(0.5);
    expect(S.stats.peak).toBe(20);
    S.owned = { laser: 1 };
    L.trackPlay(S, 1);
    expect(S.stats.peak).toBe(20);   // does not go back down
    expect(S.stats.played).toBe(1.5);
    L.trackPlay(S, -3);
    expect(S.stats.played).toBe(1.5); // never negative
  });
});

describe('number formatting', () => {
  it('percentages: plain below 1,000%, abbreviated above', () => {
    expect(L.fmtPct(0.01)).toBe('1%');
    expect(L.fmtPct(0.005)).toBe('0.5%');
    expect(L.fmtPct(0.517)).toBe('51.7%');
    expect(L.fmtPct(9.994, 0)).toBe('999%');
    expect(L.fmtPct(153.92, 0)).toBe('15.4K%');
    expect(L.fmtPct(1.5e5)).toBe('15.0M%');
  });
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

describe('cargo pod (rewarded ad)', () => {
  it('pays 13 minutes of output with a 300 t floor', () => {
    expect(L.podReward(state())).toBe(300);
    expect(L.podReward(state({ owned: { laser: 10 } }))).toBe(20 * 60 * 13);
    expect(L.podReward(state({ owned: { laser: 10 }, frenzyUntil: NOW + 1e6 }))).toBe(20 * 60 * 13);
  });

  it('pays once, then waits 10 minutes', () => {
    const S = state({ owned: { laser: 10 } });
    expect(L.claimPod(S, NOW)).toBe(15600);
    expect(S.ore).toBe(15600);
    expect(S.podReadyAt).toBe(NOW + 600000);
    expect(L.podWaitMs(S, NOW + 1000)).toBe(599000);
    expect(L.claimPod(S, NOW + 1000)).toBe(0);
    expect(S.ore).toBe(15600);
    expect(L.podWaitMs(S, NOW + 600000)).toBe(0);
    expect(L.claimPod(S, NOW + 600000)).toBe(15600);
  });

  it('counts as reward ore, not toward the mine mission', () => {
    const S = state();
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'mine', target: 1000, progress: 0, claimed: false },
      { type: 'tap', target: 5, progress: 0, claimed: false },
      { type: 'buy', target: 5, progress: 0, claimed: false }] };
    L.claimPod(S, NOW);
    expect(S.daily.missions[0].progress).toBe(0);
    expect(S.allTime).toBe(300);
  });
});

describe('shop', () => {
  it('has the six products with unique ids', () => {
    expect(PRODUCTS.map((p) => p.id)).toEqual(['remove_ads', 'starter_bundle', 'boost_25', 'ore_small', 'ore_medium', 'ore_large']);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(6);
    for (const p of PRODUCTS) expect(p.id).toMatch(/^[a-z0-9_]+$/);
  });

  it('packs pay hours of current output with a floor', () => {
    const small = L.productById('ore_small'), large = L.productById('ore_large');
    expect(L.productOre(state(), small)).toBe(2000);
    const S = state({ owned: { laser: 10 } }); // 20 t/s
    expect(L.productOre(S, small)).toBe(20 * 3600);
    expect(L.productOre(S, large)).toBe(20 * 3600 * 24);
    expect(L.productOre(S, L.productById('remove_ads'))).toBe(0);
  });

  it('a pack is repeatable but never granted twice for the same order', () => {
    const S = state({ owned: { laser: 10 } });
    expect(L.applyPurchase(S, 'ore_small', 'order-1', NOW)).toMatchObject({ ok: true, ore: 72000, restored: false });
    expect(S.ore).toBe(72000);
    expect(L.applyPurchase(S, 'ore_small', 'order-1', NOW)).toMatchObject({ ok: true, ore: 0, restored: true });
    expect(S.ore).toBe(72000);
    expect(L.applyPurchase(S, 'ore_small', 'order-2', NOW).ore).toBe(72000);
    expect(S.ore).toBe(144000);
  });

  it('remembers only the latest 50 order ids', () => {
    const S = state();
    for (let i = 0; i < 60; i++) L.applyPurchase(S, 'ore_small', 'o' + i, NOW);
    expect(S.granted).toHaveLength(50);
    expect(S.granted[0]).toBe('o59');
  });

  it('purchased ore counts as reward ore (not the mine mission)', () => {
    const S = state();
    S.daily = { day: 'x', chest: false, missions: [
      { type: 'mine', target: 1000, progress: 0, claimed: false },
      { type: 'tap', target: 5, progress: 0, claimed: false },
      { type: 'buy', target: 5, progress: 0, claimed: false }] };
    L.applyPurchase(S, 'ore_small', 'x', NOW);
    expect(S.daily.missions[0].progress).toBe(0);
    expect(S.allTime).toBe(2000);
  });

  it('remove ads sets the flag once', () => {
    const S = state();
    expect(L.adsRemoved(S)).toBe(false);
    expect(L.applyPurchase(S, 'remove_ads', 'a', NOW)).toMatchObject({ ok: true, restored: false });
    expect(L.adsRemoved(S)).toBe(true);
    expect(L.applyPurchase(S, 'remove_ads', 'b', NOW).restored).toBe(true);
    expect(L.owns(S, 'remove_ads')).toBe(true);
  });

  it('the boost multiplies output and taps by 1.25 and survives relocate', () => {
    const S = state({ total: 4e6, owned: { laser: 10 }, ups: { bits: true } });
    const o = L.ops(S), t = L.tapValue(S, NOW, 0);
    L.applyPurchase(S, 'boost_25', 'b', NOW);
    expect(L.ops(S)).toBeCloseTo(o * 1.25, 9);
    expect(L.tapValue(S, NOW, 0)).toBeCloseTo(t * 1.25, 9);
    L.relocate(S);
    expect(S.iap.boost).toBe(true);
    expect(L.iapMult(S)).toBe(1.25);
  });

  it('starter bundle pays once: ore plus a 120 s frenzy', () => {
    const S = state({ owned: { laser: 10 } });
    const r = L.applyPurchase(S, 'starter_bundle', 's', NOW);
    expect(r).toMatchObject({ ok: true, ore: 20 * 3600 * 3, frenzy: 120, restored: false });
    expect(S.frenzyUntil).toBe(NOW + 120000);
    expect(L.applyPurchase(S, 'starter_bundle', 's2', NOW)).toMatchObject({ ore: 0, restored: true });
    expect(S.ore).toBe(20 * 3600 * 3);
  });

  it('restoreOwned sets flags without paying', () => {
    const S = state();
    L.restoreOwned(S, 'remove_ads'); L.restoreOwned(S, 'boost_25'); L.restoreOwned(S, 'starter_bundle'); L.restoreOwned(S, 'ore_small');
    expect(S.iap).toEqual({ removeAds: true, starter: true, boost: true });
    expect(S.ore).toBe(0);
  });

  it('unknown products are refused', () => {
    expect(L.applyPurchase(state(), 'gold_bars', 'x', NOW).ok).toBe(false);
  });
});

describe('save-shape defaults', () => {
  it('fresh state has the documented fields', () => {
    const S = L.fresh(42);
    expect(Object.keys(S).sort()).toEqual(['ach', 'allTime', 'daily', 'frenzyUntil', 'gifts', 'haptics', 'last', 'lastSupply', 'owned',
      'granted', 'iap', 'journalSeen', 'music', 'notify', 'podReadyAt', 'points', 'ore', 'runs', 'sound', 'stats', 'streak', 'taps', 'total', 'ups', 'weekly'].sort());
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
