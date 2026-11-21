// prova_v232.mjs: la barra degli strumenti non cambia numero di righe passando dal riquadro RX a quello TC (caso 014, varie larghezze)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19350 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-014'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-014', null, { timeout: 60000 }); await a.waitForTimeout(4000);
  const foto = () => a.evaluate(() => {
    const bar = document.querySelector('#preset').closest('.barra-unica') || document.querySelector('#barra-2d'); const r = {};
    bar.querySelectorAll('*').forEach((e, i) => { if (e.offsetParent === null) return; const q = e.getBoundingClientRect(); r[(e.id || e.className || e.tagName) + '#' + i] = Math.round(q.width) + 'x' + Math.round(q.height) + '|' + (e.children.length ? '' : (e.textContent || e.value || '').trim().slice(0, 20)); });
    return { h: Math.round(bar.getBoundingClientRect().height), r };
  });
  const zone = await a.evaluate(() => { const v = [...document.querySelectorAll('canvas')].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 150 && r.height > 100);
    const u = []; v.forEach((r) => { if (!u.some((q) => Math.abs(q.x - r.x) < 20 && Math.abs(q.y - r.y) < 20)) u.push({ x: r.x, y: r.y, width: r.width, height: r.height }); }); return u.sort((p, q) => p.x - q.x); });
  const alt = () => a.evaluate(() => { const e = document.querySelector('.barra-unica') || document.querySelector('#barra-2d'); return Math.round(e.getBoundingClientRect().height); });
  for (const L of [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800]) {
    await a.setViewportSize({ width: L, height: 900 }); await a.waitForTimeout(400);
    const pts = await a.evaluate(() => { const q = (document.querySelector('.barra-unica') || document.querySelector('#barra-2d')).getBoundingClientRect(); const y = q.bottom + 250; return [[q.left + q.width / 4, y], [q.left + q.width * 3 / 4, y]]; });
    const h = [];
    for (let k = 0; k < 4; k++) { const p = pts[k % pts.length]; await a.mouse.move(p[0], p[1]); await a.mouse.wheel(0, 120); await a.waitForTimeout(250); await a.mouse.click(p[0], p[1]); await a.waitForTimeout(300); h.push((await alt()) + (await a.evaluate(() => 'r' + window.__dbg.V.attivo))); }
    const alte = new Set(h.map((x) => parseInt(x))); if (alte.size !== 1) ko++;
    console.log(alte.size === 1 ? 'OK ' : 'KO ', L, 'altezze della barra', h.join(' '));
  }
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
