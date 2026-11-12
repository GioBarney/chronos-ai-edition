'use strict';
/* ---------- audio ---------- */
let AC = null, master = null; const N = {}, BUS = {};
// Bundled CC0 samples are optional: failed fetch/decode keeps the original synth sounds.
const SAMPLES = Object.create(null);
const SAMPLE_BUS = { tick: 'clicks', buy: 'clicks', chips1: 'photons', money: 'money', lock: 'alerts', knock: 'alerts' };
let samplesRequested = false;
function loadSamples() {
  if (!AC || samplesRequested) return;
  samplesRequested = true;
  Object.keys(SAMPLE_BUS).forEach(name => {
    fetch('assets/sfx/' + name + '.mp3')
      .then(r => { if (!r.ok) throw Error('sample unavailable'); return r.arrayBuffer(); })
      .then(bytes => AC.decodeAudioData(bytes))
      .then(buffer => { SAMPLES[name] = buffer; })
      .catch(() => { /* Synth fallback stays active. */ });
  });
}
function cleanupSample(src, gain) {
  if (src) { src.onended = null; try { src.disconnect(); } catch (_) {} }
  if (gain) { try { gain.disconnect(); } catch (_) {} }
}
function playSample(name, volume = 1) {
  if (!AC || !SAMPLES[name] || !BUS[SAMPLE_BUS[name]]) return false;
  let src = null, g = null;
  try {
    src = AC.createBufferSource(); g = AC.createGain();
    src.buffer = SAMPLES[name]; g.gain.value = volume;
    src.connect(g).connect(BUS[SAMPLE_BUS[name]]);
    src.onended = () => cleanupSample(src, g);
    src.start();
    return true;
  } catch (_) {
    if (src) { try { src.stop(); } catch (_) {} }
    cleanupSample(src, g);
    return false;
  }
}
function playKnockSamples() {
  if (!AC || !SAMPLES.knock || !BUS.alerts) return false;
  const nodes = [];
  try {
    const start = AC.currentTime;
    for (const delay of [0, 0.18, 0.39]) {
      const src = AC.createBufferSource(), g = AC.createGain();
      nodes.push({ src, g });
      src.buffer = SAMPLES.knock; g.gain.value = 0.48;
      src.connect(g).connect(BUS.alerts);
      src.onended = () => cleanupSample(src, g);
      src.start(start + delay);
    }
    return true;
  } catch (_) {
    for (const { src, g } of nodes) {
      try { src.stop(); } catch (_) {}
      cleanupSample(src, g);
    }
    return false;
  }
}
const volOf = id => { const c = s.mix[id]; return c && c.on ? Math.pow(c.vol / 100, 2) : 0; };
function applyMix() {
  if (!AC) return; const t = AC.currentTime;
  master.gain.setTargetAtTime(volOf('master') * 0.95, t, 0.05);
  MIX.forEach(m => { if (m.id !== 'master') BUS[m.id].gain.setTargetAtTime(volOf(m.id), t, 0.05); });
}
function ensureAudio() {
  if (AC) {
    if (AC.state === 'suspended') {
      // PROP-039: some mobile browsers reject resume() outside a gesture; swallow it so a later gesture can retry.
      try { const r = AC.resume(); if (r && typeof r.catch === 'function') r.catch(function () {}); } catch (_) {}
    }
    return;
  }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = volOf('master') * 0.95;
  const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
  MIX.forEach(m => { if (m.id !== 'master') { BUS[m.id] = AC.createGain(); BUS[m.id].gain.value = volOf(m.id); BUS[m.id].connect(master); } });
  loadSamples();
  const len = AC.sampleRate * 2;
  const wb = AC.createBuffer(1, len, AC.sampleRate), wd = wb.getChannelData(0);
  const bb = AC.createBuffer(1, len, AC.sampleRate), bd = bb.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; wd[i] = w; last = (last + 0.02 * w) / 1.02; bd[i] = last * 3.5; }
  N.white = wb;
  const lp = f => { const n = AC.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; return n; };
  const gain = v => { const g = AC.createGain(); g.gain.value = v; return g; };
  // brown-noise room bed
  const bed = AC.createBufferSource(); bed.buffer = bb; bed.loop = true;
  const bedG = gain(0.045); bed.connect(lp(260)).connect(bedG).connect(BUS.amb); bed.start();
  // sub drone
  const dG = gain(0); dG.gain.setTargetAtTime(0.055, AC.currentTime, 2.5);
  const dF = lp(480); dF.connect(dG).connect(BUS.amb);
  const o1 = AC.createOscillator(); o1.frequency.value = 55; o1.connect(dF); o1.start();
  const o2 = AC.createOscillator(); o2.frequency.value = 82.4; o2.connect(dF); o2.start(); N.o2 = o2;
  // receiver static
  const st = AC.createBufferSource(); st.buffer = wb; st.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 0.8;
  N.stG = gain(0); st.connect(bp).connect(N.stG).connect(BUS.static); st.start();
  // carrier tone
  N.to = AC.createOscillator(); N.to.type = 'sine'; N.to.frequency.value = 440;
  N.toG = gain(0); N.to.connect(lp(1800)).connect(N.toG).connect(BUS.wave); N.to.start();
}
function audioUpdate(info) {
  if (!AC) return; const t = AC.currentTime;
  N.stG.gain.setTargetAtTime(info.receiving ? 0.006 + 0.07 * (1 - s.clarity / 100) : 0, t, 0.05);
  N.to.frequency.setTargetAtTime(440 + clamp(info.errS * 12000, -250, 500), t, 0.03);
  N.toG.gain.setTargetAtTime(info.receiving ? (info.locked ? 0.015 + 0.05 * s.clarity / 100 : 0.012) : 0, t, 0.06);
  N.o2.frequency.setTargetAtTime(82.4 + s.heat * 0.12, t, 0.5);
}
function env(node, peak, attack, decay, t) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function tone(freq, peak, decay, type = 'sine', when = 0, dest = null) {
  if (!AC) return; const t = AC.currentTime + when;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = freq;
  env(g, peak, 0.006, decay, t); o.connect(g).connect(dest || BUS.alerts); o.start(t); o.stop(t + decay + 0.1);
}
const sfx = {
  click() { if (!AC) return; if (playSample('tick', 0.42)) return; const t = AC.currentTime;
    const src = AC.createBufferSource(); src.buffer = N.white;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const g = AC.createGain(); env(g, 0.28, 0.001, 0.016, t);
    src.connect(hp).connect(g).connect(BUS.clicks); src.start(t, Math.random() * 1.5, 0.04);
    tone(190, 0.07, 0.03, 'sine', 0, BUS.clicks); },
  cash() { if (!AC) return; const n = performance.now(); if (n - (rt.lastCash || 0) < 70) return; rt.lastCash = n; if (playSample('money', 0.55)) return;
    tone(1568, 0.05, 0.18, 'sine', 0, BUS.money); tone(2349.3, 0.035, 0.3, 'sine', 0.06, BUS.money); },
  pop() { if (!AC) return; const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    const f = 360 + s.clarity * 3.6 + Math.random() * 160;
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.3, t + 0.055);
    env(g, 0.17, 0.004, 0.085, t); o.connect(g);
    let out = g; if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = (Math.random() - 0.5) * 0.7; g.connect(p); out = p; }
    out.connect(BUS.photons); o.start(t); o.stop(t + 0.14); },
  chime(fs, peak = 0.05, d = 1.8) { fs.forEach(f => { tone(f, peak, d); tone(f * 2.76, peak * 0.18, d * 0.5); }); },
  lock() { if (!playSample('lock', 0.55)) this.chime([1318.5, 1975.5], 0.045, 1.9); },
  decoded() { [659.3, 880, 1318.5, 1760].forEach((f, i) => { tone(f, 0.05, 1.6, 'sine', i * 0.13); tone(f * 2.76, 0.008, 0.8, 'sine', i * 0.13); }); },
  buy() { if (!AC) return; if (playSample('buy', 0.55)) return; const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.14);
    env(g, 0.32, 0.004, 0.2, t); o.connect(g).connect(BUS.clicks); o.start(t); o.stop(t + 0.3); this.click(); },
  chips() { if (!playSample('chips1', 0.4)) this.pop(); },
  knock() { if (!AC) return; if (!playKnockSamples()) { [0, 0.18, 0.39].forEach(delay => tone(135, 0.08, 0.07, 'sine', delay, BUS.alerts)); } },
  glint() { [2093, 2637, 3136].forEach((f, i) => tone(f, 0.018, 1.4, 'sine', i * 0.09)); },
  glintCatch() { [1046.5, 1568, 2093, 2637].forEach((f, i) => { tone(f, 0.04, 1.5, 'sine', i * 0.07); tone(f * 2.76, 0.006, 0.6, 'sine', i * 0.07); }); },
  warn() { tone(988, 0.025, 0.22); },
  limiter() { tone(784, 0.04, 0.5); tone(523.3, 0.04, 0.7, 'sine', 0.18); },
  trip() { if (!AC) return; const t = AC.currentTime;
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(80, t + 0.9);
    env(g, 0.18, 0.01, 0.95, t); o.connect(f).connect(g).connect(BUS.alerts); o.start(t); o.stop(t + 1.1); },
  power() { if (!AC) return; const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(220, t + 1.2);
    env(g, 0.12, 0.3, 1.1, t); o.connect(g).connect(BUS.alerts); o.start(t); o.stop(t + 1.6);
    setTimeout(() => this.lock(), 900); },
};

