'use strict';
/* ---------- save ---------- */
function load() {
  try { const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); if (!o.v2) { delete o.money; delete o.st; delete o.stUp; delete o.funded; delete o.seeded; o.v2 = true; } if (!(o.v >= 2)) { o.v = 2; o.glintIn = glintGap(); o.glint = null; o.surgeUntil = 0; o.glints = 0; o.glintsAuto = 0; }
      if (!(o.v >= 3)) { o.v = 3; o.dailyTxDay = o.dailyTxDay || 0; o.dailyTxs = o.dailyTxs || 0; } // v2 -> v3: daily transmissions (PROP-010) // v1 -> v2: anomaly glints (PROP-005)
      if (!(o.v >= 4)) { o.v = 4; o.phase = o.funded ? 2 : 1; } // v3 -> v4: phase shifts (PROP-011)
      if (!(o.v >= 5)) { o.v = 5; o.echoes = o.echoes || 0; o.endingsSeen = o.endingsSeen || {}; } // v4 -> v5: endings (PROP-012)
      if (!(o.v >= 6)) { o.v = 6; o.loops = o.loops || 0; o.loopReady = Object.keys(o.endingsSeen || {}).length > 0; o.echoSpent = o.echoSpent || 0; o.echoUp = o.echoUp || {}; } // v5 -> v6: echoes prestige (PROP-013)
      const f = fresh(); return Object.assign(f, o, { up: Object.assign(f.up, o.up || {}) }); }
  } catch (e) {}
  return null;
}
function save() {
  s.lastSave = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); $('saved').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch (e) { $('saved').textContent = 'Saving is unavailable in this browser'; }
}
function catchUp(gapMs) {
  if (gapMs < 2000) return;
  const sec = Math.min(gapMs, OFFLINE_CAP) / 1000;
  s.drift += sec * driftMul();
  s.heat = Math.max(0, s.heat - 9 * coolRate() * sec);
  s.clarity = Math.max(0, s.clarity - 5 * lnaDecay() * sec);
  const before = s.photons;
  const p = (passiveRate() + operatorRate()) * sec * echoMul();
  s.photons += p; s.total += p;
  for (const st of STATIONS) advanceStation(st, sec);
  const got = s.photons - before;
  if (got >= 1) toast(`While you were away you collected ${big(got)} photons${gapMs > OFFLINE_CAP ? ' (12-hour buffer full)' : ''}.`);
}

