// blocchi della pagina (long task) durante la ricostruzione coronale e l'apertura dell'MPR su una TC da 433 immagini
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok_) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok_(); }));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  p.on('pageerror', (e) => log('PAGEERROR', e.message)); p.on('console', (m) => { if (/worker/i.test(m.text())) log('console', m.text()); });
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-119'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 40000 });
  await p.waitForFunction(() => window.__dbg.P().frames.every((f) => f.buf), null, { timeout: 60000 });
  await p.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: false }); });
  const t0 = Date.now(); await p.keyboard.press('c');
  await p.waitForFunction(() => window.__dbg.P().piano === 'coronale' && window.__dbg.P().img, null, { timeout: 60000 });
  const lt = await p.evaluate(() => window.__lt.slice());
  log('coronale', Date.now() - t0, 'ms · blocco più lungo', Math.round(Math.max(0, ...lt)), 'ms · blocchi >200 ms', lt.filter((x) => x > 200).length, '· worker', await p.evaluate(() => typeof Worker));
  // scorrimento: tempo medio per immagine
  await p.keyboard.press('a'); await p.waitForTimeout(1500);
  const sc = await p.evaluate(async () => { const d = window.__dbg, t = performance.now(); for (let i = 0; i < 40; i++) await d.mostra(d.P().idx + 1); return (performance.now() - t) / 40; });
  log('scorrimento: ms per immagine', sc.toFixed(1));
  await p.evaluate(() => { window.__lt = []; });
  const t1 = Date.now(); await p.click('#modo-mpr');
  await p.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 });
  const lt2 = await p.evaluate(() => window.__lt.slice());
  log('MPR', Date.now() - t1, 'ms · blocco più lungo', Math.round(Math.max(0, ...lt2)), 'ms');
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
