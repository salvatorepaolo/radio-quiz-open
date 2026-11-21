import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19950 + Math.floor(Math.random() * 40), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
try {
  const a = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  a.on('console', (m) => { if (/SONDA/.test(m.text())) console.log(m.text()); });
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-118'); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 });
  await a.click('#modo-mpr'); await a.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#mpr-stato').hidden && document.querySelector('#vp-assiale canvas'), null, { timeout: 180000 });
  await a.selectOption('#mpr-preset', 'QR-angiography'); await a.waitForTimeout(500); await a.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 120000 });
  await a.waitForTimeout(1500);
  console.log(await a.evaluate(() => { const M = window.__dbg.MPR.modulo; return JSON.stringify(M._diagnosiVR?.()); }));
} catch (e) { console.log('eccezione', e.message); } finally { await b.close(); sim.kill(); }
