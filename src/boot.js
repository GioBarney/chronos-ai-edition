'use strict';
/* ---------- boot ---------- */
let last = performance.now();
function frame(p) {
  let dt = (p - last) / 1000; last = p;
  if (dt > 2) { catchUp(dt * 1000); dt = 0; }
  dt = Math.min(dt, 0.1);
  const now = Date.now(), info = tick(dt, now);
  drawScene(info, p); drawScope(info, p); renderKnob(); renderStationBars();
  if (p - rt.lastUI > 100) { updateUI(info, now); rt.lastUI = p; }
  audioUpdate(info);
  requestAnimationFrame(frame);
}
function boot(data) {
  const fromHot = data && data.s;
  const saved = fromHot ? data.s : load();
  if (saved) { s = Object.assign(fresh(), saved, { up: Object.assign(fresh().up, saved.up || {}), st: Object.assign(freshSt(), saved.st || {}), stUp: Object.assign(freshUpSt(), saved.stUp || {}), apps: saved.apps || {} });
    if (!saved.v2) { s.money = 0; s.st = freshSt(); s.funded = false; s.v2 = true; }
    if (!fromHot) catchUp(Date.now() - s.lastSave); }
  s.mix = Object.assign(defaultMix(), s.mix || {});
  if (s.muted) { s.mix.master.on = false; s.muted = false; }
  buildMixer(); updateSoundBtn(); buildStations(); buildGrants();
  freeLabel();
  readColors(); resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body); else window.addEventListener('resize', resize);
  if (!s.seenIntro) openLog(0, true);
  requestAnimationFrame(p => { last = p; frame(p); });
}
try { window.claude?.hot?.snapshot?.(() => ({ s })); } catch (e) {}
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
