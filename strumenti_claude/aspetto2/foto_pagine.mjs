// Fotografie delle pagine statiche e della pagina iniziale (telefono, tema scuro) per controllare il nuovo aspetto.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', OUT = process.argv[2] || '/tmp/pagine';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19731, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
const foto = async (url, nome, opz = {}, full = false) => {
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1300, height: 860 }, colorScheme: 'light', ...opz }); const p = await ctx.newPage();
  p.on('pageerror', (e) => err.push(nome + ': ' + e.message));
  if (opz.tema) await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); localStorage.setItem('rq-tema', t); } catch {} }, opz.tema);
  await p.goto(B + url); await p.waitForTimeout(1800);
  if (opz.tema) await p.evaluate((t) => document.documentElement.setAttribute('data-tema', t), opz.tema);
  await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${nome}.png`, fullPage: full }); await ctx.close(); console.log('foto', nome);
};
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));
await foto('/argomenti/figo-cervice.html', 'argomento');
await foto('/argomenti/', 'argomenti-indice');
await foto('/en/', 'en');
await foto('/#/', 'home-telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await foto('/#/', 'home-telefono-intera', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, true);
await foto('/#/', 'home-scuro', { colorScheme: 'dark', tema: 'scuro' });
console.log('errori:', err.length ? err.join(' | ') : 'nessuno');
await b.close(); sim.kill();
