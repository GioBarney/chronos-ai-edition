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
    b.innerHTML = `<span class="t"></span><span class="s"></span>`; b.querySelector('.t').textContent = L.title; b.querySelector('.s').textContent = L.short; b.insertAdjacentHTML('afterbegin', texImgHTML('pkt_' + Math.min(i, 6), L.title, 'signal')); if (/\|0x|137|1420\.336/.test(L.body)) b.classList.add('hex-clue-row');
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
  syncBuild13Visuals();
  syncBuild14Visuals();
  syncBuild15Visuals();
  syncBuild16Visuals(now);
  syncBuild17Visuals(info);
  syncBuild18Visuals(info);
  syncBuild19Visuals(info);
  syncBuild20Visuals(now);
  syncBuild21Visuals();
  syncBuild22Visuals();
  syncBuild23Visuals();
  syncBuild24Visuals();
  syncBuild26Visuals();
  syncBuild27Visuals(now);
  syncBuild28Visuals();
  syncBuild29Visuals();
  syncBuild30Visuals(now);
  syncBuild32Visuals(info);
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
    $('dtxText').textContent = ready ? t : 'Logged for today. The next fragment arrives tomorrow.'; box.classList.toggle('hex-clue-row', ready && /0x|137|1420\.336/.test(DAILY_TX[i])); }
  $('dtxBtn').disabled = !ready; $('dtxBtn').hidden = !ready;
}
$('dtxBtn').onclick = () => { const now = Date.now(); if (s.packet < 1 || !(s.free || dayNum(now) > s.dailyTxDay)) return;
  s.dailyTxDay = dayNum(now); s.dailyTxs = (s.dailyTxs || 0) + 1; ensureAudio(); sfx.lock();
  if (s.clarity < 90) { s.clarity = Math.min(100, s.clarity + DAILY_TX_CLARITY); toast(`Transmission logged. Signal clarity +${DAILY_TX_CLARITY}.`); }
  else { const p = Math.max(DAILY_TX_PHOTON_MIN, rt.rate * 600); s.photons += p; s.total += p; toast(`Transmission logged. +${big(p)} photons.`); }
  $('dailyTxBox').dataset.k = ''; save(); };

