/* Canvas scene: the belt's asteroid, stars, orbiting ships, comet, particles, floating text. */
import { fmt, FIRST_COMET_MS, cometDelayMs, pickFlyer } from './logic.js';
import { GENS } from './data.js';
import { beltFor, allocateShips } from './belts.js';
import { drawShip, SHIP_SCALE } from './ships.js';

const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const TAU = Math.PI * 2;
const COMET_LIFE = 8;
const COMET_HIT_PX = 44;
const COMET_PING_S = 1.6;
const SHIP_COLOR = '#7fe3ff'; // supply ships glow cyan, comets glow orange, so they can be told apart at a glance
const VESSEL_IDS = GENS.map((g) => g.id);

/**
 * hooks: { reduced: bool, frenzyOn(): bool, fleet(): { vesselId: count }, belt(): relocation count,
 *          onCometSpawn?(kind), onCometPing?(kind), onCometMissed?() }  kind is 'ship' (supply ship) or 'comet'
 * Returns the scene controller.
 */
export function createScene(cv, hooks) {
  const ctx = cv.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const css = (n, f) => cs.getPropertyValue(n).trim() || f;
  const ORE = css('--ore', '#f2a24e'), ORE_HI = '#ffd9a8', STAR = css('--text', '#e8ebf5');
  const REDUCED = hooks.reduced;

  let W = 0, H = 0, DPR = 1;
  let rot = 0, pulse = 0, glow = 0.12, tClock = 0;
  let comet = null, nextComet = 0, pingT = 0;
  const flyerHistory = []; // kinds that appeared recently, so two comets in a row are followed by a supply ship
  const fx = { chips: [], texts: [] };

  /* ---- the current belt: shape, colours and ring change with every relocation ---- */
  let curRuns = -1, B = beltFor(0);
  function syncBelt() {
    const runs = hooks.belt();
    if (runs !== curRuns) { curRuns = runs; B = beltFor(runs); }
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function rockPath(c) {
    const pts = B.pts, N = pts.length;
    c.beginPath();
    const s = mid(pts[N - 1], pts[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < N; i++) {
      const p = pts[i], e = mid(p, pts[(i + 1) % N]);
      c.quadraticCurveTo(p[0], p[1], e[0], e[1]);
    }
    c.closePath();
  }
  const stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.1, sp: 0.002 + Math.random() * 0.012, tw: 1 + Math.random() * 3, ph: Math.random() * TAU });
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ---- comet ---- */
  function cometPos(c) {
    const p = c.t / c.life, x = c.dir > 0 ? -30 + (W + 60) * p : W + 30 - (W + 60) * p;
    return [x, H * (0.3 + 0.08 * Math.sin(c.t * 1.4 + c.ph))];
  }
  function updateComet(dt, now) {
    if (!comet) {
      if (W && now >= nextComet) {
        comet = { kind: pickFlyer(Math.random(), flyerHistory), t: 0, life: COMET_LIFE, dir: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * TAU };
        flyerHistory.push(comet.kind);
        if (flyerHistory.length > 4) flyerHistory.shift();
        pingT = 0;
        if (hooks.onCometSpawn) hooks.onCometSpawn(comet.kind);
      }
      return;
    }
    comet.t += dt;
    pingT += dt;
    if (pingT >= COMET_PING_S) { pingT = 0; if (hooks.onCometPing) hooks.onCometPing(comet.kind); } // audio clue while it is on screen
    if (comet.t >= comet.life) {
      comet = null; nextComet = now + cometDelayMs(false, Math.random());
      if (hooks.onCometMissed) hooks.onCometMissed(); // it left uncaught
    }
  }
  const hitComet = (x, y) => {
    if (!comet) return false;
    const q = cometPos(comet);
    return Math.hypot(x - q[0], y - q[1]) <= COMET_HIT_PX;
  };
  /** Removes the flyer, bursts particles and schedules the next one. Returns its kind ('ship' or 'comet'), or null if none was on screen. */
  function catchComet(now) {
    if (!comet) return null;
    const q = cometPos(comet), kind = comet.kind;
    comet = null;
    nextComet = now + cometDelayMs(true, Math.random());
    const colors = kind === 'ship' ? [SHIP_COLOR, '#e0f8ff'] : [ORE, ORE_HI];
    for (let i = 0; i < (REDUCED ? 4 : 14); i++) {
      const a = Math.random() * TAU, sp = 60 + Math.random() * 140;
      fx.chips.push({ x: q[0], y: q[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.6 + Math.random() * 0.5, s: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: Math.random() < 0.7 ? colors[0] : colors[1] });
    }
    return kind;
  }
  function resetComet(now) { comet = null; flyerHistory.length = 0; nextComet = now + FIRST_COMET_MS; }
  resetComet(Date.now());

  /* ---- taps ---- */
  function spawnTap(x, y, v) {
    syncBelt();
    pulse = 1; glow = 1;
    const n = REDUCED ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * 90;
      fx.chips.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, max: 0.5 + Math.random() * 0.4, s: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: Math.random() < 0.6 ? B.vein : B.light });
    }
    if (fx.chips.length > 80) fx.chips.splice(0, fx.chips.length - 80);
    fx.texts.push({ x: x + (Math.random() - 0.5) * 24, y: y - 8, t: '+' + fmt(v), life: 0, max: 0.9 });
    if (fx.texts.length > 24) fx.texts.shift();
  }

  /* ---- drawing ---- */
  function veinPath(v) {
    ctx.beginPath();
    v.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  /** Some belts have a ring. The far half is drawn behind the rock and the near half in front of it. */
  function drawRing(front, cx, cy, base) {
    if (!B.ring) return;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(B.ring.tilt);
    ctx.strokeStyle = B.light;
    for (const [k, w, a] of [[1, 2.4, 0.55], [0.93, 1.3, 0.3], [1.07, 1.3, 0.3]]) {
      ctx.globalAlpha = a; ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(0, 0, base * B.ring.w * k, base * B.ring.h * k, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function draw(dt) {
    syncBelt();
    tClock += dt;
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      s.x -= s.sp * dt; if (s.x < 0) s.x += 1;
      ctx.globalAlpha = Math.max(0.1, 0.35 + 0.45 * Math.sin(tClock * s.tw + s.ph));
      ctx.fillStyle = STAR; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const cx = W / 2, cy = H / 2 + 2, base = Math.min(W * 0.42, H * 0.36);
    const gb = hooks.frenzyOn() ? 0.65 : 0.12;
    pulse *= Math.exp(-dt * 9); glow = gb + (glow - gb) * Math.exp(-dt * 3.2);
    if (!REDUCED) rot += dt * 0.12;

    drawRing(false, cx, cy, base);
    const z = 1 + pulse * 0.07;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(base * z * B.squash[0], base * z * B.squash[1]);
    rockPath(ctx); ctx.fillStyle = B.rock; ctx.fill();
    for (const c of B.craters) {
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.85, 0, 0, TAU); ctx.fillStyle = 'rgba(6,9,22,.32)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.85, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 0.014; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
    }
    ctx.save(); rockPath(ctx); ctx.clip(); ctx.rotate(-rot);
    const lg = ctx.createRadialGradient(-0.38, -0.42, 0.05, 0, 0, 1.15);
    lg.addColorStop(0, B.light + '38'); lg.addColorStop(0.55, B.light + '00'); lg.addColorStop(1, 'rgba(4,6,16,.55)');
    ctx.fillStyle = lg; ctx.fillRect(-1.3, -1.3, 2.6, 2.6); ctx.restore();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = B.vein; ctx.shadowBlur = (4 + 16 * glow) * DPR; ctx.strokeStyle = B.vein; ctx.lineWidth = 0.04; ctx.globalAlpha = 0.5 + 0.5 * glow;
    for (const v of B.veins) veinPath(v);
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.strokeStyle = B.veinHi; ctx.lineWidth = 0.014; ctx.globalAlpha = 0.35 + 0.6 * glow;
    for (const v of B.veins) veinPath(v);
    ctx.globalAlpha = 1;
    rockPath(ctx); ctx.lineWidth = 0.012; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();
    ctx.restore();
    drawRing(true, cx, cy, base);

    // One ship per owned vessel (at most 14), each vessel type with its own silhouette.
    const ships = allocateShips(hooks.fleet(), VESSEL_IDS), k0 = Math.max(0.8, Math.min(1.4, base / 110));
    for (let i = 0; i < ships.length; i++) {
      const dir = i % 2 ? 1 : -1, sp = (0.22 + 0.04 * (i % 5)) * dir, ang = tClock * sp + i * 2.399;
      const rx = base * (1.28 + (i % 4) * 0.13), ry = rx * 0.5;
      const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
      const h = Math.atan2(Math.cos(ang) * ry * sp, -Math.sin(ang) * rx * sp), bp = (tClock * 0.45 + i * 0.37) % 1;
      if (bp < 0.14) {
        const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
        ctx.globalAlpha = 1 - bp / 0.14; ctx.strokeStyle = B.vein; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + dx / l * base * 0.9, cy + dy / l * base * 0.9); ctx.stroke(); ctx.globalAlpha = 1;
      }
      const k = k0 * (SHIP_SCALE[ships[i]] || 1);
      ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(k, k);
      drawShip(ctx, ships[i], { glow: B.vein, t: tClock + i, reduced: REDUCED });
      ctx.restore();
    }

    if (comet) {
      const isShip = comet.kind === 'ship', trailColor = isShip ? SHIP_COLOR : ORE;
      for (let k = 14; k >= 1; k--) {
        const tt = comet.t - k * 0.1; if (tt < 0) continue;
        const q = cometPos({ t: tt, life: comet.life, dir: comet.dir, ph: comet.ph });
        ctx.globalAlpha = (1 - k / 15) * (isShip ? 0.35 : 0.5); ctx.fillStyle = trailColor; ctx.beginPath(); ctx.arc(q[0], q[1], (isShip ? 5 : 7) * (1 - k / 16), 0, TAU); ctx.fill();
      }
      const q = cometPos(comet), ringR = 24 + (REDUCED ? 0 : 4 * Math.sin(tClock * 6));
      if (isShip) {
        // A cargo ship heading along its path, with a pulsing cyan ring so it reads as something to tap.
        const ahead = cometPos({ t: comet.t + 0.1, life: comet.life, dir: comet.dir, ph: comet.ph });
        ctx.globalAlpha = 1; ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(Math.atan2(ahead[1] - q[1], ahead[0] - q[0])); ctx.scale(2.6, 2.6);
        drawShip(ctx, 'supply', { glow: SHIP_COLOR, t: tClock, reduced: REDUCED });
        ctx.restore();
      } else {
        const cg = ctx.createRadialGradient(q[0], q[1], 1, q[0], q[1], 20);
        cg.addColorStop(0, '#fff6e6'); cg.addColorStop(0.35, ORE_HI); cg.addColorStop(1, 'rgba(242,162,78,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(q[0], q[1], 20, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = trailColor; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(q[0], q[1], ringR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = fx.chips.length - 1; i >= 0; i--) {
      const p = fx.chips[i]; p.life += dt;
      if (p.life >= p.max) { fx.chips.splice(i, 1); continue; }
      const drag = Math.pow(0.04, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; p.vy *= drag; p.r += p.vr * dt;
      ctx.save(); ctx.globalAlpha = 1 - p.life / p.max; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
    }
    ctx.font = '600 16px ' + MONO; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (let i = fx.texts.length - 1; i >= 0; i--) {
      const p = fx.texts[i]; p.life += dt;
      if (p.life >= p.max) { fx.texts.splice(i, 1); continue; }
      const q = p.life / p.max, y = p.y - p.life * 46;
      ctx.globalAlpha = 1 - q * q; ctx.strokeStyle = 'rgba(8,12,26,.85)'; ctx.strokeText(p.t, p.x, y); ctx.fillStyle = B.veinHi; ctx.fillText(p.t, p.x, y);
    }
    ctx.globalAlpha = 1;
  }

  return {
    resize, draw, spawnTap, hitComet, catchComet, resetComet,
    updateComet,
    ready: () => W > 0,
    size: () => [W, H],
  };
}
