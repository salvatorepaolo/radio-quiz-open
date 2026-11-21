// prova_v216.mjs: mappa ADC calcolata dalle DWI (caso 079: b 20 e b 800, con la mappa ADC dell'apparecchio per il confronto)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19000 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-079'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-079', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  ok('1 pulsante ADC visibile in una RM con DWI', await a.evaluate(() => !document.querySelector('#btn-adc').hidden));
  const idx = await a.evaluate(() => { const d = window.__dbg; return { b800: d.V.serie.findIndex((s) => /DWI b 800/.test(s.descrizione)), adc: d.V.serie.findIndex((s) => /^ADC/.test(s.descrizione)) }; });
  await a.evaluate(async (i) => { const d = window.__dbg; d.attiva(0); await d.selezionaSerie(i.b800, 0); }, idx); await a.waitForTimeout(1500);
  await a.evaluate(() => document.querySelector('#menu-misure').open = true);
  await a.click('#btn-adc'); await a.waitForFunction(() => window.__dbg.P(0).adc && window.__dbg.P(0).img?.adc, null, { timeout: 60000 }); await a.waitForTimeout(800);
  const info = await a.evaluate(() => { const p = window.__dbg.P(0); return { bs: p.img.adc.bs, wc: p.wc, idx: p.idx, pos: p.img.ipp }; });
  ok('2 mappa ADC calcolata con b 20 e 800', JSON.stringify(info.bs) === '[20,800]', info);
  // confronto con la mappa dell'apparecchio: mediana nelle zone di tessuto (ADC dell'apparecchio tra 300 e 3000)
  const cfr = await a.evaluate(async (i) => {
    const d = window.__dbg, p = d.P(0), mia = p.img;
    // stessa fetta nella serie ADC dell'apparecchio
    const s = d.V.serie[i.adc]; const fr = s.files.map((f) => ({ url: `/casi/${d.V.caso.id}/${f}` }));
    let best = null;
    for (let k = 0; k < fr.length; k++) { const raw = await fetch(fr[k].url).then((r) => r.arrayBuffer()); const im = d.decodificaDicom(raw); const dz = Math.abs(im.ipp[2] - mia.ipp[2]); if (!best || dz < best.dz) best = { im, dz }; }
    const ap = best.im, rapp = [];
    if (ap.rows !== mia.rows || ap.cols !== mia.cols) return { diversa: [ap.rows, ap.cols, mia.rows, mia.cols] };
    for (let q = 0; q < mia.pix.length; q += 3) { const v = ap.pix[q] * (ap.slope ?? 1) + (ap.inter ?? 0); if (v > 300 && v < 3000 && mia.pix[q] > 0) rapp.push(mia.pix[q] / v); }
    rapp.sort((x, y) => x - y);
    return { n: rapp.length, mediana: rapp[rapp.length >> 1], p25: rapp[rapp.length >> 2], p75: rapp[(rapp.length * 3) >> 2], dz: best.dz };
  }, idx);
  ok('3 ADC calcolata vicina a quella dell\'apparecchio (mediana del rapporto 0,8-1,25)', cfr.n > 200 && cfr.mediana > 0.8 && cfr.mediana < 1.25, cfr);
  // ROI con l'unità
  const roi = await a.evaluate(() => { const d = window.__dbg, p = d.P(0), im = p.img, k = `${p.sIdx}:${p.idx}`; (d.V.misure[k] = d.V.misure[k] || []).push({ tipo: 'roi', a: { x: im.cols * 0.45, y: im.rows * 0.45 }, b: { x: im.cols * 0.55, y: im.rows * 0.55 } }); d.disegna(); return true; });
  await a.waitForTimeout(400);
  await a.evaluate(() => document.querySelector('#menu-misure').open = true); await a.click('#btn-adc'); await a.waitForTimeout(800);
  ok('4 secondo clic: si torna alla DWI', await a.evaluate(() => !window.__dbg.P(0).adc && !window.__dbg.P(0).img?.adc));
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
