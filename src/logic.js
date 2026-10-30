/*
 * Pure game rules. No DOM. State (`S`) is passed in; time is passed in as `now` (ms)
 * or `date` (Date) so every function is deterministic and testable.
 * Mutating functions say so and return plain results the UI turns into toasts and sounds.
 */
import {
  GENS, UPS, ACHS, MILESTONES, GROWTH, OFFLINE_CAP, OFFLINE_RATE, PRESTIGE_BASE,
  FRENZY_MULT, FRENZY_MAX_MS, ACH_BONUS, ACH_GIFT, RANKS, CHAIN_TITLES, JOURNAL, SURVEY_BONUS, MAX_BUY, MISSION_TYPES, TAP_TARGETS,
  PRODUCTS, BOOST_MULT, GRANTED_KEEP,
} from './data.js';

/* ---------- random ---------- */
export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- formatting ---------- */
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) n = 0;
  if (n < 999.5) {
    if (n >= 100) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }
  const e = Math.floor(Math.log10(n) / 3);
  if (e >= SUF.length) return n.toExponential(2).replace('e+', 'e');
  const v = n / Math.pow(10, e * 3);
  const s = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0);
  if (parseFloat(s) >= 1000) {
    // Rounded up to 1000: roll into the next suffix, or exponent form past Dc.
    if (e + 1 < SUF.length) return (parseFloat(s) / 1000).toFixed(2) + SUF[e + 1];
    return n.toExponential(2).replace('e+', 'e');
  }
  return s + SUF[e];
}

/** Big readout: whole tonnes below 1,000, otherwise fmt(). */
export const fmtOre = (n) => (n < 1000 ? String(Math.floor(n)) : fmt(n));

/** A fraction as a percent (0.5 -> "50%"), abbreviated like ore amounts once it passes 1,000% ("15.4K%"). */
export function fmtPct(x, digits = 1) {
  const p = x * 100;
  return (p < 999.5 ? String(Number(Math.max(0, p).toFixed(digits))) : fmt(p)) + '%';
}

export function fmtDur(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? h + ' h ' + m + ' m' : Math.max(1, m) + ' m';
}

/* ---------- state ---------- */
export function fresh(now = 0) {
  return {
    ore: 0, total: 0, allTime: 0, taps: 0, points: 0, runs: 0,
    owned: {}, ups: {}, last: now, sound: true, music: true, haptics: true, ach: {},
    stats: { comets: 0, missions: 0, best: 0, ships: 0, drops: 0, chests: 0, capped: 0, night: 0, bare: 0, bestRun: 0, overdrive: 0, played: 0, peak: 0 },
    streak: 0, lastSupply: '', daily: null, frenzyUntil: 0, notify: false, podReadyAt: 0,
    iap: { removeAds: false, starter: false, boost: false }, granted: [], journalSeen: 0,
    gifts: {}, // commendation id -> ore gift waiting to be claimed
  };
}

export const own = (S, id) => S.owned[id] || 0;

/* ---------- output ---------- */
export function milestoneMult(n) {
  let m = 1;
  for (const k of MILESTONES) if (n >= k) m *= 2;
  return m;
}
export const surveyMult = (S) => 1 + SURVEY_BONUS * S.points;
export const achCount = (S) => ACHS.reduce((a, x) => a + (S.ach[x.id] ? 1 : 0), 0);
/** Permanent bonus of one commendation: the original 32 give +1%, newer ones +0.5%. */
export const achBonus = (a) => (a.bonus === undefined ? ACH_BONUS : a.bonus);
export const achBonusTotal = (S) => ACHS.reduce((t, a) => t + (S.ach[a.id] ? achBonus(a) : 0), 0);
export const achMult = (S) => 1 + achBonusTotal(S);
/** One-time shop boost: x1.25 to all output and taps. */
export const iapMult = (S) => (S.iap && S.iap.boost ? BOOST_MULT : 1);
export const adsRemoved = (S) => !!(S.iap && S.iap.removeAds);

export function prodMult(S) {
  let m = 1;
  for (const u of UPS) if (S.ups[u.id] && u.prod) m *= u.prod;
  return m * surveyMult(S) * achMult(S) * iapMult(S);
}