/* phase shifts (PROP-011) */
const PHASE_NAMES = ['', 'Phase I \u00b7 Lone Dish', 'Phase II \u00b7 Grant Array', 'Phase III \u00b7 Deep-Time Array'];
const canPhase3 = () => (s.phase || 1) === 2 && s.st.interf.n >= 1 && (s.free || (s.photons >= PHASE3_PHOTONS && s.money >= PHASE3_MONEY && (s.dailyTxs || 0) >= PHASE3_TX)); // PROP-019: test mode also waives the transmission count
function renderPhase() {
  const ph = s.phase || 1; $('phaseTag').textContent = PHASE_NAMES[ph]; document.documentElement.dataset.phase = ph;
  const box = $('phaseShiftBox'); box.hidden = ph !== 2; if (box.hidden) return; // PROP-020 review: visible all of Phase II so the readiness pill guides the Interferometer step; button stays gated by canPhase3()
  $('psText').textContent = `Spend ${big(PHASE3_PHOTONS)} photons and ${money(PHASE3_MONEY)} to bring the baseline online. All station cycles run 2\u00d7 faster and the endgame opens.` + (s.free || (s.dailyTxs || 0) >= PHASE3_TX ? '' : ` The array also needs ${PHASE3_TX} logged Daily Transmissions (${s.dailyTxs || 0} so far).`);
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

// PROP-020 (council build 13): Phase III readiness pill. Visual only, no save changes.
function syncBuild13Visuals() {
  const box = $('phaseShiftBox'); if (!box || box.hidden) return;
  let pill = box.querySelector('.ps-ready-pct');
  if (!pill) { pill = document.createElement('span'); pill.className = 'ps-ready-pct'; box.querySelector('.label').appendChild(pill); }
  const r = s.free ? 1 : Math.min(1, s.photons / PHASE3_PHOTONS), m = s.free ? 1 : Math.min(1, s.money / PHASE3_MONEY), i = s.st.interf.n >= 1 ? 1 : 0;
  const tx = s.free ? 1 : Math.min(1, (s.dailyTxs || 0) / PHASE3_TX); // PROP-019
  const pct = Math.floor((r + m + i + tx) / 4 * 100);
  const txN = Math.max(0, Math.min(PHASE3_TX, Math.floor(s.dailyTxs) || 0));
  const txt = pct + '% ready' + (s.free || (s.phase || 1) !== 2 ? '' : ` \u00b7 ${txN}/${PHASE3_TX} TX`); // PROP-040 (council build 33); title set by syncBuild26Visuals (PROP-032)
  if (pill.textContent !== txt) pill.textContent = txt;
  pill.classList.toggle('ps-ready-full', pct >= 100); // PROP-021
}

// PROP-021 (council build 14): endings collection counter. Counts real seen ending IDs. Visual only, no save changes.
function syncBuild14Visuals() {
  const box = $('endingsBox'); if (!box || box.hidden) return;
  let pill = box.querySelector('.endings-seen-pill');
  if (!pill) { pill = document.createElement('span'); pill.className = 'endings-seen-pill'; box.querySelector('.label').appendChild(pill); }
  const seen = ENDINGS.filter(e => s.endingsSeen && s.endingsSeen[e.id]).length;
  pill.textContent = seen + ' / ' + ENDINGS.length + ' seen'; pill.title = 'Endings you have played';
  pill.classList.toggle('all-seen', seen >= ENDINGS.length);
}

// PROP-024 (council build 17): receiver heat danger-zone pulse and limiter/burnout tooltip. Visual only, no save changes.
function syncBuild17Visuals(info) {
  const t = $('temp'), b = $('heatbar'); if (!t || !b) return;
  const tripped = Boolean(info && info.tripped), h = Number.isFinite(s.heat) ? s.heat : 0;
  const danger = tripped || h >= 75;
  t.classList.toggle('heat-danger', danger); b.classList.toggle('heat-danger', danger);
  if (!danger) { t.removeAttribute('title'); return; }
  const k = Math.round(18 + h * 1.02);
  t.title = tripped ? 'Receiver tripped \u2014 cooling down to reset threshold'
    : s.limiterOff ? `High heat (${k} K) \u2014 limiter off: burnout risk above 85`
    : `High heat (${k} K) \u2014 safety limiter active at 85`;
}

// PROP-025 (council build 18): signal clarity peak-lock highlight and threshold tooltip. Visual only, no save changes.
// PROP-026 (council build 19): frequency readout highlights when tuned on the 1420.405 MHz hydrogen-line carrier; tooltip stays spoiler-free. Visual only, no save changes.
function syncBuild19Visuals(info) {
  const f = $('freq'); if (!f) return;
  const on = !Boolean(info && info.tripped) && Number.isFinite(s.tuned) && Math.abs(s.tuned - HLINE) <= 0.004;
  f.classList.toggle('freq-locked', on);
  if (!on) { f.removeAttribute('title'); return; }
  f.title = 'Locked on the hydrogen line (H I, 1420.405 MHz), the quiet 21 cm hum of cold gas between the stars.' + ((s.dailyTxs || 0) >= 3 ? ' The band is wider than this one carrier.' : '');
}
function syncBuild18Visuals(info) {
  const c = $('clar'), bar = $('clarbar') || $('clarBar'); if (!c) return;
  const tripped = Boolean(info && info.tripped), v = s.clarity;
  const peak = !tripped && Number.isFinite(v) && v >= 90;
  c.classList.toggle('clarity-peak', peak); if (bar) bar.classList.toggle('clarity-peak', peak);
  if (!peak) { c.removeAttribute('title'); return; }
  const pc = v.toFixed(1) + '%';
  c.title = v >= 95 ? `Peak clarity (${pc}) \u2014 Ouroboros threshold met (at least 95%) and Daily TX photon bonus active (at least 90%)`
    : `High clarity (${pc}) \u2014 Daily TX photon bonus active (at least 90%); Ouroboros threshold at 95%`;
}

// PROP-029 (council build 22): crew roster assignment summary tooltip on the payroll label, plus a soft hint on the crew panel while a worker is unassigned. Visual only, no save changes.
function syncBuild22Visuals() {
  const box = $('crewPanel'), pay = $('payroll'); if (!box || !pay) return;
  const crew = Array.isArray(s.crew) ? s.crew : [];
  const idle = crew.filter(w => !w.job).length, work = crew.length - idle;
  box.classList.toggle('crew-idle-hint', !!s.funded && idle > 0);
  if (!crew.length) { pay.removeAttribute('title'); return; }
  const wage = crew.reduce((a, w) => a + (Number.isFinite(w.wage) ? w.wage : 0), 0);
  const t = `Crew: ${work} assigned, ${idle} unassigned \u00b7 wages ${money(wage)}/day` + (idle ? ' \u2014 unassigned crew still draw wages; open a worker to give them a job' : '');
  if (pay.title !== t) pay.title = t;
}

// PROP-028 (council build 21): progress tooltips on the decoder count, funding reputation (papers) and daily transmission box. Visual only, no save changes.
// The proposal named #pkts/#papers; the real elements are #pcount (packets decoded) and the "Write a paper" row name #paperName (reputation label left untouched).
function syncBuild21Visuals() {
  const set = (el, txt) => { if (!el) return; if (txt) { if (el.title !== txt) el.title = txt; } else el.removeAttribute('title'); };
  const n = Math.max(0, Math.min(PACKETS.length, Math.floor(s.packet) || 0));
  set($('pcount'), n >= 1 ? `Signal packets decoded: ${n} / ${PACKETS.length}` + (n >= PACKETS.length ? ' \u2014 the whole transmission is in' : ' (each decode opens a new log and part)') : '');
  const p = Math.max(0, Math.floor(s.papers) || 0);
  set($('paperName'), p >= 5 ? `Published papers: ${p} \u2014 Bureaucrat ending paper threshold met (5+ papers)`
    : p >= 1 ? `Published papers: ${p} / 5 toward Bureaucrat ending threshold (each paper also raises reputation)` : '');
  const d = Math.max(0, Math.floor(s.dailyTxs) || 0), bonus = '(90%+ Clarity grants 10-min photon bonus)';
  set($('dailyTxBox'), (s.endingsSeen && s.endingsSeen.secret) ? `Daily Transmissions logged: ${d} \u2014 1420.336 MHz harmonic corridor archived ${bonus}`
    : d >= 3 ? `Daily Transmissions logged: ${d} \u2014 deep-band harmonic ephemeris unlocked in operator logs ${bonus}`
    : `Daily Transmissions logged: ${d} / 3 toward deep-band harmonic ephemeris notes ${bonus}`);
}

// PROP-027 (council build 20): live percent-complete and time-left tooltips on active decode, paper and grant progress. Visual only, no save changes.
// The grant list has no bar element, so its tooltip goes on the grant row (duration derived from the grant's review hours).
function syncBuild20Visuals(now) {
  const tip = (el, label, left, total) => { if (!el) return;
    const pct = total > 0 ? clamp(1 - left / total, 0, 1) * 100 : NaN;
    if (!(pct >= 0.2 && pct <= 99.8)) { el.removeAttribute('title'); return; }
    el.title = `${label}: ${Math.floor(pct)}% complete (~${dur(left)} remaining)`; };
  const dp = document.querySelector('#decode .prog');
  if (dp) { if (s.decode && PACKETS[s.decode.idx]) tip(dp, 'Packet decode', (s.decode.endAt - now) / 1000, PACKETS[s.decode.idx].secs); else dp.removeAttribute('title'); }
  const pp = $('paperProg');
  if (pp) { if (s.paper) tip(pp, 'Paper draft', (s.paper.endAt - now) / 1000, s.paper.secs); else pp.removeAttribute('title'); }
  GRANTS.forEach(g => { const e = rt.gEl && rt.gEl[g.id], a = s.apps && s.apps[g.id]; if (!e || !e.meta) return;
    const row = e.meta.closest('.frow') || e.meta; // not the disabled button: disabled buttons don't show hover tooltips
    if (a) tip(row, 'Grant application', (a.endAt - now) / 1000, g.hrs * 3600); else row.removeAttribute('title'); });
}

// PROP-023 (council build 16): final-10s warning cue on the active photon surge tag. Visual only, no save changes.
function syncBuild16Visuals(now) {
  const st = $('surgeTag'); if (!st) return;
  const on = Number.isFinite(s.surgeUntil) && s.surgeUntil > now;
  const rem = on ? Math.ceil((s.surgeUntil - now) / 1000) : 0;
  st.classList.toggle('surge-ending', on && rem <= 10);
  if (on) st.title = `Photon surge ends in ${rem}s`; else st.removeAttribute('title');
}

// PROP-022 (council build 15): each owned station shows its percentage share of total station output (payout per cycle second). Visual only, no save changes.
function syncBuild15Visuals() {
  if (!rt.stEl) return;
  const out = {}; let tot = 0;
  STATIONS.forEach(st => { const o = s.st[st.id]; if (!o || !o.n) return; const c = cycleSecs(st), p = payout(st);
    if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p < 0) return;
    const v = p / c; if (!Number.isFinite(v) || v < 0) return; out[st.id] = v; tot += v; });
  if (!Number.isFinite(tot) || tot <= 0) { tot = 0; for (const k in out) delete out[k]; }
  STATIONS.forEach(st => { const e = rt.stEl[st.id]; if (!e) return;
    let b = e.row.querySelector('.st-share-pct');
    if (!(st.id in out) || tot <= 0) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'st-share-pct'; e.ms.after(b); }
    const pct = Math.round(out[st.id] / tot * 100), txt = pct + '%';
    if (b.textContent !== txt) { b.textContent = txt; b.title = 'Share of total station output: ' + txt; }
    b.classList.toggle('st-share-lead', pct >= 50); });
}

