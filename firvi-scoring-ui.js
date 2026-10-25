/* BITIRO Simulador · FIRVI 2025 · panel de evaluación (Etapa C). Solo LEE la sesión y el evaluador (firvi-scoring.js); registra decisiones del juez en su libro
   append-only. No toca el robot, el escenario ni el historial de la ronda. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),C=window.BITIRO_FIRVI_COMPETITION,E=window.BITIRO_FIRVI_SCORING;
 const box=$('compEval');
 if(!C||!E||!box)return;
 const el={head:$('evalHeadline'),body:$('evalBody'),totals:$('evalTotals'),note:$('evalNote'),tabs:[$('evalTab1'),$('evalTab2')]};
 const LABEL={'validated-auto':'Validado automáticamente','validated-judge':'Validado por juez','pending':'Pendiente','not-achieved':'No conseguido','not-applicable':'No aplica'};
 const evaluators=new WeakMap();let shown=1,msg='',seenRound=0;
 const mmss=ms=>{if(ms==null)return '—';const t=Math.round(ms/1000);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
 const evaluatorOf=s=>{if(!evaluators.has(s))evaluators.set(s,E.forSession(s,{now:()=>Date.now()}));return evaluators.get(s);};
 const mkEl=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
 // En móvil la tabla se dibuja como tarjetas (display distinto de table): los roles explícitos conservan la semántica de tabla para los lectores de pantalla.
 const cell=(label,cls)=>mkEl('td',null,{role:'cell','data-label':label,...(cls?{class:cls}:{})});
 const headline=sm=>sm.results[0]||sm.results[1]?'Ronda 1: '+(sm.results[0]?sm.results[0].total:'—')+' pts · Ronda 2: '+(sm.results[1]?sm.results[1].total:'—')+' pts':'sin ronda';

 function judgeCell(ev,round,m,final){
  const td=cell('Juez','eval-judge-cell');
  if(!final){td.textContent='Tras la ronda';return td;}
  const wrap=mkEl('div',null,{class:'eval-judge'});
  const post=(verdict,attempt)=>()=>{const r=ev.judge.decide(round,m.id,verdict,{attempt});msg=r.ok?'':r.reason;render(true);};
  let sel=null;
  if(/^room-/.test(m.id)&&m.attempt==null){sel=mkEl('select',null,{'aria-label':'Intento en que se superó '+m.label});for(const n of [1,2,3,4])sel.appendChild(mkEl('option',n===4?'4.º o más':n+'.º',{value:String(n)}));wrap.appendChild(sel);}
  if(m.status!==E.ST.NA){
   const ok=mkEl('button','Conceder',{type:'button',class:'button','aria-label':'Conceder '+m.label});ok.addEventListener('click',()=>post('award',sel?+sel.value:m.attempt)());
   const no=mkEl('button','No conceder',{type:'button',class:'button','aria-label':'No conceder '+m.label});no.addEventListener('click',post('deny'));
   wrap.append(ok,no);
   if(m.judge){const un=mkEl('button','Quitar decisión',{type:'button',class:'button','aria-label':'Quitar la decisión del juez sobre '+m.label});un.addEventListener('click',post('clear'));wrap.appendChild(un);}
  }
  td.appendChild(wrap);return td;
 }

 /* Una sola lectura del estado efectivo por ciclo: el encabezado, los totales y la tabla salen de la misma `sm`/`res`. */
 const waiting=(s,n)=>n===s.roundNumber&&s.state===C.S.PREPARATION?'Ronda '+n+' en preparación: la evaluación empieza al pulsar «Iniciar ronda».':'Esta ronda aún no comienza.';
 let last='';
 function render(force){
  const s=C.on?C.session():null;
  box.hidden=!s;if(!s){last='';seenRound=0;return;}
  if(s.roundNumber!==seenRound){seenRound=s.roundNumber;shown=s.roundNumber;}   // al cambiar de ronda, el panel sigue a la ronda en curso
  const ev=evaluatorOf(s),sm=ev.summary(),res=sm.results[shown-1];
  el.head.textContent=headline(sm);
  if(!box.open&&!force)return;
  el.tabs.forEach((b,i)=>b.setAttribute('aria-pressed',String(shown===i+1)));
  const totals=res?'Ronda '+shown+': '+res.total+' pts confirmados de '+res.maxPossible+(res.pendingPotential?' (+'+res.pendingPotential+' pendientes del juez)':'')+' · tiempo '+mmss(res.timeMs)+(res.finishedBy==='time'?' (agotado)':res.final?' (voluntaria)':' (en curso)')+(res.final?'':' · evaluación provisional'):waiting(s,shown);
  const notes=[];if(msg)notes.push(msg);
  if(res&&sm.results.some(Boolean)){
   notes.push('Mejor ronda: '+(sm.bestRound?'ronda '+sm.bestRound.round+' ('+sm.bestRound.total+' pts, '+mmss(sm.bestRound.timeMs)+')':'—')+' · Suma de rondas: '+sm.sumOfRounds+' pts.'+' Las bases se contradicen (VI.A.2 mejor ronda / VI.B.1 suma): no se declara ganador.');
  }
  if(sm.pendingJudgeItems)notes.push('Criterios pendientes de validación: '+sm.pendingJudgeItems+'.');
  const note=res?notes.join(' '):'';
  const sig=JSON.stringify([shown,totals,note,res&&res.final,res&&res.milestones.map(m=>[m.id,m.status,m.points,m.max,m.attempt,m.reason,m.source,!!m.judge])]);
  if(sig===last&&!force)return;last=sig;
  el.totals.textContent=totals;el.note.textContent=note;
  // Al redibujar no se pierde el foco del teclado: se devuelve al mismo control (o, si ya no existe, a otro de su fila).
  const had=document.activeElement&&el.body.contains(document.activeElement)?document.activeElement:null;
  const hadLabel=had&&had.getAttribute('aria-label'),hadRow=had?[...el.body.rows].indexOf(had.closest('tr')):-1;
  el.body.replaceChildren();
  if(!res)return;
  for(const m of res.milestones){
   const tr=mkEl('tr',null,{role:'row'});
   const c0=cell('Hito','eval-hito');c0.textContent=m.label+(m.attempt?' · intento '+m.attempt:'');tr.appendChild(c0);
   const c1=cell('Pts','pts');c1.textContent=m.points+' / '+m.max;tr.appendChild(c1);
   const st=cell('Estado','eval-state');st.appendChild(mkEl('span',LABEL[m.status],{class:'eval-st','data-st':m.status}));
   if(m.source==='judge'&&m.auto)st.appendChild(mkEl('span','Automático: '+LABEL[m.auto.status].toLowerCase(),{class:'eval-prov'}));
   if(m.judgeRequired)st.appendChild(mkEl('span','requiere al juez',{class:'eval-prov'}));
   tr.appendChild(st);
   const why=cell('Evidencia','eval-evidence');why.appendChild(mkEl('span',m.reason,{class:'eval-why'}));why.appendChild(mkEl('span','Procedencia: '+(m.source==='judge'?'decisión del juez; ':'')+m.provenance.join(' · '),{class:'eval-prov'}));
   tr.appendChild(why);tr.appendChild(judgeCell(ev,shown,m,res.final));
   el.body.appendChild(tr);
  }
  if(had){const rowBtns=el.body.rows[hadRow]?[...el.body.rows[hadRow].querySelectorAll('button,select')]:[];
   (rowBtns.find(n=>n.getAttribute('aria-label')===hadLabel)||rowBtns[0])?.focus({preventScroll:true});}
 }
 el.tabs.forEach((b,i)=>b.addEventListener('click',()=>{shown=i+1;render(true);}));
 box.addEventListener('toggle',()=>render(true));
 setInterval(()=>render(false),500);
 // Cualquier orden de la barra (iniciar, comenzar, falta, finalizar, siguiente…) cambia el estado: se relee al terminar de aplicarse, sin esperar al sondeo.
 $('competitionBar')?.addEventListener('click',()=>setTimeout(()=>render(false),0));
 $('track')?.addEventListener('change',()=>render(true));
 $('competitionToggle')?.addEventListener('click',()=>setTimeout(()=>render(true),0));
 window.BITIRO_FIRVI_SCORING_UI=Object.freeze({render:()=>render(true),show:n=>{shown=n;render(true);}});
 render(true);
})();