export const frenzyOn = (S, now) => now < S.frenzyUntil;
export const frenzyLeft = (S, now) => Math.max(0, (S.frenzyUntil - now) / 1000);

/** Extends the frenzy timer, capped at 120 s from now. Mutates S. */
export function startFrenzy(S, now, sec) {
  S.frenzyUntil = Math.min(Math.max(now, S.frenzyUntil) + sec * 1000, now + FRENZY_MAX_MS);
}

/** Ore per second. Pass now = null/undefined for the no-frenzy rate. */
export function ops(S, now) {
  let t = 0;
  for (const g of GENS) {
    const n = own(S, g.id);
    if (n) t += n * g.rate * milestoneMult(n);
  }
  const boost = now != null && frenzyOn(S, now) ? FRENZY_MULT : 1;
  return t * prodMult(S) * boost;
}

/** `o` is the current ore/s used by the uplink upgrades (usually ops(S, now)). */
export function tapValue(S, now, o) {
  let m = 1, l = 0;
  for (const u of UPS) {
    if (!S.ups[u.id]) continue;
    if (u.tap) m *= u.tap;
    if (u.link) l += u.link;
  }
  return m * surveyMult(S) * achMult(S) * iapMult(S) * (frenzyOn(S, now) ? FRENZY_MULT : 1) + o * l;
}

/* ---------- buying ---------- */
export const unitCost = (S, g) => g.base * Math.pow(GROWTH, own(S, g.id));
export const bulkCost = (S, g, n) => Math.ceil(unitCost(S, g) * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1));

/** Most units affordable right now, 0..1000. */
export function maxBuy(S, g) {
  const c = unitCost(S, g);
  if (S.ore < c) return 0;
  let n = Math.floor(Math.log(S.ore * (GROWTH - 1) / c + 1) / Math.log(GROWTH));
  n = Math.max(0, Math.min(n, MAX_BUY));
  while (n > 0 && bulkCost(S, g, n) > S.ore) n--;
  return n;
}

/** Quantity a buy button represents: a number, or 'max' (always at least 1). */
export const buyQty = (S, g, mode) => (mode === 'max' ? Math.max(1, maxBuy(S, g)) : mode);

export const revealed = (S, g, i) => i === 0 || own(S, g.id) > 0 || S.total >= g.base * 0.4;
export const visibleUps = (S) => UPS.filter((u) => !S.ups[u.id] && S.total >= u.cost * 0.3);

/** Mutates S. Returns { ok, n, cost, milestones: [k...] }. */
export function buyVessel(S, g, mode) {
  const n = buyQty(S, g, mode), cost = bulkCost(S, g, n);
  if (S.ore < cost) return { ok: false, n, cost, milestones: [] };
  S.ore -= cost;
  addProg(S, 'buy', n);
  const before = own(S, g.id), after = before + n;
  S.owned[g.id] = after;
  return { ok: true, n, cost, milestones: MILESTONES.filter((k) => before < k && after >= k) };
}

export function buyUpgrade(S, u) {
  if (S.ups[u.id] || S.ore < u.cost) return false;
  S.ore -= u.cost;
  S.ups[u.id] = true;
  return true;
}

/* ---------- earning ---------- */
/** Adds ore. Reward ore counts for totals but not for the "mine" mission. */
export function gain(S, x, reward) {
  S.ore += x; S.total += x; S.allTime += x;
  if (!reward) addProg(S, 'mine', x);
}

/** Mutates S. Returns the ore gained from one tap. */
export function tap(S, now) {
  const v = tapValue(S, now, ops(S, now));
  gain(S, v);
  S.taps++;
  const hour = new Date(now).getHours();
  if (hour >= 2 && hour < 4) S.stats.night++; // taps in the small hours (local time)
  addProg(S, 'tap', 1);
  return v;
}

/** Mutates S. Returns { gain, capped } or null when nothing was earned. */
export function applyOffline(S, sec) {
  const s = Math.min(sec, OFFLINE_CAP), g = ops(S) * s * OFFLINE_RATE;
  if (!(g > 0)) return null;
  gain(S, g);
  const capped = sec > OFFLINE_CAP;
  if (capped) S.stats.capped++;
  return { gain: g, capped };
}

