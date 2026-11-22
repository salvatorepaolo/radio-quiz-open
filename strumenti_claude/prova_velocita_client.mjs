// prova_velocita_client.mjs (1.302): tempi del visualizzatore scaricabile su un esame grande (caso 051, ~1450 immagini, aperto
// dal disco): prima immagine, tutte le serie pronte, scorrimento, passaggio a MPR + 3D. Stampa i tempi e li confronta con
// quelli dell'ultimo giro buono (velocita-limiti.json): fallisce se un tempo peggiora oltre il 50% + 1 s.
// Uso: node prova_velocita_client.mjs [--nuovi-limiti]
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23961, B = `http://localhost:${PORTA}`, CASO = process.env.CASO || 'caso-tcia-051';
const LIMITI = path.join(path.dirname(new URL(import.meta.url).pathname), 'velocita-limiti.json');
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const dir = `/Volumes/Caloggero/piattaforma-quiz/casi-free/${CASO}/serie`, files = fs.readdirSync(dir, { recursive: true }).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(dir, x));
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-protocollo-auto', '0'); } catch {} });
const p = await ctx.newPage(), err = []; p.on('pageerror', (e) => err.push(e.message));
await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])');
const m = {}; let t0 = Date.now();
await p.setInputFiles('#cl-file', files); m.caricamento_file = Date.now() - t0;
t0 = Date.now(); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 300000 }); m.prima_immagine = Date.now() - t0 + m.caricamento_file;
const info = await p.evaluate(() => ({ serie: window.__dbg.V.serie.length, immagini: window.__dbg.V.serie.reduce((a, s) => a + s.files.length, 0) }));
// scorrimento: 30 immagini una dopo l'altra nella serie più grande
const si = await p.evaluate(() => { const V = window.__dbg.V; let k = 0; V.serie.forEach((s, i) => { if (s.files.length > V.serie[k].files.length) k = i; }); return k; });
await p.evaluate(async (si) => { await window.__dbg.selezionaSerie(si, 0); }, si); await p.waitForTimeout(500);
t0 = Date.now(); await p.evaluate(async () => { const d = window.__dbg, q = d.P(0); for (let i = 0; i < 30; i++) await d.mostraDi(0, Math.min(q.frames.length - 1, Math.floor(q.frames.length / 2) + i)); }); m.scorrimento_30 = Date.now() - t0;
t0 = Date.now(); await p.click('#modo-mpr'); await p.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#vp-assiale canvas') && document.querySelector('#mpr-stato')?.hidden, null, { timeout: 300000 }); m.mpr = Date.now() - t0;
console.log(`esame ${CASO}: ${info.serie} serie, ${info.immagini} immagini (serie più grande: ${si})`);
for (const [k, v] of Object.entries(m)) console.log(`  ${k.replace(/_/g, ' ').padEnd(18)} ${(v / 1000).toFixed(2)} s`);
let ko = 0;
if (process.argv.includes('--nuovi-limiti') || !fs.existsSync(LIMITI)) { fs.writeFileSync(LIMITI, JSON.stringify({ data: new Date().toISOString().slice(0, 10), caso: CASO, m }, null, 1) + '\n'); console.log('tempi di riferimento salvati'); }
else { const r = JSON.parse(fs.readFileSync(LIMITI, 'utf8')).m; for (const [k, v] of Object.entries(m)) if (r[k] != null && v > r[k] * 1.5 + 1000) { ko++; console.log(`KO  ${k}: ${(v / 1000).toFixed(2)} s, riferimento ${(r[k] / 1000).toFixed(2)} s`); } }
if (err.length) { ko++; console.log('KO  errori JavaScript: ' + err.slice(0, 2).join(' | ')); }
console.log(ko ? `\n${ko} tempi peggiorati` : '\nOK  tempi nella norma'); console.log(`ℹ pass ${ko ? 0 : 1}\nℹ fail ${ko ? 1 : 0}`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
