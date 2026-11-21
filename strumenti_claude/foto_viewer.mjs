// foto_viewer.mjs: pagina del caso (visualizzatore) in chiaro, scuro e telefono
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/', SUFF = process.argv[2] || 'prima';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
try {
  for (const [tema, w, h] of [['chiaro', 1500, 950], ['scuro', 1500, 950], ['chiaro', 390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', (e) => err.push(e.message));
    await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
    await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
    await p.waitForSelector('#vista-elenco:not([hidden])');
    await p.goto(B + '/?prova#/caso/caso-tcia-012'); await p.waitForFunction(() => window.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1500);
    await p.screenshot({ path: OUT + `viewer_${SUFF}_${tema}_${w}.png` });
    await p.goto(B + '/?prova#/gestione-casi'); await p.waitForSelector('#gc-lista tr'); await p.waitForTimeout(600); await p.screenshot({ path: OUT + `gcasi_${SUFF}_${tema}_${w}.png` });
    console.log(tema, w, 'largo', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); await p.close();
  }
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
