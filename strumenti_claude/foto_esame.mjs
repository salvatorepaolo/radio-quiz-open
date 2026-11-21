import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const b = await chromium.launch(); const err = [];
for (const [tema, w] of [['chiaro', 1300], ['scuro', 1300], ['chiaro', 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 }); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])'); await p.goto(B + '/?prova#/esame'); await p.waitForSelector('.es-hero'); await p.waitForTimeout(800);
  await p.screenshot({ path: `/Volumes/Caloggero/_viste/prova3d/esame_${tema}_${w}.png`, fullPage: true });
  await p.click('[data-sez="es-sez-libero"]'); await p.waitForTimeout(600); console.log(tema, w, 'hash dopo indice:', await p.evaluate(() => location.hash), 'largo', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
console.log('errori', JSON.stringify(err)); await b.close(); sim.kill();
