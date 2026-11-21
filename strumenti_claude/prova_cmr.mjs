// prova_browser.mjs: apre nel simulatore locale i casi indicati (anche bozze, come amministratore) e salva screenshot + controlli
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/browser/';
const CASI = (process.argv[2] || '090,091,092,094,095,096,097,098,099,100,101').split(',');
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}/?prova`, R = (n) => `http://localhost:${PORTA}/?prova&r=${n}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
log('simulatore pronto');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push('console: ' + m.text()); });
  await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  for (const [n, re, auto] of [['109', 'Cuore.*fetta 2/3', false], ['070', 'asse corto 5/10', true]]) {
    const id = 'caso-tcia-' + n; err.length = 0;
    await p.goto(R(n) + `#/caso/${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => { const cv = document.querySelector('#canvas'); return cv && cv.width > 50 && window.__dbg?.V?.img; }, null, { timeout: 40000 });
    await p.waitForTimeout(1500);
    await p.evaluate(async (src) => { const d = window.__dbg, r = new RegExp(src), si = d.V.serie.findIndex((x) => r.test(x.descrizione || '')); await d.selezionaSerie(si, d.V.attivo, { idx: 6 }); }, re);
    await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelector('#barra-2d [data-tool="cmr"]').click()); await p.waitForTimeout(500);
    if (auto) { await p.evaluate(async () => { await window.__dbg.autoCmr(); }); await p.waitForTimeout(1500); }
    else { await p.mouse.click(700, 400); await p.waitForTimeout(800); }
    await p.screenshot({ path: OUT + 'cmr_' + n + '.png' });
    const info = await p.evaluate(() => { const d = window.__dbg; return (d.V.pannelli || []).length; }).catch(() => null);
    log(n, 'pannello:', (await p.$eval('#cmr-pannello', (e) => e.textContent)).replace(/\s+/g, ' ').slice(0, 300), err.length ? 'ERRORI: ' + err.join(' | ') : 'nessun errore JS');
  }
} finally { await browser.close(); sim.kill(); log('FINE'); }
