/* BITIRO · HEAD-SONAR · VALIDATION-3 · modelo consolidado de la cabeza (copias aisladas; NO integrado).
   Interfaces separadas dentro del mismo módulo (cada una se puede reemplazar sin tocar las otras):
     HEAD_SONAR.params    registro de parámetros con su ESTADO (no hay valores «medidos» salvo los indicados)
     HEAD_SONAR.state     posición OBJETIVO y posición REAL del yaw
     HEAD_SONAR.motion    command(), step(dt), moving()          (servo: cuantiza, satura, avanza a velocidad finita)
     HEAD_SONAR.geometry  frame(R, mech), offsets(), heightOk()  (origen y dirección del haz; independiente del servo)
   La representación 3D NO vive aquí: solo lee HEAD_SONAR.state.angle.
   Pitch: sin implementación funcional (sin respaldo físico). */
'use strict';
window.HEAD_SONAR = (() => {
  const P = (value, unit, status, source, unc) => ({ value, unit, status, source, unc });
  // status: CONTRACT (decisión de diseño), DERIVED (mezcla de medidas y asset), PROVISIONAL (asset/foto), PLACEHOLDER (sin dato), SIM (supuesto del simulador), MEASURED
  const defaults = (face) => ({
    axisForward:   P(3.95, 'cm', 'PROVISIONAL', 'asset 3D HEAD_SERVO_PAN/HEAD_BASE', '±1,5'),
    axisRight:     P(0, 'cm', 'PROVISIONAL', 'simetría del asset', '±0,5'),
    faceForward:   P(face, 'cm', face === 7.40 ? 'DERIVED' : 'SIM', face === 7.40 ? '6,50 + 0,90 medidos' : 'histórico sin fuente', '?'),
    mechMin:       P(0, 'grados', 'CONTRACT', 'contrato 0=derecha', 'alcance real pendiente'),
    mechMax:       P(180, 'grados', 'CONTRACT', 'contrato 180=izquierda', 'alcance real pendiente'),
    resolutionDeg: P(1, 'grados', 'PLACEHOLDER', 'sin dato', '?'),
    slewDegPerS:   P(180, 'grados/s', 'PLACEHOLDER', 'sin dato', '?'),
    degPerCmd:     P(1, '°/unidad', 'PLACEHOLDER', 'supuesto 1:1', '±20 % tolerable'),
    coneHalfDeg:   P(6, 'grados', 'SIM', 'simulador actual', '?'),
    sonarHeight:   P(15.1, 'cm', 'SIM', 'simulador actual (el 3D indica 18,1–19,7)', '?'),
    vertHalfDeg:   P(0, 'grados', 'PLACEHOLDER', 'haz horizontal', '?'),
    cmdFront:      P(90, 'orden', 'CONTRACT', 'S07 diap. 18', '—'),
  });
  let params = defaults(9.83);   // por omisión = geometría publicada; head-config.js la confirma (main usaría 7.40)
  const val = (k) => params[k].value;
  const state = { init: false, target: 90, angle: 90, moves: 0 };
  const rad = (d) => d * Math.PI / 180;
  const quant = (v) => val('resolutionDeg') > 0 ? Math.round(v / val('resolutionDeg')) * val('resolutionDeg') : v;

  const motion = {
    command(v) {                                   // objetivo = saturar(cuantizar(v))
      if (!Number.isFinite(v)) return { ok: false };
      const q = quant(v), c = Math.min(val('mechMax'), Math.max(val('mechMin'), q));
      state.target = c; state.moves++;
      if (!Number.isFinite(val('slewDegPerS'))) state.angle = c;       // ∞ = instantáneo (solo para aislar geometría)
      return { ok: true, clamped: v < val('mechMin') || v > val('mechMax'), value: c };
    },
    step(dt) {                                     // el ángulo REAL avanza hacia el objetivo
      if (state.angle === state.target) return;
      const m = val('slewDegPerS') * dt, d = state.target - state.angle;
      state.angle += Math.abs(d) <= m ? d : Math.sign(d) * m;
    },
    moving() { return state.angle !== state.target; },
  };
  const geometry = {
    relDeg(angle = state.angle) { return (val('cmdFront') - angle) * val('degPerCmd'); },   // derecha positiva
    frame(R, mech) {                               // origen y dirección del haz según el ángulo REAL
      const relDeg = geometry.relDeg(), a = rad(relDeg), d = val('faceForward') - val('axisForward'), b = mech.basis(R);
      const ux = b.f.x * Math.cos(a) + b.r.x * Math.sin(a), uy = b.f.y * Math.cos(a) + b.r.y * Math.sin(a);
      const axis = { x: R.x + b.f.x * val('axisForward') + b.r.x * val('axisRight'), y: R.y + b.f.y * val('axisForward') + b.r.y * val('axisRight') };
      return { origin: { x: axis.x + ux * d, y: axis.y + uy * d }, axis, yawRel: a, yawRelDeg: relDeg, angle: state.angle, target: state.target, radius: d };
    },
    offsets() { const c = rad(val('coneHalfDeg')); return val('coneHalfDeg') > 8 ? [-c, -c / 2, 0, c / 2, c] : [-c, 0, c]; },
    coneScale() { return val('coneHalfDeg') / 6; },          // 1 = los ±6° del simulador actual (3 rayos)
    heightOk(H, d) {
      const lo = val('sonarHeight') + d * Math.tan(rad(-val('vertHalfDeg'))), hi = val('sonarHeight') + d * Math.tan(rad(val('vertHalfDeg')));
      return lo <= H && hi >= 0;
    },
  };
  return {
    heightModel: true,
    get params() { return params; },
    get spec() { return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.value])); },
    state, motion, geometry,
    configure(face, o = {}) {                      // o: sobreescribe VALORES (el estado pasa a 'TEST')
      params = defaults(face);
      for (const [k, v] of Object.entries(o)) params[k] = { ...(params[k] || { unit: '', source: '' }), value: v === null ? Infinity : v, status: 'TEST' };
    },
    available: true,                                // el intérprete lo consulta: «el módulo de la cabeza está cargado»
    reset() { state.init = false; state.target = val('cmdFront'); state.angle = val('cmdFront'); state.moves = 0; },
    init() { state.init = true; },
    // alias del contrato anterior (los bancos de prueba los usan)
    command: (v) => motion.command(v), step: (dt) => motion.step(dt), moving: () => motion.moving(),
    frame: (R, mech) => geometry.frame(R, mech), offsets: () => geometry.offsets(), coneScale: () => geometry.coneScale(), heightOk: (H, d) => geometry.heightOk(H, d),
  };
})();
