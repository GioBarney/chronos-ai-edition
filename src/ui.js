'use strict';
/* ---------- UI ---------- */
let toastT = 0;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3600); }

function parseSegs(str) { const out = []; const re = /\{\{(.+?)\|(.+?)\}\}/g; let m, i = 0;
  while ((m = re.exec(str))) { if (m.index > i) out.push({ v: str.slice(i, m.index) }); out.push({ v: m[1], alt: m[2] }); i = re.lastIndex; }
  if (i < str.length) out.push({ v: str.slice(i) }); return out; }
let typing = null;
function typeInto(el, body, instant) {
  if (typing) typing.finish();
  el.innerHTML = ''; const q = [];
  body.split('\n\n').forEach(pt => { const p = document.createElement('p'); el.appendChild(p); parseSegs(pt).forEach(seg => q.push({ p, seg })); });
  let qi = 0, ci = 0, node = null, timer = 0, done = false;
  const one = () => { const it = q[qi]; if (!it) return false;
    if (it.seg.alt) { const sp = document.createElement('span'); sp.className = 'flick'; sp.dataset.v = it.seg.v; sp.dataset.alt = it.seg.alt; sp.textContent = it.seg.v; it.p.appendChild(sp); qi++; return true; }
    if (!node) { node = document.createTextNode(''); it.p.appendChild(node); }
    node.data += it.seg.v[ci++]; if (ci >= it.seg.v.length) { qi++; ci = 0; node = null; } return true; };
  const finish = () => { if (done) return; done = true; clearTimeout(timer); while (one()); typing = null; };
  const step = () => { if (!one()) { finish(); return; } timer = setTimeout(step, 18); };
  typing = { finish };
  if (instant || reduced) finish(); else step();
}
setInterval(() => { document.querySelectorAll('.flick').forEach(sp => {
  if (Math.random() < 0.35) { sp.textContent = sp.dataset.alt; sp.classList.add('on');
    setTimeout(() => { sp.textContent = sp.dataset.v; sp.classList.remove('on'); }, 110); } }); }, 6000);

function openModal({ eyebrow, title, body, actions, instant }) {
  $('mEye').textContent = eyebrow; $('mTitle').textContent = title;
  typeInto($('mBody'), body, instant);
  const a = $('mActions'); a.innerHTML = '';
  actions.forEach(([label, fn, cls]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.onclick = () => { if (typing) typing.finish(); fn(); }; a.appendChild(b); });
  $('modal').hidden = false; endHold();
  setTimeout(() => a.lastElementChild && a.lastElementChild.focus(), 30);
}
function closeModal() { if (typing) typing.finish(); $('modal').hidden = true; }
$('mBody').addEventListener('click', () => typing && typing.finish());
function openLog(n, fresh) {
  const L = LOGS[n];
  openModal({ eyebrow: n === 0 ? 'Operator log' : 'Decoded transmission', title: L.title, body: L.body, instant: !fresh,
    actions: [[n === 0 && !s.seenIntro ? 'Power on receiver' : 'Back to the dial', () => {
      if (n === 0 && !s.seenIntro) { s.seenIntro = true; ensureAudio(); sfx.power(); save(); }
      closeModal(); }]] });
}
function weekEnd() {
  openModal({ eyebrow: 'End of the Week 1 slice', title: 'The array wants more power',
    body: "The tape recorder is running. For the first time, Hollow Ridge listens without you.\n\nWeek 2 brings battery banks, solar mirrors and probe relays, along with the heat they come with.\n\nYour run keeps going. Check back tomorrow and see what the tape caught.",
    actions: [['Keep listening', closeModal]] });
}

