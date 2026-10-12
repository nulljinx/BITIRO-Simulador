/* node tests/head-sonar.cjs — HEAD-CANVAS-INTEGRATION-1 · cabeza móvil (yaw) y compatibilidad de carga.
   A. Combinaciones de scripts (módulo ausente, parcial, completo, orden alterado): programas anteriores iguales, sin errores sin controlar,
      avisos comprensibles cuando falta la capacidad.
   B. Movimiento: cuantiza, satura con aviso, ángulos intermedios, progresivo (no instantáneo).
   C. Sonar: con yaw 90° la lectura es idéntica a la de la versión sin cabeza en TODAS las pistas; 0° = derecha, 180° = izquierda. */
'use strict';
const assert = require('node:assert/strict');
const { load } = require('./sim1/harness.cjs');
let checks = 0; const test = (n, f) => { f(); checks++; console.log('OK · ' + n); };

const BASE = ['tracks.js', 'extra-tracks.js', 'calibration.js', 'iroh-runtime.js', 'strike-physics.js', 'scenario-props.js'];
const COMBOS = {
  'sin cabeza (HTML/scripts antiguos)': [...BASE, 'simulator.js'],
  'solo head-sonar.js (head-config.js no llegó)': [...BASE, 'head-sonar.js', 'simulator.js'],
  'solo head-config.js (head-sonar.js no llegó)': [...BASE, 'head-config.js', 'simulator.js'],
  'completo, orden definido': [...BASE, 'head-sonar.js', 'head-config.js', 'simulator.js'],
  'completo, runtime después del módulo': ['tracks.js', 'extra-tracks.js', 'calibration.js', 'head-sonar.js', 'head-config.js', 'iroh-runtime.js', 'strike-physics.js', 'scenario-props.js', 'simulator.js'],
};
const loaded = (name) => COMBOS[name].includes('head-sonar.js');
const msg = (h) => h.el('msg').innerHTML;
const errs = (h) => [...msg(h).matchAll(/class=err>([^<]*)/g)].map((m) => m[1]);
const warns = (h) => [...msg(h).matchAll(/class=warn>([^<]*)/g)].map((m) => m[1]);
const world = (combo, track = 's01') => { const h = load({ files: COMBOS[combo] }); h.js(`changeTrack('${track}')`); return h; };
const ticks = (h, n) => h.tick(n);

/* ───── A · compatibilidad de carga ───── */
const OLD_PROGRAM = 'void setup(){inicializarMovimiento();inicializarSensores();} void loop(){ if(lineaCentral()){avanzar(30);}else if(lineaIzquierda()){avanzar(10,30);}else if(lineaDerecha()){avanzar(30,10);}else{avanzar(30);} }';
test('A1 programas anteriores: misma pose final con cualquier combinación de scripts', () => {
  const poses = {};
  for (const c of Object.keys(COMBOS)) {
    const h = world(c); h.program(OLD_PROGRAM); ticks(h, 1500);
    assert.deepEqual(errs(h), [], c); assert.deepEqual(warns(h), [], c);
    poses[c] = h.js('[R.x,R.y,R.th,collisionCount].join()');
  }
  const ref = poses['sin cabeza (HTML/scripts antiguos)'];
  for (const [c, p] of Object.entries(poses)) assert.equal(p, ref, c);
});

const HEAD_PROGRAM = 'void setup(){inicializarCabeza();inicializarSensores();moverServoYaw(0);botonInicio();} void loop(){ moverServoYaw(180); pausa(50); }';
test('A2 comandos de cabeza sin módulo: aviso comprensible, sin errores y sin excepciones', () => {
  for (const c of ['sin cabeza (HTML/scripts antiguos)', 'solo head-config.js (head-sonar.js no llegó)']) {
    const h = world(c);
    assert.doesNotThrow(() => { h.program(HEAD_PROGRAM); ticks(h, 400); });
    assert.deepEqual(errs(h), [], c);
    const w = warns(h);
    assert.ok(w.some((t) => /moverServoYaw\(\).*no tiene efecto.*head-sonar\.js/.test(t) || /inicializarCabeza\(\).*no tiene efecto.*head-sonar\.js/.test(t)), c + ': ' + w);
    assert.ok(w.every((t) => /no tiene efecto en este modelo virtual/.test(t)), c + ': ' + w);
  }
});
test('A3 con módulo: sin avisos; head-config.js ausente no cambia la geometría publicada (9,83)', () => {
  for (const c of ['solo head-sonar.js (head-config.js no llegó)', 'completo, orden definido', 'completo, runtime después del módulo']) {
    const h = world(c); h.program(HEAD_PROGRAM); ticks(h, 400);
    assert.deepEqual(errs(h), [], c); assert.deepEqual(warns(h), [], c);
    assert.equal(h.js('HEAD_SONAR.params.faceForward.value'), 9.83, c);
    assert.equal(h.js('HEAD_SONAR.state.target'), 0, c);   // setup: moverServoYaw(0); espera el botón
  }
});
test('A4 modo estricto: moverServoYaw sin inicializarCabeza avisa y no mueve (con y sin módulo)', () => {
  for (const c of ['completo, orden definido', 'sin cabeza (HTML/scripts antiguos)']) {
    const h = world(c);
    h.program('#include <KnightRoboticsLibs_Iroh.h>\nvoid setup(){inicializarSensores();moverServoYaw(0);}\nvoid loop(){pausa(10);}'); ticks(h, 200);
    assert.deepEqual(errs(h), [], c);
    assert.ok(warns(h).length > 0, c);
    if (loaded(c)) assert.equal(h.js('HEAD_SONAR.state.target'), 90, c);
  }
});

