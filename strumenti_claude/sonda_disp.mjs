import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19200 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
const a = await (await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' })).newPage();
await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
for (const id of (process.env.CASI_P || 'caso-tcia-004,caso-tcia-007,caso-tcia-027,caso-tcia-064,caso-tcia-079').split(',')) {
  await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/caso/' + id); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, id, { timeout: 60000 }).catch(() => {}); await a.waitForTimeout(4000);
  const r = await a.evaluate(() => { const d = window.__dbg; return { n: d.V.n, serie: d.V.pannelli.slice(0, d.V.n).map((p) => d.V.serie[p.sIdx]?.descrizione?.slice(0, 30)), sincro: d.V.sincro, ws: [...document.querySelectorAll('#ws-fasi button')].map((x) => x.textContent), disp: (d.V.caso.disposizione || []).length, riq: d.V.caso.riquadri, tutte: d.V.serie.map((s) => s.descrizione.slice(0, 25)) }; });
  console.log(id, JSON.stringify(r));
}
await b.close(); sim.kill(); process.exit(0);
