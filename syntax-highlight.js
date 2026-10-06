/* BITIRO Simulador · resaltado de sintaxis del editor (sin dependencias, sin DOM).
   Tokeniza código Arduino/C++ con los mismos criterios de color que el editor del BITIRO Lab
   (tema «bitiro-night»): palabras reservadas, cadenas, comentarios, números, operadores, paréntesis
   por profundidad y funciones de la librería IROH en naranjo.
   Diferencia deliberada con el Lab: una función IROH dentro de un comentario o de una cadena NO se colorea.
   La salida nunca altera el texto: la concatenación de los tokens es exactamente la entrada. */
'use strict';
(()=>{
 const KEYWORDS=new Set(['void','int','float','double','long','short','char','bool','boolean','byte','word','unsigned','signed','const','static','volatile','extern','auto','struct','class','enum','union','typedef','if','else','while','for','do','switch','case','default','break','continue','return','goto','true','false','nullptr','new','delete','sizeof','namespace','using','public','private','protected','virtual','inline','template','typename','this']);
 const OPEN='([{',CLOSE=')]}',OPS='-+*/%=<>!&|^~?:;,.';
 const NUMBER=/(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[uUlLfF]*/y;
 const IDENT=/[A-Za-z_]\w*/y;
 const CALL=/\s*\(/y;
 const match=(re,s,at)=>{re.lastIndex=at;return re.exec(s);};
 const isIdentChar=c=>c!==undefined&&/[A-Za-z0-9_]/.test(c);

 // Devuelve [{type,text}]; type ∈ kw str com num op api b1 b2 b3 bx plain
 function tokenize(src,apiNames=[]){
  const api=apiNames instanceof Set?apiNames:new Set(apiNames),out=[];let i=0,plainStart=-1,depth=0;
  const n=src.length;
  const flushPlain=end=>{if(plainStart>=0&&end>plainStart)out.push({type:'plain',text:src.slice(plainStart,end)});plainStart=-1;};
  const push=(type,text)=>{flushPlain(i);out.push({type,text});};
  let lineStart=true; // solo espacios desde el inicio de la línea (para directivas #)
  while(i<n){
   const c=src[i],d=src[i+1];
   if(c==='\n'){if(plainStart<0)plainStart=i;i++;lineStart=true;continue;}
   if(c==='/'&&d==='/'){let j=src.indexOf('\n',i);if(j<0)j=n;push('com',src.slice(i,j));i=j;continue;}
   if(c==='/'&&d==='*'){let j=src.indexOf('*/',i+2);j=j<0?n:j+2;push('com',src.slice(i,j));i=j;lineStart=false;continue;}
   if(c==='"'||c==="'"){let j=i+1;while(j<n&&src[j]!==c&&src[j]!=='\n'){if(src[j]==='\\'&&j+1<n&&src[j+1]!=='\n')j++;j++;}if(j<n&&src[j]===c)j++;push('str',src.slice(i,j));i=j;lineStart=false;continue;}
   if(c==='#'&&lineStart){
    const m=match(IDENT,src,i+1);
    if(m){const directive=m[0];push('kw','#'+directive);i+=1+directive.length;
     if(directive==='include'){let j=i;while(src[j]===' '||src[j]==='\t')j++;
      if(src[j]==='<'){const k=src.indexOf('>',j),eol=src.indexOf('\n',j),end=k>=0&&(eol<0||k<eol)?k:-1;
       if(end>=0){if(j>i)out.push({type:'plain',text:src.slice(i,j)});out.push({type:'kw',text:'<'},{type:'str',text:src.slice(j+1,end)},{type:'kw',text:'>'});i=end+1;}}}
     lineStart=false;continue;}
   }
   if(c===' '||c==='\t'||c==='\r'){if(plainStart<0)plainStart=i;i++;continue;}
   lineStart=false;
   if(/[0-9]/.test(c)||(c==='.'&&/[0-9]/.test(d||''))){const m=match(NUMBER,src,i);if(m&&!isIdentChar(src[i-1])){push('num',m[0]);i+=m[0].length;continue;}}
   if(/[A-Za-z_]/.test(c)){
    const word=match(IDENT,src,i)[0];
    if(KEYWORDS.has(word))push('kw',word);
    else if(api.has(word)&&match(CALL,src,i+word.length))push('api',word);
    else{if(plainStart<0)plainStart=i;i+=word.length;continue;}
    i+=word.length;continue;
   }
   if(OPEN.includes(c)){depth++;push('b'+(((depth-1)%3)+1),c);i++;continue;}
   if(CLOSE.includes(c)){if(depth===0)push('bx',c);else{push('b'+(((depth-1)%3)+1),c);depth--;}i++;continue;}
   if(OPS.includes(c)){push('op',c);i++;continue;}
   if(plainStart<0)plainStart=i;i++;
  }
  flushPlain(n);
  return out;
 }
 const ESC={'&':'&amp;','<':'&lt;','>':'&gt;'};
 const escapeHtml=s=>s.replace(/[&<>]/g,ch=>ESC[ch]);
 // HTML con clases t-<tipo>; el texto «plain» va sin envolver.
 function toHtml(tokens){let h='';for(const t of tokens)h+=t.type==='plain'?escapeHtml(t.text):'<span class="t-'+t.type+'">'+escapeHtml(t.text)+'</span>';return h;}
 const highlight=(src,apiNames)=>toHtml(tokenize(src,apiNames));
 const api=Object.freeze({tokenize,toHtml,highlight,escapeHtml,KEYWORDS});
 if(typeof window!=='undefined')window.BITIRO_SYNTAX=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
