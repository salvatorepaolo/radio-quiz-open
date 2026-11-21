// foto_pagine.mjs: tutte le pagine principali (per il ritocco grafico)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/pag_', SUFF = process.argv[2] || 'prima', TEMA = process.argv[3] || 'chiaro';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
try {
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } }); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, TEMA);
  await p.goto(B + '/#/'); await p.waitForSelector('#vista-accesso:not([hidden])'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}accesso_${SUFF}.png`, fullPage: true });
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])');
  for (const r of ['analisi', 'classi', 'percorsi', 'revisione', 'editor/caso-tcia-001', 'nuovo', 'errore', 'confronto', 'aiuto', 'caso/caso-tcia-001']) {
    try { await p.goto(B + '/?prova#/' + r); await p.waitForTimeout(r.startsWith('caso') ? 3000 : 1500);
      await p.screenshot({ path: `${OUT}${r.replace(/\/.*/, '')}_${SUFF}.png`, fullPage: !r.startsWith('caso') });
      console.log(r, 'largo', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); } catch (e) { console.log(r, 'ERR', e.message); }
  }
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
