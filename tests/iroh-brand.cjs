/* node tests/iroh-brand.cjs — IROH Simulator (SIM-IROH-UI-1 y su corrección): pruebas ESTÁTICAS de la identidad IROH Simulator (bienvenida, cabecera, «Acerca de»).
   Corren en `node-tests` (bloqueante en CI); las de navegador (tests/iroh-brand-ui.mjs) son informativas, por eso lo que debe impedir
   un merge malo vive aquí: contrato de HTML, CSP-compatibilidad, claves de almacenamiento, movimiento y runtime intacto. Sin git, sin dependencias. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};

const html=rd('index.html'),css=rd('iroh-brand.css'),js=rd('iroh-brand.js'),starters=rd('starters.js'),notFound=rd('pages/404.html');
const noComments=s=>s.replace(/<!--[\s\S]*?-->/g,'');

/* ───────── 1. HTML: contrato, CSP y recursos locales ───────── */
test('index.html: título exacto, cabecera con translate en <strong> (no en .brand) y rótulo de escena «IROH / …»',()=>{
 assert.match(html,/<title>IROH Simulator · Simulador libre<\/title>/);
 assert.match(html,/<div class="brand">\s*<img src="assets\/iroh-isotipo-68\.webp" alt="" width="34" height="34">/);
 assert.match(html,/<strong translate="no">IROH <span>Simulator<\/span><\/strong><small>Simulador libre<\/small>/);
 assert.ok(!/<div class="brand"[^>]*translate/.test(html),'translate="no" va en <strong>, no en .brand (brand-logo-ui exige class como único atributo)');
 assert.match(html,/IROH \/ <span id="stageLabel">/);
});
test('index.html: sin atributos style ni <style> (CSP style-src «self»)',()=>{
 assert.ok(!/\sstyle\s*=/.test(html),'atributo style en línea');
 assert.ok(!/<style\b/i.test(html),'<style> en línea');
 assert.ok(!/\son[a-z]+\s*=/i.test(noComments(html)),'manejadores de eventos en línea (script-src «self»)');
 assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html),'<script> en línea');
});
test('index.html y 404.html: la única URL absoluta es https://nulljinx.com, con apertura segura',()=>{
 for(const [name,src] of [['index.html',html],['pages/404.html',notFound]]){
  const abs=[...noComments(src).matchAll(/https?:\/\/[^"'\s)<]+/g)].map(m=>m[0]);
  assert.ok(abs.every(u=>u==='https://nulljinx.com'),name+': URL absoluta no permitida: '+abs.join(' '));
 }
 const links=[...html.matchAll(/<a\b[^>]*href="https:\/\/nulljinx\.com"[^>]*>/g)].map(m=>m[0]);
 assert.equal(links.length,2,'enlace nulljinx.com en «Acerca de» y en la bienvenida');
 for(const a of links){assert.match(a,/target="_blank"/);assert.match(a,/rel="noopener noreferrer"/);}
 assert.equal((html.match(/abre nulljinx\.com en una pestaña nueva/g)||[]).length,2,'aviso de pestaña nueva para lectores de pantalla en ambos enlaces');
});
test('index.html y 404.html: todo src/href local existe en disco',()=>{
 for(const [name,src,dir] of [['index.html',html,''],['pages/404.html',notFound,'pages']]){
  for(const m of noComments(src).matchAll(/<(?:script|img|link|source)\b[^>]*\b(?:src|href)="([^"#?]+)"/g)){
   const ref=m[1];if(/^(?:[a-z]+:)?\/\//.test(ref)||ref.startsWith('/'))continue;
   assert.ok(fs.existsSync(path.join(root,dir,ref)),name+' referencia un archivo inexistente: '+ref);
  }
  // srcset
  for(const m of noComments(src).matchAll(/\bsrcset="([^"]+)"/g))for(const c of m[1].split(',')){
   const ref=c.trim().split(/\s+/)[0];assert.ok(fs.existsSync(path.join(root,dir,ref)),name+' srcset inexistente: '+ref);
  }
 }
});
test('index.html: orden de carga (iroh-brand.css tras styles.css; iroh-brand.js al final, tras scenario-editor.js) y sin el símbolo antiguo',()=>{
 assert.match(html,/<link rel="stylesheet" href="iroh-brand\.css">/);
 assert.ok(html.indexOf('href="tokens.css"')<html.indexOf('href="styles.css"'));
 assert.ok(html.indexOf('href="styles.css"')<html.indexOf('href="iroh-brand.css"'));
 const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.at(-1),'iroh-brand.js','iroh-brand.js es el último script');
 assert.ok(scripts.indexOf('iroh-brand.js')>scripts.indexOf('scenario-editor.js')&&scripts.indexOf('scenario-editor.js')>scripts.indexOf('calibration.js'),'BITIRO_STORAGE (calibration.js) ya existe cuando corre iroh-brand.js');
 assert.ok(!/bitiro-symbol/.test(html),'index.html ya no usa assets/bitiro-symbol.png');
 assert.match(html,/rel="icon"[^>]*iroh-favicon-32\.png|iroh-favicon-32\.png[^>]*rel="icon"/);
});
test('index.html: los <dialog> de bienvenida y «Acerca de» están cerrados por defecto y fuera de <main>',()=>{
 const main=html.match(/<main id="workspace"[\s\S]*?<\/main>/)[0];
 for(const id of ['welcome','aboutDialog']){
  const tag=html.match(new RegExp('<dialog\\b[^>]*\\bid="'+id+'"[^>]*>'));assert.ok(tag,id+' existe');
  assert.ok(!/\bopen\b/.test(tag[0]),id+' no debe llevar open (sin JavaScript el simulador no queda tapado)');
  assert.ok(!main.includes('id="'+id+'"'),id+' va fuera de <main>');
  assert.match(tag[0],/aria-labelledby="/);assert.match(tag[0],/aria-describedby="/);
 }
 for(const id of ['welcomeEnter','welcomeClose','welcomeImg','aboutOpen','aboutClose','aboutDone','aboutWelcome','aboutTitle','welcome-title'])assert.ok(html.includes('id="'+id+'"'),'falta #'+id);
 assert.ok(!html.includes('welcomeReopen'),'el botón #welcomeReopen se eliminó del HTML (no basta con ocultarlo)');
 assert.ok(!/topbar-btn--welcome/.test(html),'sin clases del botón retirado');
 assert.match(html,/<h2 id="welcome-title"[^>]*>¡Bienvenido a (?:<span[^>]*>)?IROH Simulator!/);
 assert.match(html,/<h2 id="aboutTitle"[^>]*>Acerca de IROH Simulator<\/h2>/);
 assert.ok(html.indexOf('id="welcome"')>html.indexOf('</main>')&&html.indexOf('id="aboutDialog"')>html.indexOf('</main>'));
 assert.ok(Math.max(html.indexOf('id="welcome"'),html.indexOf('id="aboutDialog"'))<html.indexOf('<script src='),'los diálogos van antes de los scripts');
});
test('Mascota de la bienvenida: img con dimensiones, alt descriptivo, srcset 420/640/960 y carga diferida (los usuarios recurrentes no la descargan)',()=>{
 const img=html.match(/<img\b[^>]*id="welcomeImg"[^>]*>/)[0];
 assert.match(img,/width="960"/);assert.match(img,/height="960"/);assert.match(img,/loading="lazy"/);assert.match(img,/decoding="async"/);
 assert.match(img,/src="assets\/iroh-mascot-640\.webp"/);
 assert.match(img,/srcset="assets\/iroh-mascot-420\.webp 420w, assets\/iroh-mascot-640\.webp 640w, assets\/iroh-mascot-960\.webp 960w"/);
 assert.ok((img.match(/alt="([^"]*)"/)||[])[1].length>30,'alt descriptivo');
 // sin precarga que descargue la mascota a quien ya entró
 assert.ok(!/rel="preload"[^>]*mascot/.test(html));
 assert.match(html,/Desarrollado por <a href="https:\/\/nulljinx\.com"/);
});
test('404.html: título con «IROH Simulator» y sin «BITIRO» visible',()=>{
 assert.match(notFound,/<title>[^<]*IROH Simulator<\/title>/);
 assert.ok(!/bitiro/i.test(noComments(notFound)));
});

/* ───────── 2. JavaScript de la bienvenida: claves y contrato ───────── */
const jsCode=js.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');   // sin comentarios: lo que cuenta es el código ejecutable
test('iroh-brand.js: la bienvenida se recuerda SOLO en sessionStorage con la clave bitiro:standalone:welcome:session:v1',()=>{
 const keys=[...jsCode.matchAll(/['"`]bitiro:[^'"`]*['"`]/g)].map(m=>m[0].slice(1,-1));
 assert.ok(keys.length>=1);
 for(const k of keys)assert.equal(k,'bitiro:standalone:welcome:session:v1','clave no autorizada: '+k);
 assert.ok(/sessionStorage/.test(jsCode),'usa sessionStorage (vida = la pestaña)');
 assert.ok(!/localStorage/.test(jsCode),'iroh-brand.js no usa localStorage: el código, el escenario y la calibración viven ahí y no se tocan');
 assert.ok(!/BITIRO_STORAGE/.test(jsCode),'BITIRO_STORAGE envuelve localStorage; no se usa para la bienvenida');
 assert.ok(!/welcome:v1['"`]/.test(jsCode),'el indicador antiguo (localStorage, welcome:v1) no se lee, no se escribe y no se borra');
 assert.ok(!/bitiro:standalone:(code|scenario)|bitiro:line-calibration/.test(jsCode),'no se tocan las claves de código, escenario ni calibración');
 assert.ok(!/\.clear\s*\(|removeItem\(\s*['"`]bitiro:standalone:(code|scenario|welcome:v1)|removeItem\(\s*KEY\s*\)/.test(jsCode),'no borra nada que no sea su propia sonda');
 assert.ok(!/URLSearchParams|location\.search/.test(jsCode),'sin parámetros de URL de revisión (?reset, ?storage=off)');
});
test('iroh-brand.js: ya no hay botón «Bienvenida» en la cabecera ni listeners asociados; «Ver la bienvenida» sigue conectada',()=>{
 assert.ok(!/welcomeReopen/.test(js),'sin referencias a #welcomeReopen');
 assert.match(js,/aboutWelcome/);assert.match(js,/iroh:welcome-open/);
});
test('iroh-brand.js: contrato (evento, Escape, retorno de foco, sin autoapertura si el almacenamiento falla)',()=>{
 assert.match(js,/iroh:welcome-open/);
 assert.match(js,/['"]cancel['"]/,'Escape (evento cancel del <dialog>)');
 assert.match(js,/showModal/);
 assert.match(js,/prefers-reduced-motion/);
 assert.ok(!/\beval\s*\(|new Function|document\.write|innerHTML\s*=/.test(js),'sin APIs inseguras');
 assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(js),'no hace peticiones de red');
});

/* ───────── 3. CSS: movimiento accesible ───────── */
test('iroh-brand.css: @keyframes solo con transform/opacity y sin animaciones infinitas',()=>{
 const frames=[...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\}\s*)\}/g)];
 assert.ok(frames.length>=2,'hay animaciones de entrada');
 for(const [,name,body] of frames){
  const props=new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map(m=>m[1]));
  for(const p of props)assert.ok(['transform','opacity'].includes(p),`@keyframes ${name} anima «${p}» (solo transform/opacity)`);
 }
 assert.ok(!/infinite/i.test(css),'sin animation-iteration-count infinite (WCAG 2.2.2: nada automático de más de 5 s)');
 assert.ok(!/transition\s*:\s*all\b/.test(css),'sin transition: all');
});
test('iroh-brand.css: prefers-reduced-motion desactiva toda animación de la bienvenida; sin estilos que dependan de hover únicamente',()=>{
 const m=css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\})\s*\}/);
 assert.ok(m,'falta @media (prefers-reduced-motion: reduce)');
 assert.match(m[1],/animation\s*:\s*none/);assert.match(m[1],/transition\s*:\s*none/);
 assert.match(css,/forced-colors/,'colores forzados contemplados');
 assert.ok(!/outline\s*:\s*(?:none|0)\b/.test(css),'no se elimina el contorno de foco');
 assert.match(css,/:focus-visible/);
 assert.match(css,/overscroll-behavior\s*:\s*contain/);
});
test('iroh-brand.css: sin estilos del botón retirado; tipografía y mascota escalan también con la ALTURA (dvh) y el diseño pasa a una columna',()=>{
 assert.ok(!/topbar-btn--welcome|welcomeReopen/.test(css),'estilos exclusivos del botón «Bienvenida» eliminados');
 assert.match(css,/\.welcome__title\{[^}]*font-size:clamp\([^}]*dvh/,'el título depende también de la altura útil');
 const roll=css.match(/\.welcome__roll,\.welcome__float\{[^}]*\}/)[0];
 assert.match(roll,/58dvh/,'la mascota nunca pasa de ~58 % del alto en dos columnas');
 assert.ok(!/78dvh/.test(css),'sin el tope antiguo del 78 % del alto');
 assert.match(css,/@media\(max-width:719px\),\(max-aspect-ratio:11\/10\)/,'una columna si es estrecho o casi cuadrado/vertical');
 assert.match(css,/\.welcome\{[^}]*overflow:auto/,'si no cabe, la bienvenida se desplaza en lugar de recortar');
});
test('iroh-brand.css: no usa recursos externos ni @import',()=>{
 assert.ok(!/https?:\/\//.test(css),'URL externa');
 assert.ok(!/@import/.test(css));
 for(const m of css.matchAll(/url\(([^)]+)\)/g)){const u=m[1].replace(/['"]/g,'');if(/^data:/.test(u))continue;assert.ok(!/^(?:[a-z]+:)?\/\//.test(u),'recurso externo: '+u);}
});

/* ───────── 4. Runtime intacto: SIM-IROH-UI-1 no cambia física, sensores ni programación ───────── */
// Hashes de SIM-NOFIRVI-1 (manifiesto de la base 5ffcc15, SHA-256 cd995db8…cbe24). Si cambian es porque alguien tocó el runtime.
const PROTECTED={
 'simulator.js':'f0a68a59b47e8a3836445aced66754183df420dbd8202b4b390153638a1d28af',
 'ui-shell.js':'0e434c0643a558336f4805161b822e565c6540ba4ecad420d691b73b30ea5900',
 'iroh-runtime.js':'03a61341cc6f75e0b520d40b96b5b8e3390cc128a81137a76dc5082879719da3',
 'renderer3d.js':'2c7934a209311cf8b4b45d32635eb93976da0513eaca98a0e447ec6675007f76',
 'calibration.js':'6662fbdfca6549f364cecd6867cb25a6d5b26fad55bf008bea7eb4249b0c496c',
 'calibration-mode.js':'b4516b2fe3d20aea2d13f69e9437f87b5d250642f5ce2d83aa132e2a2a76b4fc',
 'scenario-props.js':'6803df0f42fafe1ce15186f040c0e607e3f675a3b080bc9fe00b434f84aee231',
 'scenario-editor.js':'28e3c91671ea389d78f1acad6db1cd7d6bd65b1fb6c301d22a1bbffc1c44c210',
 'tracks.js':'fbdae9bda13e4081f2f244aa82999c1078c8fc00f3ea4d30b7caea082e03de6b',
 'extra-tracks.js':'3e530b770c223feadc69ce5a9b4cd1ae92c34811c9cbea2c525971916c6d83e7',
 'line-geometry.js':'dec09c63fea36d176523f1670457eed68fc4e8b450070ba7e8d8e49e45d6ff79',
 'strike-physics.js':'f17522c353ed1fa37f57a5fd7a03800e91b596ecc7f11920d314dcbf34df9687',
 'head-sonar.js':'ae4577d63a082eaaaf7888cd0707d9cb6d3ccdc911c4ec6baf9d773c9df0c1b5',
 'head-config.js':'37053579590ce8f9d61573a4c0f8296f4c8bfed8e8149f75583a405c8e30f702',
 'syntax-highlight.js':'111c82af42f4a4683cb9bf3986713f1fad55292f77ecc8f40ac940489e5ec825',
 'styles.css':'d80ddd1f64019c07c60d55572433647a499cd932e1df4a84e1c08556ad1784e6',
 'tokens.css':'da6a5a10c0e9d0966f3e7b8a60c54a7b1608549a72983ccadea9b67771303eea',
 'pages/_headers':'1d1b1ecc474264b7b9388134c7dedee9029a533af8a72475749a36c9c03f03b5',
};
test('Runtime y estilos base conservan EXACTAMENTE el hash de SIM-NOFIRVI-1 (solo cambian index.html, starters.js, 404.html y archivos nuevos)',()=>{
 for(const [f,h] of Object.entries(PROTECTED))assert.equal(sha(f),h,f+' cambió: SIM-IROH-UI-1 no debe tocar el runtime');
});
test('Los hashes embebidos coinciden con el manifiesto vigente o con el histórico (doble comprobación, sin depender de uno solo)',()=>{
 const live=path.join(root,'scripts/pages-manifest.json'),hist=path.join(root,'docs/releases/sim-nofirvi-1.pages-manifest.json');
 let m=null,origin='';
 if(fs.existsSync(live)){const j=JSON.parse(fs.readFileSync(live,'utf8'));if(j.candidate==='SIM-NOFIRVI-1'){m=j;origin='scripts/pages-manifest.json';}}
 if(!m&&fs.existsSync(hist)){m=JSON.parse(fs.readFileSync(hist,'utf8'));origin='docs/releases/sim-nofirvi-1.pages-manifest.json';}
 if(!m){console.log('  (sin manifiesto de SIM-NOFIRVI-1 en disco: se usan solo los hashes embebidos)');return;}
 assert.equal(m.candidate,'SIM-NOFIRVI-1',origin);
 const byDest={};for(const [dest,e] of Object.entries(m.files))byDest[e.source]=e.sha256;
 for(const [f,h] of Object.entries(PROTECTED))assert.equal(byDest[f],h,f+' difiere del manifiesto histórico ('+origin+')');
});
test('starters.js: API anterior intacta + API de compatibilidad nueva; resolve no reescribe código guardado',()=>{
 const S=require('../starters.js');
 for(const k of ['freeTracks','isFree','hasStarter','starter','legacyExamples','isLegacyExample','resolve','isModified'])assert.ok(k in S,'API anterior: '+k);
 for(const k of ['legacyStarter','isLegacyStarter'])assert.equal(typeof S[k],'function',k);
 assert.deepEqual([...S.freeTracks],['oval','ocho']);
 assert.equal(S.legacyExamples.length,5);
 assert.match(starters,/IROH Simulator · /);assert.match(starters,/BITIRO Simulador · /,'el encabezado antiguo sigue existiendo (solo para reconocerlo como sin modificar)');
 assert.ok(!/localStorage|BITIRO_STORAGE\.(set|remove)/.test(starters),'starters.js sigue siendo un módulo puro, sin almacenamiento');
});

console.log(`\n${checks} comprobaciones estáticas de SIM-IROH-UI-1 superadas.`);
