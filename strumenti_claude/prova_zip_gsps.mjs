// zip aperti direttamente, sessione salvata e riaperta, annotazioni DICOM (GSPS) dal client e dal sito
import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/', D = '/Volumes/Caloggero/_viste/dicom_prova/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ok = (c, m) => log(c ? 'OK  ' : 'FAIL', m);
fs.rmSync(OUT + 'esame.zip', { force: true });
execSync(`cd ${D} && zip -qr ${OUT}esame.zip ct_j2k rx_testo.dcm`);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok_) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok_(); }));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true }); const err = [];
  const c = await ctx.newPage(); c.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR', e.message); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', [OUT + 'esame.zip']);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c.waitForTimeout(1500);
  const s = await c.evaluate(() => ({ serie: window.__dbg.V.serie.map((x) => x.descrizione + ' (' + x.files.length + ')'), n: window.__dbg.V.n }));
  log('zip', JSON.stringify(s)); ok(s.serie.length === 2, 'zip aperto direttamente: 2 serie');
  // misure nel riquadro A (TC)
  await c.evaluate(async () => { const d = window.__dbg; d.attiva(0); const q = d.P(0); d.V.misure[`${q.sIdx}:${q.idx}`] = [{ tipo: 'linea', a: { x: 100, y: 100 }, b: { x: 300, y: 140 } }, { tipo: 'roi', a: { x: 200, y: 250 }, b: { x: 280, y: 310 }, gruppo: 1, etichetta: 'R1' }, { tipo: 'nota', a: { x: 60, y: 60 }, b: { x: 150, y: 120 }, testo: 'aorta' }]; q.wc = 77; q.ww = 555; d.mostra(q.idx); });
  const esporta = async (cosa) => { await c.click('#cl-esporta'); await c.check(`input[name="ex-cosa"][value="${cosa}"]`); const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 60000 }), c.click('#ex-vai')]); const f = OUT + 'zg_' + dl.suggestedFilename(); await dl.saveAs(f); log(cosa, dl.suggestedFilename(), await c.locator('#ex-stato').innerText()); await c.click('#ex-chiudi'); return f; };
  const fs1 = await esporta('sessione'); const sess = JSON.parse(fs.readFileSync(fs1, 'utf8')); ok(sess.tipo === 'radio-quiz-sessione' && Object.values(sess.misure).flat().length === 3, 'sessione salvata con 3 misure');
  const fg = await esporta('gsps');
  const v = execSync(`/tmp/cvenv/bin/python -c "
import pydicom,sys
d=pydicom.dcmread('${fg}')
print(d.SOPClassUID, d.Modality, len(d.GraphicAnnotationSequence), [g.GraphicType for g in d.GraphicAnnotationSequence[0].GraphicObjectSequence], [t.UnformattedTextValue for t in d.GraphicAnnotationSequence[0].TextObjectSequence], d.ReferencedSeriesSequence[0].ReferencedImageSequence[0].ReferencedSOPInstanceUID[:20], d.SoftcopyVOILUTSequence[0].WindowCenter, d.SoftcopyVOILUTSequence[0].WindowWidth)
"`).toString().trim(); log('GSPS letto da pydicom:', v); ok(/1\.2\.840\.10008\.5\.1\.4\.1\.1\.11\.1 PR 1 \['POLYLINE', 'ELLIPSE', 'POLYLINE'/.test(v), 'GSPS valido (pydicom)');
  // riapertura: zip + sessione insieme in una pagina nuova
  const c2 = await ctx.newPage(); c2.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR c2', e.message); });
  await c2.goto(B + '/client/index.html'); await c2.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c2.evaluate(() => { try { localStorage.clear(); } catch {} });
  await c2.setInputFiles('#cl-file', [OUT + 'esame.zip', fs1]);
  await c2.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c2.waitForTimeout(3000);
  const r = await c2.evaluate(() => ({ mis: Object.values(window.__dbg.V.misure).flat().length, wc: window.__dbg.P(0).wc, ww: window.__dbg.P(0).ww }));
  ok(r.mis === 3 && r.wc === 77 && r.ww === 555, 'sessione riaperta insieme allo zip: ' + JSON.stringify(r));
  await c2.screenshot({ path: OUT + 'sessione_riaperta.png' });
  // sito: pulsante GSPS per docenti/autori
  const p = await ctx.newPage(); p.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR sito', e.message); });
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-119'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 40000 }); await p.waitForTimeout(1500);
  ok(await p.locator('#btn-gsps').isVisible(), 'pulsante GSPS visibile all\'amministratore');
  await p.evaluate(() => { const d = window.__dbg, q = d.P(); d.V.misure[`${q.sIdx}:${q.idx}`] = [{ tipo: 'linea', a: { x: 100, y: 100 }, b: { x: 300, y: 140 } }]; });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#btn-gsps')]);
  const f2 = OUT + 'sito_' + dl.suggestedFilename(); await dl.saveAs(f2);
  const v2 = execSync(`/tmp/cvenv/bin/python -c "
import pydicom; d=pydicom.dcmread('${f2}'); print(d.Modality, d.PatientName, d.GraphicAnnotationSequence[0].GraphicObjectSequence[0].GraphicData)"`).toString().trim();
  log('GSPS sito:', v2); ok(/^PR/.test(v2), 'GSPS dal sito');
  ok(!err.length, 'nessun errore JavaScript ' + err.join(' | '));
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
