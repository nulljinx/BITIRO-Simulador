/* Editor opcional: intérprete didáctico adaptado del archivo HTML aportado por el usuario.
   Es un subconjunto de Arduino/C++, sin eval ni ejecución de JS arbitrario. */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const R={x:0,y:0,th:0,L:0,R:0};
const ir=[0,0];
let btn=0; // pulsador: como en el Lab, alterna (Libre ↔ Presionado) y leerBoton() devuelve 1/0
let running=0,halt=0,wait=0,waitingButton=0,it=null,prog,strict,ini={},warns=new Set(),lcd=['',''],scopes=[Object.create(null)],variableTypes=new WeakMap(),callDepth=0;
const MAX_CALL_DEPTH=64;   // llamadas anidadas de funciones propias (determinista; evita que f(){f();} congele el navegador)
function reset(){ if(typeof window.resetRobot==='function')window.resetRobot(); }
function lect(k){return typeof window.readLine==='function'?window.readLine(k):28;}
function setIR(k,v){ir[k]=v?1:0;const b=$('ir'+k);b.setAttribute('aria-pressed',String(!!ir[k]));b.querySelector('strong').textContent=ir[k]?'Activo':'Libre';}
function setButton(v){btn=v?1:0;const b=$('pulsador');b.setAttribute('aria-pressed',String(!!btn));b.querySelector('strong').textContent=btn?'Presionado':'Libre';}
const EJ=[
`// Tres sensores: usa la calibración guardada.
// 1 = negro; 0 = blanco. Los motores reciben izq., der.
void setup() {
  inicializarMovimiento();
  inicializarSensores();
  botonInicio();
}

void loop() {
  bool izq = lineaIzquierda();
  bool centro = lineaCentral();
  bool der = lineaDerecha();

  if (izq && centro && der) {
    // Barra o cruce: conserva el rumbo.
    avanzar(25);
  }
  else if (izq && !der) {
    avanzar(12, 35);  // gira hacia la izquierda
  }
  else if (der && !izq) {
    avanzar(35, 12);  // gira hacia la derecha
  }
  else if (centro) {
    avanzar(35);
  }
  else {
    // Sin línea: detente y revisa tu estrategia.
    detenerse();
  }
}`,
`// Seguidor de línea con 1 sensor (sigue el borde)
int umbral = leerUmbralLinea();

void setup() {
  inicializarMovimiento();
  inicializarSensores();
  botonInicio();
}

void loop() {
  int sC = leerLineaNormalizada(1);
  if (sC >= umbral) {
    avanzar(30, 90);
  }
  else {
    avanzar(90, 30);
  }
}`,
`void setup() {
  inicializarMovimiento();
  inicializarSensores();
  botonInicio();
}

void loop() {
  // ¡Escribe aquí tu programa!
}`,
`// Sigue la línea y se detiene si un sensor IR detecta un obstáculo
int umbral = leerUmbralLinea();

void setup() {
  inicializarMovimiento();
  inicializarSensores();
  botonInicio();
}

void loop() {
  int obsI = leerSensorObstaculoIzquierdo();
  int obsD = leerSensorObstaculoDerecho();
  int sC = leerLineaNormalizada(1);

  if (obsI == 1 || obsD == 1) {
    detenerse();
  }
  else if (sC >= umbral) {
    avanzar(30, 90);
  }
  else {
    avanzar(90, 30);
  }
}`,`// Golpe con sonar: la garra parte al centro (apunta al frente), así que primero se aparta a un lado.
// El golpe no mueve objetos a distancia ni atraviesa cajas: solo desplaza lo que toca.
void setup() {
  inicializarMovimiento();
  inicializarSensores();
  inicializarGolpe();
  moverServoGolpe(-1);   // garra a la izquierda del robot, fuera del eje frontal
  pausa(600);            // da tiempo a que la garra gire
}

void loop() {
  int distancia = leerDistanciaSonar();
  if (distancia <= 10) {
    detenerse();
    moverServoGolpe(1);   // barrido de izquierda a derecha
    pausa(900);
    moverServoGolpe(0);   // vuelve al centro
    pausa(700);
  }
  else {
    avanzar(30);
  }
}`];


