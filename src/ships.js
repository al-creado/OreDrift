/*
 * Ship silhouettes, one per vessel type, drawn with canvas paths. Local coordinates: the ship faces +x and is
 * roughly 12 units long; the caller has already translated, rotated and scaled the context.
 */
const TAU = Math.PI * 2;
const HULL = '#e4e8f4', MID = '#a3adc9', DARK = '#5b6483';

/** Relative size of each type, so a Stellar Collector looks bigger than a Mining Drone. */
export const SHIP_SCALE = { drone: 0.85, laser: 1, tug: 1.05, barge: 1.2, refinery: 1.25, foundry: 1.35, collector: 1.5 };

function poly(ctx, pts, fill) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function dot(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}

/**
 * opts: { glow: colour of lights and engines, t: seconds (for spinning parts), reduced: bool }
 */
export function drawShip(ctx, id, opts) {
  const glow = opts.glow, spin = opts.reduced ? 0 : opts.t;
  switch (id) {
    case 'drone': // small diamond with two rotors
      poly(ctx, [[4, 0], [0, 2.8], [-4, 0], [0, -2.8]], MID);
      dot(ctx, 0, 0, 1.4, HULL);
      ctx.globalAlpha = 0.7; dot(ctx, -1, -4, 1.5, HULL); dot(ctx, -1, 4, 1.5, HULL); ctx.globalAlpha = 1;
      dot(ctx, 3.2, 0, 0.8, glow);
      break;
    case 'laser': // long hull, pointed nose with a glowing emitter, tail fins
      poly(ctx, [[-5, -1.8], [3, -1.8], [6.5, 0], [3, 1.8], [-5, 1.8]], HULL);
      poly(ctx, [[-5, -1.8], [-8, -3.6], [-3, -1.8]], MID);
      poly(ctx, [[-5, 1.8], [-8, 3.6], [-3, 1.8]], MID);
      dot(ctx, 6.4, 0, 1.2, glow);
      break;
    case 'tug': // stubby hull with two grabbing claws
      poly(ctx, [[-5, -2.8], [3, -2.8], [4, -1.4], [4, 1.4], [3, 2.8], [-5, 2.8]], MID);
      poly(ctx, [[3, -4.2], [8, -4.2], [8, -2.8], [3, -2.8]], DARK);
      poly(ctx, [[3, 2.8], [8, 2.8], [8, 4.2], [3, 4.2]], DARK);
      dot(ctx, -1.5, 0, 1.5, HULL);
      dot(ctx, -5, 0, 1, glow);
      break;
    case 'barge': // a string of cargo containers with a cab at the front
      poly(ctx, [[-9, -2.4], [-4, -2.4], [-4, 2.4], [-9, 2.4]], DARK);
      poly(ctx, [[-4, -2.4], [1, -2.4], [1, 2.4], [-4, 2.4]], MID);
      poly(ctx, [[1, -2.4], [5, -2.4], [5, 2.4], [1, 2.4]], DARK);
      poly(ctx, [[5, -1.9], [8.5, -1.2], [8.5, 1.2], [5, 1.9]], HULL);
      dot(ctx, -9.2, 0, 1, glow);
      break;
    case 'refinery': // trapezoid hull with two glowing smokestacks
      poly(ctx, [[-6, -3.2], [5, -2.2], [6.5, 0], [5, 2.2], [-6, 3.2]], MID);
      poly(ctx, [[-3.5, -5.6], [-1.5, -5.6], [-1.5, -2.8], [-3.5, -2.8]], DARK);
      poly(ctx, [[0, -5.2], [2, -5.2], [2, -2.5], [0, -2.5]], DARK);
      dot(ctx, -2.5, -5.9, 1, glow); dot(ctx, 1, -5.5, 1, glow);
      dot(ctx, 2.5, 0, 1.1, HULL); dot(ctx, -1, 0.4, 1.1, HULL);
      break;
    case 'foundry': // round furnace with a glowing core and two side pods
      ctx.strokeStyle = DARK; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0, -3.6); ctx.lineTo(0, -5.6); ctx.moveTo(0, 3.6); ctx.lineTo(0, 5.6); ctx.stroke();
      dot(ctx, 0, -5.8, 1.7, HULL); dot(ctx, 0, 5.8, 1.7, HULL);
      dot(ctx, 0, 0, 4.2, DARK);
      ctx.strokeStyle = MID; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, TAU); ctx.stroke();
      dot(ctx, 0.4, 0, 2.1, glow); dot(ctx, 0.4, 0, 0.9, HULL);
      break;
    case 'collector': { // a large slowly turning ring with spokes and a glowing hub
      ctx.strokeStyle = MID; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.stroke();
      ctx.strokeStyle = HULL; ctx.lineWidth = 0.9;
      for (let i = 0; i < 4; i++) {
        const a = spin * 0.8 + i * (TAU / 4);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.stroke();
      }
      dot(ctx, 0, 0, 2.4, DARK); dot(ctx, 0, 0, 1.5, glow);
      ctx.strokeStyle = MID; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(9, 0); ctx.stroke();
      dot(ctx, 9, 0, 0.9, glow);
      break;
    }
    case 'supply': { // the passing supply ship: long cargo hull, a glowing crate, engine flames and a blinking beacon
      const blink = opts.reduced ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(opts.t * 4));
      ctx.globalAlpha = 0.55; poly(ctx, [[-9, -1.4], [-15, 0], [-9, 1.4]], glow); ctx.globalAlpha = 1; // engine flame
      poly(ctx, [[-9, -3], [6, -3], [10, 0], [6, 3], [-9, 3]], MID);
      poly(ctx, [[-8, -2.2], [-3.5, -2.2], [-3.5, 2.2], [-8, 2.2]], DARK);
      ctx.globalAlpha = 0.9; poly(ctx, [[-3, -2.2], [1.5, -2.2], [1.5, 2.2], [-3, 2.2]], glow); ctx.globalAlpha = 1; // the supply crate
      poly(ctx, [[2.5, -2], [6, -2], [8, 0], [6, 2], [2.5, 2]], HULL);
      dot(ctx, -9.4, -1.6, 1, glow); dot(ctx, -9.4, 1.6, 1, glow);
      ctx.globalAlpha = blink; dot(ctx, 0, -3.8, 1.2, '#ffffff'); ctx.globalAlpha = 1; // beacon
      break;
    }
    default: // unknown type: the old triangle
      poly(ctx, [[5, 0], [-4, 3.2], [-4, -3.2]], HULL);
  }
}
