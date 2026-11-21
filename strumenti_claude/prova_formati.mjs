// prova_formati.mjs: client con DICOM compressi (JPEG 2000, JPEG-LS, RLE, JPEG 8 bit), multi-frame (enhanced CT, clip eco),
// CD con DICOMDIR (scelta degli studi), testo impresso coperto nell'esportazione, misure in testo, dati paziente, W/L tra finestre
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const D = '/Volumes/Caloggero/_viste/dicom_prova/', OUT = '/Volumes/Caloggero/_viste/prova3d/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ok = (c, m) => log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok_) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok_(); }));
const browser = await chromium.launch();
const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : [path.join(d, e.name)]);
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR', e.message); }); p.on('console', (m) => { if (m.type() === 'error' && !/status of 40/.test(m.text())) log('console', m.text().slice(0, 200)); });
  await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  const apri = async (files) => {
    await p.goto(B + '/client/index.html#/'); await p.waitForSelector('#vista-client:not([hidden])');
    await p.evaluate(() => { window.__dbg.V.img = null; });
    await p.setInputFiles('#cl-file', files);
    await p.waitForFunction(() => (window.__dbg?.V?.img && location.hash === '#/caso/locale') || /errore/.test(document.querySelector('#cl-stato')?.className || '') || !document.querySelector('#cl-scelta').hidden, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    return p.evaluate(() => { const { V, P } = window.__dbg, q = P(), im = q.img; let s = 0, s2 = 0, n = 0; if (im) for (let i = 0; i < im.pix.length; i += 97) { const v = im.pix[i] * im.slope + im.inter; s += v; s2 += v * v; n++; }
      return { stato: document.querySelector('#cl-stato').innerText, titolo: document.querySelector('#titolo-caso').textContent, serie: V.serie.map((x) => x.descrizione + ' (' + x.files.length + ')'), idx: q.idx, nf: q.frames.length, rows: im?.rows, cols: im?.cols, rgb: !!im?.rgb, media: n ? +(s / n).toFixed(2) : null, ds: n ? +Math.sqrt(s2 / n - (s / n) ** 2).toFixed(1) : null, iop: im?.iop?.map((x) => +x.toFixed(2)).join(','), ipp: im?.ipp?.map((x) => +x.toFixed(1)).join(','), cine: V.serie[q.sIdx]?.cine_ms, paz: im?.paziente?.nome }; });
  };
  const medie = {};
  for (const n of ['ct_j2k', 'ct_jls', 'ct_rle', 'ct_jpeg8']) {
    const r = await apri(tutti(D + n)); log(n, JSON.stringify(r)); medie[n] = r.media;
    ok(r.rows === 512 && r.ds > 10, `${n}: immagine decodificata (media ${r.media}, ds ${r.ds})`);
    await p.screenshot({ path: OUT + `formato_${n}.png` });
  }
  ok(medie.ct_j2k === medie.ct_jls && medie.ct_jls === medie.ct_rle, `compressioni senza perdita identiche: ${medie.ct_j2k} / ${medie.ct_jls} / ${medie.ct_rle}`);
  let r = await apri([D + 'ct_enhanced_mf.dcm']); log('enhanced', JSON.stringify(r));
  ok(r.nf === 30 && r.ds > 10 && r.iop === '1,0,0,0,1,0', 'enhanced CT multi-frame: 30 fotogrammi con geometria');
  const ipp1 = r.ipp; await p.keyboard.press('ArrowDown'); await p.waitForTimeout(400);
  const ipp2 = await p.evaluate(() => window.__dbg.P().img.ipp.map((x) => +x.toFixed(1)).join(',')); ok(ipp1 !== ipp2, `posizione diversa per fotogramma: ${ipp1} → ${ipp2}`);
  await p.keyboard.press('c'); await p.waitForTimeout(2500); ok(await p.evaluate(() => window.__dbg.P().piano === 'coronale'), 'coronale dal multi-frame');
  await p.screenshot({ path: OUT + 'formato_enhanced_cor.png' });
  r = await apri([D + 'us_clip_mf.dcm']); log('eco', JSON.stringify(r)); ok(r.nf === 12 && r.rgb && r.cine === 40, 'clip eco multi-frame JPEG a colori, 12 fotogrammi, 40 ms');
  await p.screenshot({ path: OUT + 'formato_eco.png' });
  // CD con DICOMDIR: due studi, si sceglie
  const cd = tutti(D + 'cd');
  await p.goto(B + '/client/index.html#/'); await p.waitForSelector('#vista-client:not([hidden])');
  await p.setInputFiles('#cl-cartella', D + 'cd').catch(async (e) => { log('cartella non supportata da Playwright:', e.message.split('\n')[0]); });
  await p.waitForTimeout(1500);
  const scelta = await p.evaluate(() => !document.querySelector('#cl-scelta').hidden ? document.querySelector('#cl-scelta').innerText : null);
  log('scelta', JSON.stringify(scelta)); ok(scelta && /2026/.test(scelta), 'DICOMDIR: elenco degli studi');
  if (scelta) { await p.evaluate(() => document.querySelectorAll('#cl-scelta input').forEach((x) => { x.checked = true; })); await p.click('#cl-scelta-apri');
    await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await p.waitForTimeout(1000);
    const s = await p.evaluate(() => ({ serie: window.__dbg.V.serie.map((x) => x.descrizione + ' (' + x.files.length + ')'), titolo: document.querySelector('#titolo-caso').textContent, paz: window.__dbg.P().img?.paziente?.nome }));
    log('cd', JSON.stringify(s)); ok(s.serie.length >= 3, 'CD aperto: serie dei due studi');
    await p.check('#cl-paziente'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + 'formato_cd_paziente.png' });
    ok(!!s.paz, 'dati paziente disponibili a richiesta: ' + s.paz);
    await p.uncheck('#cl-paziente'); }
  // RX con testo impresso: esportazione anonimizzata con testo coperto
  await apri([D + 'rx_testo.dcm']);
  await p.click('#cl-esporta'); await p.check('input[name="ex-cosa"][value="dicom"]');
  const [z] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#ex-vai')]);
  const stato = await p.locator('#ex-stato').innerText(); log('rx export', stato); ok(/coperto/.test(stato), 'testo impresso coperto e immagine esportata');
  await z.saveAs(OUT + 'rx_anonimo.zip'); await p.click('#ex-chiudi');
  // misure in testo
  await apri(tutti(D + 'ct_rle'));
  await p.evaluate(() => { const { V, P } = window.__dbg; const q = P(); V.misure[`${q.sIdx}:${q.idx}`] = [{ tipo: 'linea', a: { x: 100, y: 100 }, b: { x: 300, y: 100 } }]; });
  await p.click('#cl-esporta'); await p.check('input[name="ex-cosa"][value="misure"]');
  const [t] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#ex-vai')]);
  const testo = fs.readFileSync(await t.path(), 'utf8'); log('misure:', JSON.stringify(testo.slice(0, 300))); ok(/mm/.test(testo), 'misure esportate in testo'); await p.click('#ex-chiudi');
  // finestra (W/L) e zoom tra finestre
  const [f2] = await Promise.all([ctx.waitForEvent('page'), p.click('#cl-finestra')]);
  await f2.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await f2.waitForTimeout(800);
  await f2.evaluate(() => window.__dbg.selezionaSerie(0, 0)); await f2.waitForTimeout(800);
  await p.evaluate(() => { const q = window.__dbg.P(); q.wc = 333; q.ww = 777; q.zoom = 1.5; window.__dbg.mostra(q.idx); }); await p.waitForTimeout(1000);
  const v2 = await f2.evaluate(() => { const q = window.__dbg.P(); return [Math.round(q.wc), Math.round(q.ww), q.zoom]; }); ok(v2[0] === 333 && v2[1] === 777 && v2[2] === 1.5, 'W/L e zoom collegati tra finestre: ' + v2);
  // aiuto e ritorno
  await p.click('#btn-aiuto'); await p.waitForTimeout(800); ok(await p.evaluate(() => !document.querySelector('#vista-aiuto').hidden), '«?» apre l\'aiuto');
  await p.goto(B + '/client/index.html#/'); await p.waitForTimeout(500);
  ok(!err.length, 'nessun errore JavaScript ' + err.join(' | '));
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
