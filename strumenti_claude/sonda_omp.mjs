// sonda_omp.mjs: piano orbito-meatale sulle RM dell'encefalo dei casi pubblici (e una TC dal client): punti trovati e immagini
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19700 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = [];
const casi = (process.argv[2] || 'caso-tcia-057,caso-tcia-058,caso-tcia-059,caso-tcia-060,caso-tcia-061,caso-tcia-062,caso-tcia-063,caso-tcia-064,caso-tcia-065,caso-tcia-066,caso-tcia-020').split(',');
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' });
  const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message)); a.on('console', (m) => { if (/^OMP|raddrizza/.test(m.text())) console.log('   ', m.text().slice(0, 200)); });
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  for (const caso of casi) {
    await a.goto(B + `/?prova#/caso/${caso}`); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, caso, { timeout: 60000 });
    await a.waitForTimeout(1500);
    const r = await a.evaluate(async () => {
      const D = window.__dbg, V = D.V;
      const si = V.serie.map((s, i) => [s, i]).filter(([s]) => /3D|mpr|t1|spgr/i.test(s.descrizione) && s.files.length >= 80).map(([, i]) => i)[0] ?? V.serie.findIndex((s) => s.files.length >= 80);
      if (si < 0) return { errore: 'nessuna serie 3D' };
      if (V.serie[si]) delete V.serie[si]._omp;
      if (D.P(0).sIdx !== si || D.P(0).piano) { await D.selezionaSerie(si, 0); }
      for (let i = 0; i < 50 && !D.P(0).img; i++) await new Promise((r) => setTimeout(r, 100));
      const t0 = performance.now(); await D.raddrizzaEncefalo(0); const serieDir = V.serie[si].files[0].split('/')[1];
      const o = V.serie[si]._omp; if (!o) return { errore: 'nessun risultato', serie: V.serie[si].descrizione };
      if (o.punti) await D.vaiPunto(o.punti.globi.map((_, c) => (o.punti.globi[0][c] + o.punti.globi[1][c] + o.punti.meati[0][c] + o.punti.meati[1][c]) / 4));
      const dbg = V.ompDebug; return { serieDir, dbg, serie: V.serie[si].descrizione, ok: o.ok, testo: o.testo, punti: o.punti && JSON.stringify(o.punti, (k, v) => (typeof v === 'number' ? Math.round(v) : v)), ms: Math.round(performance.now() - t0) };
    });
    console.log(caso, r.ok, r.testo); if (r.dbg) fs.writeFileSync(`/tmp/omp_${caso}.json`, JSON.stringify({ cartella: '/Volumes/Caloggero/piattaforma-quiz/casi-free/' + caso + '/serie/' + (r.serieDir || ''), ...r.dbg }));
    await a.screenshot({ path: `/Volumes/Caloggero/_viste/omp_${caso}.png`, clip: { x: 0, y: 200, width: 1100, height: 600 } });
  }
} catch (e) { console.log('eccezione', e.message); }
finally { console.log('errori', errori.slice(0, 5)); await b.close(); sim.kill(); }
