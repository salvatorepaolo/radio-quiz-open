// prova_vetrini_esempio.mjs: client (visualizzatore DICOM), «Prova con un vetrino di esempio» per ogni formato dell'elenco.
// I vetrini sono in cloud/web/esempi/vetrini (preparati con esempi_vetrini/prepara.py, non in git) e si leggono dal
// simulatore a pezzi come da CloudFront. Per ogni formato: si apre, calibrazione presente, tessere al livello pieno, nessun errore.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23761, B = process.env.SITO || `http://localhost:${PORTA}`;   // SITO=https://radio-quiz.it: sul sito vero
const SOLO = process.argv.slice(2);
const elenco = JSON.parse(fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/web/esempi/vetrini/elenco.json', 'utf8')).filter((v) => !SOLO.length || SOLO.includes(v.id));
const sim = process.env.SITO ? null : spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
if (sim) await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1300, height: 850 }, locale: 'it-IT' }), err = [];
await ctx.addInitScript(() => { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-cl-guida-1', '1'); });
const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
const opzioni = [];
try {
  for (const v of elenco) {
    await p.goto(B + '/client/index.html'); await p.waitForSelector('#cl-esempio-box:not([hidden])');
    if (!opzioni.length) opzioni.push(...await p.$$eval('#cl-esempio-formato option', (o) => o.map((x) => x.value)));
    esito(opzioni.includes(v.id), `${v.formato}: voce nel menu dei vetrini di esempio`);
    await p.selectOption('#cl-esempio-formato', v.id);
    const zipNascosto = await p.$eval('#cl-esempio-vetrino-scarica', (a) => a.hidden);
    const t0 = Date.now(); await p.click('#cl-esempio-vetrino');
    const aperto = await p.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 120000 }).then(() => true, () => false);
    esito(aperto && zipNascosto, `${v.formato}: si apre dal sito`, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (!aperto) { console.log('   ', await p.$eval('#cl-stato', (e) => e.textContent).catch(() => '')); continue; }
    await p.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(500);
    // vetrino intero non nero né vuoto: variazione dei pixel nel riquadro
    const ds = await p.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let t = 0, s = 0, s2 = 0;
      for (let i = 0; i < d.length; i += 40) { const x = (d[i] + d[i + 1] + d[i + 2]) / 3; t++; s += x; s2 += x * x; } const m = s / t; return Math.sqrt(Math.max(0, s2 / t - m * m)); });
    esito(ds > 3, `${v.formato}: vetrino intero visibile`, `variazione ${ds.toFixed(0)}`);
    const info = await p.evaluate(() => { const vt = window.__dbg.VT; return { sp: vt.sp, W: vt.V.W, formato: vt.V.formato }; });
    await p.evaluate(() => { const vt = window.__dbg.VT; vt.vaiVista({ i: vt.vista().i, c: [vt.V.W / 2, vt.V.H / 2], s: 1, r: 0 }); });
    const pieno = await p.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).then(() => true, () => false);
    esito(pieno, `${v.formato}: tessere al livello pieno`, `${info.formato}, ${info.W} px`);
    // il TIFF generico di OpenSlide non ha una calibrazione vera (10 pixel per cm): niente righello invece di uno sbagliato
    if (v.id === 'tiff-generico') esito(!info.sp, `${v.formato}: nessuna calibrazione inventata`, info.sp ? `${info.sp} µm/pixel` : '');
    else esito(info.sp > 0, `${v.formato}: calibrazione`, info.sp ? `${info.sp.toFixed(3)} µm/pixel` : 'manca');
  }
  // il primo resta lo zip scaricabile
  await p.goto(B + '/client/index.html'); await p.waitForSelector('#cl-esempio-box:not([hidden])');
  esito(await p.$eval('#cl-esempio-formato', (s) => s.value === 'zip') && !(await p.$eval('#cl-esempio-vetrino-scarica', (a) => a.hidden)), 'scelta iniziale: il vetrino zip (aorta), con il link per scaricarlo');
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim?.kill(); process.exit(ko ? 1 : 0);
