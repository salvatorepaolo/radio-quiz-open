// fette_calcio_1127.mjs caso: fette assiali dove la nuova regola aggiunge pezzi lontani dai vasi di prima
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19900 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const caso = process.argv[2], extra = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
const a = await (await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' })).newPage();
const attendi = () => a.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 240000 });
await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
await a.goto(B + `/?prova#/caso/${caso}`); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 90000 });
await a.click('#modo-mpr'); await a.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#mpr-stato').hidden && document.querySelector('#vp-assiale canvas'), null, { timeout: 240000 });
for (const c of [false, true]) {
  await a.evaluate((x) => window.__dbg.MPR.modulo._opzioniVasi({ calcio: x }), c);
  await a.selectOption('#mpr-preset', 'mpr'); await a.waitForTimeout(250); await a.selectOption('#mpr-preset', 'QR-vascular'); await a.waitForTimeout(400); await attendi();
  if (!c) await a.evaluate(() => window.__dbg.MPR.modulo._salvaVasi());
}
const conf = await a.evaluate(() => window.__dbg.MPR.modulo._confrontoVasi()); console.log(JSON.stringify(conf));
const ks = [...new Set([...conf.pezziLontani.slice(0, 4).map((x) => +x.split('@')[1]), ...extra])];
for (const k of ks) { const url = await a.evaluate((k) => window.__dbg.MPR.modulo._fettaConfronto(k), k);
  fs.writeFileSync(`/Volumes/Caloggero/_viste/fc_${caso}_${k}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('fetta', k); }
await b.close(); sim.kill();
