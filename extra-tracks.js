/* BITIRO · Digitalizaciones aproximadas de plotters de referencia aportados.
   Las geometrías S03-S08 son reproducciones visuales didácticas, NO trazos vectoriales
   medidos; S07 es una sesión de repaso sin plotter único, usa S03 como pista seleccionable. */
'use strict';
(()=>{
 const T=window.BITIRO_TRACKS;
 const curve=(control,steps=8)=>{
  const points=[];
  for(let i=0;i<control.length-1;i++){
   const p0=control[Math.max(0,i-1)],p1=control[i],p2=control[i+1],p3=control[Math.min(control.length-1,i+2)];
   for(let j=0;j<steps;j++){
    const t=j/steps,t2=t*t,t3=t2*t;
    points.push([0,1].map(a=>+(.5*(2*p1[a]+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t2+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t3)).toFixed(3)));
   }
  }
  points.push(control[control.length-1]);return points;
 };
 const line=(id,p,w=2.6,curved=false)=>({id,w,p:curved?curve(p):p});
 const box=(id,x,y,w=19,h=18,color='finish-green',label='BASE')=>({id,x,y,width:w,height:h,kind:color,label});
 const src='Digitalización didáctica aproximada basada en la imagen de referencia del plotter; validar escala y recorrido con original antes de uso métrico.';
 T.s03={id:'s03',name:'S03 · Conteo de obstáculos e intersecciones',w:100,h:180,
 paths:[line('doble-lazo',[[50,162],[26,157],[19,140],[23,122],[35,105],[37,91],[34,76],[23,61],[19,41],[29,23],[50,18],[72,23],[81,40],[77,60],[65,77],[62,92],[66,108],[78,127],[80,145],[71,160],[50,162]],2.9,true)],
 zones:[],markers:[],obstacles:[],start:{x:50,y:162,heading:-Math.PI/2},source:'ROB-002-S03-plotter-100x180.png',note:src};
 T.s04={id:'s04',name:'S04 · Tramos y espacios de línea',w:100,h:200,
 paths:[line('linea-principal',[[50,170],[50,148]]),line('curva',[[50,127],[50,111],[58,105],[68,104],[74,93],[68,79],[56,77],[45,75],[36,66],[44,57],[55,48],[57,33],[57,23]],2.6,true),
 line('tope-inferior',[[40,149],[60,149]]),line('tope-superior',[[45,22],[68,22]])],
 zones:[box('base-salida',40,173,20,19,'finish-red','SALIDA'),box('base-meta',46,5,20,17,'finish-green','META')],
 markers:[],obstacles:[],start:{x:50,y:165,heading:-Math.PI/2},source:'Copia de ROB-002-S04-plotter100x200.png',note:src};
 T.s05={id:'s05',name:'S05 · Sensores IR y elección de ruta',w:100,h:200,
 paths:[line('tronco',[[50,172],[50,148],[49,136],[45,125],[47,117],[58,103],[56,90],[52,78],[50,70],[50,46]],2.6,true),
 line('rama-izquierda',[[50,46],[32,43],[21,35],[16,23],[16,14]],2.6,true),
 line('rama-central',[[50,46],[50,14]]),line('rama-derecha',[[50,46],[68,43],[79,34],[84,23],[84,14]],2.6,true),
 line('tope-salida',[[40,173],[60,173]]),line('tope-1',[[11,14],[21,14]]),line('tope-2',[[45,14],[55,14]]),line('tope-3',[[79,14],[89,14]])],
 zones:[box('salida',40,174,20,16,'finish-red','SALIDA'),box('base1',10,1,13,13,'finish-green','BASE 1'),box('base2',44,1,13,13,'finish-green','BASE 2'),box('base3',78,1,13,13,'finish-green','BASE 3')],
 markers:[],obstacles:[],start:{x:50,y:164,heading:-Math.PI/2},source:'Copia de ROB-002-S05-plotter-100x200.png',note:src};
 T.s06={id:'s06',name:'S06 · Sonar, cajas y velocidad',w:100,h:200,
 paths:[line('zigzag',[[50,173],[50,151],[53,140],[64,133],[73,119],[69,109],[54,103],[42,96],[36,82],[41,72],[56,60],[54,52],[50,41],[50,23]],2.6,true)],
 zones:[box('salida',40,174,20,16,'finish-red','SALIDA'),box('meta',40,4,20,18,'finish-red','META')],
 markers:[],obstacles:[{id:'caja-practica',x:48,y:90,width:5,height:5,movable:true}],start:{x:50,y:164,heading:-Math.PI/2},source:'Copia de ROB-002-S06-plotter-100x200.png',note:src+' Caja virtual para practicar el golpeador; posición ilustrativa.'};
 T.s07={...T.s03,id:'s07',name:'S07 · Repaso (pista S03 de práctica)',source:'Repaso: se utiliza como pista de práctica el trazado de S03, no existe un plotter S07 independiente en los materiales disponibles.',note:'Sesión de repaso: esta opción reutiliza explícitamente la geometría S03 para practicar. No representa una pista S07 oficial.',paths:T.s03.paths.map(p=>({...p,p:p.p.map(q=>[...q])}))};
 T.s08={id:'s08',name:'S08 · Clasificación y desafío final',w:100,h:200,
 paths:[line('principal-inferior',[[50,173],[50,108]]),line('principal-superior',[[50,91],[50,18]]),
 line('horizontal-1',[[8,44],[92,44]]),line('horizontal-2',[[8,61],[92,61]]),
 ...[17,39,61,83].map((x,i)=>line('poste-'+(i+1),[[x,19],[x,77]])),line('tope-salida',[[40,173],[60,173]])],
 zones:[box('salida',40,174,20,16,'finish-red','SALIDA'),...[17,39,61,83].map((x,i)=>box('meta-'+(i+1),x-5,4,10,14,'finish-green','BASE '+(i+1)))],
 markers:[],obstacles:[],start:{x:50,y:165,heading:-Math.PI/2},source:'Copia de ROB-002-S08-plotter-100x200.png',note:src+' Las zonas meta intermedias se muestran para referencia; no hay evaluación de clasificación implementada.'};
 // En circuitos cerrados, salir tangente a la línea permite que los sensores
 // delanteros la vean desde el inicio, sin una corrección oculta del seguidor.
 for(const id of ['s03','s07','oval','ocho']){
  const t=T[id],points=t.paths[0].p,a=points[0],b=points[1];
  t.start={...t.start,heading:Math.atan2(b[1]-a[1],b[0]-a[0])};
 }
})();
