'use strict';
/* Timing playtest bot (not shipped in the game).
   Run: node tools/playtest.js [days=45] [seed=1] [laid|opt|both]
   Loads the REAL src/data.js, src/crew.js (logic part), src/save.js and src/sim.js into a Node vm with stubbed DOM/audio and a fake clock,
   then plays a whole run with a scripted player: holds and tunes the dial, buys parts, decodes packets, runs stations,
   writes papers, applies for grants, hires crew, builds Phase III and claims the first ending.
   It calls the real tick() while the tab is open and the real catchUp() between sessions, so it exercises the actual live
   and offline code. Purchases use the same costs and rules as the UI, written out in this file (the UI handlers need a DOM).
   It measures TIMING only (the day each milestone is reached), not fun. Same seed = same result.
   Differs from tools/pacing.js: that one is a spreadsheet-style model of the formulas; this one runs the real simulation. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const crewSrc = read('crew.js'); const crewLogic = crewSrc.slice(0, crewSrc.indexOf('function statCell'));

/* open: windows the tab is open (hours of day). hold: sessions with hands on the dial (start hour, minutes). */
const PROFILES = {
  laid: { label: 'Laid-back (2 x 8 min sessions a day, tab closed otherwise)', open: [[8, 8 / 60], [20, 8 / 60]], hold: [[8, 8], [20, 8]],
    errMax: 1.1, holdLimit: 92, resume: 40, glintCatch: 0.3, listing: true },
  opt: { label: 'Optimizer (tab open 8:00-24:00, 6 x 15 min on the dial)', open: [[8, 16]], hold: [[8, 15], [11, 15], [14, 15], [17, 15], [20, 15], [23, 15]],
    errMax: 0.5, holdLimit: 80, resume: 35, glintCatch: 1, listing: true },
};