/** Mutates S. Counts seconds of play (not time away) and the highest steady output reached, for the stats list. */
export function trackPlay(S, sec) {
  if (sec > 0) S.stats.played += sec;
  S.stats.peak = Math.max(S.stats.peak, ops(S));
}

/* ---------- relocate ---------- */
export const prestigeGain = (S) => Math.floor(Math.sqrt(S.total / PRESTIGE_BASE));
export const nextPointAt = (S) => Math.pow(prestigeGain(S) + 1, 2) * PRESTIGE_BASE;

/**
 * What relocating right now would do, for the Belt tab. Does not change S.
 * bonusBefore/After are the whole "all output and taps" bonus (survey points x commendations x shop boost), as shown in the header.
 */
export function relocatePreview(S) {
  const gain = prestigeGain(S);
  const lower = gain * gain * PRESTIGE_BASE, upper = (gain + 1) * (gain + 1) * PRESTIGE_BASE;
  const other = achMult(S) * iapMult(S);
  const before = surveyMult(S) * other, after = (1 + SURVEY_BONUS * (S.points + gain)) * other;
  return {
    gain,
    pointsBefore: S.points, pointsAfter: S.points + gain,
    surveyBefore: surveyMult(S) - 1, surveyAfter: SURVEY_BONUS * (S.points + gain),
    bonusBefore: before - 1, bonusAfter: after - 1,
    ratio: after / before,
    progress: Math.max(0, Math.min(1, (S.total - lower) / (upper - lower))), // toward the next survey point
    nextAt: upper,
    lose: { ore: S.ore, vessels: fleetCount(S), upgrades: upCount(S), run: S.total },
  };
}

/** Mutates S. Returns the points gained (0 = refused). */
export function relocate(S) {
  const g = prestigeGain(S);
  if (g < 1) return 0;
  if (upCount(S) === 0) S.stats.bare++; // left without installing a single upgrade
  S.points += g; S.runs++;
  S.ore = 0; S.total = 0; S.owned = {}; S.ups = {};
  return g;
}

/* ---------- commendations ---------- */
export const fleetCount = (S) => GENS.reduce((a, g) => a + own(S, g.id), 0);
export const kindCount = (S) => GENS.filter((g) => own(S, g.id) > 0).length;
export const upCount = (S) => UPS.filter((u) => S.ups[u.id]).length;

export const maxVessel = (S) => GENS.reduce((m, g) => Math.max(m, own(S, g.id)), 0);

export function statValue(S, stat) {
  switch (stat) {
    case 'taps': return S.taps;
    case 'tapPower': return tapValue(S, Infinity, ops(S)); // one tap without a frenzy
    case 'allTime': return S.allTime;
    case 'heldOre': return S.ore;
    case 'fleet': return fleetCount(S);
    case 'kinds': return kindCount(S);
    case 'maxVessel': return maxVessel(S);
    case 'upgrades': return upCount(S);
    case 'runs': return S.runs;
    case 'points': return S.points;
    case 'comets': return S.stats.comets;
    case 'ships': return S.stats.ships;
    case 'cometsOnly': return Math.max(0, S.stats.comets - S.stats.ships);
    case 'missions': return S.stats.missions;
    case 'chests': return S.stats.chests;
    case 'best': return S.stats.best;
    case 'drops': return S.stats.drops;
    case 'capped': return S.stats.capped;
    case 'night': return S.stats.night;
    case 'bare': return S.stats.bare;
    case 'bestRun': return S.stats.bestRun;
    case 'overdrive': return S.stats.overdrive;
    case 'achs': return achCount(S);
    case 'rate': return ops(S);
    default: return 0;
  }
}
export const achValue = (S, a) => statValue(S, a.stat);

