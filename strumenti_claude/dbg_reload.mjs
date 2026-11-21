import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18950 + Math.floor(Math.random() * 40), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
try {
  const ctx = await b.newContext(); const c = await ctx.newPage(); c.on('close', () => console.log('CHIUSA')); c.on('crash', () => console.log('CRASH'));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])'); console.log('1 aperta');
  await c.reload(); await c.waitForTimeout(2000); console.log('2 ricaricata home', await c.evaluate(() => location.href));
  await c.evaluate(() => { location.hash = '#/caso/locale'; }); await c.waitForTimeout(500);
  await c.reload(); await c.waitForTimeout(3000); console.log('3 ricaricata con hash caso', await c.evaluate(() => location.href));
} catch (e) { console.log('ERR', e.message.slice(0, 200)); } finally { await b.close(); sim.kill(); }