function run(profile, maxDays, seed) {
  const P = PROFILES[profile];
  const stubs = `
    let __seed = ${seed >>> 0}; Math.random = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };
    let __clock = 1e12; const __RealDate = Date; Date = { now: () => __clock };
    const matchMedia = () => ({ matches: false });
    const __el = new Proxy(function () {}, { get: (t, k) => k === 'hidden' ? true : k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === 'dataset' ? {} : __el, set: () => true, apply: () => __el });
    const document = { getElementById: () => __el, createElement: () => __el, addEventListener() {} };
    const window = {}; const localStorage = { getItem: () => null, setItem() {} };
    const sfx = new Proxy({}, { get: () => () => {} });
    const toast = () => {}, ensureAudio = () => {}, openLog = () => {}, openModal = () => {}, closeModal = () => {};
    const knob = __el, cap = __el;`;
  const driver = `
  function save() { s.lastSave = __clock; }
  const DAY = 86400, out = { ms: {}, endings: {}, log: [] };
  const START = __clock; s.startedAt = START; s.lastSave = START; s.seenIntro = true;
  const mark = (k, t) => { if (out.ms[k] == null) out.ms[k] = t / DAY + 1; };
  const have = job => s.crew.some(w => w.job === job);
  const payrollNow = () => s.crew.reduce((a, w) => a + w.wage, 0);
  let heldBack = false, errNow = 0, errNext = 0, glintSeen = null, lastHireTry = -1e9, T = 0;

  const needJobs = () => { const j = []; if (!have('paper')) j.push('paper'); if (!have('grant')) j.push('grant');
    STATIONS.forEach(x => { if (s.st[x.id].n && !have('st:' + x.id)) j.push('st:' + x.id); }); if (!have('dial')) j.push('dial'); return j; };

  function bot(open, holdingNow) {
    // stipend, funding resolution
    if (open) {
      if (s.funded && dayNum(__clock) > s.stipendDay) { s.money += stipendAmt(); s.stipendDay = dayNum(__clock); }
      if (s.paper && __clock >= s.paper.endAt) { s.money += s.paper.pay; s.papers++; s.paper = null; }
      GRANTS.forEach(g => { const a = s.apps[g.id]; if (a && __clock >= a.endAt) { if (a.ok) s.money += a.amt; delete s.apps[g.id]; } });
      processPaydays(__clock); resolveCrew(__clock); autoCrew();
      // Daily Transmission: log one per real day once packet 1 is decoded (PROP-010; PROP-019 gates Phase III on PHASE3_TX of them)
      if (s.packet >= 1 && dayNum(__clock) > s.dailyTxDay) { s.dailyTxDay = dayNum(__clock); s.dailyTxs = (s.dailyTxs || 0) + 1; }
      if (s.packet >= 7 && !s.funded) { s.funded = true; s.money += 50000; mark('funded (Phase II)', T); }
      // glints
      if (holdingNow && s.glint && s.glint !== glintSeen) { glintSeen = s.glint; if (Math.random() < P.glintCatch) catchGlint(); }
      // decode
      if (!s.decode && s.packet < PACKETS.length && s.photons >= pCost(s.packet)) { s.photons -= pCost(s.packet); s.decode = { idx: s.packet, endAt: __clock + pSecs(s.packet) * 1000 }; }
      // parts: cheapest affordable; keep a nearly-affordable packet
      for (let g = 0; g < 30; g++) {
        const opts = UPG.filter(u => u.unlock() && s.up[u.id] < u.max && cost(u) <= s.photons).sort((a, b) => cost(a) - cost(b));
        if (!opts.length) break;
        if (s.packet < PACKETS.length && !s.decode && !['tuner', 'lna', 'tape'].includes(opts[0].id) && s.photons - cost(opts[0]) < PACKETS[s.packet].cost * 0.5) break;
        s.photons -= cost(opts[0]); s.up[opts[0].id]++; }
      // idle stations: tap while the tab is open
      for (const st of STATIONS) { const o = s.st[st.id]; if (o.n && !o.run && stOpen(STATIONS.indexOf(st))) o.run = true; }
      if (s.funded) {
        // paper (photons), keep photons for phase III once the baseline exists
        const keep = (s.phase || 1) === 2 && s.st.interf.n >= 1 && s.photons < PHASE3_PHOTONS * 1.1;
        if (!s.paper && !keep && s.photons >= paperCost()) { const c = paperCost(); s.photons -= c; const secs = paperSecs(); s.paper = { endAt: __clock + secs * 1000, secs, pay: paperPay() }; }
        // grant
        if (!Object.keys(s.apps).length) { const gapH = P.open.length === 1 ? 3 : 12;
          const pick = GRANTS.slice().sort((a, b) => (grantChance(b) * grantAmt(b) / (Math.ceil(b.hrs / gapH) * gapH)) - (grantChance(a) * grantAmt(a) / (Math.ceil(a.hrs / gapH) * gapH)))[0];
          s.apps[pick.id] = { endAt: __clock + pick.hrs * 3600e3, ok: Math.random() < grantChance(pick), amt: grantAmt(pick) }; }
        // Cheque shows up when the heat bites
        if (!s.chequeMet && (s.heat >= 80 || rt.limiterCut || __clock < s.tripUntil) && s.money >= 8000) { s.chequeMet = true; hire(chequeWorker()); out.log.push('cheque d' + (T / DAY + 1).toFixed(1)); }
        const reserve = 3 * payrollNow() + 1000;
        // raises and offers
        s.inbox.slice().forEach(it => { const w = it.wid != null ? s.crew.find(x => x.id === it.wid) : null;
          if (it.type === 'raise' && w) { removeInbox(it.id); w.wage += it.amt; w.morale = Math.min(100, w.morale + 20); w.lastRaise = dayNum(__clock); }
          else if (it.type === 'offer' && w) { removeInbox(it.id); w.wage = it.amt; w.morale = Math.min(100, w.morale + 10); }
          else if (it.type === 'note' || it.type === 'cheque') removeInbox(it.id); });
        // hiring: list the job, take the best-fitting applicant for the next needed job
        const needs = needJobs();
        s.listing = !!(P.listing && needs.length && s.money > reserve + 3000);
        if (needs.length) { const job = needs[0];
          const apps = s.inbox.filter(x => x.type === 'apply').sort((a, b) => fitOf(b.applicant, job) - fitOf(a.applicant, job));
          const top = apps[0];
          if (top && fitOf(top.applicant, job) >= 0.45 && s.money >= top.applicant.wage * 4 + reserve) { removeInbox(top.id); top.applicant.job = job; hire(top.applicant); out.log.push('hire ' + job + ' d' + (T / DAY + 1).toFixed(1)); } }
        // stations: unlock next in chain, then reinvest small slices
        const ci = STATIONS.findIndex(x => s.st[x.id].n === 0), spare = () => s.money - reserve;
        if (ci >= 0 && stOpen(ci) && spare() >= costN(STATIONS[ci], 1)) { s.money -= costN(STATIONS[ci], 1); s.st[STATIONS[ci].id].n++; mark('station ' + STATIONS[ci].id, T); }
        else { let best = null;
          STATIONS.forEach((st, i) => { const o = s.st[st.id]; if (!o.n || !stOpen(i)) return;
            const c1 = costN(st, 1), sc = payout(st) / o.n / cycleSecs(st) / c1;
            if (c1 <= 0.2 * spare() && (!best || sc > best.score)) best = { st, c: c1, score: sc, kind: 'n' };
            if (s.stUp[st.id] < 5) { const uc = upCost(st), sc2 = payout(st) * 2 / cycleSecs(st) / uc; if (uc <= 0.2 * spare() && (!best || sc2 > best.score)) best = { st, c: uc, score: sc2, kind: 'u' }; } });
          if (best) { s.money -= best.c; if (best.kind === 'n') s.st[best.st.id].n++; else s.stUp[best.st.id]++; } }
        // Phase III
        if ((s.phase || 1) === 2 && s.st.interf.n >= 1 && s.photons >= PHASE3_PHOTONS && s.money >= PHASE3_MONEY && (s.dailyTxs || 0) >= PHASE3_TX) { s.photons -= PHASE3_PHOTONS; s.money -= PHASE3_MONEY; s.phase = 3; mark('Phase III', T); }
      }
    }
    if (s.packet >= 1) for (let p = 1; p <= s.packet; p++) mark('packet ' + p, T);
    if ((s.phase || 1) >= 3) ENDINGS.forEach(e => { if (!out.endings[e.id] && e.ok()) { out.endings[e.id] = T / DAY + 1; mark('first ending available (' + e.id + ')', T); } });
  }

  // build the list of open and hold intervals (seconds from start) for one day
  const inAny = (list, sec) => list.some(([h, len]) => { const a = h * 3600, b = a + len * 3600; return sec >= a && sec < b; });
  const holdAny = sec => P.hold.some(([h, m]) => { const a = h * 3600; return sec >= a && sec < a + m * 60; });
  const openAny = sec => inAny(P.open, sec);
  const total = maxDays * DAY; let wasOpen = false, ticks = 0;
  const DT_HOLD = 0.25, DT_OPEN = 1, SLICE = 30;
  while (T < total) {
    const sec = T % DAY, isOpen = openAny(sec) || holdAny(sec), hold = holdAny(sec);
    if (!isOpen) {
      // tab closed: jump to the next time it opens, like reopening the page
      let next = Infinity;
      for (let d = 0; d < 2; d++) for (const [h, len] of P.open.concat(P.hold.map(([h2]) => [h2, 0]))) { const t0 = Math.floor(T / DAY) * DAY + d * DAY + h * 3600; if (t0 > T && t0 < next) next = t0; }
      T = Math.min(next, total); __clock = START + T * 1000; wasOpen = false; continue;
    }
    if (!wasOpen) { wasOpen = true; catchUp(__clock - s.lastSave); rt.holding = false; bot(true, false); }
    // one slice of play: either dial time (fine steps) or tab-open time (coarse steps)
    const sliceEnd = Math.min(T + SLICE, total), step = hold ? DT_HOLD : DT_OPEN;
    for (; T < sliceEnd; T += step) {
      __clock = START + T * 1000;
      if (hold) {
        const tripped = __clock < s.tripUntil;
        if (!heldBack && (s.heat >= P.holdLimit || tripped)) heldBack = true;
        if (heldBack && s.heat <= P.resume && !tripped) heldBack = false;
        if (Math.random() < 0.1) errNext = (Math.random() * 2 - 1) * P.errMax;
        errNow += (errNext - errNow) * 0.3;
        rt.holding = !heldBack && !tripped; s.tuned = target() + errNow * bandW();
      } else rt.holding = false;
      tick(step, __clock); ticks++;
    }
    s.lastSave = __clock;
    bot(true, hold);
    // end of the open stretch: if the next 30 s is closed, mark closed
    if (!(openAny(T % DAY) || holdAny(T % DAY))) { wasOpen = false; rt.holding = false; }
  }
  out.final = { day: T / DAY, packet: s.packet, phase: s.phase, papers: s.papers, money: Math.round(s.money), photons: Math.round(s.photons),
    stations: Object.fromEntries(STATIONS.map(x => [x.id, s.st[x.id].n])), crew: s.crew.map(w => w.job).filter(Boolean).length, ticks, caution: s.caution };
  return out;`;
  const src = `${stubs}\n${read('data.js')}\n${crewLogic}\n${read('save.js')}\n${read('sim.js')}\nconst P = ${JSON.stringify(P)}, maxDays = ${maxDays};\nfunction __run() {${driver}}\n__run();`;
  return vm.runInNewContext(src, {}, { timeout: 600000 });
}

if (require.main === module) {
  const days = +process.argv[2] || 45, seed = +process.argv[3] || 1, which = process.argv[4] || 'both';
  const keys = which === 'both' ? Object.keys(PROFILES) : [which];
  for (const k of keys) {
    const t0 = Date.now(), o = run(k, days, seed);
    console.log(`\n${PROFILES[k].label}  (seed ${seed}, ${days} days simulated in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${o.final.ticks} live ticks)`);
    Object.entries(o.ms).sort((a, b) => a[1] - b[1]).forEach(([n, d]) => console.log(`  day ${d.toFixed(1).padStart(5)}  ${n}`));
    console.log('  log:', o.log.join(', '));
    console.log('  at end:', JSON.stringify(o.final));
  }
}
module.exports = { run, PROFILES };