/** Unlocks any newly met commendations. Mutates S. Returns the newly earned ones (in the order earned). */
export function checkAch(S) {
  const out = [];
  // A few passes, because "earn N commendations" can be met by commendations unlocked in this very call.
  for (let pass = 0; pass < 4; pass++) {
    let found = false;
    for (const a of ACHS) {
      if (!S.ach[a.id] && achValue(S, a) >= a.t) { S.ach[a.id] = true; out.push(a); found = true; }
    }
    if (!found) break;
  }
  return out;
}

/**
 * The commendation chains (one tile each): { id, title, group, secret, steps } with steps in ascending order.
 * A secret chain stays hidden until its first tier is earned.
 */
export const CHAINS = (() => {
  const map = new Map();
  for (const a of ACHS) {
    if (!map.has(a.chain)) map.set(a.chain, { id: a.chain, title: CHAIN_TITLES[a.chain], group: a.group, secret: true, steps: [] });
    const c = map.get(a.chain);
    c.steps.push(a);
    if (!a.secret) c.secret = false;
  }
  for (const c of map.values()) c.steps.sort((x, y) => x.t - y.t);
  return [...map.values()];
})();

/** Where the player is in a chain: tiers earned, the tier being worked on (null when complete), and the last earned one. */
export function chainState(S, chain) {
  const earned = chain.steps.filter((a) => S.ach[a.id]);
  return {
    earnedCount: earned.length, total: chain.steps.length,
    next: chain.steps.find((a) => !S.ach[a.id]) || null,
    last: earned.length ? earned[earned.length - 1] : null,
    complete: earned.length === chain.steps.length,
  };
}
export const chainHidden = (S, chain) => chain.secret && !chain.steps.some((a) => S.ach[a.id]);

/** Hidden until earned. */
export const isHidden = (S, a) => !!a.secret && !S.ach[a.id];

/** One-time ore gift for earning a commendation: minutes of current output by tier, with a floor. Mutates S. */
export function achGiftAmount(S, a) {
  const [min, floor] = ACH_GIFT[Math.min(4, a.tier)];
  return minutesOfOre(S, min, floor);
}
/** Sets aside a new commendation's ore gift (sized now, at current output) for the player to claim. Mutates S. */
export function queueAchGift(S, a) {
  const g = achGiftAmount(S, a);
  S.gifts[a.id] = g;
  return g;
}
/** Ore gifts waiting to be claimed, optionally for one chain only: { count, ore }. */
export function pendingGifts(S, chainId) {
  let count = 0, ore = 0;
  for (const a of ACHS) {
    if (S.gifts[a.id] === undefined || (chainId && a.chain !== chainId)) continue;
    count++; ore += S.gifts[a.id];
  }
  return { count, ore };
}
/** Pays the waiting gifts (all, or one chain's). Mutates S. Returns the ore paid. */
export function claimAchGifts(S, chainId) {
  const { ore } = pendingGifts(S, chainId);
  for (const a of ACHS) if (S.gifts[a.id] !== undefined && (!chainId || a.chain === chainId)) delete S.gifts[a.id];
  if (ore > 0) gain(S, ore, true);
  return ore;
}

/** Title for a number of commendations earned. */
export function rankFor(n) {
  let r = RANKS[0];
  for (const x of RANKS) if (n >= x.min) r = x;
  return r;
}

/* ---------- days, missions, supply drop ---------- */
export function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function prevDayKey(d) {
  const p = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return dayKey(p);
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Two significant figures (whole numbers below 10 round up). */
export function niceRound(n) {
  if (n < 10) return Math.ceil(n);
  const e = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / e) * e;
}

/** Same day string and same lifetime ore always give the same missions. */
export function makeMissions(day, allTime) {
  const r = rng(hashStr(day)), types = MISSION_TYPES.slice();
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const x = types[i]; types[i] = types[j]; types[j] = x;
  }
  return types.slice(0, 3).map((type) => ({ type, target: missionTarget(type, allTime, r), progress: 0, claimed: false }));
}
/** The goal for one mission type; r is a 0..1 generator. */
function missionTarget(type, allTime, r) {
  if (type === 'tap') return TAP_TARGETS[Math.floor(r() * 3)];
  if (type === 'mine') return niceRound(Math.max(3000, allTime * 0.04));
  if (type === 'buy') return 8 + Math.floor(r() * 13);
  return 2 + Math.floor(r() * 3);
}

