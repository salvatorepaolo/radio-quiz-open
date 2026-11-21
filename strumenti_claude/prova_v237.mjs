// prova_v237.mjs: client, un file che non si riesce a leggere (disco che non risponde) non blocca l'apertura: si salta dopo 20 s
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
  // un file «appeso»: la lettura non finisce mai
  await c.evaluate(() => { const orig = Blob.prototype.arrayBuffer; Blob.prototype.arrayBuffer = function () { if (this.__appeso) return new Promise(() => {}); return orig.call(this); };
    const sl = File.prototype.slice; File.prototype.slice = function (...a) { const b = sl.apply(this, a); if (this.name === window.__nomeAppeso) b.__appeso = true; return b; }; });
  const nome = path.basename(files[5]);
  await c.evaluate((n) => { window.__nomeAppeso = n; }, nome);
  const t0 = Date.now();
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 });
  const st = await c.$eval('#cl-stato', (e) => e.textContent).catch(() => '');
  const n = await c.evaluate(() => window.__dbg.V.serie.reduce((a, s) => a + s.files.length, 0));
  ok('1 l\'esame si apre anche con un file che non risponde', n === files.length - 1, { n, tot: files.length, s: Math.round((Date.now() - t0) / 1000) });
  await c.waitForSelector('#dlg-saltati[open]', { timeout: 5000 }).catch(() => {});
  const dl = await c.evaluate(() => { const d = document.querySelector('#dlg-saltati'); return { open: !!d?.open, testo: d?.innerText || '' }; });
  ok('2 finestra con il file saltato, il suo nome e il consiglio per iCloud', dl.open && dl.testo.includes(nome) && /iCloud/.test(dl.testo) && /1 file non letti/.test(dl.testo), dl.testo.slice(0, 300));
  // «Riprova» con il file ora leggibile: l'esame si riapre completo
  await c.evaluate(() => { window.__nomeAppeso = '---'; });
  await c.click('#saltati-riprova');
  await c.waitForFunction((tot) => window.__dbg?.V?.serie?.reduce((a, s) => a + s.files.length, 0) === tot, files.length, { timeout: 60000 }).catch(() => {});
  const n2 = await c.evaluate(() => window.__dbg.V.serie.reduce((a, s) => a + s.files.length, 0));
  ok('2b «Riprova»: ora ci sono tutti i file', n2 === files.length, { n2, tot: files.length });
  ok('2c nessuna finestra dopo «Riprova» riuscito', await c.evaluate(() => !document.querySelector('#dlg-saltati')?.open));
  ok('3 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
