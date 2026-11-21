// prova_browser.mjs: apre nel simulatore locale i casi indicati (anche bozze, come amministratore) e salva screenshot + controlli
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/browser/';
const CASI = (process.argv[2] || '090,091,092,094,095,096,097,098,099,100,101').split(',');
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}/?prova`, R = (n) => `http://localhost:${PORTA}/?prova&r=${n}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
log('simulatore pronto');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push('console: ' + m.text()); });
  await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  for (const n of CASI) {
    const id = 'caso-tcia-' + n; err.length = 0;
    try {
      await p.goto(R(n) + `#/caso/${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => { const cv = document.querySelector('#canvas'); return cv && cv.width > 50 && window.__dbg?.V?.img; }, null, { timeout: 40000 });
      await p.waitForFunction(() => !/Caricamento|Scaricamento/.test(document.querySelector('#vista-caso')?.innerText || ''), null, { timeout: 40000 }).catch(() => {}); await p.waitForTimeout(1500);
      const st = await p.evaluate(() => [...document.querySelectorAll('canvas')].filter((c) => c.width > 50 && c.offsetParent).map((c) => {
        let ctx; try { ctx = c.getContext('2d'); } catch { return { id: c.id, w: c.width, tipo: 'gl' }; }
        if (!ctx) return { id: c.id, w: c.width, tipo: 'gl' };
        const d = ctx.getImageData(0, 0, c.width, c.height).data; let n = 0, s = 0, s2 = 0, k = 0;
        for (let i = 0; i < d.length; i += 64) { const v = d[i]; k++; s += v; s2 += v * v; if (v > 15) n++; }
        const m = s / k; return { id: c.id, w: c.width, h: c.height, pieni: +(n / k).toFixed(2), media: Math.round(m), ds: Math.round(Math.sqrt(s2 / k - m * m)) };
      }));
      const V = await p.evaluate(() => { const V = window.__dbg.V; return { wc: V.wc, ww: V.ww, serie: V.serie ?? V.attivo, riquadri: document.querySelectorAll('.riquadro, .vp').length }; });
      await p.screenshot({ path: OUT + n + '.png' });
      log(n, 'OK', JSON.stringify(st), JSON.stringify(V), err.length ? 'ERRORI: ' + err.join(' | ') : 'nessun errore JS');
    } catch (e) {
      try { await p.screenshot({ path: OUT + n + '.png' }); } catch {}
      log(n, 'PROBLEMA', e.message.split('\n')[0], err.join(' | '));
    }
  }
} finally { await browser.close(); sim.kill(); log('FINE'); }
