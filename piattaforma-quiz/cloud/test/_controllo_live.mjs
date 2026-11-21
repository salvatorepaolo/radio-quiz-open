import fs from 'node:fs'; import path from 'node:path';
const B=process.env.SITO||'https://radio-quiz.it'; const CASI=path.resolve('../casi-free');
const seg=fs.readFileSync('.segreti','utf8'); const COD=(seg.match(/^CODICE_AMMINISTRATORE="?([^"\n]+)/m)||[])[1];
let jar={}; const ck=()=>Object.entries(jar).map(([k,v])=>k+'='+v).join('; ');
async function f(u,o={}){const r=await fetch(B+u,{...o,headers:{...(o.headers||{}),cookie:ck()},redirect:'manual'});
  for(const c of (r.headers.getSetCookie?.()||[])){const [kv]=c.split(';');const i=kv.indexOf('=');jar[kv.slice(0,i)]=kv.slice(i+1);} return r;}
const P=[]; const prob=(...a)=>P.push(a.join(' '));
let r=await f('/api/accesso',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({codice:COD})}); console.log('accesso',r.status);
const casi=await (await f('/api/casi')).json(); console.log('casi online',casi.length,'visibili',casi.filter(c=>c.visibile!==false).length);
const locali=fs.readdirSync(CASI).filter(x=>x.startsWith('caso-'));
for(const id of locali) if(!casi.find(c=>c.id===id)) prob('manca online',id);
for(const c of casi) if(!locali.includes(c.id)) prob('online ma non in locale',c.id);
const lic=await (await f('/licenze.html')).text();
let nimg=0;
for(const c of casi){
  const loc=JSON.parse(fs.readFileSync(path.join(CASI,c.id,'caso.json'),'utf8'));
  if((loc.visibile!==false)!==(c.visibile!==false)) prob('visibilità diversa',c.id,'locale',loc.visibile,'online',c.visibile);
  const rc=await f('/api/casi/'+c.id); if(rc.status!==200){prob('api caso',c.id,rc.status);continue;}
  const d=await rc.json();
  if(loc.titolo!==d.titolo) prob('titolo diverso',c.id);
  if(!d.fonte?.archivio) prob('fonte mancante',c.id);
  const col=loc.fonte?.collezione; if(col && !lic.includes(col)) prob('collezione non in licenze',c.id,col);
  if(!loc.opzioni?.some(o=>o.tipo==='principale')) prob('nessuna principale',c.id);
  if((loc.opzioni||[]).filter(o=>o.tipo==='principale').length>1) prob('più principali',c.id);
  const rs=await f(`/casi/${c.id}/serie.json`); if(rs.status!==200){prob('serie.json',c.id,rs.status);continue;}
  const S=await rs.json(); const Sl=JSON.parse(fs.readFileSync(path.join(CASI,c.id,'serie.json'),'utf8'));
  if(JSON.stringify(S.map(s=>s.files.length))!==JSON.stringify(Sl.map(s=>s.files.length))) prob('serie diverse da locale',c.id);
  const v=loc.vista; if(v && (v.serie>=S.length || v.idx>=S[v.serie].files.length)) prob('vista fuori serie',c.id,JSON.stringify({s:v.serie,i:v.idx}));
  for(const s of S){ for(const fi of [s.files[0],s.files[Math.floor(s.files.length/2)],s.files.at(-1)]){
      const ri=await f(`/casi/${c.id}/${fi}`); nimg++; const b=Buffer.from(await ri.arrayBuffer());
      if(ri.status!==200||b.length<1000||b.toString('latin1',128,132)!=='DICM') prob('immagine',c.id,fi,ri.status,b.length);} }
}
// percorsi
const per=await (await f('/percorsi.json')).json(); const vis=new Set(casi.filter(c=>c.visibile!==false).map(c=>c.id)); const tutti=new Set(casi.map(c=>c.id));
for(const p of per){ const nv=p.casi.filter(x=>vis.has(x)).length; for(const x of p.casi) if(!tutti.has(x)) prob('percorso',p.id,'caso inesistente',x);
  console.log('percorso',p.id,p.casi.length,'casi, visibili',nv); }
for(const id of vis){ if(!per.some(p=>p.casi.includes(id))) prob('caso visibile in nessun percorso',id); }
// pagine statiche
for(const u of ['/','/app.js','/style.css','/licenze.html','/versione.json','/aiuto.json','/schede.json','/manuale.pdf','/logo.svg']){const x=await f(u); if(x.status!==200) prob('pagina',u,x.status);}
console.log('versione',await (await f('/versione.json')).text());
console.log('immagini controllate',nimg);
console.log('PROBLEMI',P.length); for(const p of P) console.log(' -',p);