// PROP-030 (council build 23): station milestone strip hover shows progress, speed multiplier and units to the next tier. Visual only, no save changes.
function syncBuild23Visuals() {
  if (!rt.stEl) return;
  STATIONS.forEach(st => { const e = rt.stEl[st.id], o = s.st[st.id]; if (!e || !e.ms) return;
    const n = o && Number.isFinite(o.n) ? o.n : 0;
    if (n < 1) { e.ms.removeAttribute('title'); e.ms.classList.remove('st-ms-max'); return; }
    const c = msCount(n), nm = nextMs(n), mult = Math.pow(2, c);
    const txt = nm ? `Milestones: ${c} / ${MILESTONES.length} complete (\u00d7${mult} speed) \u00b7 Next \u00d72 tier at ${nm} owned (${nm - n} more needed)`
      : `Milestones: ${MILESTONES.length} / ${MILESTONES.length} complete (\u00d7${mult} speed) \u00b7 Max tier reached (${MILESTONES[MILESTONES.length - 1]}+ owned)`;
    if (e.ms.title !== txt) e.ms.title = txt;
    e.ms.classList.toggle('st-ms-max', !nm); });
}

// PROP-031 (council build 24): Echo prestige multiplier and echo upgrade rank tooltips. Visual only, no save changes.
function syncBuild24Visuals() {
  const setT = (el, v) => { if (!el) return; if (!v) { if (el.hasAttribute('title')) el.removeAttribute('title'); } else if (el.title !== v) el.title = v; };
  const E = Number.isFinite(s.echoes) ? s.echoes : 0, L = Number.isFinite(s.loops) ? s.loops : 0;
  setT($('echoesTag'), E >= 1 || L >= 1 ? `Echoes: ${E} (+${Math.round(E * ECHO_BONUS * 100)}% output, x${echoMul().toFixed(2)} multiplier) \u00b7 Completed loops: ${L}` : '');
  const box = $('echoesBox'), w = $('echoUpgs'); if (!box || !w) return;
  let ranks = 0; const total = ECHO_UPG.length * ECHO_MAX_LV;
  ECHO_UPG.forEach(u => { ranks += Math.min(ECHO_MAX_LV, echoLv(u.id)); });
  Array.from(w.children).forEach((b, i) => { const u = ECHO_UPG[i]; if (!u) return;
    const lv = Math.min(ECHO_MAX_LV, echoLv(u.id));
    setT(b, lv >= ECHO_MAX_LV ? `Echo upgrade: ${u.name} \u2014 Rank ${lv} / ${ECHO_MAX_LV} (MAXED)`
      : `Echo upgrade: ${u.name} \u2014 Rank ${lv} / ${ECHO_MAX_LV} (Cost: ${echoCost(u.id)} Echo \u00b7 Available: ${echoFree()})\n${u.desc(lv)}`); });
  setT(box, ranks >= total ? `Echo upgrades: ${total} / ${total} total ranks unlocked (all maxed)` : `Echo upgrades: ${ranks} / ${total} total ranks unlocked`);
  box.classList.toggle('echo-all-max', ranks >= total);
}

