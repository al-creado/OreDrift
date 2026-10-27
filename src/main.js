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
import * as ads from './ads.js';
import * as store from './store.js';

/* Hosted privacy policy (GitHub Pages, from docs/). The Settings link only shows when this is non-empty. */
const PRIVACY_URL = 'https://al-creado.github.io/OreDrift/';
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
  offerDouble(r.gain);
}

/* Rewarded bonuses. With ads removed they are simply free; otherwise the player opts in to watch an ad. */
const rewardsOpen = () => L.adsRemoved(S) || ads.adsAvailable();
const getReward = () => (L.adsRemoved(S) ? Promise.resolve('rewarded') : ads.showRewarded());

/* Optional bonus: pays the offline earnings a second time. Nothing happens unless the player taps the button. */
let pendingDouble = 0; // offline earnings seen before ads finished starting
function offerDouble(amount) {
  if (!rewardsOpen()) { pendingDouble = amount; return; }
  pendingDouble = 0;
  const free = L.adsRemoved(S);
  ui.showOffer('Double your offline earnings?', (free ? 'Claim +' : 'Watch ad +') + L.fmt(amount), async () => {
    ui.hideOffer();
    const res = await getReward();
    if (res === 'rewarded') {
      L.gain(S, amount);
      ui.toast('Bonus! +' + L.fmt(amount) + ' t.', 3500);
      sounds.claim();
      refresh(); save();
    } else if (res === 'closed') {
      ui.toast('The ad was closed before it finished, so no bonus.', 3500);
      offerDouble(amount);
    } else {
      ui.toast('No ad available right now. Try again in a moment.', 3500);
      offerDouble(amount);
    }
  });
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
  syncPurchases(false); // purchases live with the Google account, so bring owned items (Remove ads, boost) straight back
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

const podInfo = (now) => (rewardsOpen() ? { reward: L.podReward(S), waitMs: L.podWaitMs(S, now), free: L.adsRemoved(S) } : null);

async function onWatchPod() {
  if (!rewardsOpen() || L.podWaitMs(S, Date.now()) > 0) return;
  const res = await getReward();
  if (res === 'rewarded') {
    const g = L.claimPod(S, Date.now());
    if (g) ui.toast('Cargo pod! +' + L.fmt(g) + ' t.', 3500);
    sounds.comet();
    refresh(); save();
  } else if (res === 'closed') {
    ui.toast('The ad was closed before it finished, so no pod.', 3500);
  } else {
    ui.toast('No ad available right now. Try again in a moment.', 3500);
  }
}

/* ---------- shop ---------- */
let purchasing = false;

function announce(p, r) {
  if (r.restored) ui.toast(p.name + ' is already yours. Restored.', 3500);
  else if (p.id === 'remove_ads') ui.toast('Ads removed. Thank you! The ad bonuses are now free.', 4500);
  else if (p.id === 'starter_bundle') ui.toast('Starter bundle! +' + L.fmt(r.ore) + ' t and output ×' + FRENZY_MULT + ' for ' + r.frenzy + ' s.', 4500);
  else if (p.id === 'boost_25') ui.toast('Prospector boost active: +25% to all output and taps.', 4500);
  else ui.toast(p.name + ': +' + L.fmt(r.ore) + ' t delivered.', 4000);
  if (!r.restored) sounds.chest();
}

async function onBuyProduct(p) {
  if (purchasing) return;
  purchasing = true; refresh();
  try {
    const res = await store.purchase(p);
    if (res.status === 'cancelled') return;
    if (res.status !== 'purchased') {
      ui.toast('The purchase did not complete. If you were charged, tap Restore purchases.', 5000);
      return;
    }
    const r = L.applyPurchase(S, res.productId, res.orderId, Date.now());
    await save(); // persist the reward before telling Play the pack is used up
    if (p.kind === 'pack') await store.finishPack(res.token);
    if (p.id === 'remove_ads' && !r.restored) { ads.hideBanner(); }
    announce(p, r);
  } finally {
    purchasing = false; refresh();
  }
}

/** Reconciles with Google Play: restores owned one-time items and delivers packs that were paid for but not yet granted. */
async function syncPurchases(manual) {
  const held = await store.ownedPurchases();
  let news = 0;
  for (const o of held) {
    const p = L.productById(o.productId);
    if (!p) continue;
    if (p.kind === 'pack') {
      const r = L.applyPurchase(S, p.id, o.orderId, Date.now());
      await save();
      await store.finishPack(o.token);
      if (!r.restored) { announce(p, r); news++; }
    } else if (!L.owns(S, p.id)) {
      L.restoreOwned(S, p.id);
      if (p.id === 'remove_ads') ads.hideBanner();
      news++;
    }
  }
  if (news) { await save(); refresh(); }
  if (manual) ui.toast(news ? 'Purchases restored.' : 'Nothing new to restore.', 3500);
}

function onToggleSound() { S.sound = !S.sound; refresh(); save(); }

async function onToggleNotify() {
  if (S.notify) {
    S.notify = false;
    native.cancelReminders();
  } else if (await native.requestNotifyPermission()) {
    S.notify = true;
    ui.toast('Reminders on. You will hear about supply drops, a full hold and a ready cargo pod.');
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
  if (S.notify) {
    const podAt = rewardsOpen() && L.podWaitMs(S, now) > 0 ? S.podReadyAt : 0; // only remind while the pod is cooling down
    native.scheduleReminders(now, L.fleetCount(S) > 0, podAt);
  }
}

function onShow() {
  const now = Date.now();
  paused = false;
  native.cancelReminders();
  lastT = S.last;
  tick(now); // under a minute away earns at full rate, longer earns offline rate (same as the reference)
  prevDraw = now;
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
    podInfo, onWatchPod,
    priceOf: store.priceOf, onBuyProduct, onRestore: () => syncPurchases(true), isBusy: () => purchasing,
    onOpenAdPrivacy: native.isNative() ? () => ads.openPrivacyOptions() : null,
    version: 'Version ' + __APP_VERSION__,
  });
  ui.init();
  if (PRIVACY_URL) { const a = $('privacy'); a.href = PRIVACY_URL; a.hidden = false; }

  const cv = $('cv');
  scene = createScene(cv, {
    reduced: REDUCED,
    frenzyOn: () => L.frenzyOn(S, Date.now()),
    shipCount: () => L.fleetCount(S),
    onCometSpawn: () => sounds.cometSpawn(),
    onCometPing: () => sounds.cometPing(),
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

  // Store first (it can restore "Remove ads" on a new phone), then ads. None of this blocks play; failure just hides the buttons.
  (async () => {
    await store.initStore();
    ui.setShopVisible(store.storeAvailable() || native.isNative()); // on Android always show it; items read "Unavailable" until Play has them
    await syncPurchases(false);
    if (!L.adsRemoved(S)) {
      await ads.initAds();
      if (!L.adsRemoved(S)) await ads.showBanner();
      ui.setAdPrivacy(ads.needsPrivacyOptions());
    }
    if (pendingDouble) offerDouble(pendingDouble);
    refresh();
  })();

  setInterval(() => { if (!paused) refresh(); }, 250);
  setInterval(() => { if (!paused) save(); }, SAVE_EVERY_MS);
  requestAnimationFrame(frame);
}

boot();
