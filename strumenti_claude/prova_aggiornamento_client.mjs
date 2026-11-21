// prova_aggiornamento_client.mjs: il visualizzatore client installato (service worker, /client/) riceve la versione nuova
// senza perdere esami recenti, impostazioni e avviso privacy già accettato, e continua a funzionare senza rete, prima e
// dopo l'aggiornamento. «Senza rete» qui vuol dire server spento davvero. La versione nuova è una copia del sito con
// app.js e versione.json cambiati; i file originali non si toccano. Uso: node prova_aggiornamento_client.mjs
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', WEB0 = '/Volumes/Caloggero/piattaforma-quiz/cloud/web', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const WEB = fs.mkdtempSync(path.join(os.tmpdir(), 'client-agg-'));
for (const e of fs.readdirSync(WEB0)) if (!['app.js', 'versione.json'].includes(e)) fs.symlinkSync(path.join(WEB0, e), path.join(WEB, e));
fs.copyFileSync(path.join(WEB0, 'app.js'), path.join(WEB, 'app.js')); fs.copyFileSync(path.join(WEB0, 'versione.json'), path.join(WEB, 'versione.json'));
const PORTA = 19280 + Math.floor(Math.random() * 40), B = `http://localhost:${PORTA}`;
let sim = null;
const accendi = async () => { sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), WEB }, stdio: ['ignore', 'pipe', 'ignore'] }); await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); })); };
const spegni = async () => { if (!sim) return; const s = sim; sim = null; s.kill(); await new Promise((r) => s.once('exit', r)); };
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d ? ' → ' + d : ''}`); };
const files = []; { const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name) && files.length < 40) files.push(f); } }; giro(path.join(CASI, 'caso-tcia-001', 'serie')); }
await accendi();
const b = await chromium.launch(), ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errori = [];
p.on('pageerror', (e) => errori.push(e.message));
const pronta = async () => { await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); return p.evaluate(() => !!navigator.serviceWorker.controller); };
const recenti = () => p.evaluate(() => document.querySelectorAll('#cl-recenti [data-k], #cl-recenti li, #cl-recenti button').length);
const ricarica = async () => { await p.goto(B + '/client/index.html', { waitUntil: 'domcontentloaded' }); return pronta(); };
try {
  // 1. installazione, avviso privacy, un'impostazione, un esame aperto dal disco
  await p.goto(B + '/client/index.html'); await pronta();
  await p.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }); await p.click('#pr-accetto');
  await p.evaluate(() => localStorage.setItem('rq-referto-finestra', 'impostazione-di-prova'));
  await p.setInputFiles('#cl-file', files);
  await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  esito(await ricarica(), 'installato: il service worker controlla la pagina');
  await p.waitForTimeout(800);
  const nRecenti = await recenti();
  esito(nRecenti > 0, 'l\'esame aperto compare tra i recenti', `${nRecenti}`);
  // 2. senza rete, versione attuale
  await spegni();
  esito(await ricarica().catch(() => false), 'senza rete: il visualizzatore si apre');
  await p.waitForTimeout(800);
  esito(await recenti() === nRecenti, 'senza rete: gli esami recenti ci sono');
  // 3. esce una versione nuova
  const v = JSON.parse(fs.readFileSync(path.join(WEB0, 'versione.json'), 'utf8'));
  fs.writeFileSync(path.join(WEB, 'versione.json'), JSON.stringify({ ...v, versione: '9.999' }));
  fs.appendFileSync(path.join(WEB, 'app.js'), "\n;window.__versioneDiProva = '9.999';\n");
  await accendi();
  let nuova = false;
  for (let i = 0; i < 3 && !nuova; i++) { await ricarica(); nuova = await p.evaluate(() => window.__versioneDiProva === '9.999'); }
  esito(nuova, 'con la rete: arriva la versione nuova');
  await p.waitForTimeout(800);
  esito(await recenti() === nRecenti, 'dopo l\'aggiornamento: gli esami recenti restano', `${await recenti()}/${nRecenti}`);
  esito(await p.evaluate(() => localStorage.getItem('rq-referto-finestra')) === 'impostazione-di-prova', 'dopo l\'aggiornamento: le impostazioni restano');
  esito(!(await p.evaluate(() => document.querySelector('#dlg-privacy-cl')?.open)), 'dopo l\'aggiornamento: l\'avviso privacy già accettato non ricompare');
  // 4. di nuovo senza rete: la versione nuova resta e funziona
  await spegni();
  esito(await ricarica().catch(() => false) && await p.evaluate(() => window.__versioneDiProva === '9.999'), 'senza rete dopo l\'aggiornamento: si apre la versione nuova');
  await p.setInputFiles('#cl-file', files.slice(0, 10));
  esito(await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }).then(() => true, () => false), 'senza rete dopo l\'aggiornamento: un esame dal disco si apre');
  const chiavi = await p.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
  esito(chiavi.length > 20 && !chiavi.some((u) => /^\/(api|casi)\//.test(u)), 'nella memoria del browser solo i file del sito, niente dati', `${chiavi.length} file`);
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | ').slice(0, 300));
} finally { await b.close(); await spegni(); fs.rmSync(WEB, { recursive: true, force: true }); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
