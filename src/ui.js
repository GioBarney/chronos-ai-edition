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
    b.innerHTML = `<span class="t"></span><span class="s"></span>`; b.querySelector('.t').textContent = L.title; b.querySelector('.s').textContent = L.short;
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
    s.funded = true; s.money += 50000; sfx.decoded(); save();
    openModal({ eyebrow: 'Grant awarded', title: '$50,000 from the university',
      body: "The board read your Week 1 logs. Nobody believes it's what you think it is, but nobody can explain it either.\n\nThey've approved $50,000 for equipment. That's enough for your first data logger, which collects photons without you on the dial.\n\nKeep the money coming with papers, grant applications and your daily stipend.",
      actions: [['Buy equipment', () => { closeModal(); $('fundPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); }]] });
  }
  processPaydays(now); resolveCrew(now); autoCrew();
  if (s.funded && !s.chequeMet && (s.heat >= 80 || rt.limiterCut || info.tripped) && $('modal').hidden) chequeArrives();
  resolveFunding(now);
  renderCrew(now);
  renderFunding(now);
  renderStations();
  renderDecode(now); renderUps(); renderLogs();
  if (!$('dev').hidden) $('devkv').textContent = `test mode ${s.free ? 'on' : 'off'} · caution ${s.caution.toFixed(1)} · risk ${s.risk.toFixed(1)} · target ${info.tgt.toFixed(4)} MHz · window ±${(info.band * 1000).toFixed(1)} kHz`;
}
function buildStations() {
  const box = $('stations'); box.innerHTML = ''; rt.stEl = {};
  STATIONS.forEach(st => {
    const row = document.createElement('div'); row.className = 'st'; row.style.setProperty('--c', `var(--${st.color})`);
    row.innerHTML = `<button class="st-run" type="button"></button><div class="st-main"><div class="st-top"><span class="st-name"></span><span class="st-ms"></span></div><button class="st-bar" type="button"><i></i><span class="st-pay"></span><span class="st-time"></span></button></div><div class="st-acts"><button class="btn st-buy" type="button"></button><button class="btn ghost st-up" type="button"></button></div>`;
    const e = { row, circ: row.querySelector('.st-run'), name: row.querySelector('.st-name'), ms: row.querySelector('.st-ms'), bar: row.querySelector('.st-bar'),
      fill: row.querySelector('.st-bar i'), pay: row.querySelector('.st-pay'), time: row.querySelector('.st-time'), buy: row.querySelector('.st-buy'), up: row.querySelector('.st-up'), acts: row.querySelector('.st-acts') };
    e.name.textContent = st.name; e.circ.setAttribute('aria-label', 'Run ' + st.name);
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
    const nm = nextMs(o.n); e.ms.textContent = nm ? `${o.n}/${nm} for 2\u00d7 speed` : 'Max speed';
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
