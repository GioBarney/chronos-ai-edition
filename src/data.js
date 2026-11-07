'use strict';
const KEY = 'chronos.ai.save.v1';
const HOUR = 3600e3, OFFLINE_CAP = 12 * HOUR;
const HLINE = 1420.405;
const FMIN = 1420.300, FMAX = 1420.510;

const PACKETS = [
  { cost: 25,   secs: 120 },
  { cost: 90,   secs: 600 },
  { cost: 220,  secs: 1800 },
  { cost: 480,  secs: 3600 },
  { cost: 950,  secs: 7200 },
  { cost: 1700, secs: 14400 },
  { cost: 2900, secs: 28800 },
];

const LOGS = [
  { title: 'Day 1', short: 'Nobody told the receiver.',
    body: "The Hollow Ridge array was shut down in 2019 when the grant ran out. Nobody told the receiver.\n\nSince Tuesday it has been picking up something at the hydrogen line, 1420.405 MHz. Every radio astronomer on Earth listens there. It's faint, and it drifts.\n\nKeep your hand on the dial." },
  { title: 'Packet 001', short: 'Nature doesn’t count in primes.',
    body: "Three bytes recovered. A pulse, a gap, a pulse. The gaps are prime-spaced: 2, 3, 5, 7, 11.\n\nPulsars don't do that. Nature doesn't count in primes." },
  { title: 'Packet 002', short: 'Getting closer without moving.',
    body: "The Doppler shift is wrong. The source isn't moving away from us. It isn't moving at all.\n\nBut the signal is getting stronger. Something is getting closer without changing position." },
  { title: 'Packet 003', short: 'The header is in my format.',
    body: "Recovered a full header. The field layout matches our own telemetry {{standard|0x89}}, the one I wrote for this station in 2017.\n\nNobody outside this building has ever seen that format." },
  { title: 'Packet 004', short: 'A date, 29 days out.',
    body: "The header timestamp decodes cleanly. It's a date.\n\nIt's 29 days from today." },
  { title: 'Packet 005', short: 'Someone breathing.',
    body: "There's a second layer under the carrier wave. Slowed down forty times, it sounds like someone breathing.\n\nSteady. Patient. Like they're waiting for me to finish something." },
  { title: 'Packet 006', short: '26.18 N, 98.15 W.',
    body: "Coordinates. Not a star, not a galaxy.\n\n26.18 N, 98.15 W. That's this {{building|0x24}}." },
  { title: 'Packet 007', short: 'My callsign. Not yet.',
    body: "The sender field isn't empty. It's my callsign.\n\nI haven't transmitted anything. Not yet.\n\nI can't keep up with it by hand anymore. I need something that listens while I sleep." },
];

const UPG = [
  { id: 'tuner', name: 'Fine-tune the tuner knob', max: 10, base: 12, mul: 1.17, unlock: () => true,
    desc: () => `+0.6 photons/s at full clarity (now ${fmt1(baseRate())}/s)` },
  { id: 'lens', name: 'Polish the dish surface', max: 6, base: 30, mul: 1.35, unlock: () => true,
    desc: () => 'The signal drifts 12% slower' },
  { id: 'horn', name: 'Realign the feed horn', max: 6, base: 45, mul: 1.35, unlock: () => true,
    desc: () => `Lock window 18% wider (now ±${(bandW() * 1000).toFixed(1)} kHz)` },
  { id: 'lna', name: 'Low-noise amplifier', max: 5, base: 60, mul: 1.4, unlock: () => s.packet >= 1,
    desc: () => 'Clarity builds faster and fades slower' },
  { id: 'sink', name: 'Copper heat sink', max: 5, base: 80, mul: 1.4, unlock: () => s.packet >= 2,
    desc: () => 'The receiver heats up slower and cools faster' },
  { id: 'tape', name: 'Reel-to-reel tape recorder', max: 1, base: 3200, mul: 1, unlock: () => s.packet >= 7,
    desc: () => 'Keeps capturing while you’re away, up to a 12-hour buffer' },
];

