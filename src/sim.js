'use strict';
/* ---------- simulation ---------- */
// One station-cycle routine for live play (sec = frame dt) and offline catch-up (sec = time away).
// With a runner the station loops and keeps any overflow, so several cycles can pay in one step;
// without one, a manually started run finishes once and stops. Returns cycles paid.
function advanceStation(st, sec) {
  const o = s.st[st.id]; if (!o.n || !(sec > 0)) return 0;
  if (s.funded && runnerOf(st.id)) {
    const t = (o.run ? o.p : 0) + sec / cycleSecs(st), cyc = Math.floor(t);
    o.p = t - cyc; o.run = true;
    if (cyc > 0) { const pay = payout(st) * cyc; s.photons += pay; s.total += pay; }
    return cyc;
  }
  if (!o.run) return 0;
  o.p += sec / cycleSecs(st);
  if (o.p < 1) return 0;
  const pay = payout(st); o.p = 0; o.run = false; s.photons += pay; s.total += pay;
  return 1;
}
function tick(dt, now) {
  if (s.funded && (s.phase || 1) < 2) s.phase = 2;
  s.drift += dt * driftMul();
  const tgt = target(), errS = s.tuned - tgt, err = Math.abs(errS), band = bandW();
  const tripped = now < s.tripUntil;
  if (rt.limiterCut && s.heat < 55) rt.limiterCut = false;
  const receiving = rt.holding && !tripped && !rt.limiterCut;
  const locked = receiving && err <= band;

  if (receiving) {
    if (locked) s.clarity += (5 + 15 * (1 - err / band)) * lnaGain() * dt;
    else s.clarity -= 14 * dt;
  } else s.clarity -= 5 * lnaDecay() * dt;
  s.clarity = clamp(s.clarity, 0, 100);

  if (receiving) s.heat += 5.5 * heatRate() * (s.heat > 85 ? 1.35 : 1) * dt;
  else s.heat -= 9 * coolRate() * dt;
  s.heat = clamp(s.heat, 0, 100);

  // hidden caution: letting go on your own while running hot
  if (receiving && s.heat > 65) rt.cautionArmed = true;
  if (rt.cautionArmed && !rt.holding && s.heat < 85 && !tripped && !rt.limiterCut) { s.caution += 1; rt.cautionArmed = false; }
  if (s.heat < 40) rt.cautionArmed = false;

  if (receiving && s.heat >= 85 && !s.limiterOff) {
    rt.limiterCut = true; rt.cautionArmed = false; sfx.limiter(); toast('Safety limiter cut the receiver. It’s cooling down.');
  }
  if (receiving && s.heat > 85 && s.limiterOff) s.risk += dt / 10;
  if (s.heat >= 100 && !tripped) {
    s.tripUntil = now + 25000; s.clarity = 0; s.risk += 3; rt.cautionArmed = false;
    sfx.trip(); toast('The receiver burned out. 25 seconds to cool down.');
  }

  let r = 0;
  if (receiving) { r = baseRate() * Math.pow(s.clarity / 100, 1.5); if (s.heat > 85) r *= 1.6; }
  const total = (r + passiveRate() + (rt.holding ? 0 : operatorRate())) * (surgeOn(now) ? SURGE_MUL : 1) * echoMul();
  s.photons += total * dt; s.total += total * dt;
  rt.rate += (total - rt.rate) * Math.min(1, dt * 4);
  if (r > 0) {
    const step = Math.max(1, r / 9);
    rt.popAcc = Math.min(rt.popAcc + r * dt, step * 2);
    if (rt.popAcc >= step && now - rt.lastPop > 55) { rt.popAcc -= step; rt.lastPop = now; sfx.pop(); }
  } else rt.popAcc = 0;
  for (const st of STATIONS) { if (advanceStation(st, dt) > 0) { sfx.cash(); const e = rt.stEl && rt.stEl[st.id];
      if (e) { e.row.classList.add('flash'); setTimeout(() => e.row.classList.remove('flash'), 350); } } }

  if (s.decode && now >= s.decode.endAt) {
    s.packet = s.decode.idx + 1; s.decode = null; sfx.decoded(); openLog(s.packet, true); save();
  }
  if (locked && !rt.prevLocked && now - rt.lastChime > 1500) { sfx.lock(); rt.lastChime = now; }
  rt.prevLocked = locked;
  glintTick(dt, now);
  surveyTick(now);
  if (receiving && s.heat > 75 && now - rt.lastWarn > 1100) { sfx.warn(); rt.lastWarn = now; }
  return { tgt, errS, err, band, receiving, locked, tripped };
}


/* ---------- anomaly glints (PROP-005) ----------
   Play time only: the timer runs inside tick(), so it pauses while the tab is hidden
   and offline catch-up never spawns glints. */
function glintTick(dt, now) {
  if (s.glint) {
    if (now > s.glint.until) {
      s.glint = null; s.glintIn = glintGap();
      if (jobEff('dial') > 0) { const v = glintValue() * GLINT_AUTO; s.photons += v; s.total += v; s.glintsAuto++;
        toast(`Your dial operator caught the glint you missed: +${big(v)} photons.`); }
    }
    return;
  }
  if (!s.seenIntro || !$('modal').hidden) return;
  s.glintIn -= dt;
  if (s.glintIn <= 0) {
    s.glint = { kind: Math.random() < (s.clarity < 40 ? 0.5 : 0.75) ? 'surge' : 'clear', until: now + GLINT_WINDOW };
    sfx.glint(); toast('An anomaly glint is shimmering on the receiver.');
  }
}
function catchGlint() {
  const g = s.glint, now = Date.now(); if (!g || now > g.until) return;
  s.glint = null; s.glintIn = glintGap(); s.glints++;
  ensureAudio(); sfx.glintCatch();
  if (g.kind === 'surge') { s.surgeUntil = now + SURGE_MS; toast('Photon surge: ×3 photons for 60 seconds.'); }
  else { s.clarity = 100; toast('The glint cleared the noise. Signal clarity is back to 100%.'); }
  save();
}

/* ---------- long-baseline surveys (PROP-042) ----------
   Wall-clock timer (like papers), so it keeps running while the tab is closed. */
function surveyTick(now) {
  if (!s.surveyAt || now < s.surveyAt) return;
  s.surveyAt = 0; s.surveys = Math.min(SURVEY_CAP, (s.surveys || 0) + 1);
  sfx.decoded(); toast(`Survey complete. Survey Star ${s.surveys} of ${SURVEY_CAP}: stations pay +${Math.round((surveyMul() - 1) * 100)}%.`); save();
}
function startSurvey() {
  if (!surveyOpen() || s.surveyAt || surveyStars() >= SURVEY_CAP) return;
  const c = surveyCost(); if (s.money < c) return;
  s.money -= c; s.surveyAt = Date.now() + surveySecs() * 1000; ensureAudio(); sfx.buy();
  toast(`Long-baseline survey started. Back in ${dur(surveySecs())}.`); save();
}