const TY=['int','float','long','bool','byte'],CONS={true:1,false:0,HIGH:1,LOW:0};
function lex(src){
  const T=[];let i=0,ln=1;
  src=src.replace(/^[ \t]*#.*$/gm,'');
  while(i<src.length){
    const ch=src[i];let m;
    if(ch==='\n'){ln++;i++;continue}
    if(/\s/.test(ch)){i++;continue}
    if(src.startsWith('//',i)){while(i<src.length&&src[i]!=='\n')i++;continue}
    if(src.startsWith('/*',i)){const e=src.indexOf('*/',i+2);if(e<0)throw{m:'Comentario «/*» sin cerrar',ln};for(const c of src.slice(i,e+2))if(c==='\n')ln++;i=e+2;continue}
    if(m=/^\d+(\.\d+)?/.exec(src.slice(i,i+20))){T.push({t:'n',v:parseFloat(m[0]),numericType:m[0].includes('.')?'float':'int',ln});i+=m[0].length;continue}
    if(m=/^[A-Za-z_]\w*/.exec(src.slice(i,i+60))){T.push({t:'i',v:m[0],ln});i+=m[0].length;continue}
    if(ch==='"'){const e=src.indexOf('"',i+1);if(e<0)throw{m:'Faltan unas comillas de cierre «"»',ln};T.push({t:'s',v:src.slice(i+1,e),ln});i=e+1;continue}
    m=/^(\+\+|--|\+=|-=|&&|\|\||==|!=|<=|>=|[-+*\/%<>=!(){};,])/.exec(src.slice(i,i+2));
    if(!m)throw{m:(ch==='&'||ch==='|')?'Para «y» usa «&&» y para «o» usa «||» (dos símbolos)':'Símbolo no válido «'+ch+'»',ln};
    T.push({t:'p',v:m[0],ln});i+=m[0].length;
  }
  return T;
}
function parse(T){
  let p=0;
  const last=()=>T[p-1]||{ln:1},is=v=>T[p]&&T[p].t==='p'&&T[p].v===v;
  const ex=(v,why)=>{if(!is(v))throw{m:why||'Falta «'+v+'»',ln:((v===';'||v===')')&&p?last():T[p]||last()).ln};p++};
  const body=()=>is('{')?block():[stmt()];
  function block(){ex('{');const b=[];while(!is('}')){if(p>=T.length)throw{m:'Falta cerrar una llave «}»',ln:last().ln};b.push(stmt())}p++;return b}
  function ifs(){
    const ln=T[p].ln;p++;ex('(','Falta «(» después de if');
    const c=expr();
    if(is('='))throw{m:'En una condición se compara con «==». El «=» sirve para guardar valores',ln};
    ex(')','Falta «)» al cerrar la condición del if');
    const b=body();let e=null;
    if(T[p]&&T[p].v==='else'){p++;e=(T[p]&&T[p].v==='if')?[ifs()]:body()}
    return{k:'if',c,b,e,ln};
  }
  function stmt(){
    const t=T[p];
    if(!t)throw{m:'El programa termina antes de tiempo (¿falta algo?)',ln:last().ln};
    if(is('{'))return{k:'blk',b:block()};
    if(t.t==='i'){
      if(t.v==='if')return ifs();
      if(t.v==='while'){p++;ex('(');const c=expr();ex(')');return{k:'while',c,b:body(),ln:t.ln}}
      if(t.v==='for')throw{m:'«for» no está disponible en este simulador; usa «while»',ln:t.ln};
      if(t.v==='return'){p++;let e=null;if(!is(';'))e=expr();ex(';');return{k:'ret',e,ln:t.ln}}
      if(TY.includes(t.v)){
        p++;const ds=[];
        do{const n=T[p++];if(!n||n.t!=='i')throw{m:'Falta el nombre de la variable',ln:t.ln};let e=null;if(is('=')){p++;e=expr()}ds.push({n:n.v,e,type:t.v,ln:t.ln})}while(is(',')&&++p);
        ex(';');return{k:'dec',ds,ln:t.ln};
      }
      const n=T[p+1];
      if(n&&n.t==='p'&&n.v==='('){const e=expr();ex(';');return{k:'ex',e,ln:t.ln}}
      if(n&&n.t==='p'&&['=','+=','-=','++','--'].includes(n.v)){
        p+=2;const e=(n.v==='++'||n.v==='--')?{k:'n',v:1}:expr();ex(';');
        return{k:'as',n:t.v,op:n.v[0],e,ln:t.ln};
      }
      if(FN[t.v])throw{m:'Después de «'+t.v+'» van paréntesis: '+t.v+'( ... );',ln:t.ln};
    }
    throw{m:t.v==='}'?'Sobra una llave «}»':'No entiendo esta instrucción cerca de «'+t.v+'»',ln:t.ln};
  }
  const BIN=[['||'],['&&'],['==','!='],['<','>','<=','>='],['+','-'],['*','/','%']];
  function expr(l=0){
    if(l>=BIN.length)return un();
    let a=expr(l+1);
    while(T[p]&&T[p].t==='p'&&BIN[l].includes(T[p].v)){const o=T[p++].v;a={k:'b',o,a,b:expr(l+1)}}
    return a;
  }
  function un(){
    if(is('!')){p++;return{k:'u',o:'!',a:un()}}
    if(is('-')){p++;return{k:'u',o:'-',a:un()}}
    const t=T[p++];
    if(!t)throw{m:'La instrucción termina antes de tiempo',ln:last().ln};
    if(t.t==='n'||t.t==='s')return{k:t.t,v:t.v,numericType:t.numericType};
    if(t.t==='i'){
      if(is('(')){p++;const a=[];if(!is(')')){do{a.push(expr())}while(is(',')&&++p)}ex(')');return{k:'c',n:t.v,a,ln:t.ln}}
      return{k:'v',n:t.v,ln:t.ln};
    }
    if(t.v==='('){const e=expr();ex(')');return e}
    throw{m:'No esperaba «'+t.v+'» en este lugar',ln:t.ln};
  }
  const globals=[],fn={},fns=Object.create(null),sketch=T.some(t=>t.v==='void');
  // Función propia: «tipo nombre(tipo a, tipo b) { ... }». Se declara en el nivel superior y puede usarse desde cualquier punto (sin prototipos).
  function fdef(){
    const t=T[p++],n=T[p++];ex('(');const params=[];
    if(!is(')')){do{
      const ty=T[p++];
      if(!ty||ty.t!=='i'||!TY.includes(ty.v))throw{m:'Cada parámetro necesita un tipo (int, float, long, bool o byte) antes de su nombre',ln:(ty||last()).ln};
      const nm=T[p++];
      if(!nm||nm.t!=='i')throw{m:'Falta el nombre del parámetro',ln:ty.ln};
      if(params.some(q=>q.n===nm.v))throw{m:'El parámetro «'+nm.v+'» está repetido en «'+n.v+'()»',ln:nm.ln};
      params.push({n:nm.v,type:ty.v,ln:nm.ln});
    }while(is(',')&&++p)}
    ex(')');
    if(is(';'))throw{m:'No hace falta declarar «'+n.v+'()» antes: escribe la función completa con sus llaves { ... }',ln:n.ln};
    return{name:n.v,ret:t.v,params,body:block(),ln:n.ln};
  }
  if(!sketch){fn.loop=[];while(p<T.length)fn.loop.push(stmt())}
  else{
    while(p<T.length){
      const t=T[p];
      if((t.v==='void'||TY.includes(t.v))&&T[p+1]&&T[p+1].t==='i'&&T[p+2]&&T[p+2].t==='p'&&T[p+2].v==='('){
        const d=fdef();
        if(d.name==='setup'||d.name==='loop'){
          if(d.ret!=='void'||d.params.length)throw{m:'«'+d.name+'()» debe ser «void '+d.name+'()» y no recibe parámetros',ln:d.ln};
          if(fn[d.name])throw{m:'«'+d.name+'()» ya está declarada; solo puede haber una',ln:d.ln};
          fn[d.name]=d.body;
        }else{
          if(FN[d.name])throw{m:'«'+d.name+'» ya es una función del robot; elige otro nombre para tu función',ln:d.ln};
          if(d.name in CONS)throw{m:'«'+d.name+'» es un valor reservado; elige otro nombre para tu función',ln:d.ln};
          if(fns[d.name])throw{m:'La función «'+d.name+'()» ya está declarada (línea '+fns[d.name].ln+'); cada función propia necesita un nombre distinto',ln:d.ln};
          fns[d.name]=d;
        }
      }
      else if(t.v==='void'){
        p++;const n=T[p++];
        if(!n||n.t!=='i')throw{m:'Falta el nombre después de void',ln:t.ln};
        ex('(');   // «void nombre» sin paréntesis: error genérico de «Falta «(»»
      }
      else if(TY.includes(t.v))globals.push(stmt());
      else throw{m:'Fuera de las funciones solo puedes declarar variables',ln:t.ln};
    }
    if(!fn.loop)throw{m:'Falta la función void loop() { ... }',ln:1};
  }
  const gnames=new Set(globals.flatMap(g=>g.ds.map(d=>d.n)));
  for(const n in fns)if(gnames.has(n))throw{m:'«'+n+'» ya es una variable global; elige otro nombre para la función',ln:fns[n].ln};
  UF=fns;
  const vctx={ret:sketch?'void':null};   // en un programa sin funciones (script plano) «return» no tiene dónde volver
  chkS(globals.concat([{k:'blk',b:fn.setup||[]},{k:'blk',b:fn.loop}]),[],vctx);
  for(const n in fns){const f=fns[n];chkS(f.body,[gnames,new Set(f.params.map(q=>q.n))],{ret:f.ret,name:n});}
  return{globals,fn,fns,sketch};
}

/* revisión antes de ejecutar (como el compilador) */
function lev(a,b){const m=[];for(let i=0;i<=a.length;i++){m[i]=[i];for(let j=1;j<=b.length;j++)m[i][j]=i?Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]!==b[j-1])):j}return m[a.length][b.length]}
function near(n){n=n.toLowerCase();let b=null,bd=3;for(const k of [...Object.keys(FN),...Object.keys(UF)]){const d=lev(n,k.toLowerCase());if(d<bd){bd=d;b=k}}return b}
// Funciones propias del programa en curso (nombre → {ret,params,body,ln}); se reemplaza en cada parse().
let UF=Object.create(null);
// Funciones del robot que NO devuelven valor (void): válidas como sentencia, rechazadas dentro de una expresión. El resto (lecturas) devuelve un número.
const VOID_FN=new Set(['avanzar','retroceder','girarDerecha','girarIzquierda','detenerse','pausa','finPrograma','botonInicio','escribirPantalla','borrarPantalla','apagarPantalla','prenderPantalla','inicializarMovimiento','inicializarSensores','inicializarCabeza','inicializarGolpe','inicializarPantalla','apagarCabeza','moverServoYaw','moverServoPitch','moverServoGolpe']);
const plural=k=>k+' valor'+(k===1?'':'es');
// Resolución de una llamada: función del robot (FN) → función propia (UF) → error con sugerencia.
function vcall(e,asValue){
  const f=FN[e.n],u=UF[e.n];
  if(f){
    if(!f[0].includes(e.a.length))throw{m:'«'+e.n+'()» necesita '+f[0].join(' o ')+' valor(es) entre paréntesis y tiene '+e.a.length,ln:e.ln};
    if(asValue&&VOID_FN.has(e.n))throw{m:'«'+e.n+'()» es una función void: no devuelve ningún valor y no puede usarse dentro de una expresión.',ln:e.ln};
    return;
  }
  if(u){
    if(u.params.length!==e.a.length)throw{m:'«'+e.n+'()» necesita '+plural(u.params.length)+' y recibió '+e.a.length+'.',ln:e.ln};
    if(asValue&&u.ret==='void')throw{m:'«'+e.n+'()» es una función void: no devuelve ningún valor y no puede usarse dentro de una expresión.',ln:e.ln};
    return;
  }
  const s=near(e.n);throw{m:'No conozco la función «'+e.n+'()»'+(s?'. ¿Quisiste escribir «'+s+'()»?':''),ln:e.ln}
}
function chkV(n,ln,sc){if(!sc.some(x=>x.has(n))&&!(n in CONS))throw{m:'La variable «'+n+'» no está declarada (falta escribir «int '+n+' = ...;» antes de usarla)',ln}}
// asValue=false solo para la llamada que forma una sentencia completa (ahí una función void es válida).
function chkE(e,sc,asValue=true){
  if(e.k==='v')chkV(e.n,e.ln,sc);
  else if(e.k==='c'){vcall(e,asValue);e.a.forEach(a=>chkE(a,sc))}
  else if(e.k==='b'){chkE(e.a,sc);chkE(e.b,sc)}
  else if(e.k==='u')chkE(e.a,sc);
}
function chkS(list,sc,ctx){
  sc=[...sc,new Set()];
  for(const s of list){
    if(s.k==='dec')for(const d of s.ds){if(d.e)chkE(d.e,sc);sc[sc.length-1].add(d.n)}
    else if(s.k==='as'){chkV(s.n,s.ln,sc);chkE(s.e,sc)}
    else if(s.k==='ex')chkE(s.e,sc,false);
    else if(s.k==='ret'){
      if(!ctx||ctx.ret==null)throw{m:'«return» solo se puede usar dentro de una función',ln:s.ln};
      if(ctx.ret==='void'&&s.e)throw{m:'Una función void no devuelve valor: usa «return;» sin valor'+(ctx.name?' en «'+ctx.name+'()»':''),ln:s.ln};
      if(ctx.ret!=='void'&&!s.e)throw{m:'La función '+ctx.ret+' «'+ctx.name+'()» necesita un valor: escribe «return valor;»',ln:s.ln};
      if(s.e)chkE(s.e,sc);
    }
    else if(s.k==='if'){chkE(s.c,sc);chkS(s.b,sc,ctx);if(s.e)chkS(s.e,sc,ctx)}
    else if(s.k==='while'){chkE(s.c,sc);chkS(s.b,sc,ctx)}
    else if(s.k==='blk')chkS(s.b,sc,ctx);
  }
}

