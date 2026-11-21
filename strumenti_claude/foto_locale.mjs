import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const b = await chromium.launch(); const err = [];
for (const [nome, w, h, tema] of [['scuro', 1440, 900, 'scuro'], ['chiaro', 1440, 900, 'chiaro'], ['tel', 390, 844, 'scuro']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); localStorage.setItem('rq-cl-privacy-1','1'); } catch {} }, tema);
  await p.goto(`http://localhost:${PORTA}/client/index.html`); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(500);
  await p.screenshot({ path: `/Volumes/Caloggero/_viste/prova3d/locale_${nome}.png`, fullPage: true });
  console.log(nome, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
console.log('errori', JSON.stringify(err)); await b.close(); sim.kill();
