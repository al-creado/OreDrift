/* DOM building and updating: HUD, tabs, cards, goals, toasts. Reads state, never changes rules. */
import { GENS, UPS, ACHS, MILESTONES, FRENZY_MULT, ACH_BONUS, PRODUCTS } from './data.js';
import * as L from './logic.js';

const $ = (id) => document.getElementById(id);
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };

/**
 * h: { getState(), onBuy(gen, mode), onBuyUp(up), onClaimMission(i), onClaimChest(), onClaimSupply(),
 *      onRelocate(), onWipe(), onToggleSound(), onToggleNotify?(), version?,
 *      podInfo(now) -> null | { reward, waitMs, free }, onWatchPod(), onOpenAdPrivacy?(),
 *      priceOf(id), onBuyProduct(product), onRestore(), isBusy() }
 */
export function createUI(h) {
  let buyMode = 1;
  let activeTab = 'fleet';
  const S = () => h.getState();

  /* ---------- toast queue ---------- */
  let toastTimer = 0, toastBusy = false;
  const toastQ = [];
  function toast(msg, ms) {
    if (toastQ.length >= 4) toastQ.shift();
    toastQ.push([msg, ms || 3200]);
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    const t = $('toast'), n = toastQ.shift();
    clearTimeout(toastTimer);
    if (!n) { toastBusy = false; t.hidden = true; return; }
    toastBusy = true; t.textContent = n[0]; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    toastTimer = setTimeout(nextToast, toastQ.length ? Math.min(n[1], 3500) : n[1]);
  }

  /* ---------- fleet ---------- */
  const cards = {};
  function buildFleet() {
    const host = $('fleet'); host.textContent = '';
    GENS.forEach((g) => {
      const el = document.createElement('article'); el.className = 'card';
      el.innerHTML = '<div class="count"></div><div class="info"><h3 class="name"></h3><p class="desc"></p><p class="meta"></p></div><button class="buy" type="button"><span class="bn"></span><span class="bc"></span></button>';
      const c = {
        root: el, count: el.querySelector('.count'), name: el.querySelector('.name'), desc: el.querySelector('.desc'),
        meta: el.querySelector('.meta'), btn: el.querySelector('.buy'), bn: el.querySelector('.bn'), bc: el.querySelector('.bc'),
      };
      c.btn.addEventListener('click', () => h.onBuy(g, buyMode));
      host.appendChild(el); cards[g.id] = c;
    });
  }
  function updateFleet(s) {
    let lockShown = false;
    const pm = L.prodMult(s);
    GENS.forEach((g, i) => {
      const c = cards[g.id], n = L.own(s, g.id);
      if (L.revealed(s, g, i)) {
        c.root.hidden = false; c.root.classList.remove('locked'); c.btn.hidden = false;
        const each = g.rate * L.milestoneMult(n || 1) * pm, next = MILESTONES.find((k) => k > n);
        setText(c.count, String(n)); setText(c.name, g.name); setText(c.desc, g.desc);
        setText(c.meta, n > 0
          ? L.fmt(each) + ' t/s each, ' + L.fmt(n * each) + ' t/s total\n' + (next ? 'Output doubles at ' + next + ' owned' : 'All output boosts earned')
          : L.fmt(g.rate * pm) + ' t/s each\nOutput doubles at ' + MILESTONES[0] + ' owned');
        const q = L.buyQty(s, g, buyMode), cost = L.bulkCost(s, g, q), can = s.ore >= cost;
        setText(c.bn, 'Buy ×' + q); setText(c.bc, L.fmt(cost));
        c.btn.disabled = !can; c.btn.classList.toggle('can', can);
      } else if (!lockShown) {
        lockShown = true;
        c.root.hidden = false; c.root.classList.add('locked'); c.btn.hidden = true;
        setText(c.count, '?'); setText(c.name, 'Unknown vessel');
        setText(c.desc, 'Mine ' + L.fmt(g.base * 0.4) + ' t this run to reveal it.'); setText(c.meta, '');
      } else c.root.hidden = true;
    });
  }

  /* ---------- upgrades ---------- */
  let upKey = '', upEls = {};
  function updateUps(s) {
    const vis = L.visibleUps(s), installed = L.upCount(s), key = vis.map((u) => u.id).join(',') + '|' + installed;
    const host = $('ups');
    if (key !== upKey) {
      upKey = key; upEls = {}; host.textContent = '';
      if (!vis.length) {
        const e = document.createElement('div'); e.className = 'empty';
        e.textContent = installed === UPS.length
          ? 'Everything is installed. Relocate on the Belt tab to start a stronger run.'
          : 'Nothing to install yet. Keep mining and new gear shows up here.';
        host.appendChild(e);
      }
      vis.forEach((u) => {
        const el = document.createElement('article'); el.className = 'card up';
        const info = document.createElement('div'); info.className = 'info';
        const hd = document.createElement('h3'); hd.className = 'name'; hd.textContent = u.name;
        const p = document.createElement('p'); p.className = 'desc'; p.textContent = u.desc;
        info.append(hd, p);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'buy';
        b.innerHTML = '<span class="bn">Install</span><span class="bc"></span>';
        b.querySelector('.bc').textContent = L.fmt(u.cost);
        b.addEventListener('click', () => h.onBuyUp(u));
        el.append(info, b); host.appendChild(el); upEls[u.id] = b;
      });
      const f = document.createElement('div'); f.className = 'foot'; f.textContent = installed + ' of ' + UPS.length + ' installed';
      host.appendChild(f);
    }
    vis.forEach((u) => {
      const b = upEls[u.id]; if (!b) return;
      const can = s.ore >= u.cost; b.disabled = !can; b.classList.toggle('can', can);
    });
  }
  const resetUpgradeList = () => { upKey = ''; };

  /* ---------- belt ---------- */
  function updateBelt(s) {
    if (activeTab !== 'belt') return;
    const g = L.prestigeGain(s);
    setText($('pts'), String(s.points));
    $('relocate').disabled = g < 1;
    setText($('relnote'), g >= 1
      ? 'Relocating now earns +' + g + ' survey point' + (g > 1 ? 's' : '') + ' (+' + g * 10 + '%). The next point comes at ' + L.fmt(L.nextPointAt(s)) + ' t this run.'
      : 'Mine ' + L.fmt(1e6 - s.total) + ' more t this run to earn your first survey point.');
    setText($('st-all'), L.fmt(s.allTime) + ' t'); setText($('st-run'), L.fmt(s.total) + ' t');
    setText($('st-taps'), s.taps.toLocaleString('en-US'));
    setText($('st-fleet'), String(L.fleetCount(s)));
    setText($('st-runs'), String(s.runs));
    setText($('st-comets'), String(s.stats.comets)); setText($('st-missions'), String(s.stats.missions));
    setText($('st-best'), s.stats.best + (s.stats.best === 1 ? ' day' : ' days')); setText($('st-ach'), L.achCount(s) + ' of ' + ACHS.length);
    setText($('snd'), s.sound ? 'On' : 'Off'); $('snd').setAttribute('aria-pressed', String(s.sound));
    const nb = $('notify');
    if (!$('notify-row').hidden) { setText(nb, s.notify ? 'On' : 'Off'); nb.setAttribute('aria-pressed', String(!!s.notify)); }
  }

  /* ---------- goals ---------- */
  const G = { dots: [], m: [] }, achEls = [];
  let achKey = -1;
  function buildGoals() {
    const dots = $('dots'); dots.textContent = ''; G.dots = [];
    for (let i = 1; i <= 7; i++) {
      const d = document.createElement('span'); d.className = 'dot'; d.textContent = String(i);
      dots.appendChild(d); G.dots.push(d);
    }
    const host = $('missions'); host.textContent = ''; G.m = [];
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('article'); el.className = 'card up';
      el.innerHTML = '<div class="info"><p class="mtext"></p><div class="track"><div class="fill"></div></div><p class="meta"></p></div><button class="buy" type="button"><span class="bn"></span><span class="bc"></span></button>';
      const c = { text: el.querySelector('.mtext'), fill: el.querySelector('.fill'), meta: el.querySelector('.meta'), btn: el.querySelector('.buy'), bn: el.querySelector('.bn'), bc: el.querySelector('.bc') };
      c.btn.addEventListener('click', () => { if (i < 3) h.onClaimMission(i); else h.onClaimChest(); });
      host.appendChild(el); G.m.push(c);
    }
    $('supply-btn').addEventListener('click', () => h.onClaimSupply());
  }
  function setBtn(c, can, bn, bc) {
    setText(c.bn, bn); setText(c.bc, bc || ''); c.btn.disabled = !can; c.btn.classList.toggle('can', can);
  }
  function setFill(el, p) {
    const w = Math.max(0, Math.min(100, p)) + '%';
    if (el.style.width !== w) el.style.width = w;
  }
  function buildAch(s) {
    const host = $('achs'); host.textContent = ''; achEls.length = 0;
    const ratio = (a) => Math.min(1, L.achValue(s, a) / a.t);
    const list = ACHS.slice().sort((a, b) => {
      const ua = s.ach[a.id] ? 1 : 0, ub = s.ach[b.id] ? 1 : 0;
      if (ua !== ub) return ua - ub;
      return ua ? 0 : ratio(b) - ratio(a);
    });
    list.forEach((a) => {
      const el = document.createElement('article'); el.className = 'card ach';
      el.innerHTML = '<div class="count"></div><div class="info"><h3 class="name"></h3><p class="desc"></p><div class="track"><div class="fill"></div></div><p class="meta"></p></div>';
      el.querySelector('.name').textContent = a.name; el.querySelector('.desc').textContent = a.desc;
      host.appendChild(el);
      achEls.push({ a, root: el, mark: el.querySelector('.count'), track: el.querySelector('.track'), fill: el.querySelector('.fill'), meta: el.querySelector('.meta') });
    });
    achKey = L.achCount(s);
  }
  function updateGoals(s, date) {
    const D = s.daily; if (!D) return;
    const sh = L.shownStreak(s, date), can = L.canSupply(s, date), nx = Math.min(L.nextStreak(s, date), 7), f = L.supplyFactor(L.nextStreak(s, date));
    G.dots.forEach((d, i) => { d.classList.toggle('on', i < Math.min(sh, 7)); d.classList.toggle('next', can && i === nx - 1); });
    $('dots').setAttribute('aria-label', 'Supply streak: ' + sh + ' of 7 days');
    setText($('supnote'), can
      ? 'Day ' + nx + ' pays ×' + f + ', about ' + L.fmt(L.supplyReward(s, date)) + ' t. Miss a day and the streak starts over.'
      : 'Collected for today. Streak: ' + s.streak + (s.streak === 1 ? ' day. ' : ' days. ') + (s.streak >= 7 ? 'Bonus is at its maximum.' : 'Come back tomorrow for a bigger drop.'));
    const sb = $('supply-btn'); sb.disabled = !can; setText(sb, can ? 'Claim ' + L.fmt(L.supplyReward(s, date)) : 'Collected');

    const mid = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const left = Math.max(0, Math.floor((mid - date) / 60000));
    setText($('reset'), Math.floor(left / 60) + 'h ' + (left % 60) + 'm left');
    const rew = L.missionReward(s);
    D.missions.forEach((m, i) => {
      const c = G.m[i], done = m.progress >= m.target;
      setText(c.text, L.missionText(m)); setFill(c.fill, 100 * m.progress / m.target);
      setText(c.meta, m.claimed ? 'Claimed' : L.fmt(m.progress) + ' / ' + L.fmt(m.target) + '\nReward about ' + L.fmt(rew) + ' t');
      if (m.claimed) setBtn(c, false, 'Claimed', '');
      else if (done) setBtn(c, true, 'Claim', '+' + L.fmt(rew));
      else setBtn(c, false, Math.floor(100 * m.progress / m.target) + '%', '');
    });
    const cc = G.m[3], got = D.missions.filter((m) => m.claimed).length, all = got === 3, cr = L.chestReward(s);
    setText(cc.text, 'Daily cache'); setFill(cc.fill, 100 * got / 3);
    setText(cc.meta, D.chest ? 'Opened today' : got + ' of 3 missions claimed\nPays about ' + L.fmt(cr) + ' t and ×' + FRENZY_MULT + ' output for 60 s');
    if (D.chest) setBtn(cc, false, 'Opened', '');
    else if (all) setBtn(cc, true, 'Open', '+' + L.fmt(cr));
    else setBtn(cc, false, 'Locked', '');

    if (achKey !== L.achCount(s)) buildAch(s);
    const n = L.achCount(s);
    setText($('achcount'), n + ' / ' + ACHS.length);
    setText($('achnote'), 'Each commendation adds +' + Math.round(ACH_BONUS * 100) + '% to all output and taps, and stays through relocations. Current bonus: +' + Math.round(n * ACH_BONUS * 100) + '%.');
    achEls.forEach((e) => {
      const done = !!s.ach[e.a.id], v = Math.min(L.achValue(s, e.a), e.a.t);
      e.root.classList.toggle('done', done); e.track.hidden = done;
      setText(e.mark, done ? '✓' : Math.floor(100 * v / e.a.t) + '%');
      setText(e.meta, done ? '' : L.fmt(v) + ' / ' + L.fmt(e.a.t));
      if (!done) setFill(e.fill, 100 * v / e.a.t);
    });
  }
  const resetAchList = () => { achKey = -1; };

  /* ---------- cargo pod (rewarded ad) ---------- */
  function updatePod(s, date) {
    const info = h.podInfo(date.getTime()), sect = $('pod-sect');
    sect.hidden = !info;
    if (!info) return;
    const ready = info.waitMs <= 0;
    setText($('pod-note'), ready
      ? (info.free ? 'Free bonus, thanks to removing ads.' : 'Watch a short ad. Optional.')
      : 'Next cargo pod in ' + L.fmtDur(Math.ceil(info.waitMs / 1000)) + '.');
    setBtn({ btn: $('pod-btn'), bn: $('pod-bn'), bc: $('pod-bc') }, ready, ready ? (info.free ? 'Collect' : 'Watch ad') : 'Wait', ready ? '+' + L.fmt(info.reward) : '');
  }

  /* ---------- shop ---------- */
  const shopEls = {};
  function buildShop() {
    const host = $('shop'); host.textContent = '';
    PRODUCTS.forEach((p) => {
      const el = document.createElement('article'); el.className = 'card up';
      el.innerHTML = '<div class="info"><h3 class="name"></h3><p class="desc"></p><p class="meta"></p></div><button class="buy" type="button"><span class="bn"></span><span class="bc"></span></button>';
      el.querySelector('.name').textContent = p.name; el.querySelector('.desc').textContent = p.desc;
      const c = { meta: el.querySelector('.meta'), btn: el.querySelector('.buy'), bn: el.querySelector('.bn'), bc: el.querySelector('.bc') };
      c.btn.addEventListener('click', () => h.onBuyProduct(p));
      host.appendChild(el); shopEls[p.id] = c;
    });
    $('restore').addEventListener('click', () => h.onRestore());
  }
  function updateShop(s) {
    $('shop-note').hidden = PRODUCTS.some((p) => h.priceOf(p.id));
    PRODUCTS.forEach((p) => {
      const c = shopEls[p.id], owned = L.owns(s, p.id), price = h.priceOf(p.id);
      setText(c.meta, owned ? 'Owned' : p.hours ? 'Pays about ' + L.fmt(L.productOre(s, p)) + ' t at your current output' : '');
      if (owned) setBtn(c, false, 'Owned', '');
      else if (!price) setBtn(c, false, 'Unavailable', '');
      else setBtn(c, !h.isBusy(), 'Buy', price);
    });
  }
  function setShopVisible(on) {
    $('nav-shop').hidden = !on;
    if (!on && activeTab === 'shop') selectTab('fleet');
  }

  /* ---------- offer banner (e.g. double offline earnings) ---------- */
  let offerGo = null;
  function showOffer(text, button, onGo) {
    offerGo = onGo;
    setText($('offer-text'), text); setText($('offer-go'), button);
    $('offer').hidden = false;
  }
  const hideOffer = () => { $('offer').hidden = true; offerGo = null; };

  /* ---------- HUD and whole-screen refresh ---------- */
  let lastOre = '';
  function updateOre(s) {
    const t = L.fmtOre(s.ore);
    if (t !== lastOre) { lastOre = t; $('ore').textContent = t; }
  }
  function update(now, date) {
    const s = S();
    const o = L.ops(s, now);
    setText($('rate'), '+' + L.fmt(o) + ' t/s'); setText($('tapv'), 'tap +' + L.fmt(L.tapValue(s, now, o)));
    const b = $('bonus'), bp = Math.round((L.surveyMult(s) * L.achMult(s) * L.iapMult(s) - 1) * 100);
    if (bp > 0) { b.hidden = false; setText(b, '+' + bp + '% bonus'); } else b.hidden = true;
    const fz = $('frenzy');
    if (L.frenzyOn(s, now)) { fz.hidden = false; setText(fz, '×' + FRENZY_MULT + ' for ' + Math.ceil(L.frenzyLeft(s, now)) + 's'); } else fz.hidden = true;
    updateOre(s);
    updateFleet(s); updatePod(s, date); updateUps(s);
    if (activeTab === 'goals') updateGoals(s, date);
    if (activeTab === 'shop') updateShop(s);
    updateBelt(s);
    $('b-ups').hidden = !L.visibleUps(s).some((u) => s.ore >= u.cost);
    $('b-goals').hidden = !L.goalsReady(s, date);
    $('b-belt').hidden = L.prestigeGain(s) < 1;
  }

  /* ---------- tabs and controls ---------- */
  const TABS = ['fleet', 'ups', 'goals', 'shop', 'belt'];
  function selectTab(name) {
    activeTab = name;
    document.querySelectorAll('.nav button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    TABS.forEach((t) => { $('tab-' + t).hidden = t !== name; });
  }
  function confirmable(btn, label, armedLabel, action) {
    let armed = false, timer = 0;
    btn.addEventListener('click', () => {
      if (!armed) { armed = true; btn.textContent = armedLabel; timer = setTimeout(() => { armed = false; btn.textContent = label; }, 4000); return; }
      clearTimeout(timer); armed = false; btn.textContent = label; action();
    });
  }

  function init() {
    buildFleet(); buildGoals(); buildShop();
    document.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => {
      buyMode = b.dataset.m === 'max' ? 'max' : +b.dataset.m;
      document.querySelectorAll('#seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      h.onRefresh();
    }));
    document.querySelectorAll('.nav button').forEach((b) => b.addEventListener('click', () => { selectTab(b.dataset.tab); h.onRefresh(); }));
    confirmable($('relocate'), 'Relocate', 'Tap again to relocate', h.onRelocate);
    confirmable($('wipe'), 'Wipe save', 'Tap again to wipe', h.onWipe);
    $('snd').addEventListener('click', h.onToggleSound);
    $('toast').addEventListener('click', nextToast);
    if (h.version) setText($('version'), h.version);
    $('pod-btn').addEventListener('click', () => h.onWatchPod());
    $('offer-go').addEventListener('click', () => { if (offerGo) offerGo(); });
    $('offer-x').addEventListener('click', hideOffer);
    if (h.onOpenAdPrivacy) $('adprivacy').addEventListener('click', h.onOpenAdPrivacy);
    if (h.onToggleNotify) { $('notify-row').hidden = false; $('notify').addEventListener('click', h.onToggleNotify); }
  }

  return {
    init, update, updateOre, toast, showOffer, hideOffer, setShopVisible, setAdPrivacy: (on) => { $('adprivacy-row').hidden = !on; }, selectTab, resetUpgradeList, resetAchList,
    activeTab: () => activeTab,
  };
}
