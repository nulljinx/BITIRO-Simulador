/* Evaluador externo (HEAD-SONAR-POC-1). Misma pauta de 100 puntos que POC-2, con las convenciones nuevas:
   · IR: se exige una ACTIVACIÓN EXCLUSIVA NUEVA después de detenerse (transición a un único IR desde «ninguno» o «ambos»);
   · las barras terminales de las bases no son bifurcaciones;
   · cajas: la lectura debe tomarse con la CABEZA apuntando de lado y el CUERPO inmóvil;
   · puntaje VERIFICABLE: donde la trayectoria no distingue la elección de ruta (base 2) esos 10 puntos quedan «pendientes», no se otorgan. */
'use strict';
const P2 = require('./s08-geometry.cjs');
const { trackNodes, inRect, sensorPoint } = P2;
const HZ = 120, R1 = (v) => Math.round(v * 10) / 10;
const COLS = [13.43, 37.85, 62.27, 86.69];

function classify(T) {
  return trackNodes(T).map((n) => {
    let kind = 'otro';
    if (Math.abs(n.y - 161.69) < 0.6) kind = 'salida';
    else if (Math.abs(n.y - 65.45) < 0.6) kind = 'continuacion';
    else if (Math.abs(n.y - 26.88) < 0.6) kind = 'llegada';
    else if (Math.abs(n.y - 59.10) < 0.6) kind = 'bif-A';
    else if (Math.abs(n.y - 44.57) < 0.6) kind = 'bif-B';
    return { ...n, kind };
  });
}
const nodeAt = (nodes, kind, x) => nodes.find((n) => n.kind === kind && Math.abs(n.x - x) < 1);
function expected(nodes, base, linea) {
  const colX = COLS[base - 1], out = [nodeAt(nodes, 'bif-A', 37.85)];
  if (base === 2) { out.push(nodeAt(nodes, 'bif-B', 37.85)); return out; }
  const dir = Math.sign(colX - 37.85);
  const cols = COLS.filter((x) => x !== 37.85 && (x - 37.85) * dir > 0 && Math.abs(x - 37.85) <= Math.abs(colX - 37.85) + 0.5).sort((a, b) => Math.abs(a - 37.85) - Math.abs(b - 37.85));
  if (linea === 'A') { for (const x of cols) out.push(nodeAt(nodes, 'bif-A', x)); out.push(nodeAt(nodes, 'bif-B', colX)); }
  else { out.push(nodeAt(nodes, 'bif-B', 37.85)); for (const x of cols) out.push(nodeAt(nodes, 'bif-B', x)); }
  return out.filter(Boolean);
}
function stops(g) {
  const out = []; let cur = null;
  for (let i = 1; i < g.n; i++) {
    const still = g.L[i] === 0 && g.R[i] === 0 && Math.hypot(g.x[i] - g.x[i - 1], g.y[i] - g.y[i - 1]) < 0.05 && Math.abs(g.th[i] - g.th[i - 1]) < 0.002;
    if (still && !cur) cur = { i0: i };
    if (!still && cur) { cur.i1 = i - 1; out.push(cur); cur = null; }
  }
  if (cur) { cur.i1 = g.n - 1; out.push(cur); }
  return out.map((s) => ({ ...s, t0: g.t[s.i0], t1: g.t[s.i1], dur: (s.i1 - s.i0 + 1) / HZ, x: g.x[s.i0], y: g.y[s.i0], th: g.th[s.i0] }));
}
function sensorialAt(g, t0) {
  const reads = g.api.filter((a) => a[0] >= t0 - 0.15 && a[0] <= t0 + 0.001 && /^linea(Izquierda|Central|Derecha)$/.test(a[1]));
  const m = {}; for (const r of reads) m[r[1]] = r[3];
  return m.lineaIzquierda === 1 && m.lineaCentral === 1 && m.lineaDerecha === 1;
}