// PROP-032 (council build 26): Phase tag status tooltip and Phase III per-gate breakdown. Visual only, no save changes.
// Test mode (s.free) waives the photon and money costs (and the PROP-019 transmission count) but never the Interferometer gate, matching canPhase3().
function syncBuild26Visuals() {
  const setT = (el, v) => { if (!el) return; if (!v) { if (el.hasAttribute('title')) el.removeAttribute('title'); } else if (el.title !== v) el.title = v; };
  const ph = s.phase || 1, box = $('phaseShiftBox');
  const P = Number.isFinite(s.photons) ? Math.max(0, s.photons) : 0, M = Number.isFinite(s.money) ? Math.max(0, s.money) : 0;
  const I = s.st && s.st.interf && Number.isFinite(s.st.interf.n) ? s.st.interf.n : 0;
  const TX = Number.isFinite(s.dailyTxs) ? Math.max(0, s.dailyTxs) : 0;
  let tag = '';
  if (ph >= 3) tag = `${PHASE_NAMES[3]} active \u2014 all station cycles run \u00d72 faster`;
  else if (ph === 2) tag = `${PHASE_NAMES[2]} (\u00d71 station speed) \u2014 Phase III gates: ` +
    (s.free ? 'photons and funds waived (test mode)' : `photons ${Math.floor(Math.min(1, P / PHASE3_PHOTONS) * 100)}% \u00b7 funds ${Math.floor(Math.min(1, M / PHASE3_MONEY) * 100)}%`) +
    ` \u00b7 Interferometer ${Math.min(1, I)}/1` + (s.free ? '' : ` \u00b7 transmissions ${Math.min(PHASE3_TX, TX)}/${PHASE3_TX}`);
  else { const n = Math.max(0, Math.min(PACKETS.length, Math.floor(s.packet) || 0));
    tag = `${PHASE_NAMES[1]} (\u00d71 station speed) \u2014 decode all ${PACKETS.length} signal packets (${n} / ${PACKETS.length} decoded) to unlock Phase II and the $50,000 grant`; }
  setT($('phaseTag'), tag);
  const targets = box ? [box, $('psBtn'), box.querySelector('.ps-ready-pct')] : [];
  if (ph !== 2 || !box) { targets.forEach(el => setT(el, '')); return; }
  const line = (name, have, need, fmtFn) => have >= need ? `\u2713 ${name}: ${fmtFn(have)} / ${fmtFn(need)}` : `\u2717 ${name}: ${fmtFn(have)} / ${fmtFn(need)} (${fmtFn(need - have)} short)`;
  const rows = [
    s.free ? '\u2713 Photons: waived (test mode)' : line('Photons', P, PHASE3_PHOTONS, big),
    s.free ? '\u2713 Funds: waived (test mode)' : line('Funds (total cash)', M, PHASE3_MONEY, money),
    line('Interferometer', Math.min(1, I), 1, x => String(Math.floor(x))),
    s.free ? '\u2713 Daily Transmissions: waived (test mode)' : line('Daily Transmissions logged', Math.min(PHASE3_TX, TX), PHASE3_TX, x => String(Math.floor(x))) + (TX < PHASE3_TX ? ' \u2014 one arrives each real day' : '')];
  const txt = canPhase3()
    ? `Ready to synchronize the Deep-Time Array (\u00d72 station speed).${s.free ? '' : ` Advancing spends ${big(PHASE3_PHOTONS)} photons and ${money(PHASE3_MONEY)}.`}\n` + rows.join('\n')
    : `Phase III gates${s.free ? '' : ' (photons and cash are spent when you advance)'}:\n` + rows.join('\n');
  // PROP-040 (council build 33): lead line on the readiness pill tooltip with the Daily Transmission count; the PROP-032 per-gate breakdown stays below it.
  const pill = box.querySelector('.ps-ready-pct'), TXn = Math.floor(Math.min(PHASE3_TX, TX)), need = PHASE3_TX - TXn;
  const lead = s.free ? '' : `Daily Transmissions logged: ${TXn} / ${PHASE3_TX} (` + (need > 0 ? `${need} more real-day transmission${need === 1 ? '' : 's'} needed for Phase III)` : `Phase III ${PHASE3_TX}-TX gate met)`) + '\n';
  targets.forEach(el => setT(el, el === pill ? lead + txt : txt));
}

