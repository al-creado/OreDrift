import { GENS, UPS } from '../src/data.js';
import { fresh, ops, own, unitCost, bulkCost, tap, gain, checkAch, ensureDaily } from '../src/logic.js';

/**
 * Greedy player: once per simulated second it earns, then buys the item with the best
 * payback (cost / added ore per second). With `waitForBest` it saves up for that item
 * instead of buying a cheaper one. `tapsPerSec` models active tapping.
 * Returns the minute at which total ore first reached each milestone.
 */
export function simulate({ milestones, tapsPerSec = 0, waitForBest = true, maxMinutes = 400 }) {
  const S = fresh(0);
  const date = new Date(2026, 0, 1);
  ensureDaily(S, date);
  const hit = {};
  const gainOf = (item) => {
    const before = ops(S);
    if (item.g) { S.owned[item.g.id] = own(S, item.g.id) + 1; } else { S.ups[item.u.id] = true; }
    const after = ops(S);
    if (item.g) { S.owned[item.g.id]--; if (!S.owned[item.g.id]) delete S.owned[item.g.id]; } else { delete S.ups[item.u.id]; }
    return after - before;
  };
  for (let sec = 1; sec <= maxMinutes * 60; sec++) {
    const now = sec * 1000;
    gain(S, ops(S, now));
    for (let i = 0; i < tapsPerSec; i++) tap(S, now);
    checkAch(S);
    for (;;) {
      const items = [];
      for (const g of GENS) items.push({ g, cost: unitCost(S, g) });
      for (const u of UPS) if (!S.ups[u.id]) items.push({ u, cost: u.cost });
      let best = null, bestPay = Infinity;
      for (const it of items) {
        const d = gainOf(it);
        // tap-only upgrades add no ore/s; treat them as worthless to this player
        const pay = d > 0 ? it.cost / d : Infinity;
        it.pay = pay;
        if (pay < bestPay) { bestPay = pay; best = it; }
      }
      if (!best) break;
      let pick = best;
      if (!waitForBest && S.ore < best.cost) {
        pick = items.filter((it) => it.cost <= S.ore && isFinite(it.pay)).sort((a, b) => a.pay - b.pay)[0];
      }
      if (!pick || S.ore < pick.cost) break;
      S.ore -= pick.cost;
      if (pick.g) S.owned[pick.g.id] = own(S, pick.g.id) + 1; else S.ups[pick.u.id] = true;
    }
    for (const m of milestones) if (hit[m] === undefined && S.allTime >= m) hit[m] = sec / 60;
    if (milestones.every((m) => hit[m] !== undefined)) break;
  }
  return hit;
}
