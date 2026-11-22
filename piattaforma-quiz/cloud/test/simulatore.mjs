// Simulatore locale di radio-quiz.it per i test di non regressione: CloudFront (guardia delle immagini),
// Lambda (api/logica.mjs) e S3 (pagina e casi) su un solo server http. Database solo in memoria:
// i casi si leggono dalla cartella casi/ del Mac e non vengono mai modificati (le scritture restano in memoria).
//   CASI=../../casi WEB=../web PORTA=8097 node simulatore.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const { gestisci, impronta } = await import(pathToFileURL(path.join(QUI, '../api/logica.mjs')).href);
const CASI = path.resolve(process.env.CASI || path.join(QUI, '../../casi-free'));
// pacchetti di immagini preparati da pacchetti-casi.mjs (PACCHETTI=nessuno per provarne l'assenza)
const PACCHETTI = path.resolve(process.env.PACCHETTI || path.join(QUI, '../.casi-pk'));
const WEB = path.resolve(process.env.WEB || path.join(QUI, '../web'));
const PORTA = Number(process.env.PORTA || 8097), SEG = 'segreto-dei-test';
export const CODICE_ADMIN = 'admin-test-0000';

const casi = {}, serie = {};
for (const d of fs.readdirSync(CASI)) {
  if (!d.startsWith('caso-') && !d.startsWith('prop-')) continue;   // prop-: casi proposti dagli iscritti (come nell'archivio vero)
  try { casi[d] = JSON.parse(fs.readFileSync(path.join(CASI, d, 'caso.json'), 'utf8')); } catch { continue; }
  try { serie[d] = JSON.parse(fs.readFileSync(path.join(CASI, d, 'serie.json'), 'utf8')); } catch { serie[d] = null; }
}
const visite = new Map();
const LAVORI = new Map();
const sfide = new Map(), partSfide = new Map();
const ris = [], acc = new Map(), classi = new Map(), aziende = new Map(), spons = new Map(), sstat = new Map(), perc = new Map(), esami = [], errori = [], tent = new Map(), posta = [], IMP = {};
const magazzino = {
  elencoCasi: async () => Object.entries(casi).map(([id, c]) => ({ ...c, id })), leggiCaso: async (id) => (Object.hasOwn(casi, id) ? JSON.parse(JSON.stringify(casi[id])) : null),
  scriviCaso: async (id, c) => { casi[id] = c; }, eliminaCaso: async (id) => { delete casi[id]; return 0; },
  leggiSerie: async (id) => (Object.hasOwn(serie, id) ? serie[id] : null), scriviSerie: async (id, x) => { serie[id] = x; }, cancellaFile: async () => {}, segnaModificaImmagini: async () => {},
  salvaRisultato: async (r) => ris.push({ ...r, id: new Date().toISOString() + '#' + Math.random().toString(16).slice(2, 10) }), risultati: async () => [...ris],
  revisionaRisultato: async (id, rev) => { const r = ris.find((x) => x.id === id); if (r) { r.dettagli = { ...(r.dettagli || {}) }; if (rev) r.dettagli.revisione = rev; else delete r.dettagli.revisione; } },
  anonimizzaRisultati: async (id) => { for (const r of ris) if (r.account === id) { r.account = 'eliminato'; r.nome = 'Account eliminato'; } for (let i = esami.length - 1; i >= 0; i--) if (esami[i].account === id) esami.splice(i, 1); for (let i = errori.length - 1; i >= 0; i--) if (errori[i].account === id) errori.splice(i, 1); },
  elencoAccount: async () => [...acc.values()].map((a) => ({ ...a })), leggiAccount: async (id) => (acc.has(id) ? { ...acc.get(id) } : null),
  scriviAccount: async (a) => { acc.set(a.id, { ...a }); }, eliminaAccount: async (id) => { acc.delete(id); }, ripristinaCodice: async () => {},
  elencoSfide: async () => [...sfide.values()].map((x) => ({ ...x })), leggiSfida: async (c) => (sfide.has(c) ? { ...sfide.get(c) } : null), scriviSfida: async (x) => { sfide.set(x.codice, { ...x }); },
  partecipantiSfida: async (c) => [...(partSfide.get(c) || new Map()).values()].map((x) => ({ ...x })),
  scriviPartecipante: async (c, x) => { if (!partSfide.has(c)) partSfide.set(c, new Map()); partSfide.get(c).set(x.account, { ...x }); },
  eliminaPartecipante: async (c, a) => { partSfide.get(c)?.delete(a); },
  elencoClassi: async () => [...classi.values()], scriviClasse: async (c) => { classi.set(c.id, c); }, eliminaClasse: async (id) => { classi.delete(id); },
  elencoAziende: async () => [...aziende.values()], leggiAzienda: async (id) => aziende.get(id) || null, scriviAzienda: async (a) => { aziende.set(a.id, a); }, eliminaAzienda: async (id) => { aziende.delete(id); },
  elencoSponsor: async () => [...spons.values()], scriviSponsor: async (x) => { spons.set(x.id, x); }, eliminaSponsor: async (id) => { spons.delete(id); },
  contaSponsor: async (id, g, c) => { const k = id + '#' + g; const r = sstat.get(k) || { id, giorno: g, viste: 0, clic: 0 }; r[c]++; sstat.set(k, r); }, statSponsor: async (da) => [...sstat.values()].filter((r) => r.giorno >= da),
  tentativi: async (a, c) => tent.get(a + '#' + c) || 0, contaTentativo: async (a, c) => { const k = a + '#' + c; tent.set(k, (tent.get(k) || 0) + 1); return tent.get(k); },
  leggiImpostazioni: async () => ({ ...IMP }), scriviImpostazioni: async (x) => { Object.assign(IMP, x); },
  elencoPercorsi: async () => [...perc.values()], scriviPercorso: async (p) => { perc.set(p.id, p); }, eliminaPercorso: async (id) => { perc.delete(id); },
  elencoEsami: async () => [...esami], scriviEsame: async (e) => { esami.push(e); },
  elencoErrori: async () => [...errori], scriviErrore: async (e) => { errori.push(e); },
  contaVisita: async (g, v) => { const k = g + '#' + v; visite.set(k, (visite.get(k) || 0) + 1); },
  statVisite: async (da) => [...visite].map(([k, n]) => { const i = k.indexOf('#'); return { giorno: k.slice(0, i), voce: k.slice(i + 1), n }; }).filter((r) => r.giorno >= da),
};
const cfg = { hashAdmin: impronta(CODICE_ADMIN), segreto: SEG, magazzino, sicuro: false, indirizzo: `http://localhost:${PORTA}`,
  inviaEmail: async (a, o, c) => { posta.push({ a, o, testo: c?.testo }); }, firmaCaricamento: (k) => `http://localhost:${PORTA}/s3put/${k}`,
  // creazione automatica delle piattaforme (finta): il «lavoro AWS» resta in corso finché il test non manda l'esito
  creazione: process.env.CREAZIONE_FINTA ? { avvia: async (x) => { LAVORI.set(x.id, { ...x, stato: 'IN_PROGRESS' }); return 'lavoro:' + x.id; },
    stato: async (ids) => Object.fromEntries(ids.map((i) => [i, LAVORI.get(i.replace(/^lavoro:/, ''))?.stato || 'IN_PROGRESS'])) } : null,
  avvisiA: 'info@prova.example',
  // accesso con Google finto (22/11/2026): /__google fa la parte di accounts.google.com e rimanda indietro con un codice che
  // contiene le affermazioni (email da ?email=, altrimenti un indirizzo Gmail inventato); GOOGLE=0 lo spegne;
  // nelle piattaforme delle aziende è spento, come online (pubblica.command passa GOOGLE_ID solo alla vetrina)
  google: process.env.GOOGLE === '0' || process.env.MODO === 'azienda' ? null : { id: 'finto.apps.googleusercontent.com', segreto: 'finto', autorizza: `http://localhost:${PORTA}/__google`,
    scambia: async (codice) => JSON.parse(Buffer.from(codice, 'base64url').toString('utf8')) },
  linkedin: process.env.GOOGLE === '0' || process.env.MODO === 'azienda' ? null : { id: 'finto-linkedin', segreto: 'finto', autorizza: `http://localhost:${PORTA}/__linkedin`,
    scambia: async (codice) => JSON.parse(Buffer.from(codice, 'base64url').toString('utf8')) },
  // consumi AWS finti (solo nel simulatore, per vedere la dashboard): serie giornaliere plausibili
  traffico: process.env.TRAFFICO_FINTO ? async (n) => { const g = (k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10), s = (f) => Array.from({ length: n }, (_, i) => [g(n - 1 - i), f(i)]);
    return { distribuzione: true, memoriaMB: 256, richieste: s((i) => 8000 + 400 * i + 3000 * Math.sin(i)), byte: s((i) => 2.5e9 + 1e8 * i), err5: s(() => 0.02), err4: s(() => 1.1),
      invocazioni: s((i) => 900 + 30 * i), durata: s((i) => 120000 + 4000 * i), erroriApi: s(() => 0), sito: [[g(1), 7.1e9]], dati: [[g(1), 3.2e8]], tabellaByte: 4.1e6 }; } : null,
  istanza: { modo: process.env.MODO || 'vetrina', nome: process.env.NOME_ISTANZA || '', contatto: process.env.CONTATTO || '', utentiMax: process.env.UTENTI_MAX || '', scadenza: process.env.SCADENZA || '', sospesa: process.env.SOSPESA === '1' } };
