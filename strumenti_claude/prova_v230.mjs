// prova_v230.mjs: segmentazione DICOM (SEG) dei volumi e delle calcificazioni, solo nel visualizzatore scaricabile;
// letta da pydicom e controllata con dicom-validator; sulla piattaforma non si esporta
import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19350 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const D = '/tmp/rq-seg'; fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D);
// 60 immagini contigue della TC del caso 110 (studio 1)
execSync(`/Users/salvatorepaolobuemi/.radioquiz-ia/venv/bin/python - <<'PY'
import json, os, shutil
c='/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110'; s=json.load(open(c+'/serie.json')); l=s if isinstance(s,list) else s.get('serie',[])
x=[y for y in l if y.get('descrizione','').startswith('Studio 1')][0]; fs=x['files']; m=len(fs)//2
for i,f in enumerate(fs[m-30:m+30]): shutil.copy(os.path.join(c,f), '${D}/img%03d.dcm'%i)
PY`);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
let ctx; try {
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/rq-profilo-'), { viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  await c.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.id = 'prova-in'; document.body.append(i); });
  await c.setInputFiles('#prova-in', fs.readdirSync(D).sort().map((f) => path.join(D, f)));
  await c.evaluate(async () => { const radice = await navigator.storage.getDirectory(), dir = await radice.getDirectoryHandle('seg', { create: true });
    for (const f of document.querySelector('#prova-in').files) { const h = await dir.getFileHandle(f.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
    await window.__dbg.caricaClient(await window.__dbg.fileDaManiglie([dir])); });
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(2000);
  // una struttura densa e piccola (calcificazione) e un volume semiautomatico sulla stessa
  const pt = await c.evaluate(async () => { const d = window.__dbg, p = d.P();
    for (let j = 20; j < 40; j++) { await d.selezionaSerie(p.sIdx, d.V.attivo, { idx: j }); const im = d.P().img, W = im.cols, H = im.rows, v = (i) => im.pix[i] * im.slope + im.inter;
      for (let y = Math.floor(H * 0.3); y < H * 0.6; y += 2) for (let x = Math.floor(W * 0.38); x < W * 0.62; x += 2) { if (v(y * W + x) < 250) continue;
        let bordo = 0, dentro = 0; for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const q = v((y + dy) * W + x + dx); if (Math.max(Math.abs(dx), Math.abs(dy)) === 8 && q >= 130) bordo++; if (q >= 130) dentro++; }
        if (!bordo && dentro >= 3 && dentro <= 60) return { x, y, j }; } }
    return null; });
  ok('1 struttura trovata', !!pt, pt);
  await c.evaluate(async (pt) => { const d = window.__dbg; d.CAC.vaso = 'IVA'; await d.calcioDa(d.V.attivo, pt); }, pt);
  // volume semiautomatico su un tessuto molle del mediastino (densità 20-70 HU, area uniforme)
  const pv = await c.evaluate(() => { const im = window.__dbg.P().img, W = im.cols, H = im.rows, v = (i) => im.pix[i] * im.slope + im.inter;
    for (let y = Math.floor(H * 0.3); y < H * 0.7; y += 3) for (let x = Math.floor(W * 0.35); x < W * 0.65; x += 3) { let ok2 = true, t = 0; for (let dy = -6; dy <= 6 && ok2; dy++) for (let dx = -6; dx <= 6; dx++) { const q = v((y + dy) * W + x + dx); t += q; if (q < -60 || q > 160) { ok2 = false; break; } } if (ok2 && t / 169 > 15 && t / 169 < 80) return { x, y }; }
    return null; });
  console.log('pv', JSON.stringify(pv)); console.log('vol', await c.evaluate(async (pv) => { const d = window.__dbg; if (!pv) return 'nopv'; try { await d.volumeDa(d.V.attivo, pv); } catch (e) { return 'err ' + e.message; } return d.V.volumi.length + ' ' + document.querySelector('#caricamento')?.textContent; }, pv));
  const n = await c.evaluate(() => ({ cac: window.__dbg.CAC.lesioni.length, vol: window.__dbg.V.volumi.length }));
  ok('2 una calcificazione e un volume misurati', n.cac === 1 && n.vol === 1, n);
  const fl = await c.evaluate(async () => (await window.__dbg.esportaSEG()).map((f) => ({ nome: f.nome, b: Array.from(f.dati) })));
  fs.writeFileSync('/tmp/prova_seg.dcm', Buffer.from(fl[0].b));
  const py = execSync(`/Users/salvatorepaolobuemi/.radioquiz-ia/venv/bin/python -c "
import pydicom, numpy as np, sys
d=pydicom.dcmread('/tmp/prova_seg.dcm')
a=d.pixel_array
print(d.SOPClassUID, d.Modality, d.SegmentationType, len(d.SegmentSequence), int(d.NumberOfFrames), a.shape, int(a.sum()), [s.SegmentLabel for s in d.SegmentSequence], d.PerFrameFunctionalGroupsSequence[0].DerivationImageSequence[0].SourceImageSequence[0].ReferencedSOPInstanceUID[:8])
"`).toString().trim();
  console.log('pydicom:', py);
  ok('3 SEG letto da pydicom: due segmenti, maschere non vuote, immagini di origine', py.startsWith('1.2.840.10008.5.1.4.1.1.66.4 SEG BINARY 2') && /Calcio IVA/.test(py) && !/ 0, \[/.test(py), py.slice(0, 300));
  const hd = execSync(`/private/tmp/cvenv/bin/python -c "import highdicom as hd; r=hd.seg.segread('/tmp/prova_seg.dcm'); print(r.number_of_segments, r.get_segment_numbers())"`).toString().trim();
  ok('3b letto anche da highdicom (la libreria usata da 3D Slicer e OHIF per i SEG)', hd.startsWith('2 '), hd);
  let val = ''; try { val = execSync('/private/tmp/cvenv/bin/validate_iods /tmp/prova_seg.dcm --standard-path /Users/salvatorepaolobuemi/dicom-validator --revision 2026d 2>&1 || true').toString(); } catch (e) { val = String(e.stdout || e.message); }
  console.log(val.split('\n').slice(0, 30).join('\n'));
  // dicom-validator 0.9 non conosce i gruppi funzionali dei SEG: segnala come «unexpected» anche quelli di un SEG di
  // riferimento creato con highdicom; contano gli altri errori
  const altri = val.split('\n').filter((r) => /^\s+Tag .* is unexpected/.test(r) ? !/(9116|9110|000A|9124|9111|9113)\)/.test(r) : /missing|not allowed|invalid|unexpected/i.test(r));
  ok('4 dicom-validator: nessun errore (oltre al limite noto dei gruppi funzionali)', !altri.length, altri.slice(0, 10));
  // sulla piattaforma: nessuna esportazione
  const p = await ctx.newPage(); await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 });
  const esito = await p.evaluate(async () => { try { await window.__dbg.esportaSEG(); return 'esportato'; } catch (e) { return e.message; } });
  ok('5 piattaforma: la segmentazione non si esporta, neanche per l\'amministratore', /solo nel visualizzatore scaricabile/.test(esito), esito);
  ok('6 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await ctx?.close?.().catch(() => {}); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