// PROP-033 (council build 27): glint countdown tooltip, dial-operator auto-catch note, and a soft pulse in the last 5 s. Visual only, no save changes.
function syncBuild27Visuals(now) {
  const gb = $('glintBtn'), knob = $('knob'); if (!gb) return;
  const setT = (el, v) => { if (!el) return; if (!v) { if (el.hasAttribute('title')) el.removeAttribute('title'); } else if (el.title !== v) el.title = v; };
  const g = s.glint, until = g && Number.isFinite(g.until) ? g.until : 0, live = until > 0 && now <= until;
  const oper = jobEff('dial') > 0;
  const autoTxt = oper ? `Dial operator on duty: a missed glint is auto-caught at ${Math.round(GLINT_AUTO * 100)}% value.` : 'No dial operator: a missed glint fades with no reward.';
  let urgent = false;
  if (live) {
    const left = Math.max(0, (until - now) / 1000); urgent = left <= 5;
    const reward = g.kind === 'surge' ? `×${SURGE_MUL} photons for ${Math.round(SURGE_MS / 1000)} s` : 'signal clarity refilled to 100%';
    setT(gb, `Anomaly glint: ${Math.ceil(left)} s left. Catch it for ${reward}.\n${autoTxt}`);
  } else setT(gb, oper ? `No glint right now (one shimmers every ${Math.round(GLINT_MIN / 60)}–${Math.round(GLINT_MAX / 60)} min of play). ${autoTxt}` : '');
  gb.classList.toggle('glint-urgent', urgent);
  if (knob) knob.classList.toggle('glint-urgent', urgent);
}


