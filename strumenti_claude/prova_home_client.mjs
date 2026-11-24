// prova_home_client.mjs (1.322): schermata iniziale del client (computer chiaro e scuro, telefono, inglese) + pulsanti degli esempi
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 23967, B = `http://localhost:${PORTA}`, OUT = '/Volumes/Caloggero/strumenti_claude/tmp_vtc/';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); })); process.on('exit', () => sim.kill());
const b = await chromium.launch(); let ko = 0;
for (const [nome, vp, tema, lingua] of [['chiaro', { width: 1440, height: 1500 }, 'chiaro', 'it'], ['scuro', { width: 1440, height: 1500 }, 'scuro', 'it'], ['telefono', { width: 390, height: 1900 }, 'chiaro', 'it'], ['inglese', { width: 1440, height: 1500 }, 'chiaro', 'en']]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, locale: lingua === 'en' ? 'en-GB' : 'it-IT' }), err = [];
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-cl-guida-1', '1'); localStorage.setItem('quiz-tema', t); if (l === 'en') localStorage.setItem('rq-lingua', 'en'); } catch {} }, [tema, lingua]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}home-${nome}.png` });
  const vis = await p.evaluate(() => ['#cl-esempio', '#cl-esempio-vetrino', '#cl-guida-apri', '#cl-esempio-formato', '#cl-cartella'].map((s) => [s, !!document.querySelector(s)]));
  if (vis.some(([, v]) => !v) || err.length) { ko++; console.log('KO', nome, JSON.stringify(vis), err.join(' | ')); } else console.log('OK', nome);
  await ctx.close();
}
await b.close(); process.exit(ko ? 1 : 0);