/* ---------- Ejecución ---------- */
function warn(t){if(!warns.has(t)){warns.add(t);$('msg').innerHTML+='\n<span class=warn>⚠ '+esc(t)+'</span>'}}
function mov(l,r){
  if(strict&&!ini.m){warn('Usaste un comando de movimiento sin llamar antes a inicializarMovimiento(): el robot real no se movería.');return}
  if(!Number.isFinite(l)||!Number.isFinite(r))throw{m:'La velocidad debe ser un número finito',ln:0};
  if(Math.abs(l)>100||Math.abs(r)>100)warn('Las velocidades van de 0 a 100: el valor se limitó.');
  R.L=Math.max(-100,Math.min(100,l));R.R=Math.max(-100,Math.min(100,r));
}
function sens(k){if(strict&&!ini.s){warn('Leíste un sensor sin llamar antes a inicializarSensores(): el robot real no entregaría lecturas válidas.');return 0}return k<3?lect(k):ir[k-3]}
function lineDetected(k){if(strict&&!ini.s){sens(k);return 0;}return +LINE_SENSOR.detected(lect(k),k);}
function lcdW(c,f,v){f=Math.max(0,Math.min(1,f|0));c=Math.max(0,c|0);v=String(v);const s=lcd[f].padEnd(16);lcd[f]=(s.slice(0,c)+v+s.slice(c+v.length)).slice(0,16)}
const NOP=()=>0;
const unavailable=name=>()=>{warn(name+'() no tiene efecto en este modelo virtual.');return 0;};
const FN={
 avanzar:[[1,2],a=>mov(a[0],a[1]??a[0])],
 retroceder:[[1,2],a=>mov(-a[0],-(a[1]??a[0]))],
 girarDerecha:[[1],a=>mov(a[0],-a[0])],
 girarIzquierda:[[1],a=>mov(-a[0],a[0])],
 detenerse:[[0],()=>mov(0,0)],
 pausa:[[1],NOP],
 finPrograma:[[0],()=>{mov(0,0);halt=1}],
 botonInicio:[[0],NOP],
 leerSensorLineaIzquierdo:[[0],()=>sens(0)],
 leerSensorLineaCentral:[[0],()=>sens(1)],
 leerSensorLineaDerecho:[[0],()=>sens(2)],
 leerBoton:[[0],()=>btn],
 leerDistanciaSonar:[[0],()=>{if(strict&&!ini.s){warn('Inicializa los sensores antes de leer el sonar.');return 200;}return window.readSonarDistance?window.readSonarDistance():200;}],
 leerLineaNormalizada:[[1],a=>{const k=a[0];if(!Number.isInteger(k)||k<0||k>2)throw{m:'El sensor debe ser 0 (izquierdo), 1 (central) o 2 (derecho)',ln:0};if(strict&&!ini.s){sens(k);return 0;}return LINE_SENSOR.normalized(lect(k),k);}],
 leerUmbralLinea:[[0],()=>LINE_SENSOR.profile.threshold],
 lineaIzquierda:[[0],()=>lineDetected(0)],lineaCentral:[[0],()=>lineDetected(1)],lineaDerecha:[[0],()=>lineDetected(2)],
 leerSensorObstaculoIzquierdo:[[0],()=>sens(3)],
 leerSensorObstaculoDerecho:[[0],()=>sens(4)],
 escribirPantalla:[[3],a=>lcdW(a[0],a[1],a[2])],
 borrarPantalla:[[0],()=>{lcd=['','']}],
 apagarPantalla:[[0],unavailable("apagarPantalla")],prenderPantalla:[[0],unavailable("prenderPantalla")],
 inicializarMovimiento:[[0],()=>{ini.m=1}],
 inicializarSensores:[[0],()=>{ini.s=1}],
 inicializarCabeza:[[0],unavailable("inicializarCabeza")],inicializarGolpe:[[0],()=>{ini.g=1;if(window.setStrikerPosition)window.setStrikerPosition(0);}],inicializarPantalla:[[0],NOP],
 apagarCabeza:[[0],unavailable("apagarCabeza")],moverServoYaw:[[1],unavailable("moverServoYaw")],moverServoPitch:[[1],unavailable("moverServoPitch")],moverServoGolpe:[[1],a=>{if(strict&&!ini.g){warn('Inicializa el golpe con inicializarGolpe() antes de moverlo.');return;}if(!Number.isFinite(a[0]))throw{m:'La posición del golpe debe ser un número finito',ln:0};if(a[0]!==-1&&a[0]!==0&&a[0]!==1){warn('moverServoGolpe() admite -1, 0 o 1.');return;}if(window.setStrikerPosition)window.setStrikerPosition(a[0]);}]
};
function find(n,ln){for(let i=scopes.length-1;i>=0;i--)if(Object.prototype.hasOwnProperty.call(scopes[i],n))return scopes[i];if(n in CONS)return null;throw{m:'La variable «'+n+'» no está declarada',ln}}
function coerce(value,type,ln){
 if(typeof value!=='number'||!Number.isFinite(value))throw{m:'La variable numérica necesita un valor finito',ln};
 if(type==='bool')return +Boolean(value);
 if(type==='float')return value;
 const integer=Math.trunc(value);return type==='byte'?((integer%256)+256)%256:integer;
}
function* declare(scope,d){
 const value=d.e?yield* ev(d.e):0,types=variableTypes.get(scope)||Object.create(null);
 types[d.n]=d.type;variableTypes.set(scope,types);scope[d.n]=coerce(value,d.type,d.ln);
}
function expressionType(e){
 if(e.k==='n')return e.numericType||'int';
 if(e.k==='v'){const scope=find(e.n,e.ln);return scope?(variableTypes.get(scope)?.[e.n]||'int'):'int';}
 if(e.k==='c'){const u=UF[e.n];return u&&u.ret==='float'?'float':'int';}
 if(e.k==='u')return e.o==='!'?'int':expressionType(e.a);
 if(e.k==='b'&&['+','-','*','/','%'].includes(e.o))return expressionType(e.a)==='float'||expressionType(e.b)==='float'?'float':'int';
 return 'int';
}
/* Ejecutor cooperativo único. ev() y run() son generadores: un `yield` (pausa, botonInicio, while) sube por TODA la cadena de
   llamadas (expresión → función propia → sentencia → ...) hasta update(), que es quien gobierna el tiempo simulado. Sin Promises ni timers. */