/** The first swap of each day is free; later ones need a bonus ad (free when ads are removed). */
export const FREE_SWAPS = 1;
export const swapIsFree = (S) => !S.daily || (S.daily.swaps || 0) < FREE_SWAPS || adsRemoved(S);
/** A mission can be swapped while it is neither finished nor claimed. */
export const canSwap = (S, i) => { const m = S.daily && S.daily.missions[i]; return !!m && !m.claimed && m.progress < m.target; };
/**
 * Mutates S. Replaces mission i with the kind of mission that is not on today's list (so the three stay different),
 * with a goal drawn from the day and the swap count, so the same swap always gives the same mission. Returns the new mission or null.
 */
export function swapMission(S, i) {
  if (!canSwap(S, i)) return null;
  const D = S.daily, n = D.swaps || 0, used = D.missions.map((m) => m.type);
  const type = MISSION_TYPES.find((t) => !used.includes(t));
  if (!type) return null;
  D.missions[i] = { type, target: missionTarget(type, S.allTime, rng(hashStr(D.day + ':swap:' + n))), progress: 0, claimed: false };
  D.swaps = n + 1;
  return D.missions[i];
}

/** Regenerates missions if the day changed. Mutates S. Returns true when it did. */
export function ensureDaily(S, date) {
  const d = dayKey(date);
  if (!S.daily || S.daily.day !== d) {
    S.daily = { day: d, missions: makeMissions(d, S.allTime), chest: false, swaps: 0 };
    return true;
  }
  return false;
}

export function addProg(S, type, n) {
  if (!S.daily) return;
  for (const m of S.daily.missions) {
    if (m.type === type && !m.claimed && m.progress < m.target) m.progress = Math.min(m.target, m.progress + n);
  }
}

export function missionText(m) {
  if (m.type === 'tap') return 'Tap the asteroid ' + fmt(m.target) + ' times';
  if (m.type === 'mine') return 'Mine ' + fmt(m.target) + ' t of ore';
  if (m.type === 'buy') return 'Hire ' + m.target + ' vessels';
  return 'Catch ' + m.target + ' comets or supply ships';
}

/** `min` minutes of no-frenzy output, at least `floor`. */
export const minutesOfOre = (S, min, floor) => Math.max(floor, ops(S) * 60 * min);
export const missionReward = (S) => minutesOfOre(S, 8, 400);
export const chestReward = (S) => minutesOfOre(S, 25, 2500);

export const canSupply = (S, date) => S.lastSupply !== dayKey(date);
export const nextStreak = (S, date) => (S.lastSupply === prevDayKey(date) ? S.streak + 1 : 1);
export const shownStreak = (S, date) =>
  (S.lastSupply === dayKey(date) || S.lastSupply === prevDayKey(date) ? S.streak : 0);
export const supplyFactor = (n) => 1 + 0.25 * (Math.min(n, 7) - 1);
export function supplyReward(S, date) {
  const f = supplyFactor(nextStreak(S, date));
  return minutesOfOre(S, 15 * f, 600 * f);
}

export function goalsReady(S, date) {
  if (canSupply(S, date)) return true;
  if (pendingGifts(S).count > 0) return true;
  const D = S.daily;
  if (!D) return false;
  if (D.missions.some((m) => !m.claimed && m.progress >= m.target)) return true;
  return !D.chest && D.missions.every((m) => m.claimed);
}

/** Mutates S. Returns the reward, or 0 if not claimable. */
export function claimMission(S, i) {
  const m = S.daily && S.daily.missions[i];
  if (!m || m.claimed || m.progress < m.target) return 0;
  const g = missionReward(S);
  m.claimed = true; S.stats.missions++;
  gain(S, g, true);
  return g;
}

/** Mutates S. Returns the reward, or 0 if not claimable. Also starts a 60 s frenzy. */
export function claimChest(S, now) {
  const D = S.daily;
  if (!D || D.chest || !D.missions.every((m) => m.claimed)) return 0;
  const g = chestReward(S);
  D.chest = true;
  S.stats.chests++;
  gain(S, g, true);
  startFrenzy(S, now, 60);
  return g;
}

