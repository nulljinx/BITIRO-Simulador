/* Geometría de pista para el evaluador S08 (vendorizado de BITIRO-S08/POC-2 poc2-lib.cjs: inRect, sensorPoint, trackNodes). */
'use strict';
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
const sensorPoint = (x, y, th, front) => [x + front * Math.sin(th), y - front * Math.cos(th)];

/* Nodos de bifurcación calculados desde las centerlines del plotter (intersecciones y empalmes en T). */
function trackNodes(T) {
  const segs = [];
  for (const p of T.paths) for (let i = 1; i < p.p.length; i++) segs.push({ id: p.id, a: p.p[i - 1], b: p.p[i] });
  const pts = [];
  const distToSeg = (q, s) => {
    const vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1], d = vx * vx + vy * vy;
    const t = d ? Math.max(0, Math.min(1, ((q[0] - s.a[0]) * vx + (q[1] - s.a[1]) * vy) / d)) : 0;
    return Math.hypot(q[0] - (s.a[0] + t * vx), q[1] - (s.a[1] + t * vy));
  };
  const candidates = [];
  for (const s of segs) { candidates.push({ q: s.a, id: s.id }); candidates.push({ q: s.b, id: s.id }); }
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], u = segs[j];
    const d = (s.b[0] - s.a[0]) * (u.b[1] - u.a[1]) - (s.b[1] - s.a[1]) * (u.b[0] - u.a[0]);
    if (Math.abs(d) < 1e-9) continue;
    const t = ((u.a[0] - s.a[0]) * (u.b[1] - u.a[1]) - (u.a[1] - s.a[1]) * (u.b[0] - u.a[0])) / d;
    const w = ((u.a[0] - s.a[0]) * (s.b[1] - s.a[1]) - (u.a[1] - s.a[1]) * (s.b[0] - s.a[0])) / d;
    if (t >= -0.02 && t <= 1.02 && w >= -0.02 && w <= 1.02) candidates.push({ q: [s.a[0] + t * (s.b[0] - s.a[0]), s.a[1] + t * (s.b[1] - s.a[1])], id: s.id + '×' + u.id, cross: true });
  }
  // Nodo = punto donde ≥2 trazos distintos se tocan a menos de 1,6 cm (ancho de línea 2,6).
  const uniq = [];
  for (const c of candidates.filter(c => c.cross)) {
    if (!uniq.some(u => Math.hypot(u[0] - c.q[0], u[1] - c.q[1]) < 1.6)) uniq.push(c.q);
  }
  for (const q of uniq) {
    const near = segs.filter(s => distToSeg(q, s) < 1.6);
    const ids = new Set(near.map(s => s.id));
    pts.push({ x: q[0], y: q[1], paths: [...ids].sort(), degree: ids.size });
  }
  return pts.filter(n => n.degree >= 2).sort((a, b) => b.y - a.y || a.x - b.x);
}

module.exports = { inRect, sensorPoint, trackNodes };