// PROP-035 (council build 28): endings status tooltips and New Game+ loop preview. Visual only, no save changes.
function syncBuild28Visuals() {
  const setT = (el, v) => { if (el && el.title !== v) el.title = v; };
  const seenN = ENDINGS.filter(e => s.endingsSeen && s.endingsSeen[e.id]).length, disc = `${seenN} / ${ENDINGS.length} endings discovered`;
  const echoTxt = n => n > 0 ? `+${n} Echo${n > 1 ? 'es' : ''}` : 'no Echoes';
  const box = $('endingsBox');
  if (box && !box.hidden) {
    const btns = $('endBtns').children;
    ENDINGS.forEach((e, i) => { const b = btns[i]; if (!b) return;
      const ready = endingAvailable(e), seen = !!(s.endingsSeen && s.endingsSeen[e.id]);
      setT(b, ready ? `READY in this loop \u00b7 Click to open the scorecard.\n${seen ? 'Seen before: completing it again re-qualifies the New Game+ reset.' : `First completion awards ${echoTxt(e.echoes)} and unlocks the New Game+ reset.`}`
        : seen ? `Seen in a prior loop (history only) \u00b7 Requalify in this loop to unlock the New Game+ reset.\n${e.hint}`
        : `Locked \u00b7 ${e.hint}\nFirst completion awards ${echoTxt(e.echoes)} \u00b7 ${disc}`); });
  }
  const lb = $('loopBtn'); if (!lb) return;
  const ready = !!s.loopReady, ups = ECHO_UPG.reduce((a, u) => a + echoLv(u.id), 0);
  lb.classList.toggle('loop-ready', ready && !lb.hidden);
  setT(lb, ready ? `New Game+ ready: resets to Week 1 and grants +1 Echo (${(s.echoes || 0) + 1} total).\nKeeps ${ups} Echo upgrade level${ups === 1 ? '' : 's'} and your ${disc}.`
    : 'Complete any ending in this loop to unlock the New Game+ reset.');
}

