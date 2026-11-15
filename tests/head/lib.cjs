/* Biblioteca HEAD-SONAR-POC-1: cargador de árboles aislados + registro + helpers. Reutiliza el evaluador de POC-2 ampliado en eval2.cjs. */
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');    // raíz del repositorio
const HZ = 120;
const FILES = ['tracks.js', 'extra-tracks.js', 'calibration.js', 'iroh-runtime.js', 'strike-physics.js', 'scenario-props.js', 'head-sonar.js', 'head-config.js', 'simulator.js'];

function load(tree) {
  const dir = ROOT;
  const nodes = new Map(), saved = new Map();
  function el(id) {
    if (!nodes.has(id)) nodes.set(id, { id, value: id === 'quality' ? 'standard' : '', textContent: '', innerHTML: '', style: {}, dataset: {}, hidden: false, disabled: false,
      classList: { toggle() {}, add() {}, remove() {} }, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      events: {}, addEventListener(t, fn) { this.events[t] = fn; }, querySelector() { return el(id + '.sub'); }, focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
      getBoundingClientRect() { return { width: 700, height: 480 }; }, scrollIntoView() {}, requestFullscreen() {} });
    return nodes.get(id);
  }
  const document = { addEventListener() {}, getElementById: el, querySelectorAll(q) { return q === '.cam' ? ['perspective', 'top', 'follow', 'robot'].map(v => ({ ...el('cam_' + v), dataset: { view: v } })) : []; } };
  const localStorage = { getItem: k => saved.has(k) ? saved.get(k) : null, setItem: (k, v) => saved.set(k, String(v)), removeItem: k => saved.delete(k) };
  const ctx = { document, window: null, console, performance: { now: () => 0 }, Math, Number, Date, localStorage, devicePixelRatio: 1,
    clamp: (n, a, b) => Math.max(a, Math.min(n, b)), requestAnimationFrame() {}, renderScene3D() {} };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of FILES) { const p = path.join(dir, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  const js = s => vm.runInContext(s, ctx);
  const program = code => { el('src').value = code; js('start()'); };
  const tick = n => { for (let i = 0; i < n; i++) js('update(1/120)'); };
  return { ctx, js, el, program, tick, dir };
}

const RECORDER = `(function(){
 const log=window.__log={n:0,t:[],x:[],y:[],th:[],L:[],R:[],s:[],so:[],ir:[],col:[],moved:[],yaw:[],ox:[],oy:[],api:[],lcd:[]};
 let lastLcd=null;const u=window.update;
 window.update=function(dt){
  u(dt);
  log.n++;log.t.push(simTime);log.x.push(R.x);log.y.push(R.y);log.th.push(R.th);log.L.push(R.L);log.R.push(R.R);
  log.s.push([0,1,2].map(k=>LINE_SENSOR.detected(readLine(k),k)?1:0).join(''));
  log.so.push(readSonarDistance());log.ir.push(ir[0]*2+ir[1]);log.col.push(collisionCount);log.moved.push(movedCount);
  if(window.HEAD_SONAR){const f=HEAD_SONAR.frame(R,IROH_MECHANICS);log.yaw.push(f.yawRelDeg);log.ox.push(f.origin.x);log.oy.push(f.origin.y);}
  const l=lcd.join('|');if(l!==lastLcd){lastLcd=l;log.lcd.push([simTime,lcd.map(s=>s.replace(/ +$/,''))]);}
 };
 for(const name of Object.keys(FN)){const orig=FN[name][1];FN[name][1]=function(a){const r=orig(a);const f=window.HEAD_SONAR?HEAD_SONAR.frame(R,IROH_MECHANICS):null;log.api.push([simTime,name,a.slice(),r,f?f.yawRelDeg:null,f?f.origin.y:null,R.L,R.R,f?f.angle:null,f?f.target:null,f?f.origin.x:null,R.th]);return r;};}
})();`;

function createWorld({ tree, slots = [], pose = null, code, record = true, boxHeight = null }) {
  const h = load(tree);
  h.js("changeTrack('s08')");
  const T = h.js('JSON.parse(JSON.stringify(track))');
  const boxes = slots.map((s, n) => {
    const slot = typeof s === 'number' ? T.boxSlots[s] : s;                  // índice de posición oficial o caja libre {x,y}
    return { id: 'user-box-' + (n + 1), x: slot.x, y: slot.y, width: 8, height: 8, movable: true, ...(boxHeight ? { visualHeightCm: boxHeight } : {}) };
  });
  h.js(`scenarioList=${JSON.stringify(boxes)};resetRobot()`);
  const face = tree.startsWith('main') ? 7.40 : 9.83;
  h.js(`window.SONAR_FACE_REF=${face}`);
  if (record) h.js(RECORDER);
  if (code) h.program(code);
  if (pose) h.js(`R.x=${pose.x};R.y=${pose.y};R.th=${pose.th};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);
  const err = code && /class=err/.test(h.el('msg').innerHTML) ? h.el('msg').innerHTML.replace(/<[^>]+>/g, ' ') : null;
  const msg = () => h.el('msg').innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { h, T, boxes, slots, compileError: err, msg, geometry: h.js('JSON.parse(JSON.stringify(LINE_SENSOR.geometry))'), tree, faceRef: face, record };
}
module.exports = { ROOT, HZ, load, createWorld };
