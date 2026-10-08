/* SIM-3D-INTEGRATION-1/2 · Pruebas del modelo visual IROH v1 (lógica, sin navegador).
   El modelo es SOLO apariencia: estas pruebas verifican que el selector, el asset y el dibujo no tocan la física.
   No hace ninguna aserción de física basada en dimensiones visuales.
     node tests/iroh-visual.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
const {load,root}=require('./sim1/harness.cjs');
let n=0;const test=(name,fn)=>{fn();n++;console.log('OK · '+name);};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

/* Contexto completo: simulador (harness) + renderer real + (opcional) modelo IROH, con un canvas que solo cuenta y registra caras.
   `query` imita location.search; los dos scripts del modelo se evalúan solo bajo el flag, como hace el loader síncrono del navegador. */
function world(query='',loadModel=true){
 const h=load();
 const faces=[];let fills=0;
 const rec=new Proxy({},{get:(t,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):k==='fill'?()=>{fills++}:()=>{}, set:()=>true});
 h.el('scene').getContext=()=>rec;h.el('scene').getBoundingClientRect=()=>({width:700,height:480});
 h.ctx.location={search:query};h.ctx.WeakMap=WeakMap;
 const anchor='function face(list,pts,fill,layer=3,alpha=1,stroke=null){list.push(';
 let src=read('renderer3d.js');assert.equal(src.split(anchor).length,2);
 src=src.replace(anchor,()=>'function face(list,pts,fill,layer=3,alpha=1,stroke=null){window.__faces.push({pts:pts.map(p=>({x:p.x,y:p.y,z:p.z})),fill});list.push(');
 const sorter=' const ordered=faces.map(';assert.equal(src.split(sorter).length,2);
 src=src.replace(sorter,()=>' window.__all=faces.map(f=>({pts:f.points.map(p=>({x:p.x,y:p.y,z:p.z})),fill:f.fill}));'+sorter);   // todas las caras (incluidas las del modelo IROH) antes de ordenar
 h.ctx.__faces=faces;
 vm.runInContext(src+';window.renderScene3D=renderScene3D;',h.ctx,{filename:'renderer3d.js'});
 if(loadModel&&query.includes('robot=iroh')){
  vm.runInContext(read('assets/iroh/iroh-render-v1.js'),h.ctx,{filename:'iroh-render-v1.js'});
  vm.runInContext(read('iroh-visual.js'),h.ctx,{filename:'iroh-visual.js'});
 }
 h.js("changeTrack('s01')");
 return {...h,faces,fillsCount:()=>fills,render(){faces.length=0;fills=0;h.js('render()');}};
}
const state=w=>w.js(`JSON.stringify({R:{x:R.x,y:R.y,th:R.th,L:R.L,R:R.R},wheel,striker:striker.angle,simTime,mode,running,trail:trail.length,
 runDistance,collisionCount,sensors:[0,1,2].map(readLine),sonar:readSonarDistance(),obs:activeObstacles.map(o=>[o.id,o.x,o.y]),
 hit:IROH_MECHANICS.spec,line:LINE_SENSOR.geometry,lcd:typeof lcdText==='undefined'?null:lcdText})`);
const CODE='void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();} void loop(){avanzar(30);}';

const asset=(()=>{const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(read('assets/iroh/iroh-render-v1.js'),c);return c.IROH_RENDER_V1;})();

