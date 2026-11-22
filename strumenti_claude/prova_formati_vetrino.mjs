// prova_formati_vetrino.mjs: vetrini in formati non DICOM nel visualizzatore client (vetrini-formati.js).
// File di prova pubblici (OpenSlide test data, CC0 o liberamente distribuibili) in /Volumes/Caloggero/vetrini_formati_prova
// (non in git; si scaricano con scarica.sh). Per ogni file: si apre la vista, il vetrino intero si vede, al livello pieno le
// tessere si vedono, la calibrazione in µm c'è (quando il formato la dà), nessuna richiesta fuori dal computer, nessun errore.
// Uso: node prova_formati_vetrino.mjs [filtro]   (BROWSER=webkit|firefox)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', DIR = '/Volumes/Caloggero/vetrini_formati_prova';
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || 23720, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
// [nome, file (o cartella con più file), calibrazione attesa]
const CASI = [
  ['Aperio SVS (JPEG)', 'Aperio/CMU-1-Small-Region.svs', true], ['Aperio SVS (JPEG 2000 YCbCr 33003)', 'Aperio/JP2K-33003-1.svs', true],
  ['Aperio SVS (JPEG 2000 RGB 33005)', 'Aperio/CMU-1-JP2K-33005.svs', true], ['Hamamatsu NDPI', 'Hamamatsu/CMU-1.ndpi', true],
  ['TIFF generico', 'Generic-TIFF/CMU-1.tiff', false], ['Ventana BIF', 'Ventana/Ventana-1.bif', true], ['Philips TIFF', 'Philips-TIFF/Philips-4.tiff', true],
  ['Leica SCN', 'Leica/Leica-1.scn', true], ['Zeiss CZI (JPEG XR, anteprima)', 'Zeiss/Zeiss-5-SlidePreview-JXR.czi', true], ['Zeiss CZI (Zstandard)', 'Zeiss/Zeiss-5-SlidePreview-Zstd0.czi', true],
  ['Philips iSyntax', 'Philips-iSyntax/testslide.isyntax', true], ['Olympus VSI', 'Olympus/OS-2.vsi', false],
  ['Zeiss CZI (JPEG XR, mosaico)', 'Zeiss/Zeiss-5-JXR.czi', true], ['Zeiss CZI (non compresso)', 'Zeiss/Zeiss-5-Flat.czi', true], ['3DHISTECH MRXS', 'Mirax/CMU-1-Saved-1_16.mrxs', true], ['3DHISTECH MRXS (completo)', 'Mirax/CMU-1.mrxs', true], ['Leica SCN fluorescenza', 'Leica/Leica-Fluorescence-1.scn', true], ['Huron TIFF', 'Huron/Huron-1.tif', false],
].filter(([n, f]) => !process.argv[2] || new RegExp(process.argv[2], 'i').test(n + f));
try {
  for (const [nome, rel, cal] of CASI) {
    const fp = path.join(DIR, rel);
    if (!fs.existsSync(fp)) { console.log(`⚠   ${nome}: file assente (${rel})`); continue; }
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' });
    await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-cl-guida-1', '1'); } catch {} });
    const c = await ctx.newPage(), errori = [], fuori = [];
    c.on('pageerror', (e) => errori.push(e.message)); c.on('console', (m) => { if (m.type() === 'warning' && /vetrino|livello/.test(m.text())) errori.push('avviso: ' + m.text()); });
    c.on('request', (r) => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) fuori.push(r.url()); });
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    const t0 = Date.now();
    // MRXS: il file .mrxs e la cartella con lo stesso nome
    const cart = fp.replace(/\.mrxs$/i, '');
    // VSI: il file .vsi e i file .ets della cartella «_nome_»
    const ets = (d) => fs.readdirSync(d, { recursive: true }).filter((x) => /\.ets$/i.test(x)).map((x) => path.join(d, x));
    const vsiCart = path.join(path.dirname(fp), '_' + path.basename(fp, '.vsi') + '_');
    await c.setInputFiles('#cl-file', /\.mrxs$/i.test(fp) ? [fp, ...fs.readdirSync(cart).map((x) => path.join(cart, x))] : /\.vsi$/i.test(fp) && fs.existsSync(vsiCart) ? [fp, ...ets(vsiCart)] : [fp]);
    const aperto = await c.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 120000 }).then(() => true, () => false);
    esito(aperto, `${nome}: si apre la vista del vetrino`, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (!aperto) { console.log('   stato:', await c.evaluate(() => (document.querySelector('#cl-stato')?.textContent || '') + ' | ' + (document.querySelector('.vista-vetrino .errore')?.textContent || ''))); console.log('   errori:', errori.slice(0, 3).join(' | ')); await ctx.close(); continue; }
    const pieno = () => c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).then(() => true, () => false);
    const contenuto = () => c.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'); const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0, t = 0, s = 0, s2 = 0, rs = 0, bs = 0, gs = 0;
      for (let i = 0; i < d.length; i += 40) { t++; const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; rs += d[i]; bs += d[i + 2]; gs += d[i + 1]; if (Math.abs(d[i] - 243) > 12 || Math.abs(d[i + 1] - 243) > 12 || Math.abs(d[i + 2] - 243) > 12) n++; }
      const m = s / t; return { colorati: n / t, ds: Math.sqrt(Math.max(0, s2 / t - m * m)), r: rs / t, g: gs / t, b: bs / t }; });
    await pieno(); await c.waitForTimeout(800);
    const vInt = await contenuto();
    esito(vInt.colorati > 0.03 && vInt.ds > 4, `${nome}: vetrino intero visibile`, `${(vInt.colorati * 100).toFixed(0)}% con tessuto, variazione ${vInt.ds.toFixed(0)}, R ${vInt.r.toFixed(0)} B ${vInt.b.toFixed(0)}`);
    const info = await c.evaluate(() => { const vt = window.__dbg.VT, v = vt.viewer;
      const cv = document.querySelector('.vt-osd canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data, r = cv.width / cv.clientWidth;
      let best = null, bv = 1e9;
      for (let y = 0; y + 32 <= cv.height; y += 32) for (let x = 0; x + 32 <= cv.width; x += 32) { let sm = 0; for (let yy = 0; yy < 32; yy += 4) for (let xx = 0; xx < 32; xx += 4) { const i = ((y + yy) * cv.width + x + xx) * 4; sm += d[i] + d[i + 1] + d[i + 2]; } if (sm < bv && sm > 0) { bv = sm; best = [(x + 16) / r, (y + 16) / r]; } }
      const p = v.viewport.viewerElementToViewportCoordinates(new OpenSeadragon.Point(best[0], best[1]));
      v.viewport.zoomTo(v.viewport.imageToViewportZoom(1), null, true); v.viewport.panTo(p, true); v.viewport.applyConstraints(true);
      return { sp: vt.sp, W: vt.V.W, H: vt.V.H, livelli: vt.V.livelli.length, formato: vt.V.formato, canali: vt.V.canali.length, et: !!vt.V.etichetta, pan: !!vt.V.panoramica }; });
    await pieno(); await c.waitForTimeout(800);
    const vMax = await contenuto();
    esito(vMax.colorati > 0.02 || vMax.ds > 3, `${nome}: al livello pieno le tessere si vedono`, `${(vMax.colorati * 100).toFixed(0)}% · variazione ${vMax.ds.toFixed(0)} · ${info.W}×${info.H}, ${info.livelli} livelli, ${info.formato}, canali ${info.canali}, etichetta ${info.et}, panoramica ${info.pan}`);
    if (cal) esito(info.sp > 0.05 && info.sp < (/anteprima|Zstandard/.test(nome) ? 100 : 5), `${nome}: calibrazione in µm`, `${info.sp} µm/pixel`);
    esito(!fuori.length, `${nome}: nessuna richiesta fuori dal computer`, fuori.slice(0, 2).join(' '));
    esito(!errori.length, `${nome}: nessun errore`, errori.slice(0, 2).join(' | ').slice(0, 250));
    await c.screenshot({ path: `/tmp/formato_${rel.replace(/\W+/g, '_')}.png` });
    await ctx.close();
  }
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