// la guardia di CloudFront è scritta nello stack (lib/stack.mjs): la stessa funzione, con il segreto dei test
const src = fs.readFileSync(path.join(QUI, '../lib/stack.mjs'), 'utf8').match(/fromInline\(`([\s\S]*?)`\)/)[1].replace('${JSON.stringify(segreto)}', JSON.stringify(SEG));
const fg = path.join(os.tmpdir(), `guardia-test-${process.pid}.mjs`); fs.writeFileSync(fg, src + '\nexport { handler };');
const { handler: guardia } = await import(pathToFileURL(fg).href); fs.unlinkSync(fg);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.dcm': 'application/dicom', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.gz': 'application/gzip', '.png': 'image/png', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };
const CSP = "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com; worker-src 'self' blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
// Copertura del codice del sito nel browser (qualita/copertura-browser.sh). Con COPERTURA_SITO=<cartella> i file JS del sito
// (non le librerie né i worker) si servono «strumentati» con istanbul: ogni pagina rimanda i suoi contatori qui ogni 3 secondi
// e alla chiusura; all'uscita il simulatore scrive la somma in <cartella>/sito-<porta>-<pid>.json. Senza la variabile non cambia nulla.
const COP = process.env.COPERTURA_SITO, copMappe = {}, copPagine = new Map(), copCache = new Map();
let strumenta = null;
if (COP) {
  const { createRequire } = await import('node:module');
  const { createInstrumenter } = createRequire(path.join(QUI, '../../qualita/package.json'))('istanbul-lib-instrument');
  const ins = createInstrumenter({ esModules: true, compact: true, coverageVariable: '__coverage__' });
  const INVIO = "\n;(()=>{if(globalThis.__rqCop)return;globalThis.__rqCop=1;if(typeof document==='undefined'||/^\\/client\\//.test(location.pathname)||/[?&]client(=|&|$)/.test(location.search))return;const id=Math.random().toString(36).slice(2);const m=()=>{const c=globalThis.__coverage__;if(!c)return;const o={};for(const[k,v]of Object.entries(c))o[k]={s:v.s,f:v.f,b:v.b};fetch('/__copertura',{method:'POST',body:JSON.stringify({id,o})}).catch(()=>{})};setInterval(m,3000);addEventListener('pagehide',m)})();\n";
  strumenta = (file) => {
    const st = fs.statSync(file).mtimeMs, c = copCache.get(file); if (c?.st === st) return c.code;
    const code = ins.instrumentSync(fs.readFileSync(file, 'utf8'), file) + INVIO;
    copMappe[file] = ins.lastFileCoverage(); copCache.set(file, { st, code }); return code;
  };
  // tutto strumentato all'avvio: i moduli caricati a richiesta arrivano subito come senza copertura
  for (const x of fs.readdirSync(WEB)) if (x.endsWith('.js') && !/worker|^sw\.js$/.test(x)) strumenta(path.join(WEB, x));
  process.on('exit', () => {
    const tot = {};
    for (const o of copPagine.values()) for (const [file, v] of Object.entries(o)) {
      const m = copMappe[file]; if (!m) continue;
      const t = (tot[file] ||= { ...m, s: { ...m.s }, f: { ...m.f }, b: Object.fromEntries(Object.entries(m.b).map(([k, x]) => [k, [...x]])) });
      for (const k in v.s) t.s[k] = (t.s[k] || 0) + v.s[k]; for (const k in v.f) t.f[k] = (t.f[k] || 0) + v.f[k];
      for (const k in v.b) t.b[k] = (t.b[k] || []).map((n, i) => n + (v.b[k][i] || 0));
    }
    if (Object.keys(tot).length) { fs.mkdirSync(COP, { recursive: true }); fs.writeFileSync(path.join(COP, `sito-${PORTA}-${process.pid}.json`), JSON.stringify(tot)); }
  });
}
const server = http.createServer(async (q, s) => {
  try {
    const u = new URL(q.url, 'http://x'); const pezzi = []; for await (const c of q) pezzi.push(c); const corpo = Buffer.concat(pezzi).toString();
    if (u.pathname === '/__lavori') { s.writeHead(200, { 'content-type': 'application/json' }); return s.end(JSON.stringify(Object.fromEntries(LAVORI))); }
    if (u.pathname === '/__lavori/fallito') { for (const v of LAVORI.values()) v.stato = 'FAILED'; s.writeHead(200); return s.end('ok'); }
    if (u.pathname === '/__copertura' && COP) { try { const x = JSON.parse(corpo); copPagine.set(x.id, x.o); } catch {} s.writeHead(204); return s.end(); }
    if (u.pathname === '/__google' || u.pathname === '/__linkedin') {
      const li = u.pathname === '/__linkedin';
      const p = u.searchParams, email = (p.get('email') || 'mario.rossi@gmail.com').toLowerCase();
      if (p.get('annulla')) { s.writeHead(302, { location: `${p.get('redirect_uri')}?error=access_denied&state=${p.get('state')}` }); return s.end(); }
      const c = { iss: li ? 'https://www.linkedin.com' : 'https://accounts.google.com', aud: p.get('client_id'), exp: Math.floor(Date.now() / 1000) + 600, ...(li && !p.get('connonce') ? {} : { nonce: p.get('nonce') }),
        sub: p.get('sub') || (li ? 'L' : 'g') + Buffer.from(email).toString('hex').slice(0, 20), email, email_verified: p.get('verificata') !== '0',
        name: p.get('nome') ?? 'Mario Rossi', ...(p.get('hd') ? { hd: p.get('hd') } : {}) };
      s.writeHead(302, { location: `${p.get('redirect_uri')}?code=${Buffer.from(JSON.stringify(c)).toString('base64url')}&state=${p.get('state')}` }); return s.end();
    }
    if (u.pathname === '/__posta') { s.writeHead(200, { 'content-type': 'application/json' }); return s.end(JSON.stringify(posta)); }
    if (u.pathname.startsWith('/api/') || /^\/s\/[^/]+$/.test(u.pathname)) { const r = await gestisci({ metodo: q.method, percorso: u.pathname, query: Object.fromEntries(u.searchParams), headers: q.headers, corpo }, cfg); s.writeHead(r.stato, r.headers); return s.end(r.corpo); }
    if (u.pathname.startsWith('/s3put/')) {                    // caricamenti: solo serie.json in memoria (niente scritture su disco)
      const m = u.pathname.match(/^\/s3put\/casi\/([^/]+)\/serie\.json$/); if (m) try { serie[m[1]] = JSON.parse(corpo); } catch {}
      s.writeHead(200); return s.end(); }
    let file;
    if (u.pathname.startsWith('/casi/')) {
      const cookies = {}; (q.headers.cookie || '').split(/;\s*/).forEach((kv) => { const i = kv.indexOf('='); if (i > 0) { const n = kv.slice(0, i), v = { value: kv.slice(i + 1) }; if (cookies[n]) (cookies[n].multiValue ||= [{ value: cookies[n].value }]).push(v); else cookies[n] = v; } });
      const r = guardia({ request: { cookies, uri: u.pathname } }); if (r.statusCode) { s.writeHead(r.statusCode); return s.end('Forbidden'); }
      if (u.pathname.endsWith('caso.json')) { s.writeHead(403); return s.end(); }
      const rel = decodeURIComponent(u.pathname.slice(6));
      if (rel.split('/').some((x) => x.startsWith('_') || x === '..')) { s.writeHead(403); return s.end(); }
      if (rel.endsWith('/serie.json')) { const id = rel.split('/')[0]; s.writeHead(200, { 'content-type': 'application/json' }); return s.end(JSON.stringify((Object.hasOwn(serie, id) && serie[id]) || [])); }
      // 1.277: pacchetti di immagini (pacchetti-casi.mjs), se sono stati preparati: come S3, compressi con Content-Encoding br
      const pk = /^[^/]+\/(pacchetti\.json|pacchetti\/[0-9a-f]+\.rqp)$/.test(rel) && path.join(PACCHETTI, rel);
      if (pk) { if (!fs.existsSync(pk)) { s.writeHead(404); return s.end(); }
        s.writeHead(200, rel.endsWith('.json') ? { 'content-type': 'application/json', 'cache-control': 'no-cache' } : { 'content-type': 'application/octet-stream', 'content-encoding': 'br', 'cache-control': 'public, max-age=31536000, immutable' });
        return fs.createReadStream(pk).pipe(s); }
      file = path.join(CASI, rel);
    } else {
      // come la CloudFront Function «IndiciCartelle» (lib/stack.mjs): manuale del client fuori da /client/, cartelle → index.html
      let pn = decodeURIComponent(u.pathname); if (/^\/client\/manuale-client(\.en)?\.html$/.test(pn)) pn = pn.slice(7);
      file = path.join(WEB, pn === '/' ? 'index.html' : pn.endsWith('/') ? pn + 'index.html' : pn);
    }
    if (!file.startsWith(CASI) && !file.startsWith(WEB)) { s.writeHead(403); return s.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { s.writeHead(404); return s.end(); }
    // richieste parziali (Range), come S3 dietro CloudFront
    const rg = /^bytes=(\d+)-(\d*)$/.exec(q.headers.range || ''), tot = fs.statSync(file).size;
    if (rg && +rg[1] < tot) { const da = +rg[1], a = Math.min(tot - 1, rg[2] ? +rg[2] : tot - 1);
      s.writeHead(206, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'content-range': `bytes ${da}-${a}/${tot}`, 'content-length': a - da + 1, 'accept-ranges': 'bytes' });
      return fs.createReadStream(file, { start: da, end: a }).pipe(s); }
    if (strumenta && file.startsWith(WEB) && file.endsWith('.js') && !/\/(lib|backup_vista|client)\/|worker|\/sw\.js$/.test(file)) {
      s.writeHead(200, { 'content-type': 'text/javascript', 'content-security-policy': CSP, 'cache-control': 'no-store' }); return s.end(strumenta(file)); }
    // come S3: lunghezza e «accept-ranges» anche senza Range (e per HEAD, che usano i lettori a pezzi nei worker, es. iSyntax)
    s.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'content-security-policy': CSP, ...(file.startsWith(CASI) || u.pathname.startsWith('/esempi/') ? { 'content-length': tot, 'accept-ranges': 'bytes' } : {}) });
    if (q.method === 'HEAD') return s.end();
    fs.createReadStream(file).pipe(s);
  } catch (e) { console.error(e); s.writeHead(500); s.end(String(e?.message || e)); }
});
server.listen(PORTA, () => console.log(`simulatore pronto su ${PORTA} (${Object.keys(casi).length} casi)`));
// chiusura pulita quando un test lo ferma: così, misurando la copertura (qualita/copertura.sh), i dati del simulatore si salvano
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => process.exit(0));
