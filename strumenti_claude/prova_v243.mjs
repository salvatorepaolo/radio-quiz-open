// prova_v243.mjs: «Copia nel referto» dalle scale porta anche i dati inseriti (non solo il risultato e i disegni)
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
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); await c.reload(); await c.waitForSelector('#vista-client:not([hidden])');
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  await c.evaluate(() => document.querySelector('#btn-scale').click()); await c.waitForTimeout(500);
  const scelta = await c.evaluate(() => { const s = document.querySelector('#scala-scelta'); const o = [...s.options].find((x) => /lungrads|lung/i.test(x.value)) || s.options[1]; s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return o.value; });
  await c.waitForTimeout(500);
  // compila: la prima scelta di ogni gruppo e 6 mm nei campi in millimetri
  await c.evaluate(() => { const nomi = new Set([...document.querySelectorAll('#scala-corpo input[type=radio]')].map((x) => x.name));
    for (const n of nomi) { const x = document.querySelector(`#scala-corpo input[name="${n}"]`); if (x && !x.closest('[hidden]')) { x.checked = true; x.dispatchEvent(new Event('input', { bubbles: true })); } }
    document.querySelectorAll('#scala-corpo input[type=number]').forEach((x) => { if (!x.closest('[hidden]')) { x.value = '6'; x.dispatchEvent(new Event('input', { bubbles: true })); } }); });
  await c.waitForTimeout(300);
  ok('1 risultato e pulsante «Copia nel referto»', await c.evaluate(() => !!document.querySelector('#scala-copia')), scelta);
  await c.click('#scala-copia'); await c.waitForSelector('#dlg-referto[open]', { timeout: 10000 }); await c.waitForTimeout(500);
  const ed = await c.evaluate(() => document.querySelector('#ref-testo').innerHTML);
  ok('2 nel referto: nome della scala, risultato ed elenco dei dati inseriti', /<b>/.test(ed) && /<ul>/.test(ed) && (ed.match(/<li>/g) || []).length >= 1, ed.slice(ed.indexOf('Lung') - 40, ed.indexOf('Lung') + 500));
  ok('3 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
