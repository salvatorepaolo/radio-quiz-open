// sonda_omp_ct.mjs: OMP sulle TC dell'encefalo (CQ500, CPTAC) aperte nel client
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19800 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = [];
const R = '/Volumes/Caloggero/_tcia_grezzi/testa/';
const cartelle = (process.argv[2] ? process.argv[2].split(',') : ['cq0/CQ500CT0 CQ500CT0/Unknown Study/CT PLAIN THIN', 'cq2/CQ500CT2 CQ500CT2/Unknown Study/CT 0.625mm', 'cq3/CQ500CT3 CQ500CT3/Unknown Study/CT PLAIN THIN', '1.3.6.1.4.1.14519.5.2.1.2099.3159.265218331544383384375657318210']);
try {
  for (const [n, c] of cartelle.entries()) {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' });
    await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
    const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message)); a.on('console', (m) => { if (/^OMP|raddrizza/.test(m.text())) console.log('   ', m.text().slice(0, 300)); });
    await a.goto(B + '/client/index.html'); await a.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    const files = fs.readdirSync(R + c).filter((f) => f.endsWith('.dcm')).map((f) => R + c + '/' + f);
    await a.setInputFiles('#cl-file', files); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 90000 });
    await a.waitForTimeout(6000);
    const r = await a.evaluate(async () => {
      const D = window.__dbg, V = D.V, si = D.P(0).sIdx;
      for (let i = 0; i < 100 && !V.serie[si]._omp; i++) await new Promise((r) => setTimeout(r, 200));   // automatico all'apertura
      const o = V.serie[si]._omp; if (!o) return { errore: 'nessun risultato automatico' };
      if (o.punti) await D.vaiPunto(o.punti.globi.map((_, c) => (o.punti.globi[0][c] + o.punti.globi[1][c] + o.punti.meati[0][c] + o.punti.meati[1][c]) / 4));
      return { dbg: V.ompDebug, ok: o.ok, testo: o.testo, punti: o.punti && JSON.stringify(o.punti, (k, v) => (typeof v === 'number' ? Math.round(v) : v)), on: document.querySelector('#btn-raddrizza').classList.contains('on') };
    });
    console.log(c.slice(0, 30), JSON.stringify(r)); fs.writeFileSync(`/tmp/omp_ct${n}.json`, JSON.stringify({ cartella: R + c, ...r.dbg }));
    await a.screenshot({ path: `/Volumes/Caloggero/_viste/omp_ct${n}.png`, clip: { x: 0, y: 150, width: 1100, height: 700 } });
    // OMP di nuovo: torna alle originali; e ancora: di nuovo OMP (dalla memoria)
    await a.click('#btn-raddrizza'); await a.waitForTimeout(1500);
    const off = await a.evaluate(() => ({ piano: window.__dbg.P(0).piano, on: document.querySelector('#btn-raddrizza').classList.contains('on') }));
    await a.click('#btn-raddrizza'); await a.waitForTimeout(2500);
    const on2 = await a.evaluate(() => ({ piano: window.__dbg.P(0).piano, on: document.querySelector('#btn-raddrizza').classList.contains('on') }));
    console.log('   spento:', JSON.stringify(off), 'riacceso:', JSON.stringify(on2));
    await ctx.close();
  }
} catch (e) { console.log('eccezione', e.message); }
finally { console.log('errori', errori.slice(0, 5)); await b.close(); sim.kill(); }
