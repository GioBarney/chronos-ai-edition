'use strict';
/* ---------- crew ---------- */
const STAT_NAMES = { work: 'Work ethic', tech: 'Technical', writing: 'Writing', loyalty: 'Loyalty', ambition: 'Ambition' };
const STAT_KEYS = Object.keys(STAT_NAMES);
const JOBS = [['cool', 'Cooling tech'], ['dial', 'Dial operator'], ['paper', 'Paper writer'], ['grant', 'Grant writer']];
const jobName = j => !j ? 'Unassigned' : j.startsWith('st:') ? 'Runs ' + STATIONS.find(x => x.id === j.slice(3)).name.toLowerCase() : JOBS.find(x => x[0] === j)[1];
const FIRST = ['Lupe', 'Mateo', 'Rosa', 'Hector', 'Diana', 'Kevin', 'Priya', 'Marcus', 'Aiyana', 'Tomas', 'Elena', 'Sam', 'Jordan', 'Bianca', 'Raul', 'Wen', 'Darnell', 'Inez', 'Omar', 'Carla', 'Felix', 'Noor', 'Ruben', 'Tess', 'Gabe', 'Yesenia', 'Theo', 'Ana', 'Dmitri', 'Joy'];
const LAST = ['Garza', 'Okafor', 'Reyes', 'Lindqvist', 'Salinas', 'Park', 'Benavides', 'Holt', 'Trevino', 'Nakamura', 'Ochoa', 'Brennan', 'Castillo', 'Mbeki', 'Villarreal', 'Shah', 'Cantu', 'Dawson'];
const QUESTIONS = [
  { stat: 'work', q: 'What does a long shift look like for you?', a: ['I clock out on time. Every time.', 'I’ll stay late if something’s on fire.', 'I lose track of time. My last boss had to send me home.'] },
  { stat: 'work', q: 'Tell me about your last job.', a: ['It was fine until they wanted weekends.', 'Steady. Never missed a day.', 'Ran double shifts for a year when we were short.'] },
  { stat: 'tech', q: 'Ever fixed electronics?', a: ['I can change a lightbulb. Mostly.', 'I build my own PCs.', 'I rewound a transformer last week for fun.'] },
  { stat: 'tech', q: 'What does a low-noise amplifier do?', a: ['Something that’s… quiet?', 'Boosts the signal before the noise gets in.', 'Depends. Are we talking HEMT or a parametric amp?'] },
  { stat: 'writing', q: 'Have you published anything?', a: ['Does a group chat count?', 'A couple of conference posters.', 'Eleven papers. Two got cited a lot.'] },
  { stat: 'writing', q: 'Explain this station to a funding board.', a: ['It’s a big dish. It listens.', 'We listen to hydrogen. Something’s talking back.', '(A two-minute pitch that gives you chills.)'] },
  { stat: 'loyalty', q: 'Why did you leave your last place?', a: ['Better offer. I always take the better offer.', 'It wasn’t going anywhere.', 'They closed. I was there till the lights went off.'] },
  { stat: 'loyalty', q: 'If someone offered you more money next month?', a: ['I’d be gone by Friday.', 'I’d give you a chance to match it.', 'I don’t jump ship.'] },
  { stat: 'ambition', q: 'Where do you see yourself in five years?', a: ['Here, if the coffee’s good.', 'Running a team, maybe.', 'Running my own array.'] },
  { stat: 'ambition', q: 'What kind of pay are you after?', a: ['Whatever’s fair.', 'Market rate, with raises.', 'More than you’re thinking. And it’ll go up.'] },
];
const round50 = v => Math.max(50, Math.round(v / 50) * 50);
const avgStat = w => (w.st.work + w.st.tech + w.st.writing) / 3;
const wageFor = st => round50(1500 + 350 * (st.tech + st.writing) + 150 * st.work + 100 * st.ambition);
function traitOf(st) {
  const hi = { work: 'Hard worker', tech: 'Good with gear', writing: 'Strong writer', loyalty: 'Steady', ambition: 'Hungry to move up' };
  const lo = { work: 'clocks out early', tech: 'not technical', writing: 'not much of a writer', loyalty: 'restless', ambition: 'easygoing' };
  const ks = STAT_KEYS.slice().sort((a, b) => st[b] - st[a]);
  return `${hi[ks[0]]}, ${lo[ks[ks.length - 1]]}`;
}
function genWorker(scouted) {
  const roll = () => scouted ? 6 + Math.floor(Math.random() * 5) : clamp(Math.round((Math.random() + Math.random() + Math.random()) / 3 * 9 + 1), 1, 10);
  const st = { work: roll(), tech: roll(), writing: roll(), loyalty: roll(), ambition: roll() };
  if (scouted) { const k = ['work', 'tech', 'writing', 'loyalty'][Math.floor(Math.random() * 4)]; st[k] = Math.max(1, st[k] - 5); st.ambition = Math.max(st.ambition, 7); }
  return { id: s.wseq++, name: FIRST[Math.floor(Math.random() * FIRST.length)] + ' ' + LAST[Math.floor(Math.random() * LAST.length)],
    st, wage: wageFor(st), morale: 80, job: null, known: { work: 0, tech: 0, writing: 0, loyalty: 0, ambition: 0 },
    missed: 0, days: 0, lastRaise: dayNum(Date.now()), raises: 0, scouted: !!scouted, trait: traitOf(st) };
}
function chequeWorker() {
  return { id: 0, name: 'Cheque', st: { work: 8, tech: 9, writing: 3, loyalty: 10, ambition: 1 }, wage: 2000, morale: 90, job: 'cool',
    known: { work: 1, tech: 1, writing: 1, loyalty: 1, ambition: 1 }, missed: 0, days: 0, lastRaise: dayNum(Date.now()), raises: 0, cheque: true,
    trait: 'HVAC, thirty years in the trade. Loyal for life.' };
}
function fitOf(w, job) {
  const t = w.st;
  if (!job) return 0;
  if (job.startsWith('st:') || job === 'cool') return (0.6 * t.tech + 0.4 * t.work) / 10;
  if (job === 'dial') return (0.7 * t.tech + 0.3 * t.work) / 10;
  return (0.7 * t.writing + 0.3 * t.work) / 10;
}
function effOf(w) {
  let e = fitOf(w, w.job) * (0.5 + 0.5 * w.morale / 100);
  if (w.cheque) { e *= 1 + 0.1 * Math.min(w.raises, 5); if (w.job === 'cool') e *= 1.5; }
  return e;
}
function jobEff(job) { if (!s.crew) return 0; const w = s.crew.find(x => x.job === job); return w ? effOf(w) : 0; }
function runnerOf(id) { return s.crew && s.crew.some(w => w.job === 'st:' + id); }
const payroll = () => s.crew.reduce((a, w) => a + w.wage, 0) + (s.listing ? 500 : 0);
let inboxSeq = 0;
function pushInbox(it) { it.id = Date.now() + '-' + (inboxSeq++); s.inbox.push(it); }
function removeInbox(id) { s.inbox = s.inbox.filter(x => x.id !== id); }
function quit(w, why) {
  s.crew = s.crew.filter(x => x !== w);
  s.inbox = s.inbox.filter(x => x.wid !== w.id);
  pushInbox({ type: 'note', text: `${w.name} quit. ${why}` }); sfx.warn(); toast(`${w.name} quit.`);
}
function learn(w) {
  const rel = !w.job ? [] : (w.job.startsWith('st:') || w.job === 'cool' || w.job === 'dial') ? ['tech', 'work'] : ['writing', 'work'];
  STAT_KEYS.forEach(k => { w.known[k] = Math.min(1, w.known[k] + (rel.includes(k) ? 0.15 : 0.06)); });
}
function processPaydays(now) {
  if (!s.funded) return;
  const day = dayNum(now);
  if (!s.payDay) { s.payDay = day; return; }
  let guard = 0;
  while (s.payDay < day && guard++ < 14) { s.payDay++; payday(s.payDay); }
}
function payday(day) {
  if (s.listing) { if (s.free || s.money >= 500) { if (!s.free) s.money -= 500; } else { s.listing = false; pushInbox({ type: 'note', text: 'Your job listing closed. You couldn’t cover the $500 fee.' }); } }
  if (!s.crew.length) return;
  let paid = 0; const missed = [];
  s.crew.slice().forEach(w => {
    if (s.free || s.money >= w.wage) { if (!s.free) s.money -= w.wage; paid += w.wage; w.missed = 0; w.morale = Math.min(100, w.morale + 5); }
    else { w.missed++; w.morale = Math.max(w.cheque ? 60 : 0, w.morale - 30); missed.push(w); }
    w.days++; learn(w);
    if (!w.cheque && w.st.ambition >= 4 && day - w.lastRaise >= 16 - w.st.ambition && !s.inbox.some(x => x.type === 'raise' && x.wid === w.id))
      pushInbox({ type: 'raise', wid: w.id, amt: round50(w.wage * (0.1 + w.st.ambition * 0.01)) });
    if (!w.cheque && !s.inbox.some(x => x.type === 'offer' && x.wid === w.id) && Math.random() < (w.st.ambition / 10) * 0.08 * (1 - w.st.loyalty / 12))
      pushInbox({ type: 'offer', wid: w.id, amt: round50(w.wage * (1.3 + Math.random() * 0.3)) });
  });
  missed.forEach(w => { if (w.cheque) return; const limit = avgStat(w) >= 7.5 || w.scouted ? 1 : (w.st.loyalty >= 8 ? 4 : 3);
    if (w.missed >= limit) quit(w, limit === 1 ? 'Top talent doesn’t wait for a late check.' : `${w.missed} missed paydays.`); });
  sfx.cash();
  toast(`Payday: ${money(paid)} in wages.${missed.length ? ` ${missed.length} not paid!` : ''}`);
}
function resolveCrew(now) {
  if (!s.funded) return;
  s.inbox = s.inbox.filter(x => !(x.type === 'apply' && !x.scouted && now - x.at > 86400e3));
  if (s.listing) {
    if (!s.nextApp) s.nextApp = now + 3 * 3600e3 * (0.7 + 0.6 * Math.random());
    let guard = 0;
    while (now >= s.nextApp && guard++ < 8) {
      if (s.inbox.filter(x => x.type === 'apply').length < 3) { const a = genWorker(false); pushInbox({ type: 'apply', applicant: a, at: s.nextApp }); toast(`${a.name} applied for a job.`); }
      s.nextApp += 3 * 3600e3 * (0.7 + 0.6 * Math.random());
    }
  } else s.nextApp = 0;
  if (s.scout && now >= s.scout.endAt) { const a = genWorker(true); pushInbox({ type: 'apply', applicant: a, at: now, scouted: true }); s.scout = null; sfx.decoded(); toast(`Your scout found ${a.name}.`); save(); }
}
function autoCrew() {
  if (!s.funded) return;
  if (jobEff('paper') > 0 && !s.paper) { const c = paperCost(); if (s.photons >= c) { s.photons -= c; const secs = paperSecs(); s.paper = { endAt: Date.now() + secs * 1000, secs, pay: paperPay() }; } }
  const ge = jobEff('grant');
  if (ge > 0 && !Object.keys(s.apps).length) { const g = GRANTS[ge < 0.5 ? 0 : ge < 0.8 ? 1 : 2];
    s.apps[g.id] = { endAt: Date.now() + (s.free ? 0 : g.hrs * 3600e3), ok: Math.random() < grantChance(g), amt: grantAmt(g) }; }
}
function hire(a) {
  STAT_KEYS.forEach(k => { a.known[k] = a.known[k] || 0; });
  a.lastRaise = dayNum(Date.now()); s.crew.push(a); ensureAudio(); sfx.buy();
  toast(`${a.name} joined the crew. Give them a job.`); rt.openW.add(a.id); save();
}
function chequeArrives() {
  s.chequeMet = true; save();
  openModal({ eyebrow: 'Someone at the door', title: 'Cheque',
    body: "Somebody's knocking on the observatory door at 2 a.m.\n\nIt's Cheque. HVAC, thirty years in the trade. He saw heat shimmer coming off the receiver shed from the road.\n\n\"That thing's cooking itself. Let me take a look. Pay me whatever's fair.\"",
    actions: [['Not now', () => { pushInbox({ type: 'cheque' }); closeModal(); }, 'ghost'], ['Hire Cheque for $2,000/day', () => { hire(chequeWorker()); closeModal(); }]] });
}
function interview(item) {
  const a = item.applicant, asked = []; let round = 0, log = '';
  const step = () => {
    if (round >= 3) {
      openModal({ eyebrow: 'Interview · decision', title: a.name, instant: true,
        body: `${log}\n\nThey're asking ${money(a.wage)} a day.`,
        actions: [['Pass', () => { removeInbox(item.id); closeModal(); save(); }, 'ghost'], [`Hire for ${money(a.wage)}/day`, () => { removeInbox(item.id); hire(a); closeModal(); }]] });
      return;
    }
    const pool = QUESTIONS.filter(q => !asked.includes(q));
    const pick = []; const used = new Set();
    pool.sort(() => Math.random() - 0.5).forEach(q => { if (pick.length < 3 && !used.has(q.stat)) { pick.push(q); used.add(q.stat); } });
    pool.forEach(q => { if (pick.length < 3 && !pick.includes(q)) pick.push(q); });
    openModal({ eyebrow: `Interview · round ${round + 1} of 3`, title: a.name, instant: true,
      body: log || `${a.name} takes a seat.${item.scouted ? ' Your scout vouches for them.' : ''}\n\nFirst impression: ${a.trait.toLowerCase()}.`,
      actions: pick.map(q => [q.q, () => {
        asked.push(q); a.known[q.stat] = Math.max(a.known[q.stat], 0.5);
        const v = a.st[q.stat], tier = v <= 3 ? 0 : v >= 8 ? 2 : 1;
        log += (log ? '\n\n' : '') + `You: ${q.q}\n${a.name}: “${q.a[tier]}”`; round++; step(); }, 'ghost q']) });
  };
  step();
}
function statCell(w, k) {
  const v = w.st[k], kn = w.known[k];
  if (kn >= 1) return `<span class="sbar"><i style="width:${v * 10}%"></i></span><span class="sv">${v}</span>`;
  if (kn >= 0.5) { const lo = Math.max(1, v - 1), hi = Math.min(10, v + 1); return `<span class="sbar"><i class="fuzzy" style="width:${hi * 10}%"></i></span><span class="sv">${lo}–${hi}</span>`; }
  return `<span class="sbar"></span><span class="sv">?</span>`;
}
function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function renderCrew(now) {
  $('crewPanel').hidden = !s.funded; if (!s.funded) return;
  $('payroll').textContent = `Payroll ${money(payroll())}/day`;
  $('listSw').setAttribute('aria-checked', String(s.listing));
  $('listMeta').textContent = s.listing ? `Open. Someone applies about every 3 hours. $500 a day.${s.nextApp ? ` Next in about ${dur((s.nextApp - now) / 1000)}.` : ''}` : 'Closed. Open it to get applicants.';
  const sc = scoutCost();
  if (s.scout) { $('scoutMeta').textContent = `Out looking. Back in ${dur((s.scout.endAt - now) / 1000)}.`; $('scoutBtn').disabled = true; $('scoutBtn').textContent = 'Searching'; }
  else { $('scoutMeta').textContent = `Finds top talent in 1 hour. Top talent costs more and won't wait for a late check.`; $('scoutBtn').textContent = `Hire scout · ${money(sc)}`; $('scoutBtn').disabled = s.money < sc; }
  const day = dayNum(now);
  const sig = JSON.stringify([s.inbox.map(x => x.id), s.crew.map(w => [w.id, w.job, w.wage, Math.round(w.morale / 5), STAT_KEYS.map(k => Math.round(w.known[k] * 10)), w.missed, w.raises]),
    STATIONS.map(st => s.st[st.id].n > 0)]);
  if (sig !== rt.crewSig) { rt.crewSig = sig; buildInbox(); buildCrewList(); }
  document.querySelectorAll('[data-cost]').forEach(b => { if (!b.dataset.confirm) b.disabled = s.money < +b.dataset.cost; });
  document.querySelectorAll('[data-eff]').forEach(el => { const w = s.crew.find(x => x.id === +el.dataset.eff);
    if (w) el.textContent = w.job ? `Working at ${Math.round(effOf(w) * 100)}% · ${money(w.wage)}/day · day ${w.days + 1} on the crew` : `Not assigned · ${money(w.wage)}/day`; });
  $('nextPay') && ($('nextPay').textContent = `Next payday in ${dur((s.startedAt + day * 86400e3 - now) / 1000)}.`);
}
const scoutCost = () => s.free ? 0 : round50(150000 * Math.pow(1.5, s.scouts));
function buildInbox() {
  const box = $('inbox'); box.innerHTML = '';
  s.inbox.forEach(it => {
    const row = document.createElement('div'); row.className = 'frow inb';
    const w = it.wid != null ? s.crew.find(x => x.id === it.wid) : null;
    let title = '', meta = '', acts = [];
    if (it.type === 'apply') { const a = it.applicant; title = `${a.name} applied${it.scouted ? ' (scouted)' : ''}`; meta = `${a.trait}. Asking ${money(a.wage)}/day.`;
      acts = [['Pass', () => { removeInbox(it.id); save(); }, 'ghost'], ['Interview', () => interview(it), '']]; }
    else if (it.type === 'raise' && w) { title = `${w.name} wants a raise`; meta = `+${money(it.amt)}/day, to ${money(w.wage + it.amt)}/day.`;
      acts = [['Decline', () => { removeInbox(it.id); w.morale = Math.max(0, w.morale - 25); w.lastRaise = dayNum(Date.now());
        if (w.st.ambition >= 8 && Math.random() < 0.4) quit(w, 'They wanted that raise.'); save(); }, 'ghost'],
        ['Give raise', () => { removeInbox(it.id); w.wage += it.amt; w.morale = Math.min(100, w.morale + 20); w.lastRaise = dayNum(Date.now()); sfx.cash(); save(); }, '']]; }
    else if (it.type === 'offer' && w) { title = `${w.name} got an outside offer`; meta = `Another lab offered ${money(it.amt)}/day. They're asking if you'll match it.`;
      acts = [['Let them go', () => { removeInbox(it.id); s.crew = s.crew.filter(x => x !== w); toast(`${w.name} left for the other lab.`); save(); }, 'ghost'],
        ['Match it', () => { removeInbox(it.id); w.wage = it.amt; w.morale = Math.min(100, w.morale + 10); sfx.cash(); save(); }, '']]; }
    else if (it.type === 'cheque') { title = 'Cheque is still around'; meta = 'HVAC tech. Says the offer stands whenever you’re ready.';
      acts = [['Hire for $2,000/day', () => { removeInbox(it.id); hire(chequeWorker()); }, '']]; }
    else if (it.type === 'note') { title = it.text; acts = [['OK', () => { removeInbox(it.id); save(); }, 'ghost']]; }
    else { removeInbox(it.id); return; }
    row.innerHTML = `<div class="fi"><div class="fn"></div><div class="fm"></div></div><div class="acts"></div>`;
    row.querySelector('.fn').textContent = title; row.querySelector('.fm').textContent = meta;
    acts.forEach(([l, fn, cls]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = l;
      b.onclick = () => { ensureAudio(); sfx.click(); fn(); }; row.querySelector('.acts').appendChild(b); });
    box.appendChild(row);
  });
}
function buildCrewList() {
  const box = $('crewList'); box.innerHTML = '';
  if (!s.crew.length) { box.innerHTML = '<p class="teaser">No crew yet. Open a job listing or hire a scout to find people.</p>'; return; }
  const pd = document.createElement('p'); pd.className = 'teaser'; pd.id = 'nextPay'; box.appendChild(pd);
  s.crew.forEach(w => {
    const d = document.createElement('details'); d.className = 'wk'; if (rt.openW.has(w.id)) d.open = true;
    d.addEventListener('toggle', () => { d.open ? rt.openW.add(w.id) : rt.openW.delete(w.id); });
    const opts = [['', 'Unassigned'], ...JOBS, ...STATIONS.filter(st => s.st[st.id].n > 0).map(st => ['st:' + st.id, 'Run ' + st.name.toLowerCase()])]
      .map(([v, l]) => { const other = s.crew.find(x => x !== w && x.job === (v || null)); return `<option value="${v}"${(w.job || '') === v ? ' selected' : ''}>${esc(l)}${v && other ? ` (now ${esc(other.name)})` : ''}</option>`; }).join('');
    const low = w.morale < 40;
    d.innerHTML = `<summary><span class="wn">${esc(w.name)}</span><span class="wj">${esc(jobName(w.job))}</span><span class="wm${low ? ' low' : ''}">Morale ${Math.round(w.morale)}%${w.missed ? ` · ${w.missed} missed payday${w.missed > 1 ? 's' : ''}` : ''}</span></summary>
      <div class="wbody"><div class="fm">${esc(w.trait)}</div><div class="fm" data-eff="${w.id}"></div>
      <select id="job-${w.id}" aria-label="Job for ${esc(w.name)}">${opts}</select>
      <div class="stats">${STAT_KEYS.map(k => `<div class="srow"><span>${STAT_NAMES[k]}</span>${statCell(w, k)}</div>`).join('')}</div>
      <div class="wacts"></div></div>`;
    d.querySelector('select').onchange = e => { const v = e.target.value || null; if (v) s.crew.forEach(x => { if (x !== w && x.job === v) x.job = null; }); w.job = v; sfx.click(); save(); };
    const acts = d.querySelector('.wacts');
    const mk = (label, fn, cls, cost) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || 'ghost'); b.textContent = label; if (cost != null) b.dataset.cost = cost; b.onclick = () => { ensureAudio(); fn(b); }; acts.appendChild(b); };
    if (STAT_KEYS.some(k => w.known[k] < 1)) { const rc = s.free ? 0 : w.wage * 3; mk(`Performance review · ${money(rc)}`, () => { if (s.money < rc) return; s.money -= rc; STAT_KEYS.forEach(k => { w.known[k] = 1; }); sfx.buy(); save(); }, 'ghost', rc); }
    mk(w.cheque ? `Give Cheque a raise (+10%)${w.raises ? ` · ${w.raises} so far` : ''}` : 'Give a raise (+10%)', () => {
      w.wage = round50(w.wage * 1.1); w.morale = Math.min(100, w.morale + 15); w.lastRaise = dayNum(Date.now()); if (w.cheque) w.raises++; sfx.cash();
      if (w.cheque) toast(w.raises <= 5 ? 'Cheque grins. He’s working harder.' : 'Cheque appreciates it, but he’s already giving it everything.'); save(); }, 'ghost');
    if (!w.cheque) mk('Let go', b => { if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Tap again to let go'; setTimeout(() => { if (b.isConnected) { delete b.dataset.confirm; b.textContent = 'Let go'; } }, 3000); return; }
      s.crew = s.crew.filter(x => x !== w); s.inbox = s.inbox.filter(x => x.wid !== w.id); toast(`${w.name} packed up and left.`); save(); }, 'ghost');
    box.appendChild(d);
  });
}
$('listSw').onclick = () => { s.listing = !s.listing; s.nextApp = 0; ensureAudio(); sfx.click(); toast(s.listing ? 'Job listing posted.' : 'Job listing closed.'); save(); };
$('scoutBtn').onclick = () => { const c = scoutCost(); if (s.scout || s.money < c) return; s.money -= c; s.scouts++; s.scout = { endAt: Date.now() + (s.free ? 0 : 3600e3) }; ensureAudio(); sfx.buy(); toast('The scout is out looking. Back in an hour.'); save(); };
function renderKnob() { cap.style.setProperty('--a', s.knobAngle + 'deg'); }