/* ───── B · movimiento ───── */
const withHead = () => world('completo, orden definido');
test('B1 ángulos intermedios y movimiento progresivo (180 °/s)', () => {
  const h = withHead(); h.program('void setup(){inicializarCabeza();moverServoYaw(45);} void loop(){pausa(10);}');
  h.js('HEAD_SONAR.reset()'); // la cabeza parte de 90
  h.program('void setup(){inicializarCabeza();moverServoYaw(45);} void loop(){pausa(10);}');
  ticks(h, 6);                       // 6/120 s = 0,05 s → 9°
  const a = h.js('HEAD_SONAR.state.angle'), t = h.js('HEAD_SONAR.state.target');
  assert.equal(t, 45); assert.ok(a < 90 && a > 45, 'ángulo intermedio, no instantáneo: ' + a);
  ticks(h, 60);
  assert.equal(h.js('HEAD_SONAR.state.angle'), 45);
});
test('B2 cuantiza a 1°, satura a 0–180 con aviso y rechaza valores no finitos con error controlado', () => {
  let h = withHead(); h.program('void setup(){inicializarCabeza();moverServoYaw(200);} void loop(){pausa(10);}'); ticks(h, 20);
  assert.equal(h.js('HEAD_SONAR.state.target'), 180); assert.ok(warns(h).some((t) => /limit/.test(t)), warns(h).join('|'));
  h = withHead(); h.program('void setup(){inicializarCabeza();moverServoYaw(-5);} void loop(){pausa(10);}'); ticks(h, 20);
  assert.equal(h.js('HEAD_SONAR.state.target'), 0);
  h = withHead(); h.program('void setup(){inicializarCabeza();moverServoYaw(30.4);} void loop(){pausa(10);}'); ticks(h, 20);
  assert.equal(h.js('HEAD_SONAR.state.target'), 30);
  h = withHead(); h.program('void setup(){inicializarCabeza();moverServoYaw(1/0);} void loop(){pausa(10);}'); ticks(h, 20);
  assert.ok(errs(h).length > 0 || h.js('HEAD_SONAR.state.target') === 90, 'valor no finito: error controlado o ignorado');
});
test('B3 reiniciar y cambiar de pista devuelven la cabeza a 90°', () => {
  const h = withHead(); h.program('void setup(){inicializarCabeza();moverServoYaw(0);} void loop(){pausa(10);}'); ticks(h, 200);
  assert.equal(h.js('HEAD_SONAR.state.angle'), 0);
  h.js('resetRobot()'); assert.equal(h.js('HEAD_SONAR.state.angle'), 90); assert.equal(h.js('HEAD_SONAR.state.target'), 90);
  h.program('void setup(){inicializarCabeza();moverServoYaw(180);} void loop(){pausa(10);}'); ticks(h, 200);
  h.js("changeTrack('s02')"); assert.equal(h.js('HEAD_SONAR.state.angle'), 90);
});

