// prova_v239.mjs: client, dati anagrafici del paziente sulla linguetta dell'esame (accesi di base, si spengono dal menu ⋯)
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
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 });
  await c.waitForFunction(() => document.querySelector('#tab-studi .tab-paz'), null, { timeout: 15000 }).catch(() => {});
  const t1 = await c.evaluate(() => ({ tabs: [...document.querySelectorAll('#tab-studi button[data-n]')].map((b) => b.innerText), paz: [...document.querySelectorAll('#tab-studi .tab-paz')].map((x) => x.textContent) }));
  ok('1 linguette con i dati del paziente', t1.paz.length === t1.tabs.length && t1.paz.length >= 1 && t1.paz.every((x) => x.startsWith('👤 ')), t1);
  await c.evaluate(() => { document.querySelector('#cl-altro').open = true; }); await c.uncheck('#cl-paz-tab');
  const t2 = await c.evaluate(() => document.querySelectorAll('#tab-studi .tab-paz').length);
  ok('2 spenti dal menu: spariscono e la scelta si ricorda', t2 === 0 && await c.evaluate(() => localStorage.getItem('rq-cl-paz-tab')) === '0', t2);
  await c.check('#cl-paz-tab');
  ok('3 riaccesi', await c.evaluate(() => document.querySelectorAll('#tab-studi .tab-paz').length) >= 1);
  ok('4 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
