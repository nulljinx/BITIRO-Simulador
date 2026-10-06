/* Editor opcional: intérprete didáctico adaptado del archivo HTML aportado por el usuario.
   Es un subconjunto de Arduino/C++, sin eval ni ejecución de JS arbitrario. */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const R={x:0,y:0,th:0,L:0,R:0};
const ir=[0,0];
let running=0,halt=0,wait=0,it=null,prog,strict,ini={},warns=new Set(),lcd=['',''],scopes=[Object.create(null)],variableTypes=new WeakMap();
function reset(){ if(typeof window.resetRobot==='function')window.resetRobot(); }
function lect(k){return typeof window.readLine==='function'?window.readLine(k):28;}
function setIR(k,v){ir[k]=v?1:0;const b=$('ir'+k);b.setAttribute('aria-pressed',String(!!ir[k]));b.querySelector('strong').textContent=ir[k]?'SÍ':'NO';}
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
}`,`// Golpe con sonar: acércate ANTES de accionar el servo.
// El golpe no mueve objetos a distancia ni atraviesa cajas.
void setup() {
  inicializarMovimiento();
  inicializarSensores();
  inicializarGolpe();
}

void loop() {
  int distancia = leerDistanciaSonar();
  if (distancia <= 10) {
    detenerse();
    moverServoGolpe(65);
    pausa(950);  // espera a que el golpe termine el barrido
    moverServoGolpe(0);
    pausa(900);  // regreso a posición recogida
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
  const globals=[],fn={},sketch=T.some(t=>t.v==='void');
  if(!sketch){fn.loop=[];while(p<T.length)fn.loop.push(stmt())}
  else{
    while(p<T.length){
      const t=T[p];
      if(t.v==='void'){
        p++;const n=T[p++];
        if(!n||n.t!=='i')throw{m:'Falta el nombre después de void',ln:t.ln};
        if(n.v!=='setup'&&n.v!=='loop')throw{m:'Solo se pueden usar void setup() y void loop()',ln:n.ln};
        ex('(');ex(')');fn[n.v]=block();
      }else if(TY.includes(t.v))globals.push(stmt());
      else throw{m:'Fuera de setup() y loop() solo puedes declarar variables',ln:t.ln};
    }
    if(!fn.loop)throw{m:'Falta la función void loop() { ... }',ln:1};
  }
  chkS(globals.concat([{k:'blk',b:fn.setup||[]},{k:'blk',b:fn.loop}]),[]);
  return{globals,fn,sketch};
}

/* revisión antes de ejecutar (como el compilador) */
function lev(a,b){const m=[];for(let i=0;i<=a.length;i++){m[i]=[i];for(let j=1;j<=b.length;j++)m[i][j]=i?Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]!==b[j-1])):j}return m[a.length][b.length]}
function near(n){n=n.toLowerCase();let b=null,bd=3;for(const k in FN){const d=lev(n,k.toLowerCase());if(d<bd){bd=d;b=k}}return b}
function vcall(e){
  const f=FN[e.n];
  if(!f){const s=near(e.n);throw{m:'No conozco la función «'+e.n+'()»'+(s?'. ¿Quisiste escribir «'+s+'()»?':''),ln:e.ln}}
  if(!f[0].includes(e.a.length))throw{m:'«'+e.n+'()» necesita '+f[0].join(' o ')+' valor(es) entre paréntesis y tiene '+e.a.length,ln:e.ln};
}
function chkV(n,ln,sc){if(!sc.some(x=>x.has(n))&&!(n in CONS))throw{m:'La variable «'+n+'» no está declarada (falta escribir «int '+n+' = ...;» antes de usarla)',ln}}
function chkE(e,sc){
  if(e.k==='v')chkV(e.n,e.ln,sc);
  else if(e.k==='c'){vcall(e);e.a.forEach(a=>chkE(a,sc))}
  else if(e.k==='b'){chkE(e.a,sc);chkE(e.b,sc)}
  else if(e.k==='u')chkE(e.a,sc);
}
function chkS(list,sc){
  sc=[...sc,new Set()];
  for(const s of list){
    if(s.k==='dec')for(const d of s.ds){if(d.e)chkE(d.e,sc);sc[sc.length-1].add(d.n)}
    else if(s.k==='as'){chkV(s.n,s.ln,sc);chkE(s.e,sc)}
    else if(s.k==='ex')chkE(s.e,sc);
    else if(s.k==='if'){chkE(s.c,sc);chkS(s.b,sc);if(s.e)chkS(s.e,sc)}
    else if(s.k==='while'){chkE(s.c,sc);chkS(s.b,sc)}
    else if(s.k==='blk')chkS(s.b,sc);
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
 leerBoton:[[0],unavailable("leerBoton")],
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
 inicializarCabeza:[[0],unavailable("inicializarCabeza")],inicializarGolpe:[[0],()=>{ini.g=1}],inicializarPantalla:[[0],NOP],
 apagarCabeza:[[0],unavailable("apagarCabeza")],moverServoYaw:[[1],unavailable("moverServoYaw")],moverServoPitch:[[1],unavailable("moverServoPitch")],moverServoGolpe:[[1],a=>{if(strict&&!ini.g){warn('Inicializa el golpe con inicializarGolpe() antes de moverlo.');return;}if(!Number.isFinite(a[0]))throw{m:'El ángulo debe ser finito',ln:0};if(a[0]<0||a[0]>65)warn('El mando del golpe admite 0–65; 0 es recogido y 65 completa el barrido.');if(window.setStrikerAngle)window.setStrikerAngle(a[0]);}]
};
function find(n,ln){for(let i=scopes.length-1;i>=0;i--)if(Object.prototype.hasOwnProperty.call(scopes[i],n))return scopes[i];if(n in CONS)return null;throw{m:'La variable «'+n+'» no está declarada',ln}}
function coerce(value,type,ln){
 if(typeof value!=='number'||!Number.isFinite(value))throw{m:'La variable numérica necesita un valor finito',ln};
 if(type==='bool')return +Boolean(value);
 if(type==='float')return value;
 const integer=Math.trunc(value);return type==='byte'?((integer%256)+256)%256:integer;
}
function declare(scope,d){
 const value=d.e?ev(d.e):0,types=variableTypes.get(scope)||Object.create(null);
 types[d.n]=d.type;variableTypes.set(scope,types);scope[d.n]=coerce(value,d.type,d.ln);
}
function expressionType(e){
 if(e.k==='n')return e.numericType||'int';
 if(e.k==='v'){const scope=find(e.n,e.ln);return scope?(variableTypes.get(scope)?.[e.n]||'int'):'int';}
 if(e.k==='u')return e.o==='!'?'int':expressionType(e.a);
 if(e.k==='b'&&['+','-','*','/','%'].includes(e.o))return expressionType(e.a)==='float'||expressionType(e.b)==='float'?'float':'int';
 return 'int';
}
function ev(e){
  switch(e.k){
    case'n':case's':return e.v;
    case'v':{const s=find(e.n,e.ln);return s?s[e.n]:CONS[e.n]}
    case'u':{const a=ev(e.a);return e.o==='!'?+!a:-a}
    case'c':{vcall(e);return FN[e.n][1](e.a.map(a=>ev(a)))||0}
    case'b':{
      const a=ev(e.a);
      if(e.o==='&&')return +Boolean(a&&ev(e.b));
      if(e.o==='||')return +Boolean(a||ev(e.b));
      const b=ev(e.b);
      switch(e.o){
        case'+':return a+b;case'-':return a-b;case'*':return a*b;case'%':if(!b)throw{m:'No se puede calcular el resto con divisor cero',ln:0};return a%b;
        case'/':if(!b)throw{m:'No se puede dividir por cero',ln:0};return expressionType(e)==='float'?a/b:Math.trunc(a/b);
        case'==':return +(a==b);case'!=':return +(a!=b);
        case'<':return +(a<b);case'>':return +(a>b);case'<=':return +(a<=b);default:return +(a>=b);
      }
    }
  }
}
function* run(list){
  scopes.push(Object.create(null));
  for(const s of list){
    switch(s.k){
      case'dec':for(const d of s.ds)declare(scopes[scopes.length-1],d);break;
      case'as':{const sc=find(s.n,s.ln),v=ev(s.e);sc[s.n]=coerce(s.op==='='?v:s.op==='+'?sc[s.n]+v:sc[s.n]-v,variableTypes.get(sc)?.[s.n],s.ln);break}
      case'ex':if(s.e.n==='pausa'){const ms=ev(s.e.a[0]);if(!Number.isFinite(ms)||ms<0)throw{m:'pausa() necesita milisegundos finitos y no negativos',ln:s.ln};yield ms;}else ev(s.e);break;
      case'if':if(ev(s.c))yield*run(s.b);else if(s.e)yield*run(s.e);break;
      case'while':while(!halt&&ev(s.c)){yield*run(s.b);if(!halt)yield 8}break;
      case'blk':yield*run(s.b);break;
    }
    if(halt){scopes.pop();return;}
  }
  scopes.pop();
}
function* main(){
  for(const s of prog.globals)for(const d of s.ds)declare(scopes[0],d);
  if(prog.fn.setup)yield*run(prog.fn.setup);
  while(!halt){yield*run(prog.fn.loop);yield 0}
}
function fail(e){running=0;R.L=R.R=0;if(window.onCodeStopped)window.onCodeStopped();$('msg').innerHTML+='\n<span class=err>✖ Error'+(e.ln?' (línea '+e.ln+')':'')+': '+esc(e.m||'error interno: '+e.message)+'</span>'}
function start(){
  let P;
  try{P=parse(lex($('src').value))}
  catch(e){reset();$('msg').innerHTML='<span class=err>✖ Error'+(e.ln?' (línea '+e.ln+')':'')+': '+esc(e.m||'error interno: '+e.message)+'</span>';return}
  const inputs=[...ir];reset();inputs.forEach((v,k)=>setIR(k,v));if(window.onCodeStarted)window.onCodeStarted();prog=P;strict=P.sketch;ini={m:!strict,s:!strict,g:!strict};warns=new Set();
  scopes=[Object.create(null)];variableTypes=new WeakMap();it=main();running=1;
  $('msg').innerHTML='<span class=ok>✔ Sintaxis validada. Intérprete didáctico en ejecución…</span>';
}
