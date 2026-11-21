// prova_v219.mjs: misure in DICOM SR (TID 1500), lette da pydicom e controllate con dicom-validator
import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19400 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-001'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-001', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  ok('1 caso di archivio pubblico: niente esportazioni sulla piattaforma', await a.evaluate(() => document.querySelector('#btn-sr').hidden && document.querySelector('#btn-gsps').hidden));
  const dati = await a.evaluate(async () => {
    const d = window.__dbg, p = d.P(), k = `${p.sIdx}:${p.idx}`, c = { x: p.img.cols / 2, y: p.img.rows / 2 };
    d.V.misure[k] = [{ tipo: 'linea', a: { x: c.x - 20, y: c.y }, b: { x: c.x + 20, y: c.y } },
      { tipo: 'recist', a: { x: c.x - 15, y: c.y + 30 }, b: { x: c.x + 15, y: c.y + 30 }, c: { x: c.x, y: c.y + 22 }, d: { x: c.x, y: c.y + 38 } },
      { tipo: 'roi', a: { x: c.x - 10, y: c.y - 40 }, b: { x: c.x + 10, y: c.y - 25 } },
      { tipo: 'nota', a: { x: c.x + 40, y: c.y + 40 }, b: { x: c.x + 25, y: c.y + 25 }, testo: 'nodulo' }];
    const fl = await d.esportaGSPS({ sr: true }); return { n: fl.length, byte: Array.from(fl[0].dati), sp: p.img.spCol };
  });
  fs.writeFileSync('/tmp/prova_sr.dcm', Buffer.from(dati.byte));
  const py = execSync(`/Users/salvatorepaolobuemi/.radioquiz-ia/venv/bin/python -c "
import pydicom
d=pydicom.dcmread('/tmp/prova_sr.dcm')
gr=d.ContentSequence[-1].ContentSequence
num=[(c.ConceptNameCodeSequence[0].CodeMeaning, round(float(c.MeasuredValueSequence[0].NumericValue),1), c.MeasuredValueSequence[0].MeasurementUnitsCodeSequence[0].CodeValue) for g in gr for c in g.ContentSequence if c.ValueType=='NUM']
img=[i for g in gr for c in g.ContentSequence if c.ValueType=='NUM' for s in c.ContentSequence for i in s.ContentSequence]
print(d.SOPClassUID, d.Modality, d.ContentTemplateSequence[0].TemplateIdentifier, len(gr), num, len(img), img[0].ReferencedSOPSequence[0].ReferencedSOPInstanceUID[:6] if img else '')
"`).toString().trim();
  console.log('pydicom:', py);
  const att = (40 * dati.sp).toFixed(1);
  ok('2 SR letto da pydicom: Comprehensive SR, TID 1500, 4 gruppi, valori e immagini di origine', py.startsWith('1.2.840.10008.5.1.4.1.1.88.33 SR 1500 4') && py.includes(`('Length', ${att}, 'mm')`) && /Long Axis/.test(py) && /Short Axis/.test(py) && /'Mean'/.test(py) && /hnsf/.test(py), py.slice(0, 300));
  let val = '';
  try { val = execSync('/private/tmp/cvenv/bin/validate_iods /tmp/prova_sr.dcm --standard-path /Users/salvatorepaolobuemi/dicom-validator --edition 2026d 2>&1 || true').toString(); }
  catch (e) { val = String(e.stdout || e.message); }
  console.log(val.split('\n').slice(0, 25).join('\n'));
  ok('3 dicom-validator: nessun errore nel modulo', !/error|Error|missing|not allowed|invalid/i.test(val.replace(/no errors/i, '')), val.slice(0, 400));
  ok('4 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