/** Mutates S. Returns { reward, streak } or null if already claimed today. */
export function claimSupply(S, date) {
  if (!canSupply(S, date)) return null;
  const reward = supplyReward(S, date), streak = nextStreak(S, date);
  S.streak = streak;
  S.lastSupply = dayKey(date);
  S.stats.best = Math.max(S.stats.best, streak);
  S.stats.drops++;
  gain(S, reward, true);
  return { reward, streak };
}

/* ---------- passing flyers: supply ships and comets ---------- */
export const FIRST_COMET_MS = 25000;
/** Delay before the next flyer, from a 0..1 random value. */
export const cometDelayMs = (caught, r, rate = 1) => (caught ? 50 + r * 60 : 40 + r * 50) * 1000 / rate;

/* ---------- weekly events: no server, they follow the player's local calendar ---------- */
/** days: getDay() values (0 = Sunday). flyerRate: flyers come this many times as often. cometMult: comets drop this many times the ore. */
export const EVENTS = [
  { id: 'meteor', name: 'Meteor weekend', days: [6, 0], flyerRate: 2, cometMult: 1, desc: 'Supply ships and comets fly past twice as often.' },
  { id: 'rich', name: 'Rich comets', days: [3], flyerRate: 1, cometMult: 2, desc: 'Comets drop double the ore.' },
];
const dayAt = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const eventOn = (date) => EVENTS.find((e) => e.days.includes(date.getDay())) || null;
/** The event running on this date, with endsAt (ms, the next local midnight after its last day), or null. */
export function activeEvent(date) {
  const e = eventOn(date);
  if (!e) return null;
  let n = 1;
  while (n < 8 && eventOn(dayAt(date, n)) === e) n++;
  return { ...e, endsAt: dayAt(date, n).getTime() };
}
/** The next event that starts after this date (not the one already running), with startsAt (ms), or null. */
export function nextEvent(date) {
  const now = eventOn(date);
  for (let n = 1; n <= 7; n++) {
    const e = eventOn(dayAt(date, n));
    if (e && e !== now) return { ...e, startsAt: dayAt(date, n).getTime() };
  }
  return null;
}
export const flyerRate = (date) => (activeEvent(date) || { flyerRate: 1 }).flyerRate;
export const cometMult = (date) => (activeEvent(date) || { cometMult: 1 }).cometMult;

/** Share of flyers that are supply ships (the rest are comets). */
export const SUPPLY_SHIP_CHANCE = 0.6;
/** After this many comets in a row, the next flyer is always a supply ship (no long dry spells). */
export const GUARANTEE_AFTER = 2;

/**
 * Which flyer appears next: 'ship' (temporary boost) or 'comet' (ore).
 * `r` is a 0..1 random value; `history` lists the kinds that appeared before, oldest first.
 */
export function pickFlyer(r, history = []) {
  const tail = history.slice(-GUARANTEE_AFTER);
  if (tail.length === GUARANTEE_AFTER && tail.every((k) => k === 'comet')) return 'ship';
  return r < SUPPLY_SHIP_CHANCE ? 'ship' : 'comet';
}

export const SHIP_BOOST_SECONDS = 30;
/** A comet pays a random 5 to 25 minutes of current no-frenzy output, at least 300 t. */
export const COMET_MIN_MINUTES = 5;
export const COMET_MAX_MINUTES = 25;
export const COMET_FLOOR = 300;

/** Mutates S. A supply ship brings a temporary boost (output and taps x7). Returns { kind: 'frenzy', sec }. */
export function catchSupplyShip(S, now) {
  S.stats.comets++;
  S.stats.ships++;
  addProg(S, 'comet', 1);
  startFrenzy(S, now, SHIP_BOOST_SECONDS);
  if (S.frenzyUntil - now > 100000) S.stats.overdrive++; // stacked up to over 100 s of boost
  return { kind: 'frenzy', sec: SHIP_BOOST_SECONDS };
}

