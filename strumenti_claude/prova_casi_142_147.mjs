// prova_casi_142_147.mjs: apre i 6 casi del 21/11/2026 nel simulatore (amministratore), controlla che l'immagine si carichi
// senza errori JavaScript, che la «vista» del caso porti sull'immagine indicata e fotografa ogni caso in foto_1274/caso_NNN.png
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23611, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), err = []; let ko = 0;
const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => err.push(e.message));
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
for (const n of [142, 143, 144, 145, 146, 147]) {
  const id = `caso-tcia-${n}`;
  try {
    await p.goto(B + `/?prova#/caso/${id}`);
    await p.waitForFunction((i) => window.__dbg?.V?.caso?.id === i && window.__dbg.P(0)?.img, id, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const V = window.__dbg.V; return { titolo: V.caso.titolo, serie: V.serie?.length ?? V.caso?.serie?.length, visibile: V.caso.visibile }; });
    await p.screenshot({ path: `/Volumes/Caloggero/strumenti_claude/foto_1274/caso_${n}.png` });
    console.log(`OK  ${id}: ${r.titolo.slice(0, 60)} · serie ${r.serie} · visibile ${r.visibile}`);
  } catch (e) { ko++; console.log(`KO  ${id}: ${e.message.split('\n')[0]}`); }
}
console.log(err.length ? 'errori JS: ' + err.join(' | ') : 'nessun errore JS'); await b.close(); sim.kill(); process.exit(ko || err.length ? 1 : 0);