$('lim').onclick = () => {
  s.limiterOff = !s.limiterOff;
  if (s.limiterOff) { s.risk += 1; toast('Limiter bypassed. Watch the noise temperature.'); } else { s.caution += 1; toast('Limiter back on.'); }
  sfx.click(); save();
};
function preview(id) {
  if (!AC) return; const n = Date.now(); if (n - rt.lastPreview < 160) return; rt.lastPreview = n;
  if (id === 'wave') tone(440, 0.05, 0.45, 'sine', 0, BUS.wave);
  else if (id === 'photons' || id === 'master') { sfx.pop(); setTimeout(() => sfx.pop(), 90); }
  else if (id === 'clicks') sfx.click();
  else if (id === 'alerts') sfx.lock();
  else if (id === 'static') { const src = AC.createBufferSource(); src.buffer = N.white; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300;
    const g = AC.createGain(); env(g, 0.06, 0.01, 0.35, AC.currentTime); src.connect(bp).connect(g).connect(BUS.static); src.start(AC.currentTime, 0, 0.4); }
}
function updateSoundBtn() { $('soundBtn').textContent = s.mix.master.on ? 'Sound' : 'Sound off'; }
function buildMixer() {
  const box = $('mixRows'); box.innerHTML = '';
  MIX.forEach(m => {
    const row = document.createElement('div'); row.className = 'mix';
    row.innerHTML = `<div><div class="mn"></div><div class="md"></div></div><button class="switch snd" type="button" role="switch" id="mixsw-${m.id}"></button><input type="range" min="0" max="100" step="1" id="mixvol-${m.id}">`;
    row.querySelector('.mn').textContent = m.name; row.querySelector('.md').textContent = m.desc;
    const sw = row.querySelector('.switch'), rg = row.querySelector('input');
    sw.setAttribute('aria-label', m.name); rg.setAttribute('aria-label', m.name + ' volume');
    const sync = () => { const c = s.mix[m.id]; sw.setAttribute('aria-checked', String(c.on)); rg.value = c.vol; row.classList.toggle('off', !c.on); };
    sw.onclick = () => { ensureAudio(); s.mix[m.id].on = !s.mix[m.id].on; sync(); applyMix(); if (s.mix[m.id].on) preview(m.id); updateSoundBtn(); save(); };
    rg.oninput = () => { ensureAudio(); s.mix[m.id].vol = +rg.value; if (!s.mix[m.id].on) { s.mix[m.id].on = true; sync(); updateSoundBtn(); } applyMix(); preview(m.id); };
    rg.onchange = save;
    sync(); box.appendChild(row);
  });
}
const toggleMixer = open => { $('mixer').hidden = !open; $('soundBtn').setAttribute('aria-expanded', String(open)); };
$('soundBtn').onclick = () => { ensureAudio(); toggleMixer($('mixer').hidden); };
$('mixClose').onclick = () => toggleMixer(false);
function resetIdle() { const box = $('resetBox'); box.innerHTML = '<button class="chip" id="reset" type="button">Reset run</button>'; $('reset').onclick = resetAsk; }
function resetAsk() { const box = $('resetBox');
  box.innerHTML = '<span class="label">Erase this run?</span><button class="btn warn" id="rYes" type="button">Erase</button><button class="btn ghost" id="rNo" type="button">Cancel</button>';
  $('rNo').onclick = resetIdle;
  $('rYes').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} const keepMix = s.mix; s = fresh(); s.mix = keepMix; rt.upSig = ''; rt.logSig = -1; rt.limiterCut = false; save(); resetIdle(); openLog(0, true); }; }