function evaluate({ world, exec, trueCount }) {
  const g = exec.log, T = world.T, front = world.geometry.front;
  const nodes = classify(T), ev = {}, st = stops(g);
  const marker = T.markers.find((m) => m.kind === 'start-red'), gaps = T.gaps;

  // 1. Salir de la base (10)
  {
    const inside = (x, y) => x - 8.3 >= marker.x && x + 8.3 <= marker.x + marker.width && y - 8.3 >= marker.y && y + 8.3 <= marker.y + marker.height;
    const startedInside = inside(g.x[0], g.y[0]);
    let leftIdx = -1; for (let i = 0; i < g.n; i++) if (!inRect(g.x[i], g.y[i], marker)) { leftIdx = i; break; }
    const sawLine = leftIdx >= 0 && g.s.slice(leftIdx).some((s) => s === '010');
    const col = leftIdx >= 0 ? g.col[leftIdx] : g.col[g.n - 1];
    ev.salir = { max: 10, pts: startedInside && leftIdx >= 0 && sawLine && col === 0 ? 10 : 0, evidencia: [`cuerpo completo en zona roja al inicio: ${startedInside}`, `el eje sale en t=${leftIdx >= 0 ? g.t[leftIdx].toFixed(2) : '—'} s`, `010 tras salir: ${sawLine}`, `colisiones hasta salir: ${col}`] };
  }
  // 2. Gaps (10 c/u)
  gaps.forEach((gp, k) => {
    const yTop = gp.y, yBot = gp.y + gp.height; let enter = -1, exit = -1, lat = 0;
    for (let i = 0; i < g.n; i++) {
      if (enter < 0 && Math.abs(g.y[i] - yBot) <= 1) enter = i;
      if (enter >= 0 && g.y[i] <= yTop - 1) { exit = i; break; }
      if (enter >= 0) lat = Math.max(lat, Math.abs(g.x[i] - 37.85));
    }
    ev['gap' + (k + 1)] = { max: 10, pts: enter >= 0 && exit >= 0 && lat <= 6 && g.col[exit] === g.col[enter] ? 10 : 0, evidencia: [`y ${yTop.toFixed(1)}–${yBot.toFixed(1)}`, `entra t=${enter >= 0 ? g.t[enter].toFixed(2) : '—'} · sale t=${exit >= 0 ? g.t[exit].toFixed(2) : '—'}`, `desvío lateral máx. ${lat.toFixed(1)} cm`] };
  });
  // 3. Cajas (5 × 4): lectura con la cabeza de lado, eje PAN a la altura de la posición, cuerpo inmóvil; LCD con el total correcto
  {
    const shown = g.lcd.map((e) => (/Cajas:\s*(\d+)/.exec(e[1][0]) || [])[1]).filter(Boolean);
    const lcdCount = shown.length ? +shown[shown.length - 1] : null;
    const sonarReads = g.api.filter((a) => a[1] === 'leerDistanciaSonar');
    let total = 0; const rows = [];
    const coneHalf = world.h.js('HEAD_SONAR.spec.coneHalfDeg');
    // Evidencia por GEOMETRÍA DEL HAZ (válida también en barridos): el rayo central, con el origen y el ángulo REALES en el instante
    // de la lectura, atraviesa la posición; presente → la lectura es coherente con su cara; vacía → la lectura supera la salida.
    const rayRect = (ox, oy, ang, s) => {
      const dx = Math.sin(ang), dy = -Math.cos(ang); let lo = 0, hi = 80;
      for (const [p, d, mn, mx] of [[ox, dx, s.x, s.x + s.width], [oy, dy, s.y, s.y + s.height]]) {
        if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return null; continue; }
        let a = (mn - p) / d, b = (mx - p) / d; if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b);
      }
      return hi >= lo ? { tin: lo, tout: hi } : null;
    };
    T.boxSlots.forEach((slot, idx) => {
      const present = world.slots.includes(idx), left = idx % 2 === 0;
      let evid = null;
      for (const r of sonarReads) {
        const yaw = r[4], oy = r[5], ox = r[10], th = r[11], bodyStill = r[6] === 0 && r[7] === 0;
        if (!bodyStill || ox == null) continue;
        // los 3 rayos del haz (centro y ±semiángulo): la caja puede estar en el borde del cono
        const half = coneHalf * Math.PI / 180, base = th + yaw * Math.PI / 180;
        const hits = [-half, 0, half].map((o) => rayRect(ox, oy, base + o, slot)).filter(Boolean);
        if (!hits.length) continue;
        const read = r[3], tin = Math.min(...hits.map((h) => h.tin)), tout = Math.max(...hits.map((h) => h.tout));
        if (present ? read <= tin + 2.5 : read >= tout) { evid = { t: r[0], read, yaw, oy: +oy.toFixed(1), tin: +tin.toFixed(1), anguloReal: r[8] }; break; }
      }
      const ok = !!evid && lcdCount === trueCount; if (ok) total += 5;
      rows.push({ slot: idx, lado: left ? 'izq' : 'der', gap: idx < 2 ? 1 : 2, presente: present, evidencia: evid, pts: ok ? 5 : 0 });
    });
    ev.cajas = { max: 20, pts: total, evidencia: [`verdad ${trueCount} · LCD «Cajas:» = ${lcdCount === null ? 'nunca' : lcdCount}`, ...rows.map((s) => `pos ${s.slot} (gap ${s.gap} ${s.lado}, ${s.presente ? 'caja' : 'vacía'}): ${s.evidencia ? `sonar=${s.evidencia.read} cm con la cabeza a ${s.evidencia.yaw}° (ángulo real), t=${s.evidencia.t.toFixed(2)}` : 'sin lectura que atraviese la posición'} → ${s.pts}`)], filas: rows };
  }
  // 4. Detenerse en la intersección (10): parada ≥0,5 s sobre N1, 111 leído justo antes, y permanencia hasta una activación exclusiva NUEVA
  const N1 = nodeAt(nodes, 'bif-A', 37.85);
  const gap2Exit = (() => { const gp = gaps[1]; for (let i = 0; i < g.n; i++) if (g.y[i] <= gp.y - 1) return i; return -1; })();
  let n1 = null, tNew = null;
  {
    for (const s of st) {
      if (gap2Exit < 0 || s.i0 < gap2Exit) continue;
      const [sx, sy] = sensorPoint(s.x, s.y, s.th, front);
      if (Math.hypot(sx - N1.x, sy - N1.y) <= 2.5 && s.dur >= 0.5) { n1 = { ...s, sx, sy, sensorial: sensorialAt(g, s.t0) }; break; }
    }
    let waited = false, why = '', code = null;
    if (n1) {
      let prev = g.ir[n1.i0];
      for (let i = n1.i0 + 1; i < g.n; i++) { const c = g.ir[i]; if ((c === 1 || c === 2) && (prev === 0 || prev === 3)) { tNew = g.t[i]; code = c; break; } prev = c; }
      const leftAt = n1.t1, toEnd = n1.i1 >= g.n - 2;
      if (tNew === null) { waited = toEnd; why = toEnd ? 'no hubo activación exclusiva nueva y el robot permaneció detenido' : 'no hubo activación exclusiva nueva y el robot continuó'; }
      else { waited = leftAt + 1 / HZ >= tNew - 0.02; why = waited ? `esperó la activación exclusiva nueva (t=${tNew.toFixed(2)} s, IR ${code === 2 ? 'izquierdo' : 'derecho'})` : `reanudó en t=${leftAt.toFixed(2)} s, antes de la activación nueva (t=${tNew.toFixed(2)} s)`; }
    }
    ev.interseccion = { max: 10, pts: n1 && waited && n1.sensorial ? 10 : 0, evidencia: n1 ? [`parada ${n1.dur.toFixed(2)} s, sensor a (${n1.sx.toFixed(1)}, ${n1.sy.toFixed(1)}) · nodo (${N1.x.toFixed(2)}, ${N1.y.toFixed(2)})`, why, `111 leído antes de parar: ${n1.sensorial}`] : ['sin parada ≥0,5 s sobre la primera barra tras el gap 2'] };
    ev.interseccion.irNuevo = tNew;
    ev.interseccion.irCodigo = tNew !== null ? (() => { let c = 0; for (let i = 0; i < g.n; i++) { if (g.t[i] >= tNew) { c = g.ir[i]; break; } } return c; })() : null;
  }
  // 5. Elegir ruta por IR (10)
  {
    const consulted = n1 ? g.api.some((a) => /^leerSensorObstaculo/.test(a[1]) && a[0] >= n1.t0) : false;
    const wanted = ev.interseccion.irCodigo === 2 ? 'A' : ev.interseccion.irCodigo === 1 ? 'B' : null;
    let observed = null, leaveT = null;
    if (n1) for (let i = n1.i1 + 1; i < g.n; i++) {
      if (Math.abs(g.x[i] - 37.85) > 6 && Math.abs(g.y[i] - 59.1) < 2.2) { observed = 'A'; leaveT = g.t[i]; break; }
      if (Math.abs(g.x[i] - 37.85) > 6 && Math.abs(g.y[i] - 44.57) < 2.2) { observed = 'B'; leaveT = g.t[i]; break; }
      if (g.y[i] < 27 && Math.abs(g.x[i] - 37.85) <= 6) { observed = 'tronco'; leaveT = g.t[i]; break; }
    }
    const lcdLine = (() => { const m = g.lcd.map((e) => /Linea:\s*([AB])/.exec(e[1][1] || '')).filter(Boolean); return m.length ? m[m.length - 1][1] : null; })();
    const afterNew = tNew !== null && (leaveT === null || leaveT >= tNew - 0.02);
    let pts = 0, nota = '', verificable = true;
    if (!consulted) nota = 'no consultó los IR tras detenerse';
    else if (wanted === null) nota = 'no hubo activación exclusiva nueva';
    else if (!afterNew) nota = 'se movió hacia una línea antes de la activación nueva';
    else if (trueCount === 2) { verificable = false; nota = `base 2: A y B comparten el tronco → la trayectoria NO distingue la elección. Evidencia disponible: consulta de IR sí, activación exclusiva nueva sí (IR ${wanted === 'A' ? 'izq.' : 'der.'}), LCD declara «Linea: ${lcdLine}» (declarativa).`; }
    else { pts = observed === wanted ? 10 : 0; nota = `trayectoria ${observed} frente a la esperada ${wanted}`; }
    ev.rutaIR = { max: 10, pts, verificable, evidencia: [`consultó IR después de detenerse: ${consulted}`, `IR de la activación nueva: ${wanted === 'A' ? 'izquierdo → A' : wanted === 'B' ? 'derecho → B' : '—'}`, `ruta observada: ${observed || '—'}`, `LCD «Linea»: ${lcdLine || '—'}`, nota], observed, wanted, lcdLine };
  }
  // 6. Bifurcaciones (10): 1 s en cada una de las que debía recorrer; las barras de las bases no cuentan
  {
    const exp = trueCount >= 1 && trueCount <= 4 ? expected(nodes, trueCount, ev.rutaIR.wanted || 'A') : [];
    const rows = [];
    for (const nd of exp) {
      let found = null;
      for (const s of st) {
        const [sx, sy] = sensorPoint(s.x, s.y, s.th, front);
        if (Math.hypot(sx - nd.x, sy - nd.y) > 2.5 || s.dur < 0.95) continue;
        const sensorial = sensorialAt(g, s.t0); found = { s, sensorial }; if (sensorial) break;
      }
      rows.push({ nodo: `${nd.kind} (${nd.x.toFixed(2)}, ${nd.y.toFixed(2)})`, ok: !!(found && found.sensorial), dur: found ? +found.s.dur.toFixed(2) : null });
    }
    const okN = rows.filter((r) => r.ok).length;
    // pausa de 1 s en la barra terminal de una base: no se exige ni se premia; se registra
    const baseStops = st.filter((s) => s.dur >= 0.95 && nodes.some((n) => n.kind === 'llegada' && Math.hypot(...sensorPoint(s.x, s.y, s.th, front).map((v, i) => v - [n.x, n.y][i])) <= 2.5));
    ev.bifurcaciones = { max: 10, pts: exp.length ? R1(10 * okN / exp.length) : 0, evidencia: rows.length ? rows.map((r) => `${r.nodo}: ${r.ok ? `OK ${r.dur} s` : r.dur ? 'parada sin 111 leído' : 'sin parada ≥1 s'}`) : ['sin ruta definida'], esperadas: exp.length, validas: okN, paradasEnBarraDeBase: baseStops.length };
  }
  // 7. Base correcta (20)
  {
    const zone = T.zones.find((z) => z.id === 'base' + trueCount), n = g.n - 1, w = Math.round(0.5 * HZ);
    const inZone = zone && inRect(g.x[n], g.y[n], zone);
    let still = n >= w; for (let i = n - w; i <= n && still; i++) if (g.L[i] !== 0 || g.R[i] !== 0 || Math.hypot(g.x[i] - g.x[n], g.y[i] - g.y[n]) > 0.1) still = false;
    const lcdBase = (() => { const m = g.lcd.map((e) => /Base:\s*(\d+)/.exec(e[1][0] || '')).filter(Boolean); return m.length ? +m[m.length - 1][1] : null; })();
    ev.base = { max: 20, pts: inZone && still && exec.finished ? 20 : 0, evidencia: [`eje final (${g.x[n].toFixed(1)}, ${g.y[n].toFixed(1)})`, zone ? `zona ${zone.id} x ${zone.x.toFixed(1)}–${(zone.x + zone.width).toFixed(1)}, y ${zone.y.toFixed(1)}–${(zone.y + zone.height).toFixed(1)}` : 'sin base esperada', `dentro: ${!!inZone} · detenido ≥0,5 s: ${still} · programa terminó: ${exec.finished}`, `LCD «Base:» = ${lcdBase === null ? '—' : lcdBase}`], lcdBase };
  }
  // La cabeza gira y el cuerpo no: por cada exploración (grupo de órdenes de cabeza), del primer moverServoYaw a la última lectura del sonar
  let maxBody = 0, scans = 0, yawSeen = new Set();
  {
    const calls = g.api.filter((a) => a[1] === 'moverServoYaw' || a[1] === 'leerDistanciaSonar');
    let grp = [];
    const flush = () => {
      if (grp.some((c) => c[1] === 'moverServoYaw') && grp.some((c) => c[1] === 'leerDistanciaSonar')) {
        scans++;
        const i = Math.min(g.n - 1, Math.round((grp[0][0] + 0.3) * HZ));      // 0,3 s: el frenado de la rampa de motor ya terminó
        const lastRead = [...grp].reverse().find((c) => c[1] === 'leerDistanciaSonar');
        const j = Math.min(g.n - 1, Math.round(lastRead[0] * HZ));
        for (let k = i; k <= j; k++) maxBody = Math.max(maxBody, Math.hypot(g.x[k] - g.x[i], g.y[k] - g.y[i]), Math.abs(g.th[k] - g.th[i]) * 8);
      }
      grp = [];
    };
    for (const c of calls) { if (grp.length && c[0] - grp[grp.length - 1][0] > 2.5) flush(); grp.push(c); if (c[4] != null) yawSeen.add(Math.round(c[4])); }
    flush();
  }
  const total = Object.values(ev).reduce((a, c) => a + c.pts, 0);
  const pendiente = Object.values(ev).filter((c) => c.verificable === false).reduce((a, c) => a + c.max, 0);
  const noAplica = trueCount === 0 ? 40 : 0;
  return { ev, total: R1(total), pendiente, noAplica, maxVerificable: 100 - pendiente - noAplica, finalLcd: g.lcd.length ? g.lcd[g.lcd.length - 1][1] : ['', ''], collisions: g.col[g.n - 1], moved: g.moved[g.n - 1], seconds: exec.seconds, finished: exec.finished, cuerpoDuranteCabeza: { maxCm: R1(maxBody), exploraciones: scans, yawVistos: [...yawSeen].sort((p, q) => p - q) } };
}
module.exports = { evaluate, classify, expected, stops };
