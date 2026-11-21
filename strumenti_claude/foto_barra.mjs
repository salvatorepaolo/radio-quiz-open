// foto_barra.mjs: righe occupate dalla barra degli strumenti del visualizzatore (amministratore e studente) a varie
// larghezze; schermate in foto_1274/barra_<larghezza>.png. Uso: CASO=caso-tcia-031 node foto_barra.mjs
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23497, B = `http://localhost:${PORTA}`, CASO = process.env.CASO || 'caso-tcia-007';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
process.on('uncaughtException', (e) => { console.log('KO  ' + e.message.split('\n')[0]); sim.kill(); process.exit(1); });
const b = await chromium.launch(), err = [];
for (const [w, h] of [[1250, 760], [1440, 900], [1920, 1080]]) {
  const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: w, height: h } })).newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + `/?prova#/caso/${CASO}`); await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(0)?.img, CASO, { timeout: 60000 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const bar = document.querySelector('#vista-caso .barra-unica'), rb = bar.getBoundingClientRect(), tops = new Set();
    for (const e of bar.querySelectorAll('button, select, summary, label, a')) { const r = e.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(e).visibility !== 'hidden') tops.add(Math.round(r.top + r.height / 2)); }
    const st = document.querySelector('#stage').getBoundingClientRect(); const c = [...tops].sort((a, b) => a - b).filter((t, i, a) => !i || t - a[i - 1] > 14); return { righe: c.length, alt: Math.round(rb.height), stage: Math.round(st.height) }; });
  console.log(`${w}×${h}: barra ${r.alt} px, ${r.righe} righe di pulsanti; immagine alta ${r.stage} px`);
  await p.screenshot({ path: `/Volumes/Caloggero/strumenti_claude/foto_1274/barra_${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 420) } });
}
console.log(err.length ? 'errori JS: ' + err.join(' | ') : 'nessun errore JS'); await b.close(); sim.kill();
