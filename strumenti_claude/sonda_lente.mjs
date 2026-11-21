// prova_v232.mjs: la barra degli strumenti non cambia numero di righe passando dal riquadro RX a quello TC (caso 014, varie larghezze)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19350 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-001'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-001', null, { timeout: 60000 }); await a.waitForTimeout(3000);
  await a.evaluate(() => document.querySelector('#barra-2d [data-tool="lente"]').click());
  const r = await a.$eval('#canvas', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  console.log('canvas', r, await a.evaluate(() => ({ n: window.__dbg.V.n, tool: window.__dbg.V.tool, cv: [...document.querySelectorAll('canvas')].map((c) => c.id + ':' + Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height)) })));
  await a.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await a.mouse.move(r.x + r.w / 2 + 5, r.y + r.h / 2 + 5); await a.waitForTimeout(300);
  console.log('lente hidden', await a.$eval('#lente', (e) => e.hidden), await a.evaluate(() => { const e = document.elementFromPoint(innerWidth / 4, innerHeight / 2); return e.id + ' ' + e.className; }));
  await a.screenshot({ path: '/tmp/lente.png' });
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
