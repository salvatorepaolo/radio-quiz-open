// 28/11: fotografie del visualizzatore scuro e chiaro (simulatore, caso 021)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), BASE = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const ck = (await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) })).headers.get('set-cookie').split(';')[0];
const [n, v] = ck.split('=');
const b = await chromium.launch(); const err = [];
for (const [nome, tema, w, h] of [['chiaro', 'chiaro', 1440, 900], ['temascuro', 'scuro', 1440, 900], ['tel', 'chiaro', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5, locale: 'it-IT' });
  await ctx.addCookies([{ name: n, value: v, url: BASE }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
  await p.goto(BASE + '/#/caso/caso-tcia-021'); await p.waitForSelector('#vista-caso:not([hidden]) #canvas', { timeout: 30000 }); await p.waitForTimeout(4000);
  if (nome === 'chiaro') await p.screenshot({ path: '/Volumes/Caloggero/_viste/revisione/vis_scuro.png' });
  const vis = await p.$('#btn-vis-tema'); console.log(nome, 'pulsante visibile', vis ? await vis.isVisible() : 'manca');
  if (vis && await vis.isVisible()) await vis.click();
  else await p.evaluate(() => document.querySelector('#btn-vis-tema')?.click());
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/Volumes/Caloggero/_viste/revisione/vis_${nome}.png` });
  console.log(nome, await p.evaluate(() => [document.documentElement.dataset.vis, localStorage.getItem('quiz-vis-tema'), getComputedStyle(document.querySelector('#vista-caso>.viewer')).backgroundColor]));
  await p.reload(); await p.waitForSelector('#vista-caso:not([hidden]) #canvas', { timeout: 30000 });
  console.log(nome, 'dopo ricarica', await p.evaluate(() => document.documentElement.dataset.vis));
  await ctx.close();
}
console.log('errori', JSON.stringify(err)); await b.close(); sim.kill();
