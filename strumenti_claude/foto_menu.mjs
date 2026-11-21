// foto_menu.mjs (1.279): schermate del menu principale e delle pagine Allenamento / I miei progressi (simulatore, studente)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23495, B = `http://localhost:${PORTA}`, OUT = process.env.OUT || '/Volumes/Caloggero/strumenti_claude/foto_1274';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
process.on('uncaughtException', (e) => { console.log('KO  ' + e.message.split('\n')[0]); sim.kill(); process.exit(1); });
const b = await chromium.launch(), err = [];
const pa = await (await b.newContext()).newPage();
await pa.goto(B + '/?prova#/'); await pa.waitForSelector('[data-vai="codice"]'); await pa.click('[data-vai="codice"]'); await pa.fill('#codice', 'admin-test-0000'); await pa.press('#codice', 'Enter');
await pa.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
const cod = await pa.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Prova', ruolo: 'specializzando' }) })).json()).codice);
for (const [nome, w, h] of [['desk', 1440, 900], ['tel', 390, 844]]) {
  const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: w, height: h } })).newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/menu_${nome}_home.png` });
  for (const v of ['allenamento', 'progressi', 'vetrini']) { await p.goto(B + `/?prova#/${v}`); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/menu_${nome}_${v}.png` }); }
}
console.log(err.length ? 'errori JS: ' + err.join(' | ') : 'nessun errore JS'); await b.close(); sim.kill();
