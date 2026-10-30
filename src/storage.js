/*
 * Save data: validation (pure) plus load/save through Capacitor Preferences on device
 * and localStorage in a browser. A corrupt save must never crash the game.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { GENS, UPS, ACHS, MISSION_TYPES, GRANTED_KEEP, JOURNAL } from './data.js';
import { fresh, WEEKLY_TYPES } from './logic.js';

export const SAVE_KEY = 'oredrift.v1';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, def) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : def);
const int = (v, def) => Math.floor(num(v, def));

/**
 * Turns raw save text into a valid state. Returns null only when the text is not
 * a JSON object at all; bad individual fields fall back to their defaults.
 */
export function parseSave(raw, now = Date.now()) {
  let d;
  try { d = JSON.parse(raw); } catch (e) { return null; }
  if (!isObj(d)) return null;

  const S = fresh(now);
  S.ore = num(d.ore, 0);
  S.total = num(d.total, 0);
  S.allTime = Math.max(num(d.allTime, 0), S.total);
  S.taps = int(d.taps, 0);
  S.points = int(d.points, 0);
  S.runs = int(d.runs, 0);
  // A save from the future (clock changed) must not produce negative time away.
  S.last = Math.min(num(d.last, now), now);
  S.sound = d.sound !== false;
  S.music = d.music !== false;
  S.haptics = d.haptics !== false;
  S.notify = d.notify === true;
  S.journalSeen = Math.min(int(d.journalSeen, 0), JOURNAL.length);
  S.podReadyAt = Math.min(num(d.podReadyAt, 0), now + 10 * 60 * 1000); // never more than one cooldown ahead

  const iap = isObj(d.iap) ? d.iap : {};
  S.iap = { removeAds: iap.removeAds === true, starter: iap.starter === true, boost: iap.boost === true };
  S.granted = Array.isArray(d.granted)
    ? d.granted.filter((x) => typeof x === 'string' && x.length > 0 && x.length < 200).slice(0, GRANTED_KEEP)
    : [];

  const owned = isObj(d.owned) ? d.owned : {};
  for (const g of GENS) { const n = int(owned[g.id], 0); if (n > 0) S.owned[g.id] = n; }
  const ups = isObj(d.ups) ? d.ups : {};
  for (const u of UPS) if (ups[u.id] === true) S.ups[u.id] = true;
  const ach = isObj(d.ach) ? d.ach : {};
  for (const a of ACHS) if (ach[a.id] === true) S.ach[a.id] = true;
  const gifts = isObj(d.gifts) ? d.gifts : {};
  for (const a of ACHS) {
    const g = num(gifts[a.id], -1);
    if (S.ach[a.id] && g >= 0) S.gifts[a.id] = g; // only earned commendations can owe a gift
  }

  const st = isObj(d.stats) ? d.stats : {};
  S.stats = {
    comets: int(st.comets, 0), missions: int(st.missions, 0), best: int(st.best, 0),
    ships: int(st.ships, 0), drops: int(st.drops, 0), chests: int(st.chests, 0), capped: int(st.capped, 0),
    night: int(st.night, 0), bare: int(st.bare, 0), bestRun: int(st.bestRun, 0), overdrive: int(st.overdrive, 0),
    played: Math.max(0, num(st.played, 0)), peak: Math.max(0, num(st.peak, 0)),
  };
  S.stats.ships = Math.min(S.stats.ships, S.stats.comets); // supply ships are a subset of all flyers caught
  S.streak = int(d.streak, 0);
  S.lastSupply = typeof d.lastSupply === 'string' && DAY_RE.test(d.lastSupply) ? d.lastSupply : '';
  S.frenzyUntil = num(d.frenzyUntil, 0);

  const D = d.daily;
  if (isObj(D) && typeof D.day === 'string' && DAY_RE.test(D.day) && Array.isArray(D.missions) && D.missions.length === 3 &&
      D.missions.every((m) => isObj(m) && MISSION_TYPES.includes(m.type) && Number.isFinite(m.target) && m.target > 0)) {
    S.daily = {
      day: D.day,
      chest: D.chest === true,
      swaps: int(D.swaps, 0),
      missions: D.missions.map((m) => ({
        type: m.type, target: m.target, progress: Math.min(m.target, num(m.progress, 0)), claimed: m.claimed === true,
      })),
    };
  }
  const W = d.weekly;
  if (isObj(W) && typeof W.week === 'string' && DAY_RE.test(W.week) && Array.isArray(W.missions) && W.missions.length === 3 &&
      W.missions.every((m) => isObj(m) && WEEKLY_TYPES.includes(m.type) && Number.isFinite(m.target) && m.target > 0)) {
    S.weekly = {
      week: W.week,
      swaps: int(W.swaps, 0),
      missions: W.missions.map((m) => ({
        type: m.type, target: m.target, progress: Math.min(m.target, num(m.progress, 0)), claimed: m.claimed === true,
      })),
    };
  }
  return S;
}

export function serializeState(S, now = Date.now()) {
  return JSON.stringify({ ...S, last: now });
}

const native = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };

/** Resolves to a valid state, or null when nothing usable is stored. */
export async function loadState(now = Date.now()) {
  let raw = null;
  try {
    if (native()) raw = (await Preferences.get({ key: SAVE_KEY })).value;
    else raw = localStorage.getItem(SAVE_KEY);
  } catch (e) { raw = null; }
  return raw ? parseSave(raw, now) : null;
}

/** Fire and forget; failures are swallowed so play never stops. */
export async function saveState(S, now = Date.now()) {
  const value = serializeState(S, now);
  try {
    if (native()) await Preferences.set({ key: SAVE_KEY, value });
    else localStorage.setItem(SAVE_KEY, value);
  } catch (e) { /* storage full or blocked */ }
}