test('1. Asset runtime cargado: formato, paleta, piezas requeridas y presupuesto',()=>{
 assert.equal(asset.version,'iroh-render-v1');assert.equal(asset.unit,0.01);assert.ok(Object.isFrozen(asset));
 assert.ok(asset.palette.every(c=>/^#[0-9a-f]{6}$/.test(c)));
 assert.equal(asset.parts.length,asset.names.length);
 for(const p of ['CHASSIS_LOWER','CHASSIS_UPPER','WHEEL_L','WHEEL_R','MOTOR_L','MOTOR_R','CASTER','LINE_SENSOR_L','LINE_SENSOR_C','LINE_SENSOR_R','HEAD_RED_PLATE','ULTRASONIC_BODY','ULTRASONIC_TX','ULTRASONIC_RX','HEAD_SERVO_PAN','HEAD_SERVO_TILT','LCD','ELECTRONICS'])
  assert.ok(asset.names.includes(p),'falta '+p);
 const total=asset.parts.reduce((s,p)=>s+p.length,0);
 assert.equal(total,asset.stats.polygons);assert.ok(total<=1100,'presupuesto del asset: '+total);
 for(const part of asset.parts)for(const f of part){assert.ok(f.length>=1+9&&(f.length-1)%3===0);assert.ok(f[0]>=0&&f[0]<asset.palette.length);assert.ok(f.slice(1).every(Number.isInteger));}
 assert.match(asset.sourceSha256,/^[0-9a-f]{64}$/);
 assert.ok(!/photo|jpg|jpeg|\.blend|reference/i.test(read('assets/iroh/iroh-render-v1.js')),'el asset no referencia fotos ni el .blend');
});

test('2. El asset es reproducible desde el GLB (si el GLB existe en este árbol de trabajo)',()=>{
 const glb=path.resolve(root,'..','..','exports','iroh_lowpoly.glb');
 if(!fs.existsSync(glb)){console.log('   (GLB no disponible: se omite la regeneración)');return;}
 const r=cp.spawnSync(process.execPath,[path.join(root,'tools','build-iroh-render-asset.mjs'),glb,'--check'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});

test('3. Selector: legacy es el default; solo ?robot=iroh activa iroh-v1; valores ajenos → legacy',()=>{
 for(const q of ['','?','?robot=legacy','?robot=iroh2','?robot=IROH','?x=robot=iroh','?robot=']){const w=world(q);assert.equal(w.js('BITIRO_ROBOT_MODEL'),'legacy',q);w.render();assert.equal(w.js('BITIRO_RENDER_STATS.model'),'legacy',q);}
 for(const q of ['?robot=iroh','?a=1&robot=iroh','?robot=iroh&a=1']){const w=world(q);assert.equal(w.js('BITIRO_ROBOT_MODEL'),'iroh-v1',q);w.render();assert.equal(w.js('BITIRO_RENDER_STATS.model'),'iroh-v1',q);}
 const src=read('renderer3d.js');assert.ok(!/localStorage|sessionStorage/.test(src),'el selector no usa almacenamiento');
});

test('4. Fallback: con el flag pero sin el modelo cargado, el renderer dibuja el robot legacy',()=>{
 const w=world('?robot=iroh',false);   // flag sin scripts del modelo (p. ej. el asset no pudo cargarse)
 w.render();
 assert.equal(w.js('BITIRO_ROBOT_MODEL'),'iroh-v1');assert.equal(w.js('BITIRO_RENDER_STATS.model'),'legacy','sin asset → legacy');
});

test('5. Carga estática: sin document.write; index.html trae los dos <script> autoalojados antes de renderer3d.js; en legacy el asset no se procesa',()=>{
 const html=read('index.html'),src=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const f of ['assets/iroh/iroh-render-v1.js','iroh-visual.js'])assert.equal(src.filter(x=>x===f).length,1,f);
 assert.ok(src.indexOf('assets/iroh/iroh-render-v1.js')<src.indexOf('iroh-visual.js')&&src.indexOf('iroh-visual.js')<src.indexOf('renderer3d.js'),'orden: asset → iroh-visual → renderer3d');
 assert.ok(src.every(x=>!/^(https?:)?\/\//.test(x)),'todos los scripts son autoalojados');
 assert.ok(!/<script(?![^>]*\bsrc=)/.test(html),'sin <script> inline (CSP script-src self)');
 for(const f of ['renderer3d.js','iroh-visual.js','assets/iroh/iroh-render-v1.js'])assert.ok(!/document\.write/.test(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'')),f+' sin document.write');
 assert.ok(!/createElement\(\s*['"]script/.test(read('renderer3d.js')+read('iroh-visual.js')),'sin carga dinámica de scripts');
 // legacy con los scripts estáticos presentes: IROH_VISUAL existe pero no ha procesado el asset
 const h=world('');vm.runInContext(read('assets/iroh/iroh-render-v1.js'),h.ctx);vm.runInContext(read('iroh-visual.js'),h.ctx);
 h.render();assert.equal(h.js('BITIRO_RENDER_STATS.model'),'legacy');assert.equal(h.js('IROH_VISUAL.prepared'),false,'legacy no procesa el asset');
 for(const f of ['renderer3d.js','iroh-visual.js','tools/build-iroh-render-asset.mjs'])assert.ok(!/\beval\(|new Function|fetch\(|XMLHttpRequest|https?:\/\//.test(read(f).replace(/\/\*[\s\S]*?\*\//g,'')),f);
 assert.ok(!/eval\(|new Function|https?:\/\//.test(read('assets/iroh/iroh-render-v1.js')));
});

test('6. El render IROH no muta robot, pista, obstáculos ni física (objetos congelados)',()=>{
 const w=world('?robot=iroh');
 const track=w.js('sceneTrack'),obs=w.js('activeObstacles');
 const robot=Object.freeze({x:50,y:130,heading:.4,lineCenter:0,lineActive:Object.freeze([true,false,true]),strikerAngle:20,trail:Object.freeze([])});
 const before=state(w),spec=JSON.stringify(w.js('IROH_MECHANICS.spec'));
 w.ctx.__t=track;w.ctx.__o=obs;w.ctx.__r=robot;
 w.js('Object.freeze(IROH_MECHANICS.spec)');
 w.js('renderScene3D(document.getElementById("scene"),__t,__r,__o,{azimuth:.1,elevation:.9,distance:1.8,follow:false})');
 assert.equal(state(w),before);assert.equal(JSON.stringify(w.js('IROH_MECHANICS.spec')),spec);
 assert.ok(Object.isFrozen(w.js('IROH_VISUAL'))&&Object.isFrozen(w.js('IROH_RENDER_V1')));
});

test('7. Mapeo Blender→renderer: frente = +f (R.th), derecha = +r; la pose desplaza y gira el modelo',()=>{
 const colorsOf=name=>new Set(asset.parts[asset.names.indexOf(name)].map(f=>asset.palette[f[0]]));
 const red=[...colorsOf('HEAD_RED_PLATE')][0];
 const others=new Set(asset.names.filter(x=>!x.startsWith('WHEEL')).flatMap(x=>[...colorsOf(x)]));
 const wheelOnly=[...colorsOf('WHEEL_R')].filter(c=>!others.has(c));assert.ok(wheelOnly.length>=1,'color exclusivo de rueda');
 const w=world('?robot=iroh');
 const centroid=(col,fill)=>{const pts=col.filter(f=>f.fill===fill).flatMap(f=>f.pts);assert.ok(pts.length,fill);return {x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length,z:pts.reduce((s,p)=>s+p.z,0)/pts.length};};
 const probe=(x,y,th)=>{const heading=th-Math.PI/2;   // cámara delante del robot (azimut = rumbo visual), siguiéndolo
  w.js(`camera={azimuth:${heading},elevation:.6,distance:.5,follow:true};R.x=${x};R.y=${y};R.th=${th};previousPose={x:R.x,y:R.y,th:R.th,angle:0};paused=true;`);w.render();
  const f2=[Math.cos(heading),Math.sin(heading)],r2=[-Math.sin(heading),Math.cos(heading)];
  const tw=w.js('sceneTrack.physicalWidthCm'),tH=w.js('sceneTrack.physicalHeightCm');
  const loc=c=>{const dx=c.x-(x-tw/2),dz=c.z-(y-tH/2);return {f:dx*f2[0]+dz*f2[1],r:dx*r2[0]+dz*r2[1],up:c.y};};
  const wp=w.ctx.__all.filter(f=>f.fill===wheelOnly[0]).flatMap(f=>f.pts);assert.ok(wp.length);
  return {red:loc(centroid(w.ctx.__all,red)),wheel:{...loc(centroid(w.ctx.__all,wheelOnly[0])),maxAbsR:Math.max(...wp.map(q=>Math.abs(loc(q).r)))}};};
 const a=probe(40,100,0),b=probe(70,60,0),c=probe(40,100,1.2);
 for(const p of [a,b,c]){assert.ok(p.red.f>4&&p.red.f<6.64,'placa roja sobre la base de la cabeza, detrás de la cara de TX/RX (≈+6,64): f='+p.red.f);assert.ok(Math.abs(p.red.r)<2,'placa roja casi en el eje (las ranuras del modelo son asimétricas)');assert.ok(p.red.up>12,'placa roja alta');}
 assert.ok(Math.abs(a.red.f-b.red.f)<1e-6&&Math.abs(a.red.f-c.red.f)<1e-6,'el marco local no depende de la pose (se mueve y gira con R.x/R.y/R.th)');
 assert.ok(a.wheel.up<6.5&&a.wheel.up>0,'ruedas apoyadas en el suelo (Ø6,5)');
 assert.ok(a.wheel.maxAbsR>4.5&&a.wheel.maxAbsR<8,'ruedas a los lados (|r| máx ≈ 6,25): '+a.wheel.maxAbsR);
 assert.ok(a.wheel.f<a.red.f,'las ruedas están detrás de la cabeza');
});

test('8. Física, sensores, props, runtime y simTime idénticos con legacy e iroh-v1 (mismo programa, mismos ticks, render intercalado)',()=>{
 const run=q=>{const w=world(q);w.program(CODE);const out=[];
  for(let t=1;t<=1200;t++){w.js('update(1/120)');if(t%40===0){w.render();out.push(state(w));}}
  w.js('paused=true;');return {w,out};};
 const L=run(''),I=run('?robot=iroh');
 assert.equal(L.out.length,30);assert.deepEqual(I.out,L.out);
 assert.equal(L.w.js('BITIRO_RENDER_STATS.model'),'legacy');assert.equal(I.w.js('BITIRO_RENDER_STATS.model'),'iroh-v1');
 const s=JSON.parse(I.out.at(-1));assert.ok(s.simTime>9&&s.R.y!==undefined&&s.mode==='code');
 assert.equal(JSON.stringify(s.line),JSON.stringify({front:8,spread:1.9}),'LINE_SENSOR.geometry intacto (valores de PHYSICAL-GEOMETRY-2)');
});

test('9. Los 4 modos de cámara y la calibración dibujan IROH sin error; los LED de detección no revelan lecturas en calibración',()=>{
 const w=world('?robot=iroh');w.program(CODE);w.tick(60);
 for(const v of ['top','perspective','follow','robot']){w.js(`cameraUI('${v}')`);w.render();assert.ok(w.fillsCount()>300,v);assert.equal(w.js('BITIRO_RENDER_STATS.model'),'iroh-v1');
  const p=w.js(`(()=>{const {x,y}=BITIRO_SCENE_VIEW.projectGround(document.getElementById('scene'),sceneTrack,camera,{x:R.x,y:R.y},R.x,R.y,0)||{};return [x,y]})()`);
  assert.ok(p.every(Number.isFinite),'projectGround '+v);}
 // pickGround ∘ projectGround = identidad sobre el suelo, igual que con legacy (cameraRig no cambia)
 const rt=q=>{const ww=world(q);ww.js("cameraUI('perspective')");return ww.js(`(()=>{const cv=document.getElementById('scene'),r={x:R.x,y:R.y},p=BITIRO_SCENE_VIEW.projectGround(cv,sceneTrack,camera,r,30,90,0),g=BITIRO_SCENE_VIEW.pickGround(cv,sceneTrack,camera,r,p.x,p.y);return [p.x,p.y,g.x,g.y]})()`);};
 const A=rt(''),B=rt('?robot=iroh');assert.equal(JSON.stringify(B),JSON.stringify(A));assert.ok(Math.abs(B[2]-30)<1e-6&&Math.abs(B[3]-90)<1e-6);
 w.js('BITIRO_MANUAL.calibration=true');w.render();

 assert.ok(/calibration\?\[false,false,false\]/.test(read('simulator.js')),'en calibración lineActive = false (sin cambios)');
});

test('10. Presupuesto de caras: IROH <= 600 por frame y comparable al legacy',()=>{
 const L=world('');L.render();const I=world('?robot=iroh');I.render();
 const lf=L.js('BITIRO_RENDER_STATS.robotFaces'),ifc=I.js('BITIRO_RENDER_STATS.robotFaces');
 console.log('   LEGACY_ROBOT_RENDER_FACES='+lf+' · IROH_ROBOT_RENDER_FACES='+ifc+' (tras culling de caras traseras; el asset tiene '+asset.stats.polygons+')');
 assert.ok(ifc<=600&&ifc<=4*lf);
});

/* ── SIM-3D-INTEGRATION-2 · alineación del modelo visual con la geometría funcional (marco R = centro del eje) ──
   Solo LEE las constantes funcionales para compararlas con el asset; nunca las escribe ni derivan de él. */
const bbox=name=>{const i=asset.names.indexOf(name);assert.ok(i>=0,name);const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
 for(const f of asset.parts[i])for(let k=1;k<f.length;k+=3)for(let j=0;j<3;j++){mn[j]=Math.min(mn[j],f[k+j]*asset.unit);mx[j]=Math.max(mx[j],f[k+j]*asset.unit);}
 return {mn,mx,c:mn.map((v,j)=>(v+mx[j])/2),size:mn.map((v,j)=>mx[j]-v)};};
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,msg+': '+a+' ≠ '+b);

test('11. R = centro del eje: ruedas en (0, ±5,0) Ø6,5×2,5; placa 17,6×11,0×0,3 centrada en −2,3 con borde frontal en +6,5',()=>{
 assert.equal(asset.frame,'R-axle-center');
 for(const [n,side] of [['WHEEL_L',-1],['WHEEL_R',1]]){const b=bbox(n);near(b.c[0],0,.011,n+' f');near(b.c[1],side*5,.011,n+' r');near(b.size[2],6.5,.011,n+' diámetro');near(b.size[1],2.5,.011,n+' ancho');near(b.mn[2],0,.011,n+' apoyada en el suelo');}
 near(bbox('WHEEL_R').mx[1]-bbox('WHEEL_L').mn[1],12.5,.011,'ancho exterior rueda-a-rueda (medido)');
 near(bbox('WHEEL_R').c[1]-bbox('WHEEL_L').c[1],10,.011,'separación entre centros de rueda = wheelbase funcional (base=10)');
 assert.ok(read('simulator.js').includes('base=10;'),'el simulador sigue en base=10');
 for(const n of ['CHASSIS_LOWER','CHASSIS_UPPER']){const b=bbox(n);near(b.c[0],-2.3,.011,n+' centro de placa');near(b.size[0],17.6,.011,n+' largo');near(b.size[1],11,.011,n+' ancho');near(b.mx[0],6.5,.011,n+' borde frontal');near(b.size[2],.3,.011,n+' espesor');}
});

test('12. Sensores de línea (8,0 ; 0 / ±1,9); PCB 1,4; base negra de la cabeza en +3,95 con TX/RX ≈ +6,64 (provisional, rígido); sonar FUNCIONAL aún +4,0; pivote del striker = HIT',()=>{
 const h=world('?robot=iroh');const g=h.js('LINE_SENSOR.geometry'),spec=h.js('IROH_MECHANICS.spec');
 assert.deepEqual({front:g.front,spread:g.spread},{front:8,spread:1.9});
 for(const [n,side] of [['LINE_SENSOR_L',-1],['LINE_SENSOR_C',0],['LINE_SENSOR_R',1]]){const b=bbox(n);near(b.c[0],g.front,.011,n+' f = LINE_SENSOR.geometry.front');near(b.c[1],side*g.spread,.011,n+' r = ±spread');near(b.size[1],1.4,.011,n+' ancho de PCB (medido)');}
 // residual conocido y documentado: el PCB del Blender mide 3,0 de largo, el medido 3,1 (0,1 cm)
 near(bbox('LINE_SENSOR_C').size[0],3.0,.011,'largo de PCB del Blender (residual 0,1 vs 3,1 medido)');
 /* Cabeza: traslación RÍGIDA para que la base negra (medida 3,50 × 3,20; delante +5,70, centro +3,95, detrás +2,20) quede centrada en +3,95.
    El Blender la tiene en ≈3,6 × 4,0: SOLO su footprint se escala a lo medido (3,50 × 3,20); lo montado encima no se mueve. */
 const hb=bbox('HEAD_BASE');near(hb.c[0],3.95,.011,'centro de HEAD_BASE (medido +3,95)');near(hb.mn[0],2.20,.05,'borde trasero de la base (+2,20)');near(hb.mx[0],5.70,.05,'borde delantero de la base (+5,70)');near(hb.size[0],3.50,.05,'HEAD_BASE longitudinal medido');near(hb.size[1],3.20,.05,'HEAD_BASE transversal medido');near(hb.c[1],0,.011,'HEAD_BASE centrada lateralmente');
 near(bbox('CHASSIS_UPPER').mx[0]-hb.mx[0],.80,.05,'holgura borde de acrílico → borde delantero de la base (medida 0,80)');
 /* TX/RX ≈ +6,64 = PHOTO-CONSTRAINED / PROVISIONAL_PHYSICAL_GEOMETRY (no medido directo). Toda la cabeza se movió igual (+2,64 vs INTEGRATION-2). */
 for(const n of ['ULTRASONIC_TX','ULTRASONIC_RX'])near(bbox(n).mx[0],6.64,.011,n+' cara frontal provisional ≈ +6,64');
 // la cabeza conserva su posición (traslación rígida de 2A): distancias relativas al centro de la base idénticas a INTEGRATION-2
 const rel=n=>bbox(n).c[0]-hb.c[0];
 near(bbox('ULTRASONIC_TX').mx[0]-hb.c[0],2.69,.011,'cara TX − centro de base = 2,69 (sin deformar)');near(rel('HEAD_RED_PLATE'),1.20,.011,'placa roja respecto de la base');near(rel('HEAD_SERVO_PAN'),0,.011,'servo pan respecto de la base');near(rel('HEAD_MECHANISM'),0,.011,'mecanismo respecto de la base');
 near(bbox('ULTRASONIC_TX').mx[0],bbox('ULTRASONIC_RX').mx[0],.001,'TX y RX coplanares');
 assert.ok(read('simulator.js').includes('MECH.worldPoint(R,4.0,0)'),'el sonar funcional sigue en +4,0');
 near(bbox('SERVO').c[0],spec.pivotForward,.011,'SERVO centrado en el pivote que usa el palo (IROH_MECHANICS.spec.pivotForward)');
 near(bbox('SERVO').c[1],spec.pivotRight,.011,'SERVO centrado en pivotRight');
 // el palo y la física no se tocaron: spec idéntico al de PHYSICAL-GEOMETRY-2
 assert.equal(spec.pivotForward,8.6);assert.equal(spec.length,13.2);
});

test('13. Coherencia interna: sin piezas flotantes ni intersecciones nuevas respecto de INTEGRATION-1; sensores delante de la placa solo por sus PCB',()=>{
 const names=asset.names,B=Object.fromEntries(names.map(n=>[n,bbox(n)]));
 const ov=(a,b)=>[0,1,2].every(j=>Math.min(B[a].mx[j],B[b].mx[j])-Math.max(B[a].mn[j],B[b].mn[j])>.05);
 const now=new Set();for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(ov(names[i],names[j]))now.add(names[i]+'×'+names[j]);
 // intersecciones de bounding-box que ya existían por diseño en el Blender (sólidos con huecos, piezas encajadas): ninguna nueva
 const known=new Set(['CHASSIS_LOWER×MOTOR_L','CHASSIS_LOWER×MOTOR_R','CHASSIS_LOWER×WHEEL_L','CHASSIS_LOWER×WHEEL_R','CHASSIS_UPPER×ELECTRONICS','ELECTRONICS×HEAD_BASE','ELECTRONICS×HEAD_SERVO_PAN','ELECTRONICS×LCD','ELECTRONICS×MOTOR_L','ELECTRONICS×MOTOR_R','ELECTRONICS×SPACERS','FRONT_MECHANISM×SERVO','HEAD_MECHANISM×HEAD_RED_PLATE','HEAD_MECHANISM×HEAD_SERVO_TILT','ULTRASONIC_RX×ULTRASONIC_BODY','ULTRASONIC_TX×ULTRASONIC_BODY','LINE_SENSOR_BRACKET×LINE_SENSOR_C','LINE_SENSOR_BRACKET×LINE_SENSOR_L','LINE_SENSOR_BRACKET×LINE_SENSOR_R','MOTOR_L×SPACERS','MOTOR_L×WHEEL_L','MOTOR_R×SPACERS','MOTOR_R×WHEEL_R','SPACERS×WHEEL_L','SPACERS×WHEEL_R']);
 const added=[...now].filter(x=>!known.has(x));assert.deepEqual(added,[],'intersecciones nuevas: '+added.join(', '));
 assert.ok(B.LCD.mx[0]<B.HEAD_BASE.mn[0],'el LCD no invade la base de la cabeza');
 // todo el modelo cabe bajo el techo de altura medido del Blender y no se va del suelo
 const top=Math.max(...names.map(n=>B[n].mx[2])),bottom=Math.min(...names.map(n=>B[n].mn[2]));assert.ok(bottom>=-.011&&top<21,'alto total '+top);
 // extensión longitudinal: atrás ≥ −11,2 (borde de placa −11,1), adelante ≤ 9,6 (PCB de sensor)
 const fMin=Math.min(...names.map(n=>B[n].mn[0])),fMax=Math.max(...names.map(n=>B[n].mx[0]));
 console.log('   extensión longitudinal desde R: '+fMin.toFixed(2)+' … +'+fMax.toFixed(2)+' cm · bodyRadius funcional 8,3 (supuesto, sin cambios)');
 assert.ok(fMin>=-11.2&&fMax<=10.6);
});

test('14. Dibujo IROH: las 3 huellas funcionales (8,0 ; 0/±1,9) quedan bajo las PCB visuales, con la pose en movimiento y girada',()=>{
 const w=world('?robot=iroh');
 const track=w.js('sceneTrack'),tw=track.physicalWidthCm,tH=track.physicalHeightCm;
 const probe=(x,y,th)=>{const heading=th-Math.PI/2;w.js(`camera={azimuth:${heading},elevation:.6,distance:.5,follow:true};R.x=${x};R.y=${y};R.th=${th};previousPose={x:R.x,y:R.y,th:R.th,angle:0};paused=true;`);w.render();
  const f2=[Math.cos(heading),Math.sin(heading)],r2=[-Math.sin(heading),Math.cos(heading)];
  return c=>({f:(c.x-(x-tw/2))*f2[0]+(c.z-(y-tH/2))*f2[1],r:(c.x-(x-tw/2))*r2[0]+(c.z-(y-tH/2))*r2[1],up:c.y});};
 const pcbFill=asset.palette[asset.parts[asset.names.indexOf('LINE_SENSOR_C')][0][0]];
 for(const [x,y,th] of [[40,100,0],[70,60,1.2]]){
  const loc=probe(x,y,th);
  // las 3 huellas de lectura (capa 3, círculo de 12 puntos, z≈−0,60) están centradas en (front, k·spread) = (8,0 ; 0 / ±1,9)
  const foot=w.ctx.__all.filter(f=>f.pts.length===12&&Math.abs(f.pts[0].y+.6)<.02).map(f=>{const p=f.pts.map(loc);return {f:p.reduce((s,q)=>s+q.f,0)/12,r:p.reduce((s,q)=>s+q.r,0)/12};}).sort((a,b)=>a.r-b.r);
  assert.equal(foot.length,3);
  foot.forEach((q,i)=>{near(q.f,8,.02,'huella '+i+' f');near(q.r,(i-1)*1.9,.02,'huella '+i+' r');});
  // el modelo visual está sobre ellas: las caras del PCB (altura ≈ 1,55) rodean cada huella
  const pcb=w.ctx.__all.filter(f=>f.fill===pcbFill).flatMap(f=>f.pts.map(loc));
  assert.ok(pcb.length>0);
  for(const q of foot)assert.ok(pcb.some(p=>Math.abs(p.f-q.f)<1.6&&Math.abs(p.r-q.r)<.8),'PCB visual bajo la huella funcional');
 }
});

test('15. Cámara Robot con IROH: el bounding box proyectado del modelo completo cabe en el canvas con margen; el obstáculo frontal no queda menos visible que en legacy; legacy y demás vistas intactas',()=>{
 const vertsOf=()=>asset.parts.flatMap(p=>p.flatMap(f=>{const o=[];for(let i=1;i<f.length;i+=3)o.push([f[i]*asset.unit,f[i+1]*asset.unit,f[i+2]*asset.unit]);return o;}));
 const verts=vertsOf();
 const project=(w,size,v)=>{   // proyecta con la MISMA cámara del renderer (BITIRO_SCENE_VIEW.projectGround) vértices del asset en la pose inicial
  const {R}=JSON.parse(w.js('JSON.stringify({R:{x:R.x,y:R.y,th:R.th}})'));const hd=R.th-Math.PI/2;
  return w.js(`(()=>{const cv=document.getElementById('scene'),r={x:R.x,y:R.y},hd=${hd};let a=1e9,b=-1e9,l=1e9,rr=-1e9;
   for(const [f,s,u] of ${JSON.stringify(verts)}){const x=R.x+f*Math.cos(hd)-s*Math.sin(hd),y=R.y+f*Math.sin(hd)+s*Math.cos(hd);const p=BITIRO_SCENE_VIEW.projectGround(cv,sceneTrack,camera,r,x,y,u);if(!p)return null;
    a=Math.min(a,p.y);b=Math.max(b,p.y);l=Math.min(l,p.x);rr=Math.max(rr,p.x)}return {top:a,bottom:b,left:l,right:rr}})()`);};
 const sizes=[[1366,768],[790,520],[700,480],[560,420],[390,300],[390,700]];
 const margin=(W,H)=>Math.min(W,H)*.04;
 for(const track of ['s01','s02']){
  for(const [W,H] of sizes){
   const w=world('?robot=iroh');w.js(`changeTrack('${track}')`);
   w.js('(()=>{const cv=document.getElementById("scene");cv.getBoundingClientRect=()=>({width:'+W+',height:'+H+'})})()');
   w.js("cameraUI('robot')");w.js('paused=true;render()');
   const bb=project(w,[W,H],0);assert.ok(bb,'proyectable');
   const m=margin(W,H),tag=track+' '+W+'×'+H+' '+JSON.stringify(Object.fromEntries(Object.entries(bb).map(([k,v])=>[k,Math.round(v)])));
   assert.ok(bb.top>=m&&bb.bottom<=H-m&&bb.left>=m&&bb.right<=W-m,'IROH recortado en camera=robot: '+tag);
   assert.ok((bb.bottom-bb.top)>=.25*H||W<H,'el robot no queda diminuto: '+tag);
   if(track==='s01'){   /* Obstáculo frontal: con la cámara Robot el tablero se ve desde DELANTE del robot, así que el obstáculo queda entre la cámara y el robot,
      bajo el borde inferior. El encuadre IROH no debe dejarlo menos visible que el robot legacy con la misma cámara (esquinas dentro del canvas). */
    const seen=q=>{const l=world(q);l.js(`changeTrack('s01')`);l.js('(()=>{const cv=document.getElementById("scene");cv.getBoundingClientRect=()=>({width:'+W+',height:'+H+'})})()');l.js("cameraUI('robot')");l.js('paused=true;render()');
     return l.js(`activeObstacles.flatMap(o=>[[0,0],[o.width,0],[0,o.height],[o.width,o.height]].map(([dx,dy])=>BITIRO_SCENE_VIEW.projectGround(document.getElementById('scene'),sceneTrack,camera,{x:R.x,y:R.y},o.x+dx,o.y+dy,0))).filter(p=>p&&p.x>=0&&p.x<=${W}&&p.y>=0&&p.y<=${H}).length`);};
    assert.ok(seen('?robot=iroh')>=seen(''),'obstáculo menos visible que en legacy: '+tag);
   }
  }
 }
 // El zoom del usuario sigue actuando (distance menor → más grande) y el límite es el mismo de siempre
 const z=world('?robot=iroh');z.js("cameraUI('robot')");z.js('paused=true');
 const hgt=d=>{z.js(`camera.distance=${d}`);z.js('render()');const b=project(z,[700,480],0);return b.bottom-b.top;};
 assert.ok(hgt(.3)>hgt(.37)&&hgt(.37)>hgt(.5),'el zoom del usuario (camera.distance) sigue actuando en camera=robot');
 // legacy: cameraRig idéntico al de INTEGRATION-1 (misma proyección con y sin los scripts estáticos), y follow/perspective/top no cambian con IROH
 const rig=(q,v)=>{const w=world(q);w.js(`cameraUI('${v}')`);w.js('paused=true');return w.js(`(()=>{const cv=document.getElementById('scene'),r={x:R.x,y:R.y};return [30,90].map((x,i)=>BITIRO_SCENE_VIEW.projectGround(cv,sceneTrack,camera,r,x,i?90:60,i*3))})()`);};
 for(const v of ['perspective','top','follow'])assert.equal(JSON.stringify(rig('?robot=iroh',v)),JSON.stringify(rig('',v)),v+' idéntico entre legacy e iroh-v1');
 const leg=rig('','robot');assert.ok(leg.every(p=>p&&Number.isFinite(p.x)));
 // legacy robot: parámetros del preset y distancia efectiva intactos
 const lw=world('');lw.js("cameraUI('robot')");assert.equal(lw.js('JSON.stringify(camera)'),JSON.stringify({azimuth:-1.12,elevation:.45,distance:.37,follow:true}));
});

console.log('\n'+n+' comprobaciones SIM-3D-INTEGRATION-1/2 (lógica) superadas.');
