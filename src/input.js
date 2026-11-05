'use strict';
/* ---------- input ---------- */
const knob = $('knob'), cap = $('cap');
function turn(deg) {
  const before = Math.round(s.tuned * 1000);
  s.tuned = clamp(s.tuned + deg / 360 * 0.04, FMIN, FMAX);
  s.knobAngle = (s.knobAngle + deg) % 360;
  const after = Math.round(s.tuned * 1000);
  if (after !== before && performance.now() - rt.lastClick > 28) { sfx.click(); rt.lastClick = performance.now(); }
}
const angleOf = e => { const r = knob.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
knob.addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); try { knob.setPointerCapture(e.pointerId); } catch (x) {}
  rt.holding = true; rt.lastAng = angleOf(e); knob.classList.add('active'); });
knob.addEventListener('pointermove', e => { if (!rt.holding || rt.lastAng == null) return;
  const a = angleOf(e); let d = a - rt.lastAng; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
  rt.lastAng = a; turn(d * 180 / Math.PI); });
const endHold = () => { rt.holding = false; rt.lastAng = null; knob.classList.remove('active'); };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => knob.addEventListener(ev, endHold));
window.addEventListener('blur', endHold);
window.addEventListener('keydown', e => {
  if (!$('modal').hidden || e.target.closest('button,input')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); ensureAudio(); turn(e.shiftKey ? 45 : 9); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); ensureAudio(); turn(e.shiftKey ? -45 : -9); }
  else if (e.code === 'Space') { e.preventDefault(); ensureAudio(); rt.holding = true; knob.classList.add('active'); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') endHold(); });
document.addEventListener('pointerdown', () => ensureAudio(), { once: true });

