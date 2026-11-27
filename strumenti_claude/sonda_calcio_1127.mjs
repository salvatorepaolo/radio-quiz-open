// sonda_calcio_1127.mjs: 3D Vascular prima/dopo la regola delle calcificazioni (foto in _viste/calcio_*.png)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19900 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); const errori = [];
const casi = (process.argv[2] || 'caso-tcia-118').split(','), voci = (process.argv[3] || 'QR-vascular').split(',');
const attendi = (a) => a.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 180000 });
try {
  const a = await (await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' })).newPage();
  a.on('pageerror', (e) => errori.push(e.message)); a.on('console', (m) => { if (m.type() === 'error') errori.push('console: ' + m.text().slice(0, 200)); });
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  for (const caso of casi) {
    await a.goto(B + `/?prova#/caso/${caso}`); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await a.waitForTimeout(800);
    // serie più lunga (di solito la angio-TC sottile)
    await a.click('#modo-mpr'); await a.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#mpr-stato').hidden && document.querySelector('#vp-assiale canvas'), null, { timeout: 180000 });
    await a.waitForTimeout(1000);
    for (const v of voci) for (const calcio of [false, true]) {
      await a.evaluate((c) => window.__dbg.MPR.modulo._opzioniVasi({ calcio: c }), calcio);
      await a.selectOption('#mpr-preset', 'mpr'); await a.waitForTimeout(300);
      const t0 = Date.now(); await a.selectOption('#mpr-preset', v); await a.waitForTimeout(500); await attendi(a); await a.waitForTimeout(1500);
      const d = await a.evaluate(() => ({ info: document.querySelector('#mpr-info').textContent, diag: window.__dbg.MPR.modulo._diagnosiCalcio() }));
      console.log(caso, v, calcio ? 'NUOVO' : 'vecchio', Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(d));
      await a.screenshot({ path: `/Volumes/Caloggero/_viste/calcio_${caso}_${v}_${calcio ? 'nuovo' : 'vecchio'}.jpg`, quality: 85, clip: { x: 0, y: 120, width: 1500, height: 830 } });
    }
  }
} catch (e) { console.log('eccezione', e.message); }
finally { console.log('errori', errori.slice(0, 6)); await b.close(); sim.kill(); }
