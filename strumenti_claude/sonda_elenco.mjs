// sonda_elenco.mjs: cosa pesa nel caricamento della pagina iniziale
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
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = []; a.on('pageerror', (e) => errori.push(e.message));
  const reqs = [];
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage();
  p.on('requestfinished', async (r) => { try { const s = await r.sizes(); const t = r.timing(); reqs.push({ u: r.url().replace(B, ''), kb: Math.round((s.responseBodySize) / 1024), ms: Math.round(t.responseEnd) }); } catch {} });
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000');
  const t0 = Date.now(); reqs.length = 0;
  await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])'); await p.waitForTimeout(8000);
  console.log('elenco pronto in', Date.now() - t0, 'ms');
  const tot = reqs.reduce((a, r) => a + r.kb, 0); console.log('richieste', reqs.length, 'kB totali', tot);
  reqs.sort((a, b) => b.kb - a.kb).slice(0, 15).forEach((r) => console.log(r.kb + ' kB', r.ms + ' ms', r.u.slice(0, 100)));
  const dom = await p.evaluate(() => ({ nodi: document.querySelectorAll('*').length, card: document.querySelectorAll('.card').length, img: document.querySelectorAll('#vista-elenco img, #vista-elenco canvas').length }));
  console.log('DOM', JSON.stringify(dom));
  const g = await p.evaluate(async () => { const t = performance.now(); const r = await fetch('/api/casi'); const x = await r.text(); return { kb: Math.round(x.length / 1024), ms: Math.round(performance.now() - t), n: JSON.parse(x).length, chiavi: Object.keys(JSON.parse(x)[0]) }; });
  console.log('/api/casi', JSON.stringify(g));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
