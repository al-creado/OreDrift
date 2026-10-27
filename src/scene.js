/* Canvas scene: asteroid, stars, orbiting ships, comet, particles, floating text. */
import { rng, fmt, FIRST_COMET_MS, cometDelayMs } from './logic.js';

const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const TAU = Math.PI * 2;
const COMET_LIFE = 8;
const COMET_HIT_PX = 44;

/**
 * hooks: { reduced: bool, frenzyOn(): bool, shipCount(): number }
 * Returns the scene controller.
 */
export function createScene(cv, hooks) {
  const ctx = cv.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const css = (n, f) => cs.getPropertyValue(n).trim() || f;
  const ORE = css('--ore', '#f2a24e'), ORE_HI = '#ffd9a8', ROCK = css('--rock', '#464c68');
  const ROCK_HI = css('--rock-hi', '#727a9b'), STAR = css('--text', '#e8ebf5');
  const REDUCED = hooks.reduced;

  let W = 0, H = 0, DPR = 1;
  let rot = 0, pulse = 0, glow = 0.12, tClock = 0;
  let comet = null, nextComet = 0;
  const fx = { chips: [], texts: [] };

  /* ---- fixed shapes (seeded, so the asteroid looks the same every launch) ---- */
  const N = 16, R1 = rng(11), R2 = rng(23), R3 = rng(5);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const r = 0.8 + 0.2 * R1() - (i % 5 === 0 ? 0.05 : 0), a = i / N * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function rockPath(c) {
    c.beginPath();
    const s = mid(pts[N - 1], pts[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < N; i++) {
      const p = pts[i], e = mid(p, pts[(i + 1) % N]);
      c.quadraticCurveTo(p[0], p[1], e[0], e[1]);
    }
    c.closePath();
  }
  const craters = [];
  for (let i = 0; i < 5; i++) {
    const a = R2() * TAU, d = 0.12 + 0.5 * R2();
    craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.08 + 0.1 * R2() });
  }
  const veins = [];
  for (let v = 0; v < 6; v++) {
    const a = R3() * TAU, d = 0.15 + 0.5 * R3();
    let x = Math.cos(a) * d, y = Math.sin(a) * d, dir = R3() * TAU;
    const line = [[x, y]];
    for (let k = 0; k < 4; k++) {
      dir += (R3() - 0.5) * 1.4; x += Math.cos(dir) * 0.13; y += Math.sin(dir) * 0.13;
      const l = Math.hypot(x, y);
      if (l > 0.7) { x *= 0.7 / l; y *= 0.7 / l; }
      line.push([x, y]);
    }
    veins.push(line);
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
      if (W && now >= nextComet) comet = { t: 0, life: COMET_LIFE, dir: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * TAU };
      return;
    }
    comet.t += dt;
    if (comet.t >= comet.life) { comet = null; nextComet = now + cometDelayMs(false, Math.random()); }
  }
  const hitComet = (x, y) => {
    if (!comet) return false;
    const q = cometPos(comet);
    return Math.hypot(x - q[0], y - q[1]) <= COMET_HIT_PX;
  };
  /** Removes the comet, bursts particles and schedules the next one. Returns false if none was on screen. */
  function catchComet(now) {
    if (!comet) return false;
    const q = cometPos(comet);
    comet = null;
    nextComet = now + cometDelayMs(true, Math.random());
    for (let i = 0; i < (REDUCED ? 4 : 14); i++) {
      const a = Math.random() * TAU, sp = 60 + Math.random() * 140;
      fx.chips.push({ x: q[0], y: q[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.6 + Math.random() * 0.5, s: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: Math.random() < 0.7 ? ORE : ORE_HI });
    }
    return true;
  }
  function resetComet(now) { comet = null; nextComet = now + FIRST_COMET_MS; }
  resetComet(Date.now());

  /* ---- taps ---- */
  function spawnTap(x, y, v) {
    pulse = 1; glow = 1;
    const n = REDUCED ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * 90;
      fx.chips.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, max: 0.5 + Math.random() * 0.4, s: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: Math.random() < 0.6 ? ORE : ROCK_HI });
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

  function draw(dt) {
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

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(base * (1 + pulse * 0.07), base * (1 + pulse * 0.07));
    rockPath(ctx); ctx.fillStyle = ROCK; ctx.fill();
    for (const c of craters) {
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.85, 0, 0, TAU); ctx.fillStyle = 'rgba(6,9,22,.32)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.85, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 0.014; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
    }
    ctx.save(); rockPath(ctx); ctx.clip(); ctx.rotate(-rot);
    const lg = ctx.createRadialGradient(-0.38, -0.42, 0.05, 0, 0, 1.15);
    lg.addColorStop(0, 'rgba(255,255,255,.22)'); lg.addColorStop(0.55, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(4,6,16,.55)');
    ctx.fillStyle = lg; ctx.fillRect(-1.3, -1.3, 2.6, 2.6); ctx.restore();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = ORE; ctx.shadowBlur = (4 + 16 * glow) * DPR; ctx.strokeStyle = ORE; ctx.lineWidth = 0.04; ctx.globalAlpha = 0.5 + 0.5 * glow;
    for (const v of veins) veinPath(v);
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.strokeStyle = ORE_HI; ctx.lineWidth = 0.014; ctx.globalAlpha = 0.35 + 0.6 * glow;
    for (const v of veins) veinPath(v);
    ctx.globalAlpha = 1;
    rockPath(ctx); ctx.lineWidth = 0.012; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();
    ctx.restore();

    const nShips = Math.min(14, hooks.shipCount()), k0 = Math.max(0.8, Math.min(1.4, base / 110));
    for (let i = 0; i < nShips; i++) {
      const dir = i % 2 ? 1 : -1, sp = (0.22 + 0.04 * (i % 5)) * dir, ang = tClock * sp + i * 2.399;
      const rx = base * (1.28 + (i % 4) * 0.13), ry = rx * 0.5;
      const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
      const h = Math.atan2(Math.cos(ang) * ry * sp, -Math.sin(ang) * rx * sp), bp = (tClock * 0.45 + i * 0.37) % 1;
      if (bp < 0.14) {
        const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
        ctx.globalAlpha = 1 - bp / 0.14; ctx.strokeStyle = ORE; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + dx / l * base * 0.9, cy + dy / l * base * 0.9); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(k0, k0); ctx.fillStyle = STAR;
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, 3.2); ctx.lineTo(-4, -3.2); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    if (comet) {
      for (let k = 14; k >= 1; k--) {
        const tt = comet.t - k * 0.1; if (tt < 0) continue;
        const q = cometPos({ t: tt, life: comet.life, dir: comet.dir, ph: comet.ph });
        ctx.globalAlpha = (1 - k / 15) * 0.5; ctx.fillStyle = ORE; ctx.beginPath(); ctx.arc(q[0], q[1], 7 * (1 - k / 16), 0, TAU); ctx.fill();
      }
      const q = cometPos(comet), ringR = 24 + (REDUCED ? 0 : 4 * Math.sin(tClock * 6));
      const cg = ctx.createRadialGradient(q[0], q[1], 1, q[0], q[1], 20);
      cg.addColorStop(0, '#fff6e6'); cg.addColorStop(0.35, ORE_HI); cg.addColorStop(1, 'rgba(242,162,78,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(q[0], q[1], 20, 0, TAU); ctx.fill();
      ctx.strokeStyle = ORE; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(q[0], q[1], ringR, 0, TAU); ctx.stroke();
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
      ctx.globalAlpha = 1 - q * q; ctx.strokeStyle = 'rgba(8,12,26,.85)'; ctx.strokeText(p.t, p.x, y); ctx.fillStyle = ORE_HI; ctx.fillText(p.t, p.x, y);
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
