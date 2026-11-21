import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19800 + Math.floor(Math.random() * 100), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
try {
  const c = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  c.on('pageerror', (e) => console.log('ERR', e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  const file = tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-001/serie');
  await c.setInputFiles('#cl-file', file); await c.waitForTimeout(5000); console.log('1', await c.evaluate(() => location.hash));
  await c.evaluate(() => { document.querySelector('#cl-chiudi').click(); }); await c.waitForTimeout(300);
  if (await c.$('#cl-chiudi-menu')) await c.click('#cl-chiudi-menu [data-tutti]'); await c.waitForTimeout(1000);
  console.log('2', await c.evaluate(() => location.hash), await c.evaluate(() => document.querySelector('#cl-file').value));
  await c.setInputFiles('#cl-file', file); await c.waitForTimeout(5000); console.log('3 stesso input', await c.evaluate(() => location.hash));
  await c.setInputFiles('#cl-file', []); await c.setInputFiles('#cl-file', file); await c.waitForTimeout(5000); console.log('4 dopo svuotamento', await c.evaluate(() => location.hash));
} finally { await b.close(); sim.kill(); }