// PROP-036 (council build 29): station cycle cadence and Runner automation tooltips, plus a panel summary. Visual only, no save changes.
// Mirrors advanceStation(): a station loops on its own only while the lab is funded and a Runner is assigned to it.
function syncBuild29Visuals() {
  const panel = $('stPanel'); if (!rt.stEl || !panel) return;
  const setT = (el, v) => { if (!el) return; if (!v) { if (el.hasAttribute('title')) el.removeAttribute('title'); } else if (el.title !== v) el.title = v; };
  let owned = 0, auto = 0;
  const phaseTxt = (s.phase || 1) >= 3 ? ' \u00b7 Phase III \u00d72' : '', echoTxt = echoMul() > 1 ? ` \u00b7 Echo \u00d7${echoMul().toFixed(2)} output` : '';
  STATIONS.forEach((st, i) => { const e = rt.stEl[st.id], o = s.st[st.id]; if (!e || !o) return;
    const n = Number.isFinite(o.n) ? o.n : 0;
    if (n < 1 || !stOpen(i)) { setT(e.circ, ''); setT(e.bar, ''); return; }
    owned++;
    const secs = cycleSecs(st), cyc = secs < 60 ? secs.toFixed(2) + ' s' : dur(secs), p = o.run && Number.isFinite(o.p) ? Math.max(0, Math.min(1, o.p)) : 0, pct = Math.floor(p * 100);
    const runner = !!(s.funded && runnerOf(st.id)); if (runner) auto++;
    const eff = jobEff('st:' + st.id), crewTxt = runner && eff ? ` \u00b7 Runner \u00d7${(0.6 + 0.8 * eff).toFixed(2)} speed` : '';
    const txt = runner
      ? `Runner active: loops on its own, live and offline (${(1 / secs).toFixed(2)} cycles/s, ${cyc} per cycle, ${pct}% through this cycle)${crewTxt}${phaseTxt}${echoTxt}`
      : `Manual mode: click Run once per ${cyc} cycle (${o.run ? pct + '% through this cycle' : 'idle'}) \u00b7 Assign a Runner to keep it cycling live and offline${phaseTxt}${echoTxt}`;
    setT(e.circ, txt); setT(e.bar, txt); });
  const sum = owned ? `Stations: ${owned}/${STATIONS.length} active \u00b7 ${auto}/${owned} automated by Runners (they keep cycling live and offline)` : '';
  setT($('stations'), sum); setT($('boostTag'), sum);
  panel.classList.toggle('runner-all-active', owned > 0 && auto === owned);
}

