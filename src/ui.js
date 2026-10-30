/* DOM building and updating: HUD, tabs, cards, goals, toasts. Reads state, never changes rules. */
import { GENS, UPS, ACHS, MILESTONES, FRENZY_MULT, PRODUCTS, ACH_GROUPS, TIER_NAMES, RANKS, JOURNAL } from './data.js';
import * as L from './logic.js';
import { beltFor } from './belts.js';

const $ = (id) => document.getElementById(id);
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };

/**
 * h: { getState(), onBuy(gen, mode), onBuyUp(up), onClaimMission(i), onClaimChest(), onClaimSupply(),
 *      onRelocate(), onWipe(), onToggleSound(), onToggleMusic(), onToggleNotify?(), version?,
 *      podInfo(now) -> null | { reward, waitMs, free }, onWatchPod(), onOpenAdPrivacy?(),
 *      priceOf(id), onBuyProduct(product), onRestore(), isBusy(), onOpenJournal() }
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

  /* ---------- the Captain's journal ---------- */
  function buildJournal(s, seen) {
    const host = $('jbody'); host.textContent = '';
    JOURNAL.forEach((c, i) => {
      const open = L.statValue(s, c.stat) >= c.t;
      const el = document.createElement('article'); el.className = 'chapter' + (open ? '' : ' locked');
      const num = document.createElement('p'); num.className = 'jnum'; num.textContent = 'Chapter ' + (i + 1);
      const title = document.createElement('h3'); title.textContent = open ? c.title : 'Locked';
      if (open && i >= seen) { const n = document.createElement('span'); n.className = 'newpill'; n.textContent = 'New'; title.appendChild(n); }
      el.append(num, title);
      if (open) c.text.forEach((t) => { const p = document.createElement('p'); p.textContent = t; el.appendChild(p); });
      else { const r = document.createElement('p'); r.className = 'jreq'; r.textContent = c.req; el.appendChild(r); }
      host.appendChild(el);
    });
  }
  function openJournal() {
    const s = S();
    buildJournal(s, s.journalSeen); // chapters not seen before carry a NEW pill
    $('journal').hidden = false; $('jbody').scrollTop = 0;
    h.onOpenJournal(); // marks everything unlocked as seen
  }
  /** Returns true if the journal was open (so the back button knows it handled the press). */
  function closeJournal() {
    if ($('journal').hidden) return false;
    $('journal').hidden = true;
    return true;
  }

  /* ---------- commendation banner ---------- */
  // Tier colours: Bronze, Silver, Gold, Platinum, each with a matching soft glow.
  const TIER_LOOK = [['#d58a5a', 'rgba(213,138,90,.45)'], ['#c3cadb', 'rgba(195,202,219,.4)'], ['#f2c14e', 'rgba(242,193,78,.5)'], ['#8fe3ff', 'rgba(143,227,255,.45)']];
  const achQ = [];
  let achBusy = false, achTimer = 0, achShown = null; // achShown: the banner item on screen right now
  const ACH_SHOW_MS = 4200;

  /** item: { kicker, name, tier (1..5), sub?, reward, chain? } (chain: the commendation chain a tap on the banner opens) */
  function achPop(item) {
    if (achQ.length >= 8) achQ.shift();
    achQ.push(item);
    if (!achBusy) nextAchPop();
  }
  function nextAchPop() {
    const pop = $('achpop'), item = achQ.shift();
    achShown = item || null;
    clearTimeout(achTimer);
    if (!item) {
      achBusy = false; pop.classList.remove('show');
      achTimer = setTimeout(() => { if (!achBusy) pop.hidden = true; }, 600);
      return;
    }
    achBusy = true;
    const t = Math.min(4, item.tier || 1), look = TIER_LOOK[t - 1];
    pop.style.setProperty('--tier', look[0]); pop.style.setProperty('--glow', look[1]);
    $('achpop-kicker').textContent = item.kicker;
    $('achpop-name').textContent = item.name;
    $('achpop-tier').textContent = item.many ? '' : TIER_NAMES[t - 1];
    $('achpop-sub').textContent = item.sub || '';
    $('achpop-reward').textContent = item.reward;
    pop.hidden = false;
    pop.classList.remove('show'); void pop.offsetWidth; // restart the slide-in
    pop.classList.add('show');
    achTimer = setTimeout(hideAchPop, ACH_SHOW_MS);
  }
  function hideAchPop() {
    clearTimeout(achTimer);
    $('achpop').classList.remove('show');
    achTimer = setTimeout(nextAchPop, 450); // let it slide out before the next one comes in
  }

  /* ---------- welcome back ---------- */
  const welcomeOpen = () => !$('welcome').hidden;
  /** info: { sec, gain, capped }. The ore is already in the hold; this only reports it. */
  function showWelcome(info) {
    setText($('wel-ore'), '+' + L.fmt(info.gain) + ' t');
    setText($('wel-away'), L.fmtDur(info.sec));
    setText($('wel-hold'), info.capped ? 'Full after 8 h' : 'Not full');
    setText($('wel-note'), info.capped
      ? 'Your hold was full after 8 hours, so the rest of your time away did not count.' + (h.onToggleNotify ? ' Turn on Reminders in Settings on the Belt tab to hear when it fills.' : '')
      : 'Your fleet mines at half rate while you are away, for up to 8 hours.');
    $('wel-double').hidden = true;
    $('welcome').hidden = false;
    $('wel-ok').focus();
  }
  /** Shows (label + handler) or hides (null) the optional "double it" button. Returns false when the card is not open. */
  function setWelcomeOffer(label, onGo) {
    if (!welcomeOpen()) return false;
    const b = $('wel-double');
    b.hidden = !label;
    if (label) { setText(b, label); b.onclick = onGo; }
    return true;
  }
  function welcomeDoubled(total) {
    if (!welcomeOpen()) return;
    setText($('wel-ore'), '+' + L.fmt(total) + ' t');
    setText($('wel-note'), 'Bonus claimed: your offline earnings were doubled.');
    $('wel-double').hidden = true;
  }
  /** Returns true if the card was open (so the back button knows it handled the press). */
  function closeWelcome() {
    if (!welcomeOpen()) return false;
    $('welcome').hidden = true;
    return true;
  }
  const closeOverlay = () => closeWelcome() || closeJournal();

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
    const pv = L.relocatePreview(s), g = pv.gain;
    setText($('pts'), String(s.points));
    const chapters = L.journalCount(s);
    setText($('jnote'), chapters + ' of ' + JOURNAL.length + ' chapters unlocked. A story of the Drift, told as you go.');
    $('jnew').hidden = chapters <= s.journalSeen;
    setText($('beltname'), 'Current belt: ' + beltFor(s.runs).name);
    $('relocate').disabled = g < 1;

    // What relocating gives (and costs), spelled out.
    setText($('rl-gain'), g >= 1
      ? '+' + g + ' survey point' + (g > 1 ? 's' : '') + ': everything you earn ×' + pv.ratio.toFixed(2)
      : 'Not yet: ' + L.fmt(Math.max(0, pv.nextAt - s.total)) + ' t to go');
    setFill($('rl-fill'), pv.progress * 100);
    setText($('relnote'), (g >= 1 ? 'The next survey point' : 'Your first survey point') + ' comes at ' + L.fmt(pv.nextAt) + ' t this run (' + L.fmt(s.total) + ' so far). The bar shows the way there.');
    $('rl-detail').hidden = g < 1;
    setText($('rl-pts'), pv.pointsBefore + ' → ' + pv.pointsAfter);
    setText($('rl-sb'), '+' + pct(pv.surveyBefore) + ' → +' + pct(pv.surveyAfter));
    setText($('rl-total'), '+' + L.fmtPct(pv.bonusBefore, 0) + ' → +' + L.fmtPct(pv.bonusAfter, 0));
    setText($('rl-belt'), beltFor(s.runs).name + ' → ' + beltFor(s.runs + 1).name);
    const lose = pv.lose;
    setText($('rl-lose'), L.fmt(lose.ore) + ' t of ore, ' + lose.vessels + ' vessel' + (lose.vessels === 1 ? '' : 's') + ', ' + lose.upgrades + ' upgrade' + (lose.upgrades === 1 ? '' : 's') + ' and this run\'s ' + L.fmt(lose.run) + ' t of progress.');
    setText($('st-all'), L.fmt(s.allTime) + ' t'); setText($('st-run'), L.fmt(s.total) + ' t');
    setText($('st-taps'), s.taps.toLocaleString('en-US'));
    setText($('st-fleet'), String(L.fleetCount(s)));
    setText($('st-runs'), String(s.runs));
    setText($('st-comets'), String(s.stats.comets)); setText($('st-missions'), String(s.stats.missions));
    setText($('st-played'), L.fmtDur(s.stats.played)); setText($('st-peak'), L.fmt(s.stats.peak) + ' t/s'); setText($('st-run-best'), String(s.stats.bestRun));
    setText($('st-best'), s.stats.best + (s.stats.best === 1 ? ' day' : ' days')); setText($('st-ach'), L.achCount(s) + ' of ' + ACHS.length);
    setText($('st-rank'), L.rankFor(L.achCount(s)).name);
    setText($('snd'), s.sound ? 'On' : 'Off'); $('snd').setAttribute('aria-pressed', String(s.sound));
    setText($('mus'), s.music ? 'On' : 'Off'); $('mus').setAttribute('aria-pressed', String(s.music));
    setText($('hap'), s.haptics ? 'On' : 'Off'); $('hap').setAttribute('aria-pressed', String(s.haptics));
    const nb = $('notify');
    if (!$('notify-row').hidden) { setText(nb, s.notify ? 'On' : 'Off'); nb.setAttribute('aria-pressed', String(!!s.notify)); }
  }

  /** "2d 5h", "5h 12m" or "9m" for a span in milliseconds. */
  function leftText(ms) {
    const m = Math.max(1, Math.round(ms / 60000)), d = Math.floor(m / 1440), hr = Math.floor((m % 1440) / 60);
    return d ? d + 'd ' + hr + 'h' : hr ? hr + 'h ' + (m % 60) + 'm' : m + 'm';
  }

  /* ---------- goals ---------- */
  const G = { dots: [], m: [], cache: [] }, achEls = [];
  let achKey = '', achView = 'type'; // view: next (closest to done), type (grouped), done (earned)
  let goalsFocus = null; // { chain } or { any: true }: scroll to a commendation reward the next time the Goals tab draws
  const freshAch = new Set(); // earned this session; shown with a NEW pill until the Goals tab is left
  function buildGoals() {
    const dots = $('dots'); dots.textContent = ''; G.dots = [];
    for (let i = 1; i <= 7; i++) {
      const d = document.createElement('span'); d.className = 'dot'; d.textContent = String(i);
      dots.appendChild(d); G.dots.push(d);
    }
    const host = $('missions'); host.textContent = ''; G.m = [];
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('article'); el.className = 'card up';
      el.innerHTML = '<div class="info"><p class="mtext"></p><div class="track"><div class="fill"></div></div><p class="meta"></p></div><button class="buy" type="button"><span class="bn"></span><span class="bc"></span></button>';
      const c = { el, text: el.querySelector('.mtext'), fill: el.querySelector('.fill'), meta: el.querySelector('.meta'), btn: el.querySelector('.buy'), bn: el.querySelector('.bn'), bc: el.querySelector('.bc') };
      c.btn.addEventListener('click', () => {
        h.onClaimMission(i);
        if (el.hidden) $('cache-btn').focus(); // the claimed card is gone; keep keyboard focus on the page
      });
      host.appendChild(el); G.m.push(c);
    }
    const cd = $('cache-dots'); cd.textContent = ''; G.cache = [];
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('span'); d.className = 'dot'; d.textContent = String(i + 1);
      cd.appendChild(d); G.cache.push(d);
    }
    $('supply-btn').addEventListener('click', () => h.onClaimSupply());
    $('ach-claim').addEventListener('click', () => h.onClaimAch(null));
    $('cache-btn').addEventListener('click', () => h.onClaimChest());
  }
  function setBtn(c, can, bn, bc) {
    setText(c.bn, bn); setText(c.bc, bc || ''); c.btn.disabled = !can; c.btn.classList.toggle('can', can);
  }
  function setFill(el, p) {
    const w = Math.max(0, Math.min(100, p)) + '%';
    if (el.style.width !== w) el.style.width = w;
  }
  /* ---------- commendations: one tile per chain (Bronze, Silver, Gold...) ---------- */
  const tierOf = (a) => Math.min(4, a.tier);
  const pct = (x) => L.fmtPct(x);
  const ratio = (s, a) => Math.min(1, L.achValue(s, a) / a.t);
  const chainOrder = (x, y) => ACH_GROUPS.indexOf(x.group) - ACH_GROUPS.indexOf(y.group) || L.CHAINS.indexOf(x) - L.CHAINS.indexOf(y);

  /** Which chains the current view lists, in order. */
  function achList(s) {
    const shown = L.CHAINS.filter((c) => !L.chainHidden(s, c));
    if (achView === 'done') return shown.filter((c) => L.chainState(s, c).earnedCount > 0).sort(chainOrder);
    if (achView === 'type') return L.CHAINS.slice().sort(chainOrder); // includes hidden secrets, drawn as "?" cards
    return shown.filter((c) => !L.chainState(s, c).complete)
      .sort((x, y) => ratio(s, L.chainState(s, y).next) - ratio(s, L.chainState(s, x).next)).slice(0, 10);
  }

  function buildAch(s) {
    const host = $('achs'); host.textContent = ''; achEls.length = 0;
    const list = achList(s), grouped = achView !== 'next';
    let lastGroup = '';
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'empty';
      e.textContent = achView === 'done' ? 'Nothing earned yet. Keep mining!' : 'Every visible commendation is complete.';
      host.appendChild(e);
    }
    list.forEach((chain) => {
      if (grouped && chain.group !== lastGroup) {
        lastGroup = chain.group;
        const g = document.createElement('h3'); g.className = 'grp'; g.textContent = chain.group; host.appendChild(g);
      }
      if (L.chainHidden(s, chain)) {
        // A secret one nobody has earned yet: a placeholder that gives nothing away.
        const m = document.createElement('article'); m.className = 'card ach mystery';
        m.innerHTML = '<div class="count">?</div><div class="info"><h3 class="name"><span class="nm">???</span><span class="tier secret">Secret</span></h3><p class="desc">Keep playing to discover it.</p></div>';
        host.appendChild(m);
        return;
      }
      const el = document.createElement('article'); el.className = 'card ach';
      el.innerHTML = '<div class="count"></div><div class="info"><h3 class="name"><span class="nm"></span><span class="tier"></span><span class="tier secret" hidden>Secret</span><span class="newpill" hidden>New</span></h3><p class="chainline"><span class="ctitle"></span><span class="pips"></span></p><p class="desc"></p><div class="track"><div class="fill"></div></div><p class="meta"></p><p class="earned"></p></div><button class="buy can" type="button" hidden><span class="bn">Claim</span><span class="bc"></span></button>';
      el.querySelector('.ctitle').textContent = chain.title;
      const btn = el.querySelector('.buy');
      btn.addEventListener('click', () => {
        h.onClaimAch(chain.id);
        if (btn.hidden) $('achseg').querySelector('[aria-pressed="true"]').focus(); // the button is gone; keep focus in the section
      });
      const pips = [...chain.steps.map((step) => {
        const p = document.createElement('span'); p.className = 'pip t' + tierOf(step); p.title = step.name;
        el.querySelector('.pips').appendChild(p); return p;
      })];
      el.querySelector('.chainline').hidden = chain.steps.length < 2; // a single secret tile has no tiers to show
      el.querySelector('.secret').hidden = !chain.secret;
      host.appendChild(el);
      achEls.push({
        chain, root: el, pips, mark: el.querySelector('.count'), nm: el.querySelector('.nm'), chip: el.querySelector('.tier'),
        desc: el.querySelector('.desc'), track: el.querySelector('.track'), fill: el.querySelector('.fill'),
        meta: el.querySelector('.meta'), earned: el.querySelector('.earned'), pill: el.querySelector('.newpill'),
        btn, bc: el.querySelector('.bc'),
      });
    });
    achKey = achView + '|' + L.achCount(s);
  }

  function updateAch(s) {
    const n = L.achCount(s), rank = L.rankFor(n), nextRank = RANKS.find((r) => r.min > n);
    if (achKey !== achView + '|' + n) buildAch(s);
    setText($('achcount'), n + ' / ' + ACHS.length);
    const all = L.pendingGifts(s), ab = $('ach-claim');
    ab.hidden = all.count < 2; // one waiting gift is claimed from its own card
    if (all.count >= 2) setText(ab, 'Claim all ' + all.count + ' rewards +' + L.fmt(all.ore));
    setText($('achrank'), 'Rank: ' + rank.name + (nextRank ? '. Next: ' + nextRank.name + ' at ' + nextRank.min + ' (' + (nextRank.min - n) + ' to go).' : '. The highest rank.'));
    setText($('achnote'), 'Each tier you reach gives a permanent output and tap bonus (+1% for the first 32, +0.5% for the rest) and a one-time ore gift you claim here. They stay through relocations. Current bonus: +' + pct(L.achBonusTotal(s)) + '.');
    achEls.forEach((e) => {
      const st = L.chainState(s, e.chain), a = st.next || st.last;
      e.root.classList.toggle('done', st.complete);
      e.pips.forEach((p, i) => p.classList.toggle('on', i < st.earnedCount));
      setText(e.nm, a.name);
      setText(e.chip, st.complete ? 'Complete' : TIER_NAMES[tierOf(a) - 1]);
      e.chip.className = 'tier ' + (st.complete ? 'tc' : 't' + tierOf(a));
      setText(e.desc, st.complete ? 'Every tier earned.' : a.desc);
      e.track.hidden = st.complete;
      e.pill.hidden = !e.chain.steps.some((x) => freshAch.has(x.id));
      const gift = L.pendingGifts(s, e.chain.id);
      e.btn.hidden = !gift.count; e.root.classList.toggle('claim', gift.count > 0);
      if (gift.count) { setText(e.bc, '+' + L.fmt(gift.ore)); e.btn.setAttribute('aria-label', 'Claim ' + L.fmt(gift.ore) + ' t for ' + e.chain.title); }
      const earnedNames = e.chain.steps.filter((x) => s.ach[x.id]).map((x) => '✓ ' + x.name);
      setText(e.earned, st.earnedCount && !st.complete ? earnedNames.join('   ') : (st.complete ? earnedNames.join('   ') : ''));
      e.earned.hidden = !st.earnedCount;
      if (st.complete) {
        setText(e.mark, '✓'); setText(e.meta, '');
      } else {
        const v = Math.min(L.achValue(s, a), a.t);
        setText(e.mark, Math.floor(100 * v / a.t) + '%');
        setText(e.meta, L.fmt(v) + ' / ' + L.fmt(a.t) + '\nTier ' + (st.earnedCount + 1) + ' of ' + st.total + '. Reward: +' + pct(L.achBonus(a)) + ' output and about ' + L.fmt(L.achGiftAmount(s, a)) + ' t');
        setFill(e.fill, 100 * v / a.t);
      }
    });
  }
  /** Marks commendations earned just now, so they carry a NEW pill (and the Goals tab a dot) until the player has seen them. */
  function markNew(ids) { ids.forEach((id) => freshAch.add(id)); achKey = ''; }
  function updateGoals(s, date) {
    const D = s.daily; if (!D) return;
    const sh = L.shownStreak(s, date), can = L.canSupply(s, date), nx = Math.min(L.nextStreak(s, date), 7), f = L.supplyFactor(L.nextStreak(s, date));
    G.dots.forEach((d, i) => { d.classList.toggle('on', i < Math.min(sh, 7)); d.classList.toggle('next', can && i === nx - 1); });
    $('dots').setAttribute('aria-label', 'Supply streak: ' + sh + ' of 7 days');
    setText($('supnote'), can
      ? 'Day ' + nx + ' pays ×' + f + ', about ' + L.fmt(L.supplyReward(s, date)) + ' t. Miss a day and the streak starts over.'
      : 'Collected for today. Streak: ' + s.streak + (s.streak === 1 ? ' day. ' : ' days. ') + (s.streak >= 7 ? 'Bonus is at its maximum.' : 'Come back tomorrow for a bigger drop.'));
    const ev = L.activeEvent(date), nx_ = ev ? null : L.nextEvent(date), es = $('event-sect');
    es.classList.toggle('on', !!ev);
    if (ev) { setText($('ev-name'), ev.name); setText($('ev-time'), 'Ends in ' + leftText(ev.endsAt - date.getTime())); setText($('ev-desc'), ev.desc); }
    else if (nx_) { setText($('ev-name'), 'Next: ' + nx_.name); setText($('ev-time'), 'In ' + leftText(nx_.startsAt - date.getTime())); setText($('ev-desc'), nx_.desc); }
    es.hidden = !ev && !nx_;
    const sb = $('supply-btn'); sb.disabled = !can; setText(sb, can ? 'Claim ' + L.fmt(L.supplyReward(s, date)) : 'Collected');

    const mid = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const left = Math.max(0, Math.floor((mid - date) / 60000));
    setText($('reset'), Math.floor(left / 60) + 'h ' + (left % 60) + 'm left');
    const rew = L.missionReward(s);
    D.missions.forEach((m, i) => {
      const c = G.m[i], done = m.progress >= m.target;
      c.el.hidden = m.claimed; // claimed missions leave the list
      setText(c.text, L.missionText(m)); setFill(c.fill, 100 * m.progress / m.target);
      setText(c.meta, L.fmt(m.progress) + ' / ' + L.fmt(m.target) + '\nReward about ' + L.fmt(rew) + ' t');
      if (done) setBtn(c, true, 'Claim', '+' + L.fmt(rew));
      else setBtn(c, false, Math.floor(100 * m.progress / m.target) + '%', '');
    });
    const got = D.missions.filter((m) => m.claimed).length, all = got === 3, cr = L.chestReward(s);
    const md = $('mdone'); md.hidden = !all;
    if (all) setText(md, 'All done for today. New missions arrive at midnight.');
    G.cache.forEach((d, i) => d.classList.toggle('on', i < got));
    $('cache-dots').hidden = D.chest; // once opened, the 1 2 3 give way to the countdown
    $('cache-time').hidden = !D.chest;
    if (D.chest) setText($('cache-time'), 'Next in ' + Math.floor(left / 60) + 'h ' + (left % 60) + 'm');
    $('cache-dots').setAttribute('aria-label', got + ' of 3 missions claimed');
    setText($('cache-note'), D.chest
      ? 'Opened for today. The next one arrives at midnight.'
      : (all ? 'Ready to open.' : 'Claim all three missions to unlock it.') + ' Pays about ' + L.fmt(cr) + ' t and ×' + FRENZY_MULT + ' output for 60\u00a0s.');
    const cb = $('cache-btn'); cb.disabled = D.chest || !all;
    setText(cb, D.chest ? 'Opened' : all ? 'Open +' + L.fmt(cr) : 'Locked');

    updateAch(s);
    if (goalsFocus) { const f = goalsFocus; goalsFocus = null; spotlightReward(s, f); }
  }
  /** Scrolls to a commendation card and flashes it: the given chain's, or else the first with a reward waiting. */
  function spotlightReward(s, f) {
    const find = () => (f.chain ? achEls.find((e) => e.chain.id === f.chain) : achEls.find((e) => !e.btn.hidden));
    let e = find();
    if (!e && (f.chain || L.pendingGifts(s).count > 0)) { // the current view leaves it out: show every chain
      achView = 'type'; achKey = '';
      document.querySelectorAll('#achseg button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === 'type')));
      updateAch(s);
      e = find();
    }
    if (!e) return; // nothing waiting: stay at the top, where the daily rewards are
    e.root.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    e.root.classList.add('spot');
    setTimeout(() => e.root.classList.remove('spot'), 1800);
  }
  const resetAchList = () => { achKey = ''; freshAch.clear(); };

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
    const evNow = L.activeEvent(date), ep = $('evpill');
    ep.hidden = !evNow; if (evNow) { setText(ep, evNow.name); ep.title = evNow.desc; }
    const b = $('bonus'), bx = L.surveyMult(s) * L.achMult(s) * L.iapMult(s) - 1;
    if (bx >= 0.005) { b.hidden = false; setText(b, '+' + L.fmtPct(bx, 0) + ' bonus'); } else b.hidden = true;
    const fz = $('frenzy');
    if (L.frenzyOn(s, now)) { fz.hidden = false; setText(fz, '×' + FRENZY_MULT + ' for ' + Math.ceil(L.frenzyLeft(s, now)) + 's'); } else fz.hidden = true;
    updateOre(s);
    updateFleet(s); updatePod(s, date); updateUps(s);
    if (activeTab === 'goals') updateGoals(s, date);
    if (activeTab === 'shop') updateShop(s);
    updateBelt(s);
    $('b-ups').hidden = !L.visibleUps(s).some((u) => s.ore >= u.cost);
    $('b-goals').hidden = !(L.goalsReady(s, date) || (freshAch.size > 0 && activeTab !== 'goals'));
    $('b-belt').hidden = !(L.prestigeGain(s) >= 1 || L.journalCount(s) > s.journalSeen);
  }

  /* ---------- tabs and controls ---------- */
  const TABS = ['fleet', 'ups', 'goals', 'shop', 'belt'];
  function selectTab(name) {
    if (activeTab === 'goals' && name !== 'goals') { freshAch.clear(); achKey = ''; } // seen now
    if (name === 'goals') achKey = ''; // rebuild so "Next up" is current
    if (name === 'goals' && activeTab !== 'goals') goalsFocus = goalsFocus || { any: true }; // coming from another tab: look for waiting rewards
    const switching = name !== activeTab;
    activeTab = name;
    document.querySelectorAll('.nav button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    TABS.forEach((t) => { $('tab-' + t).hidden = t !== name; });
    if (switching && name !== 'fleet') $('tab-' + name).scrollTop = 0; // Fleet keeps its place; the others start at the top (Goals then jumps to a waiting reward)
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
    document.querySelectorAll('#achseg button').forEach((b) => b.addEventListener('click', () => {
      achView = b.dataset.v; achKey = '';
      document.querySelectorAll('#achseg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      h.onRefresh();
    }));
    $('snd').addEventListener('click', h.onToggleSound);
    $('mus').addEventListener('click', h.onToggleMusic);
    $('hap').addEventListener('click', h.onToggleHaptics);
    $('wel-ok').addEventListener('click', closeWelcome);
    $('toast').addEventListener('click', nextToast);
    $('achpop').addEventListener('click', () => {
      const item = achShown;
      hideAchPop();
      closeJournal();
      goalsFocus = item && item.chain ? { chain: item.chain } : { any: true };
      if (activeTab !== 'goals') selectTab('goals');
      h.onRefresh();
    });
    $('journal-open').addEventListener('click', openJournal);
    $('journal-close').addEventListener('click', closeJournal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeJournal(); });
    if (h.version) setText($('version'), h.version);
    $('pod-btn').addEventListener('click', () => h.onWatchPod());
    $('offer-go').addEventListener('click', () => { if (offerGo) offerGo(); });
    $('offer-x').addEventListener('click', hideOffer);
    if (h.onOpenAdPrivacy) $('adprivacy').addEventListener('click', h.onOpenAdPrivacy);
    if (h.onToggleNotify) { $('notify-row').hidden = false; $('notify').addEventListener('click', h.onToggleNotify); }
  }

  return {
    init, update, updateOre, toast, achPop, closeJournal, closeOverlay, showWelcome, setWelcomeOffer, welcomeDoubled, welcomeOpen, showOffer, hideOffer, markNew, setShopVisible, setAdPrivacy: (on) => { $('adprivacy-row').hidden = !on; }, selectTab, resetUpgradeList, resetAchList,
    activeTab: () => activeTab,
  };
}
