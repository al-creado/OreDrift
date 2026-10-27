import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/800';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './style.css';

import { FRENZY_MULT, ACH_BONUS } from './data.js';
import * as L from './logic.js';
import { createScene } from './scene.js';
import { createUI } from './ui.js';
import { sounds, setSoundEnabled } from './audio.js';
import { loadState, saveState } from './storage.js';
import * as native from './native.js';

/* Set to the hosted policy page before publishing; the link only shows when this is non-empty. */
const PRIVACY_URL = '';
const SAVE_EVERY_MS = 5000;

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

let S = L.fresh(Date.now());
let lastT = Date.now();
let paused = false;
let ui, scene;

const save = () => saveState(S, Date.now());

/* ---------- earning ---------- */
function offline(sec) {
  const r = L.applyOffline(S, sec);
  if (!r) return;
  ui.toast('Away ' + L.fmtDur(sec) + '. Your fleet mined +' + L.fmt(r.gain) + ' t at half rate' + (r.capped ? ' (capped at 8 h).' : '.'), 9000);
}

function tick(now) {
  const dt = (now - lastT) / 1000;
  lastT = now;
  if (dt <= 0) return;
  if (dt > 60) offline(dt); else L.gain(S, L.ops(S, now) * dt);
}

/* ---------- housekeeping: new day, new commendations ---------- */
function housekeeping(now) {
  const had = !!S.daily;
  if (L.ensureDaily(S, new Date(now)) && had) ui.toast('New daily missions are ready.');
  for (const a of L.checkAch(S)) {
    ui.toast('Commendation earned: ' + a.name + '. All output +' + Math.round(ACH_BONUS * 100) + '%.', 4200);
    sounds.achievement();
  }
}

function refresh() {
  const now = Date.now();
  housekeeping(now);
  setSoundEnabled(S.sound);
  ui.update(now, new Date(now));
}

/* ---------- actions ---------- */
function doTap(x, y) {
  const v = L.tap(S, Date.now());
  scene.spawnTap(x, y, v);
  sounds.tap(); native.impact(false);
}

function catchComet() {
  const now = Date.now();
  if (!scene.catchComet(now)) return;
  const r = L.catchCometReward(S, now, Math.random());
  if (r.kind === 'frenzy') ui.toast('Rich vein! Output ×' + FRENZY_MULT + ' for ' + r.sec + ' s.', 3500);
  else ui.toast('Cargo pod! +' + L.fmt(r.gain) + ' t.', 3500);
  sounds.comet(); native.impact(true);
  refresh();
}

function onBuy(g, mode) {
  const r = L.buyVessel(S, g, mode);
  if (!r.ok) return;
  for (const k of r.milestones) ui.toast(g.name + ' output doubled at ' + k + ' owned.');
  sounds.buy();
  refresh(); save();
}

function onBuyUp(u) {
  if (!L.buyUpgrade(S, u)) return;
  ui.toast('Installed ' + u.name + '.');
  sounds.install();
  refresh(); save();
}

function onRelocate() {
  const g = L.relocate(S);
  if (!g) return;
  ui.toast('New belt surveyed. +' + g + ' survey point' + (g > 1 ? 's' : '') + '.', 4500);
  sounds.relocate();
  refresh(); save();
}

function onWipe() {
  S = L.fresh(Date.now());
  lastT = Date.now();
  ui.resetUpgradeList(); ui.resetAchList();
  scene.resetComet(Date.now());
  native.cancelReminders();
  L.ensureDaily(S, new Date());
  refresh(); save();
  ui.toast('Save wiped. Fresh belt.');
}

function onClaimMission(i) {
  const g = L.claimMission(S, i);
  if (!g) return;
  ui.toast('Mission complete. +' + L.fmt(g) + ' t.');
  sounds.claim();
  refresh(); save();
}

function onClaimChest() {
  const g = L.claimChest(S, Date.now());
  if (!g) return;
  ui.toast('Daily cache opened. +' + L.fmt(g) + ' t and output ×' + FRENZY_MULT + ' for 60 s.', 4500);
  sounds.chest();
  refresh(); save();
}

function onClaimSupply() {
  const r = L.claimSupply(S, new Date());
  if (!r) return;
  ui.toast('Supply drop collected. +' + L.fmt(r.reward) + ' t. Streak: ' + r.streak + (r.streak === 1 ? ' day.' : ' days.'), 4000);
  sounds.supply();
  refresh(); save();
}

function onToggleSound() { S.sound = !S.sound; refresh(); save(); }

async function onToggleNotify() {
  if (S.notify) {
    S.notify = false;
    native.cancelReminders();
  } else if (await native.requestNotifyPermission()) {
    S.notify = true;
    ui.toast('Reminders on. You will hear about supply drops and a full hold.');
  } else {
    ui.toast('Notifications are not allowed. Turn them on in system settings first.', 4500);
  }
  refresh(); save();
}

/* ---------- lifecycle ---------- */
function onHide() {
  paused = true;
  const now = Date.now();
  S.last = now;
  save();
  if (S.notify) native.scheduleReminders(now, L.fleetCount(S) > 0);
}

function onShow() {
  const now = Date.now();
  const away = (now - S.last) / 1000;
  paused = false;
  lastT = now;
  native.cancelReminders();
  if (away > 60) offline(away);
  refresh();
  requestAnimationFrame(frame);
}

/* ---------- loop ---------- */
let prevDraw = Date.now();
function frame() {
  if (paused) return;
  const now = Date.now();
  tick(now);
  const dt = Math.min(0.05, (now - prevDraw) / 1000);
  prevDraw = now;
  ui.updateOre(S);
  scene.updateComet(dt, now);
  if (scene.ready()) scene.draw(dt);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
async function boot() {
  const loaded = await loadState(Date.now());
  if (loaded) S = loaded;

  ui = createUI({
    getState: () => S,
    onBuy, onBuyUp, onClaimMission, onClaimChest, onClaimSupply, onRelocate, onWipe, onToggleSound,
    onToggleNotify: native.isNative() ? onToggleNotify : null,
    onRefresh: refresh,
    version: 'Version ' + __APP_VERSION__,
  });
  ui.init();
  if (PRIVACY_URL) { const a = $('privacy'); a.href = PRIVACY_URL; a.hidden = false; }

  const cv = $('cv');
  scene = createScene(cv, {
    reduced: REDUCED,
    frenzyOn: () => L.frenzyOn(S, Date.now()),
    shipCount: () => L.fleetCount(S),
  });
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (scene.hitComet(x, y)) catchComet(); else doTap(x, y);
  });
  cv.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const [w, h] = scene.size();
      doTap(w / 2 + (Math.random() - 0.5) * 40, h / 2);
    } else if (e.key === 'c' || e.key === 'C') catchComet();
  });
  new ResizeObserver(scene.resize).observe(cv);
  scene.resize();

  native.watchLifecycle(onHide, onShow);
  native.watchBackButton(ui.activeTab, () => { ui.selectTab('fleet'); refresh(); });
  native.setupChrome();

  const now = Date.now();
  lastT = now; prevDraw = now;
  const away = (now - S.last) / 1000;
  if (away > 60) offline(away);
  L.ensureDaily(S, new Date(now));
  if (L.canSupply(S, new Date(now))) ui.toast('Your daily supply drop is ready on the Goals tab.', 4500);
  refresh();

  setInterval(() => { if (!paused) refresh(); }, 250);
  setInterval(() => { if (!paused) save(); }, SAVE_EVERY_MS);
  requestAnimationFrame(frame);
}

boot();
