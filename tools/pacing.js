'use strict';
/* Pacing audit (PROP-017, council build 11).
   Run: node tools/pacing.js            -> prints the day each profile reaches Phase II, Phase III and a first ending.
   It loads the REAL formulas from src/data.js and the crew maths from src/crew.js, then drives them with a simple
   deterministic player model (no randomness, expected values). It never touches a browser or a save.
   Model limits: clarity/heat on the dial are folded into one "active efficiency" number per profile; crew are
   typical hires (fixed stats); echoes/loops are ignored. Purchases, packet starts, papers and grants happen only while the tab is
   open (a session, or awake time for the optimizer). Station runners and tape/dial income keep earning while closed, as the
   12-hour offline catch-up allows; the 30 s step is fine because those rates are smooth. Use it to compare balance changes, not as a prediction. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const crewSrc = read('crew.js'); const crewFormulas = crewSrc.slice(0, crewSrc.indexOf('const payroll'));

const PROFILES = {
  laid: { label: 'Laid-back (2 short sessions/day, tab closed between)', sessions: [8, 20], sessSecs: 480, clarity: 0.7, duty: 0.6,
    openAlways: false, crewEff: 0.5, crewWage: 5300, tapStations: true, glintCatch: 0.3 },
  opt: { label: 'Optimizer (6 sessions/day, tab open while awake)', sessions: [8, 11, 14, 17, 20, 23], sessSecs: 900, clarity: 0.9, duty: 0.9,
    openAlways: true, awake: [8, 24], crewEff: 0.8, crewWage: 7000, tapStations: true, glintCatch: 1 },
};

function run(profile, maxDays) {
  const P = PROFILES[profile];
  const stubs = `const matchMedia = () => ({ matches: false }); const document = { getElementById: () => ({}) };`;
  const driver = `
  const out = { phase2: null, phase3: null, ending: null, log: [] };
  s.startedAt = 0; s.seenIntro = true;
  const DAY = 86400, STEP = 30;
  const hrOf = t => (t % DAY) / 3600, dayOf = t => Math.floor(t / DAY);
  let t = 0, lastStipDay = -1, lastPay = 0, nextSessionIdx = 0, inSession = 0, sessDone = new Set(), decodeStarted = false;
  const crewEffVal = P.crewEff, wage = P.crewWage;
  const worker = (job, eff) => ({ id: s.wseq++, job, wage, morale: 100, cheque: false, raises: 0,
    st: { work: Math.round(eff * 10), tech: Math.round(eff * 10), writing: Math.round(eff * 10), loyalty: 8, ambition: 4 } });
  // cheque cooling tech: arrives the first time heat bites, modelled as day of funding
  const hireOrder = () => { const j = []; j.push('paper'); j.push('grant'); STATIONS.forEach(x => j.push('st:' + x.id)); j.push('dial'); return j; };
  const have = job => s.crew.some(w => w.job === job);
  const isOpen = hr => P.openAlways ? (hr >= P.awake[0] && hr < P.awake[1]) : false;
  const inSess = hr => P.sessions.some(h => hr >= h && hr < h + P.sessSecs / 3600);
  const payrollPerDay = () => s.crew.reduce((a, w) => a + w.wage, 0);
  const chain = () => STATIONS.findIndex(x => s.st[x.id].n === 0);
  const rateGain = (st, i) => { const o = s.st[st.id]; const c = cycleSecs(st) || 1; return (st.rev * Math.pow(3, s.stUp[st.id]) / c) * (1 + 0); };
  function tryBuy() {
    if (!s.funded) return;
    const ci = chain(); // next station to unlock
    // 1. unlock next chain station when affordable, with phase-III money reserved once interferometer is the next goal
    if (ci >= 0 && stOpen(ci) && s.money >= costN(STATIONS[ci], 1)) { s.money -= costN(STATIONS[ci], 1); s.st[STATIONS[ci].id].n += 1; out.log.push(STATIONS[ci].id + ' d' + (t / DAY + 1).toFixed(1)); return; }
    // 2. reinvest only small slices of cash while saving for the next unlock
    let best = null;
    STATIONS.forEach((st, i) => { const o = s.st[st.id]; if (!o.n || !stOpen(i)) return;
      const c1 = costN(st, 1); const gain = st.rev * Math.pow(3, s.stUp[st.id]) * echoMul() / cycleSecs(st);
      const score = gain / c1; if (c1 <= 0.2 * s.money && (!best || score > best.score)) best = { st, c: c1, score, kind: 'n' };
      if (s.stUp[st.id] < 5) { const uc = upCost(st), g2 = payout(st) * 2 / cycleSecs(st), sc = g2 / uc; if (uc <= 0.2 * s.money && (!best || sc > best.score)) best = { st, c: uc, score: sc, kind: 'u' }; } });
    if (best) { s.money -= best.c; if (best.kind === 'n') s.st[best.st.id].n++; else s.stUp[best.st.id]++; }
  }
  function tryHire() {
    if (!s.funded) return;
    for (const job of hireOrder()) { if (have(job)) continue;
      if (job.startsWith('st:')) { const id = job.slice(3); if (!s.st[id].n) continue; }
      const next = payrollPerDay() + wage;
      if (s.money >= wage * 4 + next * 3) { s.crew.push(worker(job, crewEffVal)); s.money -= wage; }
      return; }
  }
  function trySpendPhotons() {
    // packets
    if (!s.decode && s.packet < PACKETS.length) { const c = PACKETS[s.packet].cost; if (s.photons >= c && (P.openAlways ? isOpen(hrOf(t)) || inSess(hrOf(t)) : inSess(hrOf(t)))) { s.photons -= c; s.decode = { idx: s.packet, endAt: t + PACKETS[s.packet].secs }; } }
    // parts: cheapest affordable first
    let guard = 0;
    while (guard++ < 40) { const opts = UPG.filter(u => u.unlock() && s.up[u.id] < u.max && cost(u) <= s.photons).sort((a, b) => cost(a) - cost(b));
      if (!opts.length || (s.photons - cost(opts[0]) < 0)) break;
      // keep photons for the next packet if it is nearly affordable
      if (s.packet < PACKETS.length && !s.decode && opts[0].id !== 'tuner' && opts[0].id !== 'lna' && opts[0].id !== 'tape' && s.photons - cost(opts[0]) < PACKETS[s.packet].cost * 0.5) break;
      s.photons -= cost(opts[0]); s.up[opts[0].id]++; }
  }
  function startPaperIfPossible(open) {
    if (!s.funded || s.paper) return;
    const writer = jobEff('paper') > 0;
    if (!writer && !(inSess(hrOf(t)))) return;
    const c = paperCost(); if (s.photons >= c) { s.photons -= c; const secs = paperSecs(); s.paper = { endAt: t + secs, secs, pay: paperPay() }; }
  }
  function startGrant(open) {
    if (!s.funded || Object.keys(s.apps).length) return;
    const ge = jobEff('grant'); const sessNow = inSess(hrOf(t));
    if (ge <= 0 && !sessNow) return;
    const gapH = P.openAlways ? 3 : 12;
    const pick = ge > 0 ? GRANTS[ge < 0.5 ? 0 : ge < 0.8 ? 1 : 2]
      : GRANTS.slice().sort((a, b) => (grantChance(b) * grantAmt(b) / (Math.ceil(b.hrs / gapH) * gapH)) - (grantChance(a) * grantAmt(a) / (Math.ceil(a.hrs / gapH) * gapH)))[0];
    s.apps[pick.id] = { endAt: t + pick.hrs * 3600, ok: grantChance(pick), amt: grantAmt(pick) };
  }
  const hasCheque = () => s.crew.some(w => w.cheque);
  while (t < maxD * DAY) {
    const hr = hrOf(t), day = dayOf(t), sess = inSess(hr), open = sess || isOpen(hr);
    // wall clock bookkeeping: startedAt = 0 so dayNum comes from t
    // active dial income during sessions
    let r = 0;
    if (sess) { r = baseRate() * Math.pow(P.clarity, 1.5) * P.duty * (1 + (s.heat > 85 ? 0.6 : 0) * 0); }
    let glintBonus = 0; if (sess) glintBonus = (r + passiveRate() + operatorRate()) * 2 * 60 / (P.sessSecs) * (P.sessSecs / 690) * P.glintCatch * 0; // glints omitted from the baseline
    const idle = (passiveRate() + (sess ? 0 : operatorRate()));
    const income = (r + idle + operatorRate() * (sess ? 0 : 0)) * echoMul();
    s.photons += income * STEP; s.total += income * STEP;
    // stations: runners are continuous (offline cap not binding), the rest are tapped once per session
    for (const st of STATIONS) { const o = s.st[st.id]; if (!o.n) continue;
      if (s.funded && runnerOf(st.id)) { const pay = payout(st) * STEP / cycleSecs(st); s.photons += pay; s.total += pay; }
      else if (s.funded && sess && P.tapStations) { const k = 'tap' + dayOf(t) + '_' + Math.floor(hr) + st.id; if (!sessDone.has(k)) { sessDone.add(k); const pay = payout(st); s.photons += pay; s.total += pay; } } }
    // decode finish (only when the tab is open, else on next open)
    if (s.decode && open && t >= s.decode.endAt) { s.packet = s.decode.idx + 1; s.decode = null; }
    if (s.packet >= 7 && !s.funded) { s.funded = true; s.money += 50000; s.phase = 2; out.phase2 = t / DAY; s.payDay = day; }
    if (open) {
      if (s.paper && t >= s.paper.endAt) { s.money += s.paper.pay; s.papers++; s.paper = null; }
      for (const g of GRANTS) { const a = s.apps[g.id]; if (a && t >= a.endAt) { s.money += a.ok * a.amt; delete s.apps[g.id]; } }
      if (sess && lastStipDay < day && s.funded) { s.money += stipendAmt(); lastStipDay = day; }
    }
    if (open) { trySpendPhotons(); }
    if (open) { startPaperIfPossible(open); startGrant(open); tryBuy(); tryHire();
      if (s.funded && !hasCheque() && s.money > 20000) { s.crew.push({ id: 0, cheque: true, job: 'cool', wage: 2000, morale: 90, raises: 0, st: { work: 8, tech: 9, writing: 3, loyalty: 10, ambition: 1 } }); } }
    // payday at each day rollover
    if (s.funded && day > lastPay) { lastPay = day; s.money -= payrollPerDay(); if (s.money < 0) s.money = 0; }
    // phase III
    if (s.phase === 2 && s.st.interf.n >= 1 && s.photons >= PHASE3_PHOTONS && s.money >= PHASE3_MONEY && open) { s.photons -= PHASE3_PHOTONS; s.money -= PHASE3_MONEY; s.phase = 3; out.phase3 = t / DAY; }
    if (s.phase >= 3 && !out.ending && open && (s.papers >= 5 || s.caution >= 5)) { out.ending = t / DAY; break; }
    t += STEP;
  }
  out.final = { day: t / DAY, packet: s.packet, papers: s.papers, money: s.money, photons: s.photons, stations: Object.fromEntries(STATIONS.map(x => [x.id, s.st[x.id].n])), crew: s.crew.length };
  return out;`;
  const src = `${stubs}\n${read('data.js')}\n${crewFormulas}\nconst P = ${JSON.stringify(P)}, maxD = ${maxDays};\nfunction __run() {${driver}}\n__run();`;
  return vm.runInNewContext(src, {}, { timeout: 120000 });
}

if (require.main === module) {
  const days = +process.argv[2] || 60;
  const f = v => v == null ? 'not reached' : 'day ' + (v + 1).toFixed(1);
  for (const k of Object.keys(PROFILES)) {
    const o = run(k, days);
    console.log(`\n${PROFILES[k].label}\n  Phase II (funded): ${f(o.phase2)}\n  Phase III:         ${f(o.phase3)}\n  First ending:      ${f(o.ending)}`);
    console.log('  first of each station:', o.log.join(', '));
    console.log('  at end:', JSON.stringify(o.final));
  }
}
module.exports = { run, PROFILES };
