// prova_schermate.mjs: confronto delle schermate (regressione grafica). Fotografa le pagine principali sul simulatore
// locale e le confronta pixel per pixel (pixelmatch, ISC) con quelle dell'ultima versione buona.
// Trova le rotture grafiche che i test di funzionamento non vedono (un pannello spostato, un colore sbagliato, un testo tagliato).
//   node prova_schermate.mjs             confronta; esce con 1 se una pagina cambia oltre la tolleranza
//   node prova_schermate.mjs --aggiorna  la versione attuale diventa il riferimento (dopo un cambiamento voluto)
// Riferimenti in strumenti_claude/schermate/riferimento, differenze (in rosso) in schermate/differenze. Solo sul Mac:
// le schermate del caso contengono immagini dei casi, che non vanno in git né su GitHub.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', Q = '/Volumes/Caloggero/piattaforma-quiz/qualita/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const pixelmatch = (await import(Q + 'node_modules/pixelmatch/index.js')).default, { PNG } = createRequire(Q + 'package.json')('pngjs');
const DIR = '/Volumes/Caloggero/strumenti_claude/schermate', RIF = path.join(DIR, 'riferimento'), ATT = path.join(DIR, 'attuali'), DIF = path.join(DIR, 'differenze');
// tolleranza: le pagine stabili danno 0% tra due giri; il visualizzatore varia di poco (disegno dell'immagine) → 0,5%
const AGGIORNA = process.argv.includes('--aggiorna'), TOLLERANZA = Number(process.env.TOLLERANZA || 0.0005);
const TOLLERANZA_CASO = Number(process.env.TOLLERANZA_CASO || 0.005);
for (const d of [RIF, ATT, DIF]) fs.mkdirSync(d, { recursive: true });
const PORTA = +process.env.PORTA_PROVA || (19550 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
// parti che cambiano da sole (numero di versione, date, ore): coperte prima della foto
const MASCHERE = ['.versione-sito', '#versione', '.versione', '[data-versione]', 'time', '.data-oggi', '#cl-versione'];
const ferma = 'animation: none !important; transition: none !important; caret-color: transparent !important;';
const nuova = async (opz = {}) => {
  const ctx = await b.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light', ...opz });
  await ctx.addInitScript(() => { const d = new Date('2026-03-10T10:00:00+01:00').getTime(); const D = Date; globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [d])); } static now() { return d; } }; });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('  errore JS:', e.message)); return p;
};
const entra = async (p, codice = 'admin-test-0000') => {
  await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
};
const esiti = [];
async function foto(p, nome) {
  await p.addStyleTag({ content: `*, *::before, *::after { ${ferma} }` }).catch(() => {});
  await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(800);
  // sempre dall'inizio della pagina: lo scorrimento dipende da quanto in fretta si carica (falsi allarmi sul telefono)
  await p.evaluate(() => { window.scrollTo(0, 0); document.scrollingElement && (document.scrollingElement.scrollTop = 0); }).catch(() => {}); await p.waitForTimeout(300);
  const maschere = []; for (const s of MASCHERE) maschere.push(p.locator(s));
  const buf = await p.screenshot({ animations: 'disabled', caret: 'hide', mask: maschere, maskColor: '#888' });
  const att = path.join(ATT, nome + '.png'); fs.writeFileSync(att, buf);
  // pagina vuota (404, errore, niente caricato): una schermata così piccola non va mai presa come riferimento
  if (buf.length < 30000) { esiti.push({ nome, stato: 'DIVERSA', perc: 100, nota: `pagina vuota (${buf.length} byte): indirizzo sbagliato o pagina non caricata` }); return; }
  const rif = path.join(RIF, nome + '.png');
  if (AGGIORNA || !fs.existsSync(rif)) { fs.writeFileSync(rif, buf); esiti.push({ nome, stato: 'riferimento salvato' }); return; }
  const a = PNG.sync.read(fs.readFileSync(rif)), c = PNG.sync.read(buf);
  if (a.width !== c.width || a.height !== c.height) { esiti.push({ nome, stato: 'DIVERSA', perc: 100, nota: `dimensioni ${a.width}×${a.height} → ${c.width}×${c.height}` }); return; }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, c.data, diff.data, a.width, a.height, { threshold: 0.12, includeAA: false });
  const perc = n / (a.width * a.height), tol = /caso/.test(nome) ? TOLLERANZA_CASO : TOLLERANZA;
  if (perc > tol) fs.writeFileSync(path.join(DIF, nome + '.png'), PNG.sync.write(diff)); else fs.rmSync(path.join(DIF, nome + '.png'), { force: true });
  esiti.push({ nome, stato: perc > tol ? 'DIVERSA' : 'uguale', perc: Math.round(perc * 10000) / 100 });
}
try {
  let p = await nuova(); await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]'); await foto(p, '01-home');
  p = await nuova({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]'); await foto(p, '02-home-telefono');
  p = await nuova({ locale: 'en-US' }); await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]'); await foto(p, '03-home-inglese');
  p = await nuova(); await entra(p); await foto(p, '04-elenco-casi');
  // un caso TC fisso (il primo visibile con una TC), con il visualizzatore caricato
  const casi = await (await p.request.get(B + '/api/casi')).json(), c = casi.find((x) => x.visibile !== false && /TC/.test(x.modalita || '')) || casi[0];
  await p.goto(B + `#/caso/${c.id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
  await p.waitForFunction((id) => { const d = window.__dbg, q = d?.P?.(0); return !d || (d?.V?.caso?.id === id && q?.img); }, c.id, { timeout: 30000 }).catch(() => {});
  await foto(p, '05-caso-visualizzatore');
  p = await nuova({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await entra(p); await p.goto(B + `#/caso/${c.id}`);
  await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 }); await foto(p, '06-caso-telefono');
  p = await nuova(); await p.goto(B + '/client/index.html'); await p.waitForTimeout(1500); await foto(p, '07-client');
  // 1.301 visualizzatore scaricabile con un esame TC aperto, in 2D e in MPR + 3D (lo spazio vuoto sopra le viste MPR della 1.278
  // non lo vedeva nessuna prova): esame del caso 004 dal disco, come lo aprirebbe l'utente
  { const fs2 = await import('node:fs'), pa = await import('node:path'), dir = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie';
    const files = fs2.readdirSync(dir, { recursive: true }).filter((x) => /\.dcm$/i.test(x)).map((x) => pa.join(dir, x));
    p = await nuova(); await p.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-cl-guida-1', '1'); localStorage.setItem('rq-protocollo-auto', '0'); } catch {} });   // disposizioni automatiche spente: la sincronizzazione delle fasi rende variabile la foto (le disposizioni hanno prova_disposizioni)
    await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await p.setInputFiles('#cl-file', files); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 90000 }); await p.waitForTimeout(1500);
    await foto(p, '12-client-caso-2d');
    await p.click('#modo-mpr'); await p.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#vp-assiale canvas') && document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await p.waitForTimeout(2500);
    await foto(p, '13-client-caso-mpr'); }
  p = await nuova(); await p.goto(B + '/client/manuale-client.html'); await foto(p, '08-manuale-client');
  p = await nuova(); await p.goto(B + '/qualita.html'); await foto(p, '09-qualita');
  p = await nuova({ colorScheme: 'dark' }); await p.goto(B + '/qualita.en.html'); await foto(p, '10-qualita-inglese-scuro');
  p = await nuova(); await p.goto(B + '/licenze.html'); await foto(p, '11-licenze');
} finally { await b.close(); sim.kill(); }
let ko = 0;
for (const e of esiti) { if (e.stato === 'DIVERSA') ko++; console.log(`${e.stato === 'DIVERSA' ? '✖' : '✓'} ${e.nome}: ${e.stato}${e.perc != null ? ` (${e.perc}% dei pixel)` : ''}${e.nota ? ' — ' + e.nota : ''}`); }
console.log(ko ? `\n${ko} pagine cambiate: guarda ${DIF} (se il cambiamento è voluto: node prova_schermate.mjs --aggiorna)` : '\nnessuna rottura grafica');
// riga di riepilogo nel formato degli altri test (tutti_i_test.sh)
console.log(`ℹ pass ${esiti.length - ko}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