const MIX = [
  { id: 'master', name: 'All sound', desc: 'Everything at once' },
  { id: 'wave', name: 'Wave tone', desc: 'The tone that tells you how close you are' },
  { id: 'photons', name: 'Photon pops', desc: 'Bubbles as photons come in' },
  { id: 'money', name: 'Station and grant chimes', desc: 'When a station finishes or money comes in' },
  { id: 'clicks', name: 'Dial clicks', desc: 'Dial steps and building parts' },
  { id: 'alerts', name: 'Alerts and chimes', desc: 'Lock, decode and heat warnings' },
  { id: 'static', name: 'Static', desc: 'Noise while you’re off the signal' },
  { id: 'amb', name: 'Ambience', desc: 'The low hum of the station' },
];
const STATIONS = [
  { id: 'logger', name: 'Data logger', cost: 5e4, mul: 1.07, time: 6, rev: 1, color: 'signal' },
  { id: 'spec', name: 'Spectrometer rack', cost: 4e5, mul: 1.15, time: 20, rev: 12, color: 'ok' },
  { id: 'array', name: 'Small dish array', cost: 3.2e6, mul: 1.14, time: 45, rev: 90, color: 'heat' },
  { id: 'relay', name: 'Relay tower', cost: 2.5e7, mul: 1.13, time: 90, rev: 630, color: 'anomaly' },
  { id: 'pulsar', name: 'Pulsar timing lab', cost: 2e8, mul: 1.12, time: 180, rev: 4500, color: 'signal' },
  { id: 'dsn', name: 'Deep space uplink', cost: 1.6e9, mul: 1.11, time: 480, rev: 43200, color: 'ok' },
  { id: 'interf', name: 'Interferometer baseline', cost: 1.28e10, mul: 1.10, time: 1800, rev: 576000, color: 'anomaly' },
];
const GRANTS = [
  { id: 'seed', name: 'University seed fund', hrs: 2, chance: 0.9, base: 3e4 },
  { id: 'nsf', name: 'National science grant', hrs: 12, chance: 0.6, base: 2.5e5 },
  { id: 'found', name: 'Private foundation', hrs: 48, chance: 0.35, base: 2e6 },
];
const freshUpSt = () => Object.fromEntries(STATIONS.map(x => [x.id, 0]));
const MILESTONES = [25, 50, 100, 200, 300, 400];
const freshSt = () => Object.fromEntries(STATIONS.map(x => [x.id, { n: 0, p: 0, run: false }]));
const defaultMix = () => Object.fromEntries(MIX.map(m => [m.id, { on: true, vol: m.id === 'master' ? 80 : 100 }]));
/* ---------- anomaly glints (PROP-005) ---------- */
const GLINT_MIN = 480, GLINT_MAX = 900;    // seconds of play between glints (8-15 min)
const GLINT_WINDOW = 20e3;                 // ms to catch one
const SURGE_MS = 60e3, SURGE_MUL = 3;      // x3 photons for 60 s
const GLINT_AUTO = 0.25;                   // a dial operator auto-collects missed glints at 25% value
const glintSense = () => { try { return s.echoUp.glint || 0; } catch (e) { return 0; } }; // s may not exist yet (TDZ) while building the first fresh()
const glintGap = () => (GLINT_MIN + Math.random() * (GLINT_MAX - GLINT_MIN)) * (1 - 0.08 * glintSense());
const surgeOn = now => now < s.surgeUntil;
// photons a full surge adds over 60 s at full clarity (the x3 minus the x1 you'd get anyway)
const glintValue = () => (SURGE_MUL - 1) * (baseRate() + passiveRate() + operatorRate()) * SURGE_MS / 1000;
const fresh = () => ({
  v: 6, phase: 1, echoes: 0, endingsSeen: {}, loops: 0, loopReady: false, echoSpent: 0, echoUp: {}, startedAt: Date.now(), lastSave: Date.now(),
  photons: 0, total: 0, clarity: 0, heat: 0,
  tuned: 1420.380, knobAngle: 0, drift: 0,
  up: { tuner: 0, lens: 0, horn: 0, lna: 0, sink: 0, tape: 0 },
  packet: 0, decode: null, limiterOff: false, tripUntil: 0,
  caution: 0, risk: 0, seenIntro: false, weekDone: false, muted: false, free: false, mix: defaultMix(), money: 0, buyMode: '1', st: freshSt(), stUp: freshUpSt(), funded: false, papers: 0, paper: null, apps: {}, stipendDay: 0, v2: true, crew: [], inbox: [], listing: false, nextApp: 0, scout: null, scouts: 0, payDay: 0, chequeMet: false, wseq: 1,
  glintIn: glintGap(), glint: null, surgeUntil: 0, glints: 0, glintsAuto: 0, dailyTxDay: 0, dailyTxs: 0,
});
/* Daily transmissions (PROP-010): one short fragment per real day, rotating. Hex clues point at 137.036 MHz. */
const DAILY_TX = [
  'Carrier steady. A voice, very tired, counts backwards from {137|0x89}.',
  'The message repeats, but a word is different each time. Your word.',
  'Static, then a kettle whistling. Hollow Ridge has no kettle.',
  'It is asking the dial to settle near one-three-seven, and then a decimal. 0x0.036.',
  'Someone hums the shift-change tune. You never told anyone about the tune.',
  'A long pause. Then: "Do not trust the quiet hours. Trust 1420.405."',
  'The signal thanks you, in your own handwriting somehow. 0x1420.',
];
/* The four endings (PROP-012). Secret corridor: tune near 1420.336 MHz (the 0x0.036 clue) after logging 3 daily transmissions. */
const SECRET_MHZ = 1420.336, SECRET_TOL = 0.004;
const ENDINGS = [
  { id: 'bureaucrat', name: 'The Bureaucrat', echoes: 0, hint: 'File the paperwork. Five papers or five careful releases.',
    ok: () => s.papers >= 5 || s.caution >= 5,
    text: 'You file everything in triplicate. The signal waits, politely, for approval that never comes. The grant renews itself forever. Nobody ever finishes reading your report, and the array hums on in a very clean building.' },
  { id: 'collapse', name: 'The Collapse', echoes: 0, hint: 'Run hot with the limiter off.',
    ok: () => !!s.limiterOff && s.heat >= 90,
    text: 'The limiter is off and the dish is glowing. For one long second the carrier and the receiver agree on everything. Then the lights of Hollow Ridge go out, one row at a time, and the breathing stops.' },
  { id: 'ouroboros', name: 'The Ouroboros', echoes: 1, hint: 'Hold the signal near perfect clarity with an Interferometer online.',
    ok: () => s.clarity >= 95 && s.st.interf.n >= 1,
    text: 'The date in the header was always today. You decode the sender field and it is your callsign, and the callsign is you, and the signal is the thing you are about to send. You press the key. Day 1 begins again, and you remember it.' },
  { id: 'secret', name: 'The 137 Corridor', echoes: 2, hint: 'Something is hidden between the numbers.',
    ok: () => (s.dailyTxs || 0) >= 3 && Math.abs(s.tuned - SECRET_MHZ) <= SECRET_TOL,
    text: 'You stop chasing the hydrogen line and let the dial settle where the voice kept asking. A second, quieter carrier opens. It is not a message. It is a door someone left unlocked for you, a long time from now.' },
];
/* Echoes prestige + New Game+ loop (PROP-013). s.echoes = lifetime Echoes earned (never lost); s.echoSpent = Echoes spent on upgrades. */
const ECHO_BONUS = 0.25, ECHO_MAX_LV = 5;
const echoMul = () => 1 + ECHO_BONUS * (s.echoes || 0);
const echoFree = () => Math.max(0, (s.echoes || 0) - (s.echoSpent || 0));
const echoLv = id => (s.echoUp && s.echoUp[id]) || 0;
const ECHO_UPG = [
  { id: 'memory', name: 'Photon memory', desc: lv => `Each new loop starts with ${fmt(500 * (lv + 1))} photons banked (now ${fmt(500 * lv)}).` },
  { id: 'fund', name: 'Alumni fund', desc: lv => `Each new loop starts with ${money(25000 * (lv + 1))} once funded (now ${money(25000 * lv)}).` },
  { id: 'steady', name: 'Steady hands', desc: lv => `The receiver heats up ${(lv + 1) * 6}% slower (now ${lv * 6}%).` },
  { id: 'glint', name: 'Glint sense', desc: lv => `Anomaly glints arrive ${(lv + 1) * 8}% sooner (now ${lv * 8}%).` },
];
const echoCost = id => 1 + echoLv(id);
const PHASE3_PHOTONS = 5e6, PHASE3_MONEY = 250000;
const DAILY_TX_PHOTON_MIN = 600, DAILY_TX_CLARITY = 25;
let s = fresh();
const rt = { holding: false, lastAng: null, limiterCut: false, cautionArmed: false, prevLocked: false,
  lastChime: 0, openW: new Set(), crewSig: '', popAcc: 0, lastPop: 0, lastPreview: 0, lastWarn: 0, lastClick: 0, lastUI: 0, rate: 0, verTaps: [], upSig: '', logSig: -1 };

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = n => Math.floor(n).toLocaleString('en-US');
const fmt1 = n => n.toFixed(1);
const pid = n => 'Packet ' + String(n).padStart(3, '0');
const dur = sec => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(x).padStart(2, '0')}s` : `${x}s`; };

const baseRate = () => 1 + 0.6 * s.up.tuner;
const driftMul = () => Math.pow(0.88, s.up.lens);
const bandW = () => 0.004 * (1 + 0.18 * s.up.horn);
const lnaGain = () => 1 + 0.3 * s.up.lna;
const lnaDecay = () => Math.pow(0.8, s.up.lna);
const heatRate = () => Math.pow(0.85, s.up.sink) / (1 + jobEff('cool')) * (1 - 0.06 * echoLv('steady'));
const coolRate = () => Math.pow(1.15, s.up.sink) * (1 + jobEff('cool'));
const msCount = n => MILESTONES.filter(m => n >= m).length;
const nextMs = n => MILESTONES.find(m => n < m);
const cycleSecs = st => { const e = jobEff('st:' + st.id); return st.time / Math.pow(2, msCount(s.st[st.id].n)) / ((s.phase || 1) >= 3 ? 2 : 1) / (e ? 0.6 + 0.8 * e : 1); };
const payout = st => st.rev * s.st[st.id].n * Math.pow(3, s.stUp[st.id]) * echoMul();
const upCost = st => s.free ? 0 : st.cost * 25 * Math.pow(12, s.stUp[st.id]);
const stOpen = i => s.funded && (i === 0 || s.st[STATIONS[i - 1].id].n >= 1);
const repu = () => s.papers + Object.values(s.st).reduce((a, o) => a + o.n, 0) / 10;
const paperCost = () => s.free ? 0 : Math.round(2500 * Math.pow(1.22, s.papers));
const paperSecs = () => s.free ? 0 : Math.min(4 * 3600, 1200 * Math.pow(1.1, s.papers)) * (1 - 0.4 * Math.min(1, jobEff('paper')));
const paperPay = () => 20000 * Math.pow(1.33, s.papers) * (1 + 0.5 * jobEff('paper'));
const grantChance = g => Math.min(0.98, g.chance + 0.2 * jobEff('grant'));
const operatorRate = () => { const e = jobEff('dial'); return e ? baseRate() * 0.5 * e : 0; };
const stipendAmt = () => 5000 * (1 + repu() * 0.15);
const grantAmt = g => g.base * (1 + repu() * 0.1);
const dayNum = now => Math.floor((now - s.startedAt) / 86400e3) + 1;
const big = v => { if (v < 1e6) return v < 10 && v % 1 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  const e = Math.min(NAMES.length - 1, Math.floor(Math.log10(v) / 3)); return (v / Math.pow(1000, e)).toFixed(2) + ' ' + NAMES[e]; };
const costN = (st, k) => { if (s.free) return 0; const n = s.st[st.id].n; return st.cost * Math.pow(st.mul, n) * (Math.pow(st.mul, k) - 1) / (st.mul - 1); };
const maxAfford = st => { if (s.free) return 100; const n = s.st[st.id].n, r = st.mul, c0 = st.cost * Math.pow(r, n);
  return Math.max(0, Math.floor(Math.log(s.money * (r - 1) / c0 + 1) / Math.log(r) + 1e-9)); };
const buyCount = st => s.buyMode === 'max' ? Math.max(1, maxAfford(st)) : (s.buyMode === '10' ? 10 : 1);
const NAMES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];
const money = v => { if (v < 1e6) return '$' + (v < 1000 ? v.toFixed(2) : Math.floor(v).toLocaleString('en-US'));
  const e = Math.min(NAMES.length - 1, Math.floor(Math.log10(v) / 3)); return '$' + (v / Math.pow(1000, e)).toFixed(3) + ' ' + NAMES[e]; };
const passiveRate = () => s.up.tape ? 0.08 * baseRate() + 0.1 : 0;
const cost = u => s.free ? 0 : Math.ceil(u.base * Math.pow(u.mul, s.up[u.id]));
const pCost = i => s.free ? 0 : PACKETS[i].cost;
const pSecs = i => s.free ? 0 : PACKETS[i].secs;
const target = () => { const t = s.drift;
  return HLINE + 0.018 * Math.sin(t * 0.031) + 0.011 * Math.sin(t * 0.077 + 1.3) + 0.006 * Math.sin(t * 0.19 + 0.4); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

