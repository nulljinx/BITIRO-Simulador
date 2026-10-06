/* BITIRO · Escena tridimensional autónoma. Geometría real (x,y,z) y proyección
   por perspectiva en Canvas; sin capturas, imágenes simuladas ni librerías remotas. */
'use strict';
const staticScenes=new WeakMap();
const HARDWARE=window.IROH_MECHANICS.spec;
const V = (x,y,z)=>({x,y,z});
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const norm=a=>{const k=Math.hypot(a.x,a.y,a.z)||1;return V(a.x/k,a.y/k,a.z/k)};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
function face(list,pts,fill,layer=3,alpha=1,stroke=null){list.push({points:pts,fill,layer,alpha,stroke})}
function box(list,x,y,z,w,h,d,c,layer=3){
 const a=V(x,y,z),b=V(x+w,y,z),p=V(x+w,y,z+d),q=V(x,y,z+d);
 const t=V(x,y+h,z),u=V(x+w,y+h,z),v=V(x+w,y+h,z+d),r=V(x,y+h,z+d);
 face(list,[a,b,u,t],c[1],layer);face(list,[b,p,v,u],c[2],layer);
 face(list,[p,q,r,v],c[1],layer);face(list,[q,a,t,r],c[2],layer);
 face(list,[t,u,v,r],c[0],layer);
}
function floor(list,x,z,w,d,y,color,layer=1){face(list,[V(x,y,z),V(x+w,y,z),V(x+w,y,z+d),V(x,y,z+d)],color,layer)}
function band(a,b,w,color,layer=2){let dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,ox=dz/len*w/2,oz=-dx/len*w/2;return {points:[V(a.x+ox,a.y,a.z+oz),V(b.x+ox,b.y,b.z+oz),V(b.x-ox,b.y,b.z-oz),V(a.x-ox,a.y,a.z-oz)],fill:color,layer,alpha:1}}
function renderScene3D(canvas,track,robot,obstacles,camera){
 const c=canvas.getContext('2d');if(!c)return;
 const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(w<20||h<20)return;
 const dpr=Math.min(devicePixelRatio||1,window.BITIRO_RENDER_QUALITY==='high'?2.3:1.6),cw=Math.round(w*dpr),ch=Math.round(h*dpr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch}
 c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#233440');sky.addColorStop(1,'#101b26');c.fillStyle=sky;c.fillRect(0,0,w,h);
 const X=x=>x-track.physicalWidthCm/2,Z=z=>z-track.physicalHeightCm/2;
 const target=camera.follow?V(X(robot.x),0,Z(robot.y)):V(0,0,track.physicalHeightCm*.065);
 const reach=Math.max(track.physicalWidthCm,track.physicalHeightCm),dist=clamp(camera.distance,.24,3.8)*reach;
 const position=V(target.x+dist*Math.cos(camera.elevation)*Math.cos(camera.azimuth),dist*Math.sin(camera.elevation),target.z+dist*Math.cos(camera.elevation)*Math.sin(camera.azimuth));
 const forward=norm(sub(target,position)),right=norm(cross(forward,V(0,1,0))),up=norm(cross(right,forward));
 const focal=Math.min(w,h)*1.68;
 const project=v=>{const rel=sub(v,position),depth=dot(rel,forward);if(depth<.2)return null;return{x:w/2+dot(rel,right)*focal/depth,y:h*.46-dot(rel,up)*focal/depth,depth}};
 const faces=[],labels=[];
 const cached=staticScenes.get(track);
 if(cached){faces.push(...cached.faces);labels.push(...cached.labels);}else{
 const x0=-track.physicalWidthCm/2,z0=-track.physicalHeightCm/2,tw=track.physicalWidthCm,th=track.physicalHeightCm;
 // Base de mesa: faldón lateral y superficie marfil con borde metálico.
 box(faces,x0-2,-2.7,z0-2,tw+4,1.6,th+4,['#57666e','#37434d','#39454c'],0);
 floor(faces,x0,z0,tw,th,-.92,'#F2F0E8',1);
 // Cuadrícula métrica muy tenue: los recorridos negros permanecen protagonistas.
 for(let i=10;i<tw;i+=10)faces.push(band(V(x0+i,-.89,z0),V(x0+i,-.89,z0+th),.07,'#D8DCD8',1));
 for(let i=10;i<th;i+=10)faces.push(band(V(x0,-.89,z0+i),V(x0+tw,-.89,z0+i),.07,'#D8DCD8',1));
 // Líneas del plotter: muchos tramos pequeños para mantener curvas suaves.
 for(const path of track.paths){for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i];faces.push(band(V(X(a.x),-.78,Z(a.y)),V(X(b.x),-.78,Z(b.y)),path.widthCm,'#1E242A',2));
 }}
 // Bases físicas: pintadas encima de la lámina, con pequeña franja de marco.
 for(const zone of track.finishZones){
  floor(faces,X(zone.x)-.38,Z(zone.y)-.38,zone.width+.76,zone.height+.76,-.72,'#4B5052',2);
  floor(faces,X(zone.x),Z(zone.y),zone.width,zone.height,-.69,zone.kind==='finish-green'?'#91C5A8':'#D8978D',2);
  labels.push({at:V(X(zone.x+zone.width/2),-.58,Z(zone.y+zone.height/2)),text:zone.label||'BASE'});
 }
 for(const m of track.markers||[])floor(faces,X(m.x),Z(m.y),m.width,m.height,-.68,'#D57C69',2);
 // Pequeño borde del recinto en cuatro lados, no tapa la superficie.
 box(faces,x0-1.4,-.9,z0-1.4,tw+2.8,.55,1.35,['#647079','#303B44','#2B3943'],2);
 box(faces,x0-1.4,-.9,z0+th+.05,tw+2.8,.55,1.35,['#647079','#303B44','#2B3943'],2);
 box(faces,x0-1.4,-.9,z0-1.4,1.35,.55,th+2.8,['#647079','#303B44','#2B3943'],2);
 box(faces,x0+tw+.05,-.9,z0-1.4,1.35,.55,th+2.8,['#647079','#303B44','#2B3943'],2);
 staticScenes.set(track,{faces:[...faces],labels:[...labels]});
 }
 const trace=robot.trail||[],stride=Math.max(1,Math.ceil(trace.length/450));
 for(let i=stride;i<trace.length;i+=stride){const a=trace[i-stride],b=trace[i];faces.push(band(V(X(a.x),-.75,Z(a.y)),V(X(b.x),-.75,Z(b.y)),.24,'#5FABA0',2));}
 // Obstáculos reales en 3D, con sombra y caras diferenciadas.
 for(const ob of obstacles){
  floor(faces,X(ob.x)-.95,Z(ob.y)-.95,ob.width+1.9,ob.height+1.9,-.66,'#B2B4AF',3);
  box(faces,X(ob.x),-.45,Z(ob.y),ob.width,ob.visualHeightCm ?? HARDWARE.sonarHeight+.5,ob.height,['#D9B17B','#BA8653','#94603B'],3);
 }
 // Modelo PROCEDURAL 3D del IROH inspirado en la FOTO proporcionada:
 // dos ruedas negras/amarillas, chasis doble, placa Arduino, cables, sonar
 // sobre montura AZUL, 3 sensores bajos y servo con un palo de golpe recto y articulado.
 // No se utiliza ninguna fotografía como textura ni se añaden pestañas o boca.
 const heading=robot.heading,f2=[Math.cos(heading),Math.sin(heading)],r2=[-Math.sin(heading),Math.cos(heading)];
 const local=(f,r,y)=>V(X(robot.x)+f*f2[0]+r*r2[0],y,Z(robot.y)+f*f2[1]+r*r2[1]);
 const localBox=(f,r,y,len,wide,tall,palette,layer=4)=>{
  const base=[local(f-len/2,r-wide/2,y),local(f+len/2,r-wide/2,y),local(f+len/2,r+wide/2,y),local(f-len/2,r+wide/2,y)];
  const top=base.map(q=>V(q.x,q.y+tall,q.z));
  face(faces,top,palette[0],layer);for(let k=0;k<4;k++)face(faces,[base[k],base[(k+1)%4],top[(k+1)%4],top[k]],k%2?palette[2]:palette[1],layer);
 };
 const slab=(outline,y,h,palette)=>{
  const bottom=outline.map(([f,r])=>local(f,r,y)),top=bottom.map(q=>V(q.x,q.y+h,q.z));
  face(faces,top,palette[0],4);
  for(let k=0;k<outline.length;k++)face(faces,[bottom[k],bottom[(k+1)%outline.length],top[(k+1)%outline.length],top[k]],k%2?palette[1]:palette[2],4);
 };
 // Cilindro orientado hacia los laterales del robot: disco en plano marcha-altura.
 const wheel=(forward,side,width,radius)=>{
  const mid=side*9.1;const a=[],b=[],N=16;
  for(let j=0;j<N;j++){
   const t=Math.PI*2*j/N;
   a.push(local(forward+radius*Math.cos(t),mid-side*width/2,4+radius*Math.sin(t)));
   b.push(local(forward+radius*Math.cos(t),mid+side*width/2,4+radius*Math.sin(t)));
  }
  for(let j=0;j<N;j++){
   face(faces,[a[j],a[(j+1)%N],b[(j+1)%N],b[j]],j%2?'#10171A':'#1C2228',4);
   if(j%2===0)face(faces,[local(forward+(radius+.11)*Math.cos(j*Math.PI*2/N),mid+side*width*.36,4+(radius+.11)*Math.sin(j*Math.PI*2/N)),b[j],b[(j+1)%N]],'#293137',4);
  }
  face(faces,b,'#171D23',4);
  const rim=(rad,offset,col,n=16)=>{
   const v=[];for(let j=0;j<n;j++){const t=j*Math.PI*2/n;v.push(local(forward+rad*Math.cos(t),mid+side*(width/2+offset),4+rad*Math.sin(t)))}
   face(faces,v,col,4);
  };
  rim(radius*.82,.09,'#E3AF0B');rim(radius*.68,.13,'#F3CC26');
  for(let j=0;j<6;j++){
   const a1=j*Math.PI/3,a2=a1+.21;
   face(faces,[local(forward,mid+side*(width/2+.17),4),local(forward+radius*.64*Math.cos(a1),mid+side*(width/2+.17),4+radius*.64*Math.sin(a1)),local(forward+radius*.64*Math.cos(a2),mid+side*(width/2+.17),4+radius*.64*Math.sin(a2))],'#B78C12',4);
  }
  rim(radius*.19,.2,'#373D43');rim(radius*.085,.23,'#C4CCD0');
 };
 // La carcasa de dos niveles es octogonal (no una caja rectangular genérica).
 const hull=[[-9,-5],[-6,-8.1],[5,-8.1],[9,-5],[9,5],[5,8.1],[-6,8.1],[-9,5]];
 const shadow=[];for(let j=0;j<20;j++){const a=j/20*2*Math.PI;shadow.push(local(Math.cos(a)*13,Math.sin(a)*11,-.63))}face(faces,shadow,'#46515A',3,.25);
 // Motores laterales y soportes negros.
 for(const side of [-1,1]){
  localBox(-3,side*6.7,2.4,6.0,3.2,2.5,['#43464B','#20252A','#161B20']);
  wheel(-2.3,side,2.2,5.2);
 }
 // Rueda esférica metálica de apoyo frontal, en el nivel inferior del chasis.
 const caster=[];for(let j=0;j<12;j++){const t=j*Math.PI/6;caster.push(local(6.6+Math.cos(t)*1.25,0,.92+Math.sin(t)*1.25))}
 face(faces,caster,'#B9C4C8',4);
 localBox(6.55,0,1.8,2.5,2.4,.9,['#667178','#374047','#2A343C']);
 slab(hull,2.9,.86,['#252A30','#171E24','#11181F']);
 // Chasis elevado con separadores dorados como la fotografía.
 for(const f of [-6.7,6.7])for(const r of [-5.9,5.9]){
  localBox(f,r,3.72,.75,.75,3.7,['#D6C38F','#BBA56E','#8E804E']);
  localBox(f,r,7.51,1.15,1.15,.17,['#CFD7D7','#9DAAAA','#839091']);
 }
 slab(hull.map(([f,r])=>[f*.98,r*.96]),7.30,.69,['#252B31','#151B22','#11171E']);
 // Pista de circuito verde y microcomponentes de la placa electrónica.
 localBox(-1.8,.2,8.04,11.7,8.9,.21,['#27764C','#18553B','#164F37']);
 localBox(-3.6,-1.6,8.28,6.7,4.3,.55,['#245F87','#1A4B71','#153A5B']);
 localBox(-3.6,-1.6,8.85,4.7,2.4,.26,['#242C30','#141C20','#0E171C']);
 for(let k=0;k<9;k++)localBox(-6.5+k*.63,-4.0,8.33,.28,.25,.35,['#D2D5BC','#A9B195','#838A74']);
 for(let k=0;k<7;k++)localBox(-5.5+k*.92,4.0,8.3,.48,.43,.58,['#333D46','#151E26','#15191E']);
 localBox(2.7,2.2,8.27,3.1,2.7,1.3,['#373F46','#242D33','#1B2429']);
 // Mazos de cable como tiras curvadas 3D; se dibujan por segmentos sin SVG.
 const wires=['#EC6E31','#E1BB22','#E14A3A','#2BA784','#268BC8','#ECE4D0','#CC641B','#4D6CD1'];
 for(let j=0;j<wires.length;j++){
  const path=[];for(let k=0;k<=10;k++){const t=k/10;path.push(local(-6.5+t*10.2,j*.5-2.0,8.5+Math.sin(t*Math.PI)*(2.55+j*.16)))}
  for(let k=1;k<path.length;k++)faces.push(band(path[k-1],path[k],.28,wires[j],4));
 }
 // Bisagra frontal con cuello inclinado y cabezal AZUL poligonal (no ojos decorativos).
 localBox(5.8,0,8.2,3.3,4.8,3.2,['#172F5D','#10264D','#16325E']);
 localBox(6.9,0,10.8,3.3,5.7,2.4,['#1E49AA','#17388D','#15347B']);
 slab([[5.1,-4.0],[6.0,-5.2],[8.5,-5.0],[9.3,-3.4],[9.3,3.4],[8.5,5.0],[6.0,5.2],[5.1,4.0]],12.85,4.6,['#1A46B5','#183C98','#133079']);
 // Transductores HC-SR04: aros cilíndricos, gris plata con cámara negra, vistos desde el frente.
 const sonar=(forward,r,cy)=>{
  const N=16,outer=[],inner=[],rear=[];
  for(let j=0;j<N;j++){
   const t=j*2*Math.PI/N,cos=Math.cos(t),sin=Math.sin(t);
   rear.push(local(forward-1.05,r+cos*2.03,cy+sin*2.03));
   outer.push(local(forward+.35,r+cos*2.03,cy+sin*2.03));
   inner.push(local(forward+.44,r+cos*1.31,cy+sin*1.31));
  }
  for(let j=0;j<N;j++){
   face(faces,[rear[j],rear[(j+1)%N],outer[(j+1)%N],outer[j]],j%2?'#8E9AA2':'#C6CFD2',4);
   face(faces,[outer[j],outer[(j+1)%N],inner[(j+1)%N],inner[j]],j%2?'#B6C2C6':'#DFE5E6',4);
  }
  face(faces,inner,'#19232B',4);
  const dark=[];for(let j=0;j<N;j++){const t=j*2*Math.PI/N;dark.push(local(forward+.5,r+Math.cos(t)*.72,cy+Math.sin(t)*.72))}face(faces,dark,'#0C141C',4);
 };
 sonar(9.48,-2.45,15.15);sonar(9.48,2.45,15.15);
 // Dos pequeñas placas IR laterales con emisor y fotodiodo, sin adornos de cara.
 for(const side of [-1,1]){
  localBox(5.8,side*6.6,7.85,3.5,1.55,.33,['#236CC0','#134A95','#16438C']);
  localBox(7.5,side*6.6-.40,8.20,.73,.42,.58,['#181F26','#0C1419','#152029']);
  localBox(7.5,side*6.6+.40,8.20,.73,.42,.58,['#D0DCE0','#85989E','#AABBC1']);
 }
 // Barra de sensores de línea debajo del frente: visualmente separada del servo.
 localBox(LINE_SENSOR.geometry.front-.6,0,.62,2.4,8.0,.56,['#245FAD','#123D79','#10366B']);
 for(let s=-1;s<=1;s++){
  localBox(LINE_SENSOR.geometry.front,s*LINE_SENSOR.geometry.spread,.5,1.07,1.30,.65,['#2079C4','#164E83','#17446A']);
  localBox(LINE_SENSOR.geometry.front+.53,s*LINE_SENSOR.geometry.spread,.6,.27,.76,.32,[robot.lineActive?.[s+1]?'#4BD6B4':'#171F24','#12191E','#10161A']);
 }
 // Huellas: estos son los mismos puntos que usa la lectura de la pista.
 for(let k=0;k<3;k++){
  const pts=[];for(let j=0;j<12;j++){const a=j*Math.PI/6;pts.push(local(LINE_SENSOR.geometry.front+Math.cos(a)*.72,(k-1)*LINE_SENSOR.geometry.spread+Math.sin(a)*.72,-.60));}
  face(faces,pts,robot.lineActive?.[k]?'#26CAA5':'#EAA56B',2,.95);
 }
 // GOLPE: pivote SOBRE EL EJE CENTRAL del IROH (r=0).
 // La posición de reposo mira hacia la izquierda (-65°); una orden 65
 // recorre hasta +65°: el palo barre la caja en vez de nacer dentro de ella.
 // Misma geometría y cinemática que strike-physics.js (una sola fuente).
 const pivotF=HARDWARE.pivotForward,pivotR=HARDWARE.pivotRight;
 const armLength=HARDWARE.length,armHalf=HARDWARE.halfWidth;
 // Servo azul real montado longitudinalmente en el centro del frente.
 localBox(pivotF-.4,0,3.25,3.8,3.8,3.15,['#2477C4','#19518A','#103E6A']);
 localBox(pivotF+.35,0,6.28,2.5,2.5,.45,['#BCC5C9','#87959C','#5B6870']);
 // Eje central plateado, tornillo y arandela.
 const screw=[];for(let j=0;j<14;j++){const a=2*Math.PI*j/14;screw.push(local(pivotF+.18+Math.cos(a)*.52,Math.sin(a)*.52,6.85))}
 face(faces,screw,'#E0E5E3',5);
 const angle=window.IROH_MECHANICS.sweepAngle(robot.strikerAngle||0);
 const arm=(f,r,y)=>local(pivotF+Math.cos(angle)*f-Math.sin(angle)*r,pivotR+Math.sin(angle)*f+Math.cos(angle)*r,y);
 const outline=[arm(0,-armHalf,HARDWARE.bottomHeight),arm(armLength,-armHalf,HARDWARE.bottomHeight),arm(armLength,armHalf,HARDWARE.bottomHeight),arm(0,armHalf,HARDWARE.bottomHeight)];
 const top=outline.map(v=>V(v.x,v.y+HARDWARE.topHeight-HARDWARE.bottomHeight,v.z));
 face(faces,top,'#27323A',5);
 for(let i=0;i<4;i++)face(faces,[outline[i],outline[(i+1)%4],top[(i+1)%4],top[i]],i%2?'#111820':'#1B252E',5);
 // Tapa terminal redondeada por pequeñas caras, sin punta afilada ni travesaño.
 const end=arm(armLength,0,HARDWARE.bottomHeight+.57);
 const endPlate=[arm(armLength,-armHalf,HARDWARE.bottomHeight),arm(armLength,armHalf,HARDWARE.bottomHeight),arm(armLength,armHalf,HARDWARE.topHeight),arm(armLength,-armHalf,HARDWARE.topHeight)];
 face(faces,endPlate,'#75838B',5);
 // Dos pernos discretos que fijan la varilla al servo central.
 for(const d of [1.0,2.0]){
  const bolt=arm(d,0,HARDWARE.topHeight+.035);
  face(faces,[V(bolt.x-.19,bolt.y,bolt.z-.19),V(bolt.x+.19,bolt.y,bolt.z-.19),V(bolt.x+.19,bolt.y,bolt.z+.19),V(bolt.x-.19,bolt.y,bolt.z+.19)],'#C1C9C9',5);
 }
 // Luz de posición y botón azul sobre la placa.
 localBox(0,6.4,8.11,1.2,1.0,.7,['#3CA8DB','#17699C','#0E5788']);
 // Ordenamiento de las caras por capa/distance, ninguna textura de foto.
 const ordered=faces.map(f=>{const verts=f.points.map(project);return {f,verts,depth:verts.reduce((s,p)=>s+(p?.depth||0),0)/verts.length}}).filter(q=>q.verts.every(Boolean)).sort((a,b)=>(Math.min(a.f.layer,3)-Math.min(b.f.layer,3))||(b.depth-a.depth)||(a.f.layer-b.f.layer));
 const light=norm(V(-.40,.84,-.36));
 const shade=(f)=>{
  if(f.layer<3||typeof f.fill!=='string'||!/^#[0-9a-fA-F]{6}$/.test(f.fill))return f.fill;
  const normal=norm(cross(sub(f.points[1],f.points[0]),sub(f.points[2],f.points[0])));
  const illumination=clamp(.70+.28*Math.abs(dot(normal,light)),.69,.98);
  const n=parseInt(f.fill.slice(1),16),a=[n>>16&255,n>>8&255,n&255];
  return `rgb(${a.map(x=>Math.round(x*illumination)).join(',')})`;
 };
 for(const {f,verts} of ordered){c.beginPath();c.moveTo(verts[0].x,verts[0].y);for(let j=1;j<verts.length;j++)c.lineTo(verts[j].x,verts[j].y);c.closePath();c.globalAlpha=f.alpha;c.fillStyle=shade(f);c.fill();if(f.stroke){c.strokeStyle=f.stroke;c.stroke()}}
 c.globalAlpha=1;
 // Etiquetas proyectadas: datos reales de las zonas en lugar de texto dibujado falso.
 c.font='600 11px system-ui,sans-serif';c.textAlign='center';
 for(const t of labels){const p=project(t.at);if(!p)continue;c.fillStyle='#283944';c.fillText(t.text,p.x,p.y+3)}
 // En vista superior las marcas superpuestas muestran la lectura bajo el chasis.
 if(camera.elevation>1.4){
  for(let k=0;k<3;k++){const p=project(local(LINE_SENSOR.geometry.front,(k-1)*LINE_SENSOR.geometry.spread,.1));if(!p)continue;
   c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fillStyle=robot.lineActive?.[k]?'#26CAA5':'#EAA56B';c.fill();c.strokeStyle='#10242A';c.lineWidth=1.5;c.stroke();
  }
 }
 c.textAlign='left';
}

