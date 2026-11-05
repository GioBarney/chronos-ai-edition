'use strict';
/* ---------- canvas ---------- */
const scene = $('scene'), sctx = scene.getContext('2d');
const scope = $('scope'), pctx = scope.getContext('2d');
let DPR = 1, C = {};
function readColors() { const cs = getComputedStyle(document.documentElement);
  ['void', 'panel', 'panel-2', 'line', 'ink', 'muted', 'signal', 'anomaly', 'heat', 'danger', 'ok', 'hill-far', 'hill-mid', 'hill-near', 'dish', 'dish-shade', 'steel']
    .forEach(k => C[k] = cs.getPropertyValue('--' + k).trim()); }
function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2);
  [scene, scope].forEach(c => { c.width = Math.round(c.clientWidth * DPR); c.height = Math.round(c.clientHeight * DPR); }); }
const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.72, r: Math.random() * 1.3 + 0.3, ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 1.5 }));
const dust = Array.from({ length: reduced ? 0 : 22 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.004, vy: -0.002 - Math.random() * 0.004, r: Math.random() * 1.6 + 0.5 }));
function hill(ctx, W, H, baseY, amp, freq, phase, color) {
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += W / 40) ctx.lineTo(x, baseY - amp * (0.6 * Math.sin(x / W * freq + phase) + 0.4 * Math.sin(x / W * freq * 2.3 + phase * 1.7)));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
/* PROP-008: Hollow Ridge grows with the player. Derived from state only (no save data). */
function drawHorizonProgression(ctx, W, H, u, t) {
  const arr = s.st.array ? s.st.array.n : 0, rel = s.st.relay ? s.st.relay.n : 0;
  const hasCheque = s.crew && s.crew.some(w => w.cheque);
  const ground = H * 0.84;
  // secondary dishes (1 per ~25 owned, up to 3) on the right ridge
  const dishes = arr > 0 ? Math.min(3, 1 + Math.floor(arr / 25)) : 0;
  for (let i = 0; i < dishes; i++) {
    const x = W * (0.5 + i * 0.09), y = ground - (2 + i) * u, r = (9 - i * 1.5) * u;
    ctx.fillStyle = C.steel; ctx.fillRect(x - 1.2 * u, y - r, 2.4 * u, r);
    ctx.fillStyle = C.dish; ctx.beginPath(); ctx.ellipse(x, y - r, r, r * 0.55, -0.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = C['dish-shade']; ctx.beginPath(); ctx.arc(x + r * 0.25, y - r - r * 0.5, 1.2 * u, 0, 6.283); ctx.fill();
  }
  // relay tower with a blinking mast light
  if (rel > 0) {
    const x = W * 0.78, top = ground - 46 * u;
    ctx.strokeStyle = C.steel; ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.moveTo(x - 6 * u, ground); ctx.lineTo(x, top); ctx.lineTo(x + 6 * u, ground);
    ctx.moveTo(x - 3.5 * u, ground - 18 * u); ctx.lineTo(x + 3.5 * u, ground - 18 * u); ctx.stroke();
    if (Math.floor(t / 600) % 2 === 0) { ctx.fillStyle = C.danger; ctx.beginPath(); ctx.arc(x, top, 2 * u, 0, 6.283); ctx.fill(); }
  }
  // Cheque's HVAC van parked by the dish pedestal
  if (hasCheque) {
    const x = W * 0.3 + 26 * u, y = H * 0.93 - 2 * u, w = 30 * u, h = 13 * u;
    ctx.fillStyle = C.ink; ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = C.signal; ctx.fillRect(x, y - h * 0.55, w * 0.62, h * 0.12);
    ctx.fillStyle = C['panel-2']; ctx.fillRect(x + w * 0.68, y - h * 0.85, w * 0.26, h * 0.4);
    ctx.fillStyle = C.void;
    for (const wx of [0.2, 0.78]) { ctx.beginPath(); ctx.arc(x + w * wx, y, 2.6 * u, 0, 6.283); ctx.fill(); }
    if (s.heat > 50) { // cooling exhaust shimmer
      ctx.strokeStyle = C.signal; ctx.lineWidth = 1 * u;
      for (let k = 0; k < 3; k++) { const ph = ((t * 0.0006 + k / 3) % 1); ctx.globalAlpha = (1 - ph) * 0.5;
        ctx.beginPath(); ctx.arc(x + w * 0.3 + k * 4 * u, y - h - ph * 14 * u, 2 * u, 0, 6.283); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
}

function drawScene(info, t) {
  const ctx = sctx, W = scene.width, H = scene.height; if (!W || !H) return;
  const u = H / 210;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.void); g.addColorStop(1, C['panel-2']);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.ink;
  for (const st of stars) { ctx.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.0011 * st.sp + st.ph));
    ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r * DPR, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the source: grows as packets decode
  const sx = W * 0.8, sy = H * 0.22, sr = (2.2 + s.packet * 0.9) * DPR;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.002);
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 7);
  sg.addColorStop(0, C.anomaly); sg.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.25 + 0.25 * pulse; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr * 7, 0, 6.283); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = C.anomaly; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
  // hills
  hill(ctx, W, H, H * 0.7, 18 * u, 5, 0.6, C['hill-far']);
  hill(ctx, W, H, H * 0.8, 12 * u, 4, 2.1, C['hill-mid']);
  // dish
  const dx = W * 0.3, base = H * 0.86;
  const px = dx, py = base - 48 * u;
  const ang = Math.atan2(sy - py, sx - px);
  // heat glow
  if (s.heat > 1) { const hg = ctx.createRadialGradient(dx, base, 0, dx, base, 60 * u);
    hg.addColorStop(0, C.heat); hg.addColorStop(1, 'transparent');
    ctx.globalAlpha = s.heat / 100 * 0.6; ctx.fillStyle = hg; ctx.fillRect(dx - 60 * u, base - 60 * u, 120 * u, 120 * u); ctx.globalAlpha = 1; }
  // beam rings
  const feedX = px + Math.cos(ang) * 32 * u, feedY = py + Math.sin(ang) * 32 * u;
  if (info.receiving) {
    const col = info.locked ? C.signal : C.muted;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5 * DPR;
    for (let k = 0; k < 4; k++) {
      const ph = reduced ? k / 4 : ((t * 0.0005 + k / 4) % 1);
      const bx = feedX + (sx - feedX) * ph, by = feedY + (sy - feedY) * ph;
      ctx.globalAlpha = (1 - ph) * (0.25 + 0.6 * s.clarity / 100);
      ctx.beginPath(); ctx.arc(bx, by, (4 + ph * 14) * u, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // pedestal
  ctx.fillStyle = C.steel; ctx.beginPath();
  ctx.moveTo(dx - 16 * u, base); ctx.lineTo(dx + 16 * u, base); ctx.lineTo(dx + 6 * u, py); ctx.lineTo(dx - 6 * u, py); ctx.closePath(); ctx.fill();
  // bowl
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
  ctx.fillStyle = C['dish-shade']; ctx.beginPath(); ctx.ellipse(0, 0, 13 * u, 38 * u, 0, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = C.dish; ctx.beginPath(); ctx.ellipse(-1 * u, 0, 9 * u, 36 * u, 0, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.strokeStyle = C.dish; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.moveTo(0, -38 * u); ctx.lineTo(0, 38 * u); ctx.stroke();
  ctx.strokeStyle = C['dish-shade']; ctx.lineWidth = 1.6 * u; ctx.beginPath();
  ctx.moveTo(0, -34 * u); ctx.lineTo(32 * u, 0); ctx.lineTo(0, 34 * u); ctx.stroke();
  ctx.fillStyle = info.locked ? C.ok : (info.receiving ? C.signal : C['dish-shade']);
  ctx.beginPath(); ctx.arc(32 * u, 0, 3.4 * u, 0, 6.283); ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.steel; ctx.beginPath(); ctx.arc(px, py, 6 * u, 0, 6.283); ctx.fill();
  // aircraft warning light
  if (Math.floor(t / 800) % 2 === 0) { ctx.fillStyle = C.danger; ctx.beginPath(); ctx.arc(px, py - 9 * u, 1.8 * u, 0, 6.283); ctx.fill(); }
  drawHorizonProgression(ctx, W, H, u, t);
  // near hill over the pedestal foot
  hill(ctx, W, H, H * 0.93, 6 * u, 3, 4.2, C['hill-near']);
  // dust
  ctx.fillStyle = C.ink;
  for (const d of dust) { d.x += d.vx * 0.016; d.y += d.vy * 0.016;
    if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); } if (d.x < -0.05) d.x = 1.05; if (d.x > 1.05) d.x = -0.05;
    ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r * DPR, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (info.tripped && Math.floor(t / 250) % 2 === 0) { ctx.globalAlpha = 0.12; ctx.fillStyle = C.danger; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function drawScope(info, t) {
  const ctx = pctx, W = scope.width, H = scope.height; if (!W || !H) return;
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.globalAlpha = 0.55; ctx.beginPath();
  for (let i = 1; i < 10; i++) { const x = Math.round(W * i / 10) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let i = 1; i < 4; i++) { const y = Math.round(H * i / 4) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.globalAlpha = 1;
  const mid = H / 2, A = H * 0.32, k1 = 3.2 * 6.283 / W, ph = t * 0.002, step = 3 * DPR;
  ctx.setLineDash([6 * DPR, 5 * DPR]); ctx.strokeStyle = C.anomaly; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.6 * DPR;
  ctx.beginPath(); for (let x = 0; x <= W; x += step) { const y = mid - A * Math.sin(x * k1 + ph); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.strokeStyle = C.signal; ctx.lineWidth = 2 * DPR;
  if (info.locked) { ctx.shadowColor = C.signal; ctx.shadowBlur = 12 * DPR; }
  ctx.beginPath();
  if (info.receiving) {
    const k2 = k1 * (1 + clamp(info.errS * 40, -0.9, 3)), na = (1 - s.clarity / 100) * A * 0.55;
    for (let x = 0; x <= W; x += step) { const y = mid - A * 0.95 * Math.sin(x * k2 + ph) + (Math.random() - 0.5) * na; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  } else {
    ctx.globalAlpha = 0.5;
    for (let x = 0; x <= W; x += step) { const y = mid + (Math.random() - 0.5) * A * 0.08; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  }
  ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

