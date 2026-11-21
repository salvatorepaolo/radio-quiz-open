// prova_v236.mjs: client, esame già aperto su questo computer: le intestazioni non si rileggono (riapertura più veloce, stesse serie)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19350 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = [];
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  const c = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }).then(() => c.click('#pr-accetto')).catch(() => {});
  const apri = async () => {
    const msg = new Set(); const t0 = Date.now();
    const sonda = setInterval(async () => { try { msg.add(await c.$eval('#cl-stato', (e) => e.textContent.replace(/\d+ \/ \d+/, 'N').slice(0, 70))); } catch {} }, 100);
    await c.setInputFiles('#cl-file', files);
    await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 });
    clearInterval(sonda);
    const serie = await c.evaluate(() => window.__dbg.V.serie.map((s) => `${s.descrizione}:${s.files.length}`));
    return { ms: Date.now() - t0, msg: [...msg].filter(Boolean), serie };
  };
  const p1 = await apri();
  const ric = await c.evaluate(() => new Promise((ok) => { const r = indexedDB.open('rq-client'); r.onsuccess = () => { const q = r.result.transaction('intestazioni').objectStore('intestazioni').getAllKeys(); q.onsuccess = () => ok(q.result.length); }; }));
  ok('1 prima apertura: intestazioni lette e ricordate', ric === 2 && p1.serie.length >= 2, { ms: p1.ms, msg: p1.msg.slice(0, 4), serie: p1.serie });
  await c.evaluate(() => { location.hash = '#/'; }); await c.waitForSelector('#vista-client:not([hidden])');
  const p2 = await apri();
  ok('2 seconda apertura degli stessi file: niente lettura delle intestazioni', !p2.msg.some((m) => /Lettura delle intestazioni/.test(m)), { ms: p2.ms, msg: p2.msg.slice(0, 4) });
  ok('3 stesse serie, stesse immagini', JSON.stringify(p1.serie) === JSON.stringify(p2.serie), p2.serie);
  const n = await c.evaluate(() => new Promise((ok) => { const r = indexedDB.open('rq-client'); r.onsuccess = () => { const tx = r.result.transaction('intestazioni'); const q = tx.objectStore('intestazioni').getAllKeys(); q.onsuccess = () => ok(q.result.length); }; }));
  ok('4 un solo esame ricordato (più l\'elenco)', n === 2, n);
  await c.evaluate(() => { location.hash = '#/'; }); await c.waitForSelector('#vista-client:not([hidden])'); await c.waitForTimeout(500);
  await c.evaluate(() => document.querySelector('#cl-rec-svuota')?.click()); await c.waitForTimeout(800);
  const n2 = await c.evaluate(() => new Promise((ok) => { const r = indexedDB.open('rq-client'); r.onsuccess = () => { const tx = r.result.transaction('intestazioni'); const q = tx.objectStore('intestazioni').getAllKeys(); q.onsuccess = () => ok(q.result.length); }; }));
  ok('5 «Svuota» degli esami recenti cancella anche le intestazioni ricordate', n2 === 0, n2);
  ok('6 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
