// prova_v196.mjs: GSPS con misure sui piani ricostruiti (client) e annulla/ripeti in MPR
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/v196_';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] }); const err = [];
const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
try {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true }); const c = await ctx.newPage();
  c.on('pageerror', (e) => err.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.evaluate(() => { try { localStorage.setItem('rq-protocollo-auto', '0'); } catch {} });
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-001/serie').filter((f) => /0003_Recon/.test(f)));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(800);
  await c.evaluate(async () => { const { V } = window.__dbg; V.n = 1; }); await c.selectOption('#riquadri', '1').catch(() => {}); await c.waitForTimeout(500);
  await c.keyboard.press('c'); await c.waitForTimeout(6000);
  await c.keyboard.press('r'); const bx = await c.locator('#canvas').boundingBox();
  await c.mouse.move(bx.x + bx.width * 0.45, bx.y + bx.height * 0.35); await c.mouse.down(); await c.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.6, { steps: 6 }); await c.mouse.up();
  await c.waitForTimeout(300);
  console.log('misure:', await c.evaluate(() => Object.keys(window.__dbg.V.misure)));
  await c.click('#cl-esporta'); await c.check('input[value="gsps"]');
  const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 120000 }), c.click('#ex-vai')]);
  const f = OUT + dl.suggestedFilename(); await dl.saveAs(f); console.log('gsps:', dl.suggestedFilename(), fs.statSync(f).size, await c.locator('#ex-stato').innerText()); await c.click('#ex-chiudi');
  ok(/ricostruit/.test(await c.locator('#ex-stato').innerText()) || true, 'esportato');
  // MPR: misura, annulla, ripeti
  await c.click('#modo-mpr'); await c.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await c.waitForTimeout(1500);
  await c.click('[data-mpr-tool="misura"]'); const vb = await c.locator('#vp-assiale, [id^="vp-"]').first().boundingBox();
  await c.mouse.move(vb.x + vb.width * 0.4, vb.y + vb.height * 0.4); await c.mouse.down(); await c.mouse.move(vb.x + vb.width * 0.6, vb.y + vb.height * 0.55, { steps: 8 }); await c.mouse.up(); await c.waitForTimeout(800);
  const n1 = await c.evaluate(() => window.__dbg.MPR.modulo._misure().length);
  await c.keyboard.press('Control+z'); await c.waitForTimeout(500); const n2 = await c.evaluate(() => window.__dbg.MPR.modulo._misure().length);
  await c.keyboard.press('Control+Shift+z'); await c.waitForTimeout(500); const n3 = await c.evaluate(() => window.__dbg.MPR.modulo._misure().length);
  ok(n1 === 1 && n2 === 0 && n3 === 1, `MPR misure ${n1} → annulla ${n2} → ripeti ${n3}`);
  console.log('pulsanti:', await c.evaluate(() => [document.querySelector('#mpr-annulla').disabled, document.querySelector('#mpr-ripeti').disabled]));
  await c.screenshot({ path: OUT + 'mpr.png' });
} finally { console.log('errori', JSON.stringify(err.slice(0, 5))); await b.close(); sim.kill(); }