/** Mutates S. A comet drops a random amount of ore (times an event's mult); rand is 0..1. Returns { kind: 'ore', gain, minutes }. */
export function catchComet(S, rand, mult = 1) {
  S.stats.comets++;
  addProg(S, 'comet', 1);
  const minutes = COMET_MIN_MINUTES + rand * (COMET_MAX_MINUTES - COMET_MIN_MINUTES);
  const g = minutesOfOre(S, minutes, COMET_FLOOR) * mult;
  gain(S, g, true);
  return { kind: 'ore', gain: g, minutes };
}

/* ---------- rewarded ad: cargo pod ---------- */
export const POD_MINUTES = 13;
export const POD_COOLDOWN_MS = 10 * 60 * 1000;
/** Ore in a cargo pod: 13 minutes of no-frenzy output, at least 300 t (same as the comet pod). */
export const podReward = (S) => minutesOfOre(S, POD_MINUTES, 300);
/** Milliseconds until the next pod may be requested (0 = ready). */
export const podWaitMs = (S, now) => Math.max(0, S.podReadyAt - now);

/** Call after the ad was watched. Mutates S. Returns the ore paid, or 0 if still cooling down. */
export function claimPod(S, now) {
  if (podWaitMs(S, now) > 0) return 0;
  const g = podReward(S);
  gain(S, g, true);
  S.podReadyAt = now + POD_COOLDOWN_MS;
  return g;
}

/* ---------- shop ---------- */
export const productById = (id) => PRODUCTS.find((p) => p.id === id);

/** Ore a pack or bundle pays right now. */
export const productOre = (S, p) => (p.hours ? minutesOfOre(S, p.hours * 60, p.floor) : 0);

/** True when a one-time product is already owned (a pack is never "owned"). */
export function owns(S, id) {
  if (id === 'remove_ads') return !!S.iap.removeAds;
  if (id === 'starter_bundle') return !!S.iap.starter;
  if (id === 'boost_25') return !!S.iap.boost;
  return false;
}

/**
 * Applies a completed purchase. Mutates S.
 * `orderId` makes it safe to call twice for the same purchase (a pack is granted once per order).
 * Returns { ok, ore, frenzy, restored } where restored means nothing new was paid.
 */
export function applyPurchase(S, productId, orderId, now) {
  const p = productById(productId);
  if (!p) return { ok: false, ore: 0, frenzy: 0, restored: false };
  if (p.kind === 'pack') {
    if (orderId && S.granted.includes(orderId)) return { ok: true, ore: 0, frenzy: 0, restored: true };
    const ore = productOre(S, p);
    gain(S, ore, true);
    if (orderId) { S.granted.unshift(orderId); S.granted.length = Math.min(S.granted.length, GRANTED_KEEP); }
    return { ok: true, ore, frenzy: 0, restored: false };
  }
  if (owns(S, productId)) return { ok: true, ore: 0, frenzy: 0, restored: true };
  if (productId === 'remove_ads') S.iap.removeAds = true;
  else if (productId === 'boost_25') S.iap.boost = true;
  else if (productId === 'starter_bundle') {
    S.iap.starter = true;
    const ore = productOre(S, p);
    gain(S, ore, true);
    startFrenzy(S, now, p.frenzy);
    return { ok: true, ore, frenzy: p.frenzy, restored: false };
  }
  return { ok: true, ore: 0, frenzy: 0, restored: false };
}

/** Marks a one-time product as owned without paying anything (Play says the player already bought it). */
export function restoreOwned(S, productId) {
  if (productId === 'remove_ads') S.iap.removeAds = true;
  else if (productId === 'boost_25') S.iap.boost = true;
  else if (productId === 'starter_bundle') S.iap.starter = true;
}

/* ---------- catch streak (comets and supply ships caught in a row) ---------- */
/** Records the current run of catches without a miss; the best run is kept. Mutates S. */
export function noteCatchRun(S, run) {
  S.stats.bestRun = Math.max(S.stats.bestRun, run);
}

/* ---------- the Captain's journal ---------- */
export const journalUnlocked = (S) => JOURNAL.filter((c) => statValue(S, c.stat) >= c.t);
export const journalCount = (S) => journalUnlocked(S).length;