// PROP-037 (council build 30): paper readiness glow and funding tooltips (paper, reputation, grants). Visual only, no save changes.
// The proposal described papers as needing 2 buffered packets and a 120 * 1.33^n stipend; the real game charges photons
// (paperCost) and pays paperPay(), and grant odds come from grantChance() (Grant writer crew), so the tooltips mirror those.
function syncBuild30Visuals(now) {
  const btn = $('paperBtn'); if (!btn) return;
  const setT = (el, v) => { if (!el) return; if (!v) { if (el.hasAttribute('title')) el.removeAttribute('title'); } else if (el.title !== v) el.title = v; };
  const funded = !!s.funded, p = Math.max(0, Math.floor(s.papers) || 0), r = repu();
  const c = paperCost(), have = Number.isFinite(s.photons) ? s.photons : 0, ready = funded && !s.paper && have >= c;
  btn.classList.toggle('paper-ready-glow', ready);
  if (!funded) setT(btn, '');
  else if (s.paper) { const left = Math.max(0, (s.paper.endAt - now) / 1000);
    setT(btn, `Drafting paper ${p + 1}: ${dur(left)} left \u00b7 Pays ${money(s.paper.pay)} on publication`); }
  else setT(btn, `${ready ? 'Ready to write' : `Need ${fmt(Math.max(0, c - have))} more photons`} (${fmt(Math.min(have, c))} / ${fmt(c)}) \u00b7 Takes ${dur(paperSecs())} \u00b7 Pays ${money(paperPay())}`
    + (jobEff('paper') > 0 ? ' \u00b7 Paper writer drafts the next one automatically' : ''));
  setT($('repu'), r > 0 || p > 0 ? `Reputation ${r.toFixed(1)}: ${p} published paper${p === 1 ? '' : 's'} + owned stations / 10 \u00b7 Raises the daily stipend (+15% each) and grant amounts (+10% each)`
    + (funded ? ` \u00b7 Next paper pays ${money(paperPay())}` : '') : '');
  const box = $('grants'); if (!box) return;
  const id = Object.keys(s.apps || {})[0], a = id && s.apps[id], g = a && GRANTS.find(x => x.id === id);
  setT(box, !funded ? '' : a ? `${g ? g.name : 'Grant'} under review: answer in ${dur(Math.max(0, (a.endAt - now) / 1000))} \u00b7 One application at a time`
    : `Approval odds rise with a Grant writer on the crew (up to +20%) \u00b7 Reputation raises grant amounts`);
}

// PROP-039 (council build 32): dial tooltip with the signed offset from the drifting target and the dish-polish drift note. Read-only, no save changes.
function syncBuild32Visuals(info) {
  const knob = $('knob'); if (!knob || !info) return;
  let txt;
  if (info.tripped) txt = 'Receiver tripped \u2014 cooling down to reset threshold';
  else {
    const off = Number.isFinite(info.errS) ? info.errS : 0, lv = (s.up && s.up.lens) || 0;
    const slow = Math.round((1 - driftMul()) * 100);
    txt = `Tuned ${s.tuned.toFixed(3)} MHz \u00b7 ${info.locked ? 'Locked on' : `Offset ${off >= 0 ? '+' : '\u2212'}${Math.abs(off).toFixed(3)} MHz from the drifting target`}`
      + (lv > 0 ? ` \u00b7 Dish polish level ${lv} slows target drift by ${slow}%` : ' \u00b7 Polishing the dish surface slows target drift');
  }
  if (knob.title !== txt) knob.title = txt;
}