function renderDecode(now) {
  const el = $('decode');
  $('pcount').textContent = `${s.packet} / ${PACKETS.length} packets`;
  if (s.packet >= PACKETS.length) {
    el.innerHTML = '<div class="name">All Week 1 packets recovered</div><div class="meta">' +
      (s.up.tape ? 'The tape recorder keeps capturing while you’re away.' : 'Build the tape recorder on the parts bench to finish Week 1.') + '</div>';
    return;
  }
  if (s.decode) {
    const P = PACKETS[s.decode.idx], left = (s.decode.endAt - now) / 1000, pct = clamp(1 - left / P.secs, 0, 1) * 100;
    el.innerHTML = `<div class="name">Decoding ${pid(s.decode.idx + 1)}</div>
      <div class="prog"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="meta">${dur(left)} left. Keeps decoding while the game is closed.</div>`;
    return;
  }
  const pc = pCost(s.packet), ps = pSecs(s.packet), can = s.photons >= pc;
  if (el.dataset.k !== 'ready' + s.packet + can + s.free) {
    el.dataset.k = 'ready' + s.packet + can + s.free;
    el.innerHTML = `<div class="name">${pid(s.packet + 1)}</div>
      <div class="meta">${s.free ? 'Test mode: free and instant.' : `Needs ${fmt(pc)} photons. Decoding takes ${dur(ps)} of real time.`}</div>
      <button class="btn" id="decBtn" type="button" ${can ? '' : 'disabled'}>${can ? 'Begin decode' : 'Not enough photons'}</button>`;
    $('decBtn').onclick = () => { const c2 = pCost(s.packet);
      if (s.decode || s.photons < c2) return;
      s.photons -= c2; s.decode = { idx: s.packet, endAt: Date.now() + pSecs(s.packet) * 1000 }; el.dataset.k = ''; sfx.buy(); save(); };
  }
}
function renderUps() {
  const list = UPG.filter(u => u.unlock());
  const sig = list.map(u => u.id).join(',');
  const box = $('ups');
  if (sig !== rt.upSig) { rt.upSig = sig; box.innerHTML = '';
    list.forEach(u => { const b = document.createElement('button'); b.type = 'button'; b.className = 'up'; b.id = 'up-' + u.id;
      b.innerHTML = `<span><span class="un"></span> <span class="ul"></span></span><span class="uc"></span><span class="ud"></span>`;
      b.onclick = () => { const c = cost(u); if (s.up[u.id] >= u.max || s.photons < c) return;
        s.photons -= c; s.up[u.id]++; sfx.buy(); save(); renderUps();
        if (u.id === 'tape' && !s.weekDone) { s.weekDone = true; save(); weekEnd(); } };
      box.appendChild(b); });
    $('teaser').hidden = UPG.every(u => u.unlock());
  }
  list.forEach(u => { const b = $('up-' + u.id); if (!b) return;
    const lvl = s.up[u.id], maxed = lvl >= u.max, c = cost(u);
    b.querySelector('.un').textContent = u.name;
    b.querySelector('.ul').textContent = u.max > 1 ? `${lvl}/${u.max}` : (maxed ? 'Built' : '');
    b.querySelector('.ud').textContent = u.desc();
    b.querySelector('.uc').textContent = maxed ? 'Done' : fmt(c) + ' ph';
    b.disabled = maxed || s.photons < c; b.classList.toggle('maxed', maxed); });
}
function renderLogs() {
  if (rt.logSig === s.packet) return; rt.logSig = s.packet;
  const box = $('logs'); box.innerHTML = '';
  for (let i = s.packet; i >= 0; i--) { const L = LOGS[i]; const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="t"></span><span class="s"></span>`; b.querySelector('.t').textContent = L.title; b.querySelector('.s').textContent = L.short; b.insertAdjacentHTML('afterbegin', texImgHTML('pkt_' + Math.min(i, 6), L.title, 'signal')); if (/\|0x|137\.036/.test(L.body)) b.classList.add('hex-clue-row');
    b.onclick = () => openLog(i, false); box.appendChild(b); }
  $('lcount').textContent = `${s.packet + 1} ${s.packet ? 'entries' : 'entry'}`;
}
function updateUI(info, now) {
  const day = Math.floor((now - s.startedAt) / 86400e3) + 1;
  $('sub').textContent = `Hollow Ridge Array · Day ${day} · Week 1`;
  $('clar').textContent = s.clarity.toFixed(2) + '%';
  $('pho').textContent = fmt(s.photons);
  $('rate').innerHTML = fmt1(rt.rate) + '<small>/s</small>';
  $('temp').innerHTML = (18 + s.heat * 1.02).toFixed(0) + '<small>K</small>';
  $('heatbar').style.width = s.heat.toFixed(1) + '%';
  $('freq').innerHTML = s.tuned.toFixed(3) + '<small>MHz</small>';
  knob.setAttribute('aria-valuenow', s.tuned.toFixed(3));
  knob.classList.toggle('locked', info.locked);
  const led = $('led');
  if (info.tripped) { led.dataset.s = 'trip'; led.textContent = `Burned out · ${dur((s.tripUntil - now) / 1000)}`; }
  else if (rt.limiterCut) { led.dataset.s = 'limit'; led.textContent = 'Limiter · cooling'; }
  else if (info.locked) { led.dataset.s = 'locked'; led.textContent = 'Locked'; }
  else if (info.receiving) { led.dataset.s = 'search'; led.textContent = 'Searching'; }
  else { led.dataset.s = 'idle'; led.textContent = 'Idle · hold the dial'; }
  const gb = $('glintBtn'), gl = s.glint && now <= s.glint.until;
  gb.hidden = !gl;
  if (gl) gb.textContent = `${s.glint.kind === 'surge' ? 'Catch the glint · ×3 photons' : 'Catch the glint · clear the noise'} · ${dur((s.glint.until - now) / 1000)}`;
  const st = $('surgeTag'); st.hidden = !surgeOn(now);
  if (surgeOn(now)) st.textContent = `Photon surge ×${SURGE_MUL} · ${dur((s.surgeUntil - now) / 1000)}`;
  $('limrow').hidden = s.packet < 2;
  $('lim').setAttribute('aria-checked', String(!s.limiterOff));
  if (s.packet >= 7 && !s.funded && $('modal').hidden) {
    s.funded = true; s.money += 50000 + (s.pendingLoopMoney || 0); s.pendingLoopMoney = 0; sfx.decoded(); save();
    openModal({ eyebrow: 'Grant awarded', title: '$50,000 from the university',
      body: "The board read your Week 1 logs. Nobody believes it's what you think it is, but nobody can explain it either.\n\nThey've approved $50,000 for equipment. That's enough for your first data logger, which collects photons without you on the dial.\n\nKeep the money coming with papers, grant applications and your daily stipend.",
      actions: [['Buy equipment', () => { closeModal(); $('fundPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); }]] });
  }
  syncBuild3Visuals(info);
  syncBuild9Cues();
  processPaydays(now); resolveCrew(now); autoCrew();
  if (s.funded && !s.chequeMet && (s.heat >= 80 || rt.limiterCut || info.tripped) && $('modal').hidden) chequeArrives();
  resolveFunding(now);
  renderCrew(now);
  renderFunding(now);
  renderStations();
  renderDecode(now); renderDailyTx(now); renderPhase(); renderEndings(); renderEchoes(); renderUps(); renderLogs();
  if (!$('dev').hidden) $('devkv').textContent = `test mode ${s.free ? 'on' : 'off'} · caution ${s.caution.toFixed(1)} · risk ${s.risk.toFixed(1)} · target ${info.tgt.toFixed(4)} MHz · window ±${(info.band * 1000).toFixed(1)} kHz`;
  syncBuild12Visuals();
  syncBuild10Visuals(); // after all renders so it reads this frame's DOM and post-payday state
}
function buildStations() {
  const box = $('stations'); box.innerHTML = ''; rt.stEl = {};
  STATIONS.forEach(st => {
    const row = document.createElement('div'); row.className = 'st'; row.style.setProperty('--c', `var(--${st.color})`);
    row.innerHTML = `<button class="st-run" type="button"></button><div class="st-main"><div class="st-top"><span class="st-name"></span><span class="st-ms"></span></div><div class="st-pips" aria-hidden="true"></div><button class="st-bar" type="button"><i></i><span class="st-pay"></span><span class="st-time"></span></button></div><div class="st-acts"><button class="btn st-buy" type="button"></button><button class="btn ghost st-up" type="button"></button></div>`;
    const e = { row, circ: row.querySelector('.st-run'), name: row.querySelector('.st-name'), ms: row.querySelector('.st-ms'), pips: row.querySelector('.st-pips'), bar: row.querySelector('.st-bar'),
      fill: row.querySelector('.st-bar i'), pay: row.querySelector('.st-pay'), time: row.querySelector('.st-time'), buy: row.querySelector('.st-buy'), up: row.querySelector('.st-up'), acts: row.querySelector('.st-acts') };
    e.name.textContent = st.name; e.name.insertAdjacentHTML('afterbegin', texImgHTML('st_' + st.id, st.name, st.color)); e.circ.setAttribute('aria-label', 'Run ' + st.name);
    e.circ.onclick = () => runStation(st); e.bar.onclick = () => runStation(st); e.buy.onclick = () => buyStation(st); e.up.onclick = () => upgradeStation(st);
    rt.stEl[st.id] = e; box.appendChild(row);
  });
}
function runStation(st) { const i = STATIONS.indexOf(st), o = s.st[st.id]; if (!o.n || o.run || !stOpen(i)) return; ensureAudio(); o.run = true; sfx.click(); }
function buyStation(st) {
  const o = s.st[st.id], k = buyCount(st), c = costN(st, k);
  if (!stOpen(STATIONS.indexOf(st)) || s.money < c || (s.buyMode === 'max' && !s.free && maxAfford(st) === 0)) return;
  const before = msCount(o.n); s.money -= c; o.n += k; ensureAudio(); sfx.buy();
  if (msCount(o.n) > before) { sfx.lock(); toast(`${st.name} reached ${MILESTONES[msCount(o.n) - 1]}. It now runs twice as fast.`); }
  save();
}
function upgradeStation(st) {
  const c = upCost(st); if (s.stUp[st.id] >= 5 || !s.st[st.id].n || s.money < c) return;
  s.money -= c; s.stUp[st.id]++; ensureAudio(); sfx.buy(); sfx.lock(); toast(`${st.name} upgraded. Output \u00d73.`); save();
}
function renderStations() {
  $('stPanel').hidden = !s.funded; if (!s.funded) return;
  let est = 0;
  $('buyMode').textContent = s.buyMode === 'max' ? 'Buy Max' : `Buy \u00d7${s.buyMode}`;
  let teased = false;
  STATIONS.forEach((st, i) => { const e = rt.stEl[st.id], o = s.st[st.id];
    if (!stOpen(i)) {
      if (teased) { e.row.hidden = true; return; } teased = true;
      e.row.hidden = false; e.row.classList.add('locked'); e.circ.textContent = '?'; e.circ.disabled = true; e.bar.disabled = true;
      e.ms.textContent = ''; e.pay.textContent = `Own a ${STATIONS[i - 1].name.toLowerCase()} to unlock`; e.time.textContent = ''; e.bar.classList.remove('idle'); e.acts.hidden = true; return;
    }
    e.row.hidden = false; e.row.classList.remove('locked'); e.circ.disabled = !o.n; e.bar.disabled = !o.n; e.acts.hidden = false;
    e.circ.textContent = o.n;
    if (o.n) est += payout(st) / cycleSecs(st);
    const nm = nextMs(o.n); e.pips.innerHTML = milestonePipsHTML(o.n); e.ms.textContent = nm ? `${o.n}/${nm} for 2\u00d7 speed` : 'Max speed';
    const k = buyCount(st), c = costN(st, k);
    e.buy.textContent = `Buy \u00d7${k} \u00b7 ${money(c)}`;
    e.buy.disabled = s.money < c || (s.buyMode === 'max' && !s.free && maxAfford(st) === 0);
    const ul = s.stUp[st.id];
    e.up.hidden = !o.n || ul >= 5;
    if (!e.up.hidden) { const uc = upCost(st); e.up.textContent = `\u00d73 \u00b7 ${money(uc)}`; e.up.disabled = s.money < uc; e.up.title = `Upgrade ${ul + 1} of 5: triples output`; }
    if (!o.n) { e.pay.textContent = 'Buy one to start'; e.time.textContent = ''; e.bar.classList.remove('idle'); }
    else { e.pay.textContent = '+' + big(payout(st)) + ' ph'; e.bar.classList.toggle('idle', !o.run);
      e.time.textContent = o.run ? dur((1 - o.p) * cycleSecs(st)) : 'Tap to run'; }
  });
  $('boostTag').textContent = est > 0 ? `Up to ${big(est)} photons/s when every station runs` : 'Stations collect photons on their own';
}
function resolveFunding(now) {
  if (s.paper && now >= s.paper.endAt) { const pay = s.paper.pay; s.money += pay; s.papers++; s.paper = null; sfx.cash(); toast(`Paper published. The journal paid ${money(pay)}.`); save(); }
  GRANTS.forEach(g => { const a = s.apps[g.id]; if (!a || now < a.endAt) return;
    if (a.ok) { s.money += a.amt; sfx.decoded(); toast(`${g.name} approved: ${money(a.amt)}.`); }
    else { sfx.warn(); toast(`${g.name} turned down your application.`); }
    delete s.apps[g.id]; save(); });
}
function buildGrants() {
  const box = $('grants'); box.innerHTML = ''; rt.gEl = {};
  GRANTS.forEach(g => { const row = document.createElement('div'); row.className = 'frow';
    row.innerHTML = `<div class="fi"><div class="fn"></div><div class="fm"></div></div><button class="btn ghost" type="button">Apply</button>`;
    row.querySelector('.fn').textContent = g.name;
    const btn = row.querySelector('button');
    btn.onclick = () => { if (Object.keys(s.apps).length) return; ensureAudio();
      s.apps[g.id] = { endAt: Date.now() + (s.free ? 0 : g.hrs * 3600e3), ok: Math.random() < grantChance(g), amt: grantAmt(g) };
      if (g.id === 'found') s.risk += 0.5; if (g.id === 'seed') s.caution += 0.2;
      sfx.click(); toast(`Application sent to ${g.name}.`); save(); };
    rt.gEl[g.id] = { meta: row.querySelector('.fm'), btn }; box.appendChild(row); });
}
function renderFunding(now) {
  $('fundLocked').hidden = s.funded; $('fundBody').hidden = !s.funded;
  $('repu').textContent = `Reputation ${repu().toFixed(1)}`;
  if (!s.funded) return;
  $('money').textContent = money(s.money);
  const day = dayNum(now), canStip = s.free || day > s.stipendDay;
  $('stipBtn').disabled = !canStip;
  $('stipBtn').textContent = canStip ? `Claim ${money(stipendAmt())}` : 'Claimed';
  $('stipMeta').textContent = canStip ? 'Your daily check is ready.' : `Next check in ${dur((s.startedAt + day * 86400e3 - now) / 1000)}.`;
  if (s.paper) {
    const left = (s.paper.endAt - now) / 1000, pct = s.paper.secs ? clamp(1 - left / s.paper.secs, 0, 1) * 100 : 100;
    $('paperMeta').textContent = `Writing paper ${s.papers + 1}. ${dur(left)} left. Pays ${money(s.paper.pay)}.`;
    $('paperProg').hidden = false; $('paperProg').firstElementChild.style.width = pct.toFixed(1) + '%';
    $('paperBtn').disabled = true; $('paperBtn').textContent = 'Writing';
  } else {
    const c = paperCost();
    $('paperMeta').textContent = `Uses ${fmt(c)} photons, takes ${dur(paperSecs())}, pays ${money(paperPay())}.`;
    $('paperProg').hidden = true; $('paperBtn').disabled = s.photons < c; $('paperBtn').textContent = s.photons < c ? 'Need photons' : 'Write';
  }
  const busy = Object.keys(s.apps).length > 0;
  GRANTS.forEach(g => { const e = rt.gEl[g.id], a = s.apps[g.id];
    if (a) { e.meta.textContent = `Under review. Answer in ${dur((a.endAt - now) / 1000)}.`; e.btn.disabled = true; e.btn.textContent = 'Pending'; }
    else if (busy) { e.meta.textContent = `${money(grantAmt(g))} \u00b7 ${Math.round(grantChance(g) * 100)}% approval \u00b7 ${g.hrs}h review. One application at a time.`; e.btn.disabled = true; e.btn.textContent = 'Apply'; }
    else { e.meta.textContent = `${money(grantAmt(g))} \u00b7 ${Math.round(grantChance(g) * 100)}% approval \u00b7 ${g.hrs}h review`; e.btn.disabled = false; e.btn.textContent = 'Apply'; } });
}
$('stipBtn').onclick = () => { const now = Date.now(); if (!s.funded || !(s.free || dayNum(now) > s.stipendDay)) return;
  const amt = stipendAmt(); s.money += amt; s.stipendDay = dayNum(now); ensureAudio(); sfx.cash(); toast(`Stipend received: ${money(amt)}.`); save(); };
$('paperBtn').onclick = () => { const c = paperCost(); if (s.paper || s.photons < c) return; ensureAudio();
  s.photons -= c; const secs = paperSecs(); s.paper = { endAt: Date.now() + secs * 1000, secs, pay: paperPay() }; sfx.buy(); save(); };
function renderStationBars() { if (!rt.stEl) return; STATIONS.forEach(st => { const o = s.st[st.id]; rt.stEl[st.id].fill.style.width = (o.run ? o.p * 100 : 0) + '%'; }); }
$('buyMode').onclick = () => { s.buyMode = s.buyMode === '1' ? '10' : s.buyMode === '10' ? 'max' : '1'; sfx.click(); save(); };

$('glintBtn').onclick = catchGlint;

/* ---------- council build 3: texture slots + UI instrumentation (PROP-009) ---------- */
// Brena's swappable art: drop assets/slots/<slot>.png to replace any placeholder, no code changes.
const TEX_COLORS = { signal: '#4fd8ff', ok: '#5ff2b4', heat: '#ffad4a', anomaly: '#ff5fa8' };
const makePlaceholderSVG = (label, color) => {
  const c = TEX_COLORS[color] || TEX_COLORS.signal, ch = String(label || '?').trim().charAt(0).toUpperCase().replace(/[<>&"']/g, '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#1a1f4a" stroke="${c}" stroke-width="3"/><circle cx="24" cy="24" r="9" fill="${c}" opacity=".25"/><text x="24" y="30" text-anchor="middle" font-family="sans-serif" font-size="17" fill="${c}">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
const texImgHTML = (slot, label, color) => {
  const fb = makePlaceholderSVG(label, color), safe = String(slot).replace(/[^\w-]/g, '');
  return `<img class="tex" alt="" width="22" height="22" src="assets/slots/${safe}.png" onerror="this.onerror=null;this.src=this.dataset.fb" data-fb="${fb}">`;
};
const milestonePipsHTML = n => MILESTONES.map(m => `<i class="${n >= m ? 'on' : ''}" title="${m} owned: 2\u00d7 speed"></i>`).join('');
function syncBuild3Visuals(info) {
  knob.dataset.state = info.tripped ? 'tripped' : info.locked ? 'locked' : info.receiving ? 'receiving' : 'idle';
}

/* daily transmissions (PROP-010) */
function renderDailyTx(now) {
  const box = $('dailyTxBox'), day = dayNum(now), ready = s.packet >= 1 && (s.free || day > s.dailyTxDay);
  box.hidden = s.packet < 1;
  if (box.hidden) return;
  const i = (s.dailyTxs || 0) % DAILY_TX.length;
  if (box.dataset.k !== i + '|' + ready) { box.dataset.k = i + '|' + ready;
    const t = DAILY_TX[i].replace(/\{(.+?)\|(.+?)\}/g, '$1');
    $('dtxText').textContent = ready ? t : 'Logged for today. The next fragment arrives tomorrow.'; box.classList.toggle('hex-clue-row', ready && /0x|137/.test(DAILY_TX[i])); }
  $('dtxBtn').disabled = !ready; $('dtxBtn').hidden = !ready;
}
$('dtxBtn').onclick = () => { const now = Date.now(); if (s.packet < 1 || !(s.free || dayNum(now) > s.dailyTxDay)) return;
  s.dailyTxDay = dayNum(now); s.dailyTxs = (s.dailyTxs || 0) + 1; ensureAudio(); sfx.lock();
  if (s.clarity < 90) { s.clarity = Math.min(100, s.clarity + DAILY_TX_CLARITY); toast(`Transmission logged. Signal clarity +${DAILY_TX_CLARITY}.`); }
  else { const p = Math.max(DAILY_TX_PHOTON_MIN, rt.rate * 600); s.photons += p; s.total += p; toast(`Transmission logged. +${big(p)} photons.`); }
  $('dailyTxBox').dataset.k = ''; save(); };

/* phase shifts (PROP-011) */
const PHASE_NAMES = ['', 'Phase I \u00b7 Lone Dish', 'Phase II \u00b7 Grant Array', 'Phase III \u00b7 Deep-Time Array'];
const canPhase3 = () => (s.phase || 1) === 2 && s.st.interf.n >= 1 && (s.free || (s.photons >= PHASE3_PHOTONS && s.money >= PHASE3_MONEY));
function renderPhase() {
  const ph = s.phase || 1; $('phaseTag').textContent = PHASE_NAMES[ph]; document.documentElement.dataset.phase = ph;
  const box = $('phaseShiftBox'); box.hidden = ph !== 2 || s.st.interf.n < 1; if (box.hidden) return;
  $('psText').textContent = `Spend ${big(PHASE3_PHOTONS)} photons and ${money(PHASE3_MONEY)} to bring the baseline online. All station cycles run 2\u00d7 faster and the endgame opens.`;
  $('psBtn').disabled = !canPhase3();
}
$('psBtn').onclick = () => { if (!canPhase3()) return; if (!s.free) { s.photons -= PHASE3_PHOTONS; s.money -= PHASE3_MONEY; }
  s.phase = 3; ensureAudio(); sfx.decoded(); toast('Phase III: the Deep-Time Array is online. Stations run 2\u00d7 faster.'); save(); renderPhase(); };

/* the four endings + run telemetry scorecard (PROP-012) */
const endingAvailable = e => ((s.phase || 1) >= 3 && e.id !== 'secret' || (e.id === 'secret' && s.packet >= 1)) && e.ok();
function scorecardText() {
  const days = Math.max(1, dayNum(Date.now()));
  return `Days: ${days}\nTotal photons: ${big(s.total)}\nPackets decoded: ${s.packet} / 7\nDaily transmissions: ${s.dailyTxs || 0}\nGlints caught: ${s.glints || 0}\nCrew: ${(s.crew || []).length}\nEchoes: ${s.echoes || 0}`;
}
function openEnding(e) {
  const first = !s.endingsSeen[e.id];
  if (!endingAvailable(e)) { // history view only: an ending seen in an earlier loop never counts as completed in this run
    openModal({ eyebrow: 'Ending \u00b7 ' + e.name + ' \u00b7 seen before', title: e.name, body: e.text, actions: [['Close', closeModal, 'primary']] });
    $('mTitle').insertAdjacentHTML('afterbegin', texImgHTML('ending_' + e.id, e.name, 'anomaly')); return;
  }
  openModal({ eyebrow: 'Ending \u00b7 ' + e.name, title: e.name, body: e.text + '\n\nRun telemetry\n' + scorecardText(),
    actions: [['Keep playing', () => { if (!endingAvailable(e)) return closeModal(); if (first) { s.endingsSeen[e.id] = Date.now(); s.echoes = (s.echoes || 0) + e.echoes; }
      s.loopReady = true; closeModal(); save(); $('endingsBox').dataset.k = ''; toast(first && e.echoes ? `+${e.echoes} Echo${e.echoes > 1 ? 'es' : ''} kept for a future loop.` : 'The run goes on. Nothing is lost.'); }, 'primary'],
      ['Restart the observatory (new loop)', () => { if (!endingAvailable(e)) return closeModal(); if (first) { s.endingsSeen[e.id] = Date.now(); s.echoes = (s.echoes || 0) + e.echoes; } s.loopReady = true; closeModal(); startNewLoop(); }],
      ['Not yet', closeModal]] });
  $('mBody').lastElementChild.classList.add('scorecard');
  $('mTitle').insertAdjacentHTML('afterbegin', texImgHTML('ending_' + e.id, e.name, 'anomaly'));
}
function renderEndings() {
  const box = $('endingsBox'), ph = s.phase || 1, secret = s.packet >= 1 && ENDINGS[3].ok();
  box.hidden = !(ph >= 3 || secret || Object.keys(s.endingsSeen || {}).length); if (box.hidden) return;
  const k = ENDINGS.map(e => (endingAvailable(e) ? 1 : 0) + (s.endingsSeen[e.id] ? 'S' : '')).join(',');
  if (box.dataset.k === k) return; box.dataset.k = k;
  $('endText').textContent = 'The run can end four ways. Ready endings are lit; the rest are hints.';
  const w = $('endBtns'); w.innerHTML = '';
  ENDINGS.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (s.endingsSeen[e.id] ? ' done' : '');
    const ready = endingAvailable(e); b.textContent = ready || s.endingsSeen[e.id] ? e.name : '???'; b.disabled = !ready && !s.endingsSeen[e.id]; b.title = ready ? 'Play this ending' : e.hint;
    b.onclick = () => openEnding(e); w.appendChild(b); });
}

/* echoes prestige + new game+ loop (PROP-013) */
function startNewLoop() {
  if (!s.loopReady) return;
  const keep = { mix: s.mix, echoes: (s.echoes || 0) + 1, echoSpent: s.echoSpent || 0, echoUp: s.echoUp || {}, endingsSeen: s.endingsSeen, loops: (s.loops || 0) + 1, seenIntro: true };
  s = Object.assign(fresh(), keep);
  s.photons = 500 * echoLv('memory'); s.total = s.photons;
  s.pendingLoopMoney = 25000 * echoLv('fund');
  rt.upSig = ''; rt.logSig = -1; rt.limiterCut = false; rt.cautionArmed = false; rt.openW = new Set(); rt.crewSig = '';
  $('decode').dataset.k = ''; $('endingsBox').dataset.k = ''; $('echoesBox').dataset.k = '';
  save(); toast(`Loop ${s.loops} begins. Week 1 again, and the signal remembers: +${Math.round(ECHO_BONUS * 100)}% output per Echo (now x${echoMul().toFixed(2)}).`);
}
function renderEchoes() {
  const tag = $('echoesTag'), box = $('echoesBox'), has = (s.echoes || 0) > 0 || (s.loops || 0) > 0, seen = !!s.loopReady;
  tag.hidden = !has; if (has) tag.textContent = `Loop ${s.loops || 0} \u00b7 ${s.echoes} Echo${s.echoes === 1 ? '' : 'es'} \u00b7 x${echoMul().toFixed(2)} output`;
  box.hidden = !(has || seen); if (box.hidden) return;
  $('loopBtn').hidden = !seen;
  const k = [s.echoes, s.echoSpent, s.loops, seen, s.loopReady, ECHO_UPG.map(u => echoLv(u.id)).join('')].join('|');
  if (box.dataset.k === k) return; box.dataset.k = k;
  $('echoText').textContent = `Echoes carry across loops: each one adds ${Math.round(ECHO_BONUS * 100)}% to photon and station output. ${echoFree()} to spend. A new loop unlocks each time you complete an ending in the current run; it resets the run to Week 1 and grants +1 Echo.`;
  const w = $('echoUpgs'); w.innerHTML = '';
  ECHO_UPG.forEach(u => { const lv = echoLv(u.id), maxed = lv >= ECHO_MAX_LV, c = echoCost(u.id), b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost'; b.disabled = maxed || echoFree() < c; b.title = u.desc(lv);
    b.textContent = maxed ? `${u.name} \u00b7 max` : `${u.name} ${lv}/${ECHO_MAX_LV} \u00b7 ${c} Echo${c > 1 ? 'es' : ''}`;
    b.onclick = () => { if (echoFree() < c || lv >= ECHO_MAX_LV) return; s.echoSpent += c; s.echoUp[u.id] = lv + 1; box.dataset.k = ''; save(); toast(u.desc(lv + 1).replace(/\(now .*\)\.?$/, '').trim()); };
    w.appendChild(b); });
}
$('loopBtn').onclick = () => openModal({ eyebrow: 'New loop', title: 'Begin a new loop?', body: 'The observatory resets to Week 1. You keep your Echoes, Echo upgrades and the endings you have seen.\n\nYou gain +1 Echo for the loop.',
  actions: [['Begin loop', () => { closeModal(); startNewLoop(); }, 'primary'], ['Not yet', closeModal]] });

// PROP-015 (council build 9): milestone, crew-arrival and payout micro-cues. Visual only, no save changes.
function pulseClass(el, cls, ms) {
  if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
function syncBuild9Cues() {
  if (!rt.stEl) return;
  const play = n => { try { if (typeof sfx !== 'undefined' && typeof sfx[n] === 'function') sfx[n](); } catch (e) {} };
  rt.lastMs = rt.lastMs || {};
  STATIONS.forEach(st => {
    const o = s.st[st.id], e = rt.stEl[st.id]; if (!o || !e) return;
    const c = msCount(o.n || 0);
    if (rt.lastMs[st.id] !== undefined && c > rt.lastMs[st.id]) { pulseClass(e.row, 'ms-tier-up', 1100); } // buyStation() already plays sfx.lock() here
    rt.lastMs[st.id] = c;
  });
  const cl = (s.crew || []).length, ib = (s.inbox || []).length;
  if (rt.lastCrewN !== undefined && (cl > rt.lastCrewN || ib > rt.lastInboxN)) {
    pulseClass($('crewList'), 'inbox-alert-pulse', 1400); pulseClass($('inbox'), 'inbox-alert-pulse', 1400); play('knock');
  }
  rt.lastCrewN = cl; rt.lastInboxN = ib;
  if (rt.lastMoney !== undefined && s.funded && s.money - rt.lastMoney >= 500) { pulseClass($('money'), 'cash-flash', 900); play('chips'); }
  rt.lastMoney = s.money;
}

// PROP-016 (council build 10): crew morale pips, payday shortfall warning, active timer bar shimmer. Visual only, no save changes.
function syncBuild10Visuals() {
  const list = $('crewList'), box = $('crewPanel');
  if (list && box) {
    // identity-safe: map each details.wk to its worker via the job select id (job-<worker id>), never array position
    list.querySelectorAll('details.wk').forEach(d => {
      const sel = d.querySelector('select[id^="job-"]'); if (!sel) return;
      const w = (s.crew || []).find(x => 'job-' + x.id === sel.id); if (!w) return;
      const m = Math.round(w.morale), lvl = (w.cheque || m >= 80) ? 'high' : m >= 50 ? 'mid' : 'low';
      let pip = d.querySelector('summary .morale-pip');
      if (!pip) { pip = document.createElement('i'); pip.className = 'morale-pip'; pip.setAttribute('role', 'img'); d.querySelector('summary .wn').prepend(pip); }
      if (pip.dataset.morale !== lvl) pip.dataset.morale = lvl;
      const t = `Morale ${m}%`; if (pip.title !== t) { pip.title = t; pip.setAttribute('aria-label', t); }
    });
    // actual wages due at the next payday (job listing fee only counts while listed); free mode never charges
    const due = s.free ? 0 : (s.crew || []).reduce((a, w) => a + w.wage, 0) + (s.listing ? 500 : 0);
    box.classList.toggle('payroll-warn', !!s.funded && due > 0 && s.money < due);
  }
  // shimmer only while a real task is running (and its bar is mid-fill)
  [['decode', !!s.decode], ['paperProg', !!s.paper]].forEach(([id, on]) => { const r = $(id); if (!r) return;
    r.querySelectorAll('.prog > i').forEach(i => { const w = parseFloat(i.style.width); i.classList.toggle('bar-active', on && w >= 0.2 && w <= 99.8); }); });
}

// PROP-018 (council build 12): station cycle progress sweep and Echo upgrade level badges. Visual only, no save changes.
function syncBuild12Visuals() {
  if (rt.stEl) STATIONS.forEach(st => { const o = s.st[st.id], e = rt.stEl[st.id]; if (!o || !e) return;
    let f = e.row.querySelector('.st-prog-fill');
    if (!o.n) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement('i'); f.className = 'st-prog-fill'; f.setAttribute('aria-hidden', 'true'); e.row.appendChild(f); }
    const hyper = o.run && cycleSecs(st) <= 0.25;
    f.classList.toggle('st-hyper', hyper);
    f.style.width = hyper ? '100%' : (o.run ? Math.min(100, o.p * 100) : 0) + '%'; });
  const w = $('echoUpgs'); if (!w) return;
  Array.from(w.children).forEach((b, i) => { const u = ECHO_UPG[i]; if (!u || b.querySelector('.echo-lv-badge')) return;
    const lv = echoLv(u.id), maxed = lv >= ECHO_MAX_LV, bd = document.createElement('span');
    bd.className = 'echo-lv-badge' + (maxed ? ' max' : ''); bd.textContent = maxed ? 'MAX' : `Lv ${lv}/${ECHO_MAX_LV}`; b.appendChild(bd); });
}