$('reset').onclick = resetAsk;
$('ver').addEventListener('click', () => { const n = Date.now(); rt.verTaps = rt.verTaps.filter(x => n - x < 3000); rt.verTaps.push(n);
  if (rt.verTaps.length >= 5) { $('dev').hidden = false; rt.verTaps = []; } });
$('devClose').onclick = () => { $('dev').hidden = true; };
$('testBtn').onclick = () => { $('dev').hidden = !$('dev').hidden; if (!$('dev').hidden) $('dev').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
const freeLabel = () => { $('devFree').textContent = 'Free + instant: ' + (s.free ? 'on' : 'off'); };
$('devFree').onclick = () => { s.free = !s.free; rt.upSig = ''; $('decode').dataset.k = ''; freeLabel(); toast(s.free ? 'Test mode on. Parts and decodes are free and instant.' : 'Test mode off. Normal costs and timers.'); save(); };
function skipTime(ms, label) {
  s.startedAt -= ms;
  if (s.decode) s.decode.endAt -= ms;
  if (s.paper) s.paper.endAt -= ms;
  Object.values(s.apps).forEach(a => { a.endAt -= ms; });
  if (s.nextApp) s.nextApp -= ms;
  if (s.scout) s.scout.endAt -= ms;
  s.inbox.forEach(it => { if (it.at) it.at -= ms; });
  s.tripUntil = Math.max(0, s.tripUntil - ms);
  const pBefore = s.photons; catchUp(ms);
  if (s.photons === pBefore) toast(`Skipped ${label}. Decodes, papers, grants and the stipend moved forward too.`);
  save();
}
$('devHour').onclick = () => skipTime(3600e3, '1 hour');
$('devDay').onclick = () => skipTime(86400e3, '1 day');
$('devMax').onclick = () => { UPG.forEach(u => { s.up[u.id] = u.max; }); s.weekDone = true; rt.upSig = ''; toast('All parts maxed.'); save(); };
$('devAll').onclick = () => { s.packet = PACKETS.length; s.decode = null; rt.logSig = -1; rt.upSig = ''; $('decode').dataset.k = ''; toast('All 7 packets unlocked. Read them in Operator logs.'); save(); };
$('devSkip').onclick = () => { if (s.decode) s.decode.endAt = Date.now(); };
$('devPho').onclick = () => { s.photons += 500; };
$('devCash').onclick = () => { s.money += 1e6; };
$('devGlint').onclick = () => { if (!s.glint) s.glintIn = 0; };

document.addEventListener('visibilitychange', () => { if (document.hidden) { endHold(); save(); } });
window.addEventListener('pagehide', save);
setInterval(save, 5000);