/* ───── C · sonar ───── */
let seed = 987654321; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
test('C1 yaw 90°: lectura idéntica a la versión sin cabeza en todas las pistas, con cajas de varias alturas', () => {
  const ids = Object.keys(JSON.parse(load({ files: COMBOS['sin cabeza (HTML/scripts antiguos)'] }).js('JSON.stringify(Object.fromEntries(Object.keys(BITIRO_TRACKS).map(k=>[k,1])))')));
  assert.ok(ids.length >= 5, ids.join());
  let total = 0, hits = 0;
  for (const id of ids) {
    const A = world('sin cabeza (HTML/scripts antiguos)', id), B = world('completo, orden definido', id);
    const T = JSON.parse(A.js('JSON.stringify(track)'));
    const heights = [10, 15.1, 15.6, 18.9, 20];
    for (let n = 0; n < 60; n++) {
      const x = 10 + rnd() * (T.w - 20), y = 10 + rnd() * (T.h - 20), th = (rnd() - 0.5) * 2 * Math.PI;
      const boxes = Array.from({ length: 3 }, (_, i) => { const r = 8 + rnd() * 55, a = rnd() * 2 * Math.PI; return { id: 'b' + i, x: x + r * Math.cos(a), y: y + r * Math.sin(a), width: 8, height: 8, movable: true, visualHeightCm: heights[Math.floor(rnd() * heights.length)] }; });
      const setup = `scenarioList=${JSON.stringify(boxes)};resetRobot();R.x=${x};R.y=${y};R.th=${th};`;
      A.js(setup); B.js(setup); B.js('HEAD_SONAR.command(90);for(let i=0;i<10;i++)HEAD_SONAR.step(0.1);');
      const a = A.js('readSonarDistance()'), b = B.js('readSonarDistance()');
      assert.equal(b, a, `${id} pose (${x.toFixed(1)}, ${y.toFixed(1)}, ${th.toFixed(2)})`);
      total++; if (a < 200) hits++;
    }
  }
  assert.ok(hits > 50, 'la muestra incluye detecciones reales: ' + hits + '/' + total);
});
test('C2 0° apunta a la derecha y 180° a la izquierda; la lectura usa el ángulo REAL', () => {
  const h = withHead(); h.js("changeTrack('s08')");
  h.js('scenarioList=[0,1].map((i,n)=>({id:"b"+n,x:track.boxSlots[i].x,y:track.boxSlots[i].y,width:8,height:8,movable:true}));resetRobot();R.x=37.853;R.y=133.538;R.th=0;');   // robot entre las dos cajas del gap 1
  const read = (cmd, settle) => { h.js(`HEAD_SONAR.reset();HEAD_SONAR.command(${cmd});for(let i=0;i<${settle};i++)HEAD_SONAR.step(1/120);`); return h.js('readSonarDistance()'); };
  assert.equal(read(90, 0), 200, 'frente libre');
  assert.ok(read(0, 130) < 20, 'derecha con caja');
  assert.ok(read(180, 130) < 20, 'izquierda con caja');
  h.js('HEAD_SONAR.reset();HEAD_SONAR.command(0);');         // sin avanzar el tiempo: el ángulo real sigue en 90°
  assert.equal(h.js('readSonarDistance()'), 200, 'la lectura usa el ángulo real, no el objetivo');
});

/* ───── D · head-config.js llega realmente a head-sonar.js (valor deliberadamente distinto del predeterminado) ───── */
test('D1 head-config.js: un faceForward distinto (11,5) llega al módulo y mueve el origen del haz', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const cfg = fs.readFileSync(path.join(root, 'head-config.js'), 'utf8');
  assert.ok(cfg.includes('configure(9.83)'), 'head-config.js usa el valor publicado');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-cfg-'));
  fs.writeFileSync(path.join(dir, 'head-config.js'), cfg.replace('configure(9.83)', 'configure(11.5)'));
  const alt = path.relative(root, path.join(dir, 'head-config.js'));          // el arnés resuelve rutas relativas a la raíz del repositorio
  const make = (files) => { const h = load({ files }); h.js("changeTrack('s08')");
    h.js('scenarioList=[{id:"c",x:46,y:60,width:8,height:8,movable:true}];resetRobot();R.x=50;R.y=100;R.th=0;'); return h; };
  const def = make(COMBOS['completo, orden definido']);
  const custom = make([...BASE, 'head-sonar.js', alt, 'simulator.js']);
  assert.equal(def.js('HEAD_SONAR.params.faceForward.value'), 9.83);
  assert.equal(custom.js('HEAD_SONAR.params.faceForward.value'), 11.5, 'el valor de head-config.js llegó a head-sonar.js');
  const fa = def.js('HEAD_SONAR.frame(R,IROH_MECHANICS)'), fb = custom.js('HEAD_SONAR.frame(R,IROH_MECHANICS)');
  assert.ok(Math.abs((fa.origin.y - fb.origin.y) - 1.67) < 1e-9, 'el origen del haz se adelanta 1,67 cm: ' + (fa.origin.y - fb.origin.y));
  const rd = (h) => h.js('readSonarDistance()');
  const dd = rd(def) - rd(custom);   // el sonar devuelve enteros: 1,67 cm se ve como 1 o 2
  assert.ok(dd >= 1 && dd <= 2, `la lectura real cambia ≈1,67 cm: ${rd(def)} vs ${rd(custom)}`);
  // y sin head-config.js el valor sigue siendo el publicado (9,83)
  assert.equal(make([...BASE, 'head-sonar.js', 'simulator.js']).js('HEAD_SONAR.params.faceForward.value'), 9.83);
  fs.rmSync(dir, { recursive: true, force: true });
});
console.log(`\n${checks} comprobaciones de cabeza móvil y compatibilidad de carga superadas.`);
