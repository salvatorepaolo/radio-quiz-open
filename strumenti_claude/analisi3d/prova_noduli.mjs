// prova_noduli.mjs: nel simulatore locale apre i casi in MPR, chiede «IA: misure automatiche»,
// controlla l'elenco dei noduli della seconda lettura e il pulsante «vai», salva gli screenshot.
// Uso: node prova_noduli.mjs 034,001,025 [gruppo IA per il 3D, es. vasi]
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/strumenti_claude/analisi3d/viste/'; fs.mkdirSync(OUT, { recursive: true });
const CASI = (process.argv[2] || '034').split(','), GRUPPO = process.argv[3] || '';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}/?prova`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
log('simulatore pronto');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const esito = {};
try {
  const p = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push('console: ' + m.text()); });
  await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  for (const n of CASI) {
    const id = 'caso-tcia-' + n; err.length = 0; const r = esito[n] = {};
    try {
      await p.goto(`http://localhost:${PORTA}/?prova&r=${n}#/caso/${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1500);
      await p.click('#modo-mpr');
      await p.waitForSelector('#mpr-seg optgroup[data-ia] option[value="ia:misure"]', { state: 'attached', timeout: 180000 });
      await p.selectOption('#mpr-seg', 'ia:misure');
      await p.waitForFunction(() => /Misure automatiche/.test(document.querySelector('#mpr-info')?.innerText || ''), null, { timeout: 120000 });
      await p.waitForTimeout(800);
      r.testo = (await p.innerText('#mpr-info')).slice(0, 3000);
      r.bottoni = await p.$$eval('.ia-nodulo', (b) => b.map((x) => x.textContent));
      await p.screenshot({ path: `${OUT}${n}_misure.png` });
      if (r.bottoni.length) {
        const prima = await p.evaluate(() => window.__dbg?.MPR?.modulo?.centroMirino?.());
        await p.click('.ia-nodulo >> nth=0'); await p.waitForTimeout(1500);
        const dopo = await p.evaluate(() => window.__dbg?.MPR?.modulo?.centroMirino?.());
        const atteso = await p.$eval('.ia-nodulo >> nth=0', (b) => b.dataset.p.split(',').map(Number));
        // distanza di ciascun piano MPR (fuoco e normale della camera) dal punto atteso: deve essere ~0
        const piani = await p.evaluate((w) => { const d = window.__dbg?.MPR?.modulo?._diagnosi?.() || {}; const o = {};
          for (const [k, v] of Object.entries(d)) if (v?.fuoco && v?.normale) o[k] = +Math.abs(v.normale.reduce((s, n, i) => s + n * (w[i] - v.fuoco[i]), 0)).toFixed(1);
          return o; }, atteso);
        r.mirino = { prima, dopo, atteso, distanza_mm: dopo ? Math.hypot(...dopo.map((v, i) => v - atteso[i])) : null, piani };
        await p.screenshot({ path: `${OUT}${n}_vai.png` });
      }
      if (GRUPPO) {
        await p.selectOption('#mpr-seg', `ia:g:${GRUPPO}`); await p.waitForTimeout(30000);
        await p.screenshot({ path: `${OUT}${n}_${GRUPPO}.png` });
      }
      r.errori = [...err];
      log(n, 'ok', JSON.stringify({ bottoni: r.bottoni, mirino: r.mirino, errori: r.errori }));
    } catch (e) { r.errore = e.message; r.errori = [...err]; log(n, 'ERRORE', e.message); await p.screenshot({ path: `${OUT}${n}_errore.png` }).catch(() => {}); }
  }
} finally { await browser.close(); sim.kill(); fs.writeFileSync(OUT + 'esito.json', JSON.stringify(esito, null, 1)); }