// Llamada a una función propia: scope nuevo con globals + parámetros (por valor); los locales del llamador no son visibles.
function* callUser(u,args,ln){
 if(callDepth>=MAX_CALL_DEPTH)throw{m:'Demasiadas llamadas anidadas; revisa si una función se está llamando a sí misma sin terminar.',ln};
 const saved=scopes,frame=Object.create(null),types=Object.create(null);
 u.params.forEach((q,i)=>{types[q.n]=q.type;frame[q.n]=coerce(args[i],q.type,q.ln);});
 variableTypes.set(frame,types);
 callDepth++;scopes=[saved[0],frame];
 try{
  const r=yield* run(u.body);
  if(halt||u.ret==='void')return 0;                       // finPrograma(): el valor ya no importa; nada posterior se ejecuta
  if(!r)throw{m:'La función «'+u.name+'()» terminó sin devolver un valor.',ln};
  return coerce(r.v,u.ret,ln);
 }finally{scopes=saved;callDepth--;}                       // siempre: return, finPrograma() o error
}
function* ev(e){
  switch(e.k){
    case'n':case's':return e.v;
    case'v':{const s=find(e.n,e.ln);return s?s[e.n]:CONS[e.n]}
    case'u':{const a=yield* ev(e.a);return e.o==='!'?+!a:-a}
    case'c':{
      vcall(e,false);
      const args=[];for(const a of e.a)args.push(yield* ev(a));   // izquierda → derecha
      if(halt)return 0;
      const u=FN[e.n]?null:UF[e.n];
      if(u)return yield* callUser(u,args,e.ln);
      if(e.n==='pausa'){const ms=args[0];if(!Number.isFinite(ms)||ms<0)throw{m:'pausa() necesita milisegundos finitos y no negativos',ln:e.ln};yield ms;return 0}
      // botonInicio(): barrera cooperativa de NIVEL (como la librería real: espera hasta leerBoton()==1). No consume ni libera el Pulsador.
      if(e.n==='botonInicio'){while(!btn){waitingButton=1;yield 0;}waitingButton=0;return 0}
      return FN[e.n][1](args)||0;
    }
    case'b':{
      const a=yield* ev(e.a);
      if(e.o==='&&')return +Boolean(a&&(yield* ev(e.b)));
      if(e.o==='||')return +Boolean(a||(yield* ev(e.b)));
      const b=yield* ev(e.b);
      switch(e.o){
        case'+':return a+b;case'-':return a-b;case'*':return a*b;case'%':if(!b)throw{m:'No se puede calcular el resto con divisor cero',ln:0};return a%b;
        case'/':if(!b)throw{m:'No se puede dividir por cero',ln:0};return expressionType(e)==='float'?a/b:Math.trunc(a/b);
        case'==':return +(a==b);case'!=':return +(a!=b);
        case'<':return +(a<b);case'>':return +(a>b);case'<=':return +(a<=b);default:return +(a>=b);
      }
    }
  }
}
// Devuelve undefined, o {v} si se ejecutó «return» (se propaga hasta la función que la contiene).
function* run(list){
  scopes.push(Object.create(null));
  try{
   for(const s of list){
    switch(s.k){
      case'dec':for(const d of s.ds)yield* declare(scopes[scopes.length-1],d);break;
      case'as':{const sc=find(s.n,s.ln),v=yield* ev(s.e);sc[s.n]=coerce(s.op==='='?v:s.op==='+'?sc[s.n]+v:sc[s.n]-v,variableTypes.get(sc)?.[s.n],s.ln);break}
      case'ex':yield* ev(s.e);break;
      case'ret':{const v=s.e?yield* ev(s.e):undefined;if(halt)return;return{v}}
      case'if':{const r=(yield* ev(s.c))?yield* run(s.b):s.e?yield* run(s.e):undefined;if(r)return r;break}
      case'while':while(!halt&&(yield* ev(s.c))){const r=yield* run(s.b);if(r)return r;if(!halt)yield 8}break;
      case'blk':{const r=yield* run(s.b);if(r)return r;break}
    }
    if(halt)return;
   }
  }finally{scopes.pop();}
}
function* main(){
  for(const s of prog.globals)for(const d of s.ds)yield* declare(scopes[0],d);
  if(prog.fn.setup)yield* run(prog.fn.setup);
  while(!halt){yield* run(prog.fn.loop);yield 0}
}
function fail(e){running=0;waitingButton=0;R.L=R.R=0;if(window.onCodeStopped)window.onCodeStopped();$('msg').innerHTML+='\n<span class=err>✖ Error'+(e.ln?' (línea '+e.ln+')':'')+': '+esc(e.m||'error interno: '+e.message)+'</span>'}
function start(){
  let P;
  try{P=parse(lex($('src').value))}
  catch(e){reset();$('msg').innerHTML='<span class=err>✖ Error'+(e.ln?' (línea '+e.ln+')':'')+': '+esc(e.m||'error interno: '+e.message)+'</span>';return}
  const inputs=[...ir],pressed=btn;reset();inputs.forEach((v,k)=>setIR(k,v));setButton(pressed);if(window.onCodeStarted)window.onCodeStarted();prog=P;UF=P.fns;callDepth=0;strict=P.sketch;ini={m:!strict,s:!strict,g:!strict};warns=new Set();
  scopes=[Object.create(null)];variableTypes=new WeakMap();it=main();running=1;
  $('msg').innerHTML='<span class=ok>✔ Sintaxis validada. Intérprete didáctico en ejecución…</span>';
}
