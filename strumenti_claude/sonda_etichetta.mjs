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
  const a = await (await b.newContext({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  for (const id of ['caso-tcia-014', 'caso-tcia-022', 'caso-tcia-004']) {
    await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/caso/' + id); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, id, { timeout: 60000 }); await a.waitForTimeout(3500);
    const y = await a.evaluate(() => document.querySelector('#canvas').getBoundingClientRect().y);
    await a.screenshot({ path: `/tmp/etich_${id}.png`, clip: { x: 0, y: y - 4, width: W, height: 120 } });
    console.log(id, await a.evaluate(() => JSON.stringify(window.__dbg.V.img.esame)));
  }
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
