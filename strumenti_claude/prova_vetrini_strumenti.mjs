// prova_vetrini_strumenti.mjs: strumenti del visualizzatore dei vetrini (1.268) nel client, con i vetrini pubblici di prova
// in ~/rq-vetrini (OpenSlide test data). Controlli:
// - decodifica JPEG 2000 nei web worker (non nella pagina);
// - ingrandimenti 10× e 40×, rotazione (pulsante e tasto R), frecce e + della tastiera, vista precedente (B), schermo intero;
// - annotazioni: area (poligono), ellisse, freccia, campo HPF, conteggio dentro e fuori dal campo, con area e densità giuste;
//   salvate (si ritrovano riaprendo), esportate in DICOM (Microscopy Bulk Simple Annotations) e reimportate uguali;
// - colore: «solo DAB» e luminosità cambiano l'immagine, «Ripristina» la riporta com'era;
// - istantanea PNG con le dimensioni della vista;
// - due vetrini affiancati: stessa scala in µm, movimenti legati e poi sganciati;
// - nessuna richiesta fuori dal computer, nessun errore. Il file DICOM esportato resta in /tmp/ann_vetrino.dcm (per highdicom).
// Uso: node prova_vetrini_strumenti.mjs   (BROWSER=webkit|firefox)
import { spawn, spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', DIR = path.join(os.homedir(), 'rq-vetrini');
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19460 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const tutti = (d) => fs.readdirSync(d).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(d, x));
const vicino = (a, b, tol) => Math.abs(a / b - 1) < tol;
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
const c = await ctx.newPage(), errori = [], fuori = [];
c.on('pageerror', (e) => errori.push(e.message)); c.on('request', (r) => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) fuori.push(r.url()); });
c.on('dialog', (d) => d.accept());
const VT = (f, a) => c.evaluate(f, a);
const apri = async (files) => {
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => !document.querySelector('#vista-vetrino')?.hidden && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 120000 });
  await c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).catch(() => {});
  await c.waitForTimeout(500);
};
const pixel = () => VT(() => { const cv = document.querySelector('.vt-pane .vt-osd canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let r = 0, g = 0, bl = 0, n = 0; for (let i = 0; i < d.length; i += 40) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; } return [r / n, g / n, bl / n]; });
const fermo = () => c.waitForTimeout(900);
try {
  const jp2k = tutti(path.join(DIR, 'jp2k')), leica = tutti(path.join(DIR, 'leica'));
  // ------------------------------------------------ un vetrino (JPEG 2000)
  await apri(jp2k);
  await VT(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('rq-vt-ann:')) localStorage.removeItem(k); window.__dbg.VT.misure.length = 0; });
  const dec = await VT(() => import('/vetrini.js').then((m) => ({ ...m.DEC })));
  esito(dec.worker > 0 && dec.pagina === 0, 'tessere JPEG 2000 decodificate nei web worker', JSON.stringify(dec));
  // ingrandimenti
  await c.click('.vt-ingr[data-m="10"]'); await fermo();
  const m10 = await VT(() => window.__dbg.VT.ingrAttuale());
  esito(vicino(m10, 10, 0.03), 'pulsante 10× → ingrandimento 10×', m10.toFixed(2) + '× · ' + await c.textContent('.vt-ingr-at'));
  await c.click('.vt-ingr[data-m="40"]'); await fermo();
  const m40 = await VT(() => window.__dbg.VT.ingrAttuale());
  esito(vicino(m40, 40, 0.03), 'pulsante 40× → ingrandimento 40× (0,25 µm per pixel dello schermo)', m40.toFixed(2) + '×');
  await c.keyboard.press('2'); await fermo();
  esito(vicino(await VT(() => window.__dbg.VT.ingrAttuale()), 4, 0.03), 'tasto 2 → 4×');
  // cronologia: torna a 40×, poi 4×
  await c.keyboard.press('b'); await fermo();
  esito(vicino(await VT(() => window.__dbg.VT.ingrAttuale()), 40, 0.05), 'tasto B → vista precedente (40×)');
  // rotazione e tastiera
  await c.click('.vt-ruota[data-r="90"]'); await fermo();
  esito(await VT(() => window.__dbg.VT.viewer.viewport.getRotation()) === 90, 'pulsante ⟳ → rotazione 90°');
  await c.keyboard.press('r'); await fermo();
  esito(await VT(() => window.__dbg.VT.viewer.viewport.getRotation()) === 180, 'tasto R → rotazione 180°');
  await c.keyboard.press('Shift+R'); await c.keyboard.press('Shift+R'); await fermo();
  esito(await VT(() => window.__dbg.VT.viewer.viewport.getRotation()) === 0, 'Maiusc+R due volte → di nuovo 0°');
  await c.keyboard.press('2'); await fermo();
  const c0 = await VT(() => window.__dbg.VT.viewer.viewport.getCenter());
  await c.keyboard.press('ArrowRight'); await fermo();
  const c1 = await VT(() => window.__dbg.VT.viewer.viewport.getCenter());
  esito(c1.x > c0.x && Math.abs(c1.y - c0.y) < 1e-6, 'freccia destra → la vista si sposta a destra', `${c0.x.toFixed(3)} → ${c1.x.toFixed(3)}`);
  const z0 = await VT(() => window.__dbg.VT.viewer.viewport.getZoom()); await c.keyboard.press('+'); await fermo();
  esito(await VT(() => window.__dbg.VT.viewer.viewport.getZoom()) > z0 * 1.3, 'tasto + → ingrandisce');
  await c.keyboard.press('0'); await fermo();
  // schermo intero (dove il browser di prova lo consente)
  await c.click('.vt-intero'); await c.waitForTimeout(600);
  const fs1 = await VT(() => !!(document.fullscreenElement || document.webkitFullscreenElement));
  if (fs1) { await c.click('.vt-intero'); await c.waitForTimeout(500); }
  esito(fs1 || process.env.BROWSER, 'schermo intero', fs1 ? 'sì' : 'non disponibile in questo browser di prova');
  await c.keyboard.press('2'); await fermo();
  await c.waitForTimeout(1500);   // dopo lo schermo intero la vista si ridimensiona
  // ------------------------------------------------ annotazioni
  const R = await VT(() => { const e = document.querySelector('.vt-pane .vt-misure').getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
  const scala = await VT(() => ({ px: window.__dbg.VT.viewer.viewport.viewportToImageZoom(window.__dbg.VT.viewer.viewport.getZoom(true)), sp: window.__dbg.VT.sp }));
  const um = (schermo) => (schermo / scala.px) * scala.sp;   // µm di un tratto lungo «schermo» pixel
  // area: quadrato di 200 pixel dello schermo con 4 clic e Invio
  await c.click('.vt-s[data-s="poligono"]');
  for (const [dx, dy] of [[-300, -100], [-100, -100], [-100, 100], [-300, 100]]) { await c.mouse.click(R.x + dx, R.y + dy); await c.waitForTimeout(120); }
  await c.keyboard.press('Enter'); await c.waitForTimeout(300);
  let ann = await VT(() => window.__dbg.VT.ann.map((a) => ({ ...a })));
  const area = await VT(() => import('/vetrini-ann.js').then((A) => { const a = window.__dbg.VT.ann.at(-1); return { ar: A.area(a, window.__dbg.VT.sp), pe: A.perimetro(a, window.__dbg.VT.sp) }; }));
  esito(ann.length === 1 && ann[0].t === 'poligono' && ann[0].p.length === 4 && vicino(area.ar, um(200) ** 2, 0.02) && vicino(area.pe, 4 * um(200), 0.02), 'area (4 clic e Invio): area e perimetro giusti',
    `${(area.ar / 1e6).toFixed(4)} mm² (atteso ${(um(200) ** 2 / 1e6).toFixed(4)}), ${(area.pe / 1000).toFixed(3)} mm`);
  const testoArea = await VT(() => [...document.querySelectorAll('.vt-pane .vt-misure text')].map((t) => t.textContent).join(' | '));
  esito(/mm²|µm²/.test(testoArea), 'l\'area ha l\'etichetta con la misura', testoArea);
  // ellisse
  await c.click('.vt-s[data-s="ellisse"]'); await c.mouse.move(R.x + 20, R.y - 60); await c.mouse.down(); await c.mouse.move(R.x + 220, R.y + 40, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(200);
  const el = await VT(() => import('/vetrini-ann.js').then((A) => { const a = window.__dbg.VT.ann.at(-1); return { t: a.t, ar: A.area(a, window.__dbg.VT.sp) }; }));
  esito(el.t === 'ellisse' && vicino(el.ar, Math.PI * um(100) * um(50), 0.03), 'ellisse: area π·a·b', `${(el.ar / 1e6).toFixed(4)} mm²`);
  // freccia
  await c.click('.vt-s[data-s="freccia"]'); await c.mouse.move(R.x + 250, R.y + 150); await c.mouse.down(); await c.mouse.move(R.x + 330, R.y + 200, { steps: 4 }); await c.mouse.up(); await c.waitForTimeout(200);
  esito(await VT(() => window.__dbg.VT.ann.at(-1).t === 'freccia' && document.querySelectorAll('.vt-pane .vt-misure path').length >= 4), 'freccia disegnata con la punta');
  // campo ad alto ingrandimento e conteggio: 3 punti dentro, 1 fuori
  await c.click('.vt-s[data-s="hpf"]'); await c.mouse.click(R.x + 400, R.y - 200); await c.waitForTimeout(200);
  const hpf = await VT(() => import('/vetrini-ann.js').then((A) => { const a = window.__dbg.VT.ann.at(-1); return { t: a.t, ar: A.area(a, window.__dbg.VT.sp) / 1e6, rSch: a.rx * window.__dbg.VT.viewer.viewport.viewportToImageZoom(window.__dbg.VT.viewer.viewport.getZoom(true)) }; }));
  esito(hpf.t === 'hpf' && vicino(hpf.ar, Math.PI * 0.275 ** 2, 0.005), 'campo HPF Ø 0,55 mm = 0,238 mm²', hpf.ar.toFixed(4) + ' mm²');
  await c.click('.vt-s[data-s="punto"]');
  const r = Math.min(hpf.rSch * 0.5, 40);
  for (const [dx, dy] of [[0, 0], [r, 0], [0, r], [-hpf.rSch - 60, 0]]) { await c.mouse.click(R.x + 400 + dx, R.y - 200 + dy); await c.waitForTimeout(100); }
  const rie = await VT(() => window.__dbg.VT.riepilogo()), conta = await c.textContent('.vt-conta');
  esito(rie.punti === 4 && rie.nelCampi === 3 && rie.campi === 1 && /\/mm²/.test(conta), 'conteggio: 4 punti, 3 nel campo, densità per mm²', conta);
  esito(/: 3 = 12,6\/mm²/.test(conta), 'densità = 3 / 0,238 mm² ≈ 12,6 per mm²', conta);
  // annulla (Canc) e ripristino del punto
  await c.keyboard.press('Delete'); await c.waitForTimeout(100);
  esito((await VT(() => window.__dbg.VT.ann.length)) === 7, 'Canc toglie l\'ultima annotazione');
  await c.mouse.click(R.x + 400 - hpf.rSch - 60, R.y - 200); await c.keyboard.press('Escape');
  const nAnn = await VT(() => window.__dbg.VT.ann.length);
  // esportazione DICOM
  const [dl] = await Promise.all([c.waitForEvent('download'), c.click('.vt-esporta')]);
  const fAnn = '/tmp/ann_vetrino.dcm'; await dl.saveAs(fAnn); const bytes = fs.readFileSync(fAnn);
  esito(bytes.length > 500 && bytes.slice(128, 132).toString() === 'DICM', 'esportazione: file DICOM scaricato', `${dl.suggestedFilename()} · ${bytes.length} byte`);
  const rilett = await VT(async (b64) => { const u = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0)), ds = window.dicomParser.parseDicom(u); const A = await import('/vetrini-ann.js'); const l = A.leggiANN(ds), sp = window.__dbg.VT.sp;
    const somma = (x) => x.reduce((s, a) => s + A.area(a, sp), 0); return { n: l.length, tipi: l.map((a) => a.t).sort().join(','), orig: window.__dbg.VT.ann.map((a) => a.t).sort().join(','), area: somma(l), areaOrig: somma(window.__dbg.VT.ann), sop: ds.string('x00080016'), mod: ds.string('x00080060') }; }, bytes.toString('base64'));
  esito(rilett.n === nAnn && rilett.tipi === rilett.orig && vicino(rilett.area, rilett.areaOrig, 1e-4) && rilett.sop === '1.2.840.10008.5.1.4.1.1.91.1' && rilett.mod === 'ANN', 'il file DICOM si rilegge con le stesse annotazioni e aree', `${rilett.n} forme: ${rilett.tipi}`);
  // lettura con highdicom (se installato nel venv di strumenti_claude)
  const PY = '/Volumes/Caloggero/strumenti_claude/venv_idc/bin/python';
  if (fs.existsSync(PY)) { const v = spawnSync(PY, ['/Volumes/Caloggero/strumenti_claude/verifica_ann.py', fAnn], { encoding: 'utf8', timeout: 120000 }); const o = (v.stdout || '') + (v.stderr || '');
    esito(/elementi principali presenti/.test(o) && /Conteggio: POINT, 4 forme/.test(o) && /Campi ad alto ingrandimento: ELLIPSE, 1 forme/.test(o) && /Area \(mm2\)/.test(o), 'highdicom legge il file: gruppi, forme e aree', o.split('\n').filter((x) => /:/.test(x)).slice(1, 4).join(' | ')); }
  // istantanea
  const [png] = await Promise.all([c.waitForEvent('download'), c.click('.vt-foto')]);
  const fPng = '/tmp/istantanea_vetrino.png'; await png.saveAs(fPng); const pb = fs.readFileSync(fPng);
  const pw0 = pb.readUInt32BE(16), ph0 = pb.readUInt32BE(20), vista = await VT(() => { const e = document.querySelector('.vt-pane'); return [e.clientWidth * devicePixelRatio, e.clientHeight * devicePixelRatio]; });
  esito(pb.slice(1, 4).toString() === 'PNG' && Math.abs(pw0 - vista[0]) <= 2 && ph0 > vista[1], 'istantanea PNG con le dimensioni della vista (più la didascalia)', `${pw0} × ${ph0}`);
  // colore
  const p0 = await pixel();
  await c.click('.vt-colore-b'); await c.selectOption('.vt-modo', 'DAB'); await c.waitForTimeout(400);
  await c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 30000 }).catch(() => {}); await c.waitForTimeout(400);
  const p1 = await pixel();
  esito(Math.abs(p1[2] - p0[2]) > 4 || Math.abs(p1[0] - p0[0]) > 4, 'colore «solo DAB»: l\'immagine cambia (l\'eosina sparisce)', `${p0.map(Math.round)} → ${p1.map(Math.round)}`);
  await c.click('.vt-col-zero'); await c.waitForTimeout(400);
  await c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 30000 }).catch(() => {}); await c.waitForTimeout(400);
  const p2 = await pixel();
  esito(p2.every((v, i) => Math.abs(v - p0[i]) < 1.5), '«Ripristina» riporta i colori originali', `${p2.map(Math.round)}`);
  await c.fill('.vt-lum', '40'); await c.dispatchEvent('.vt-lum', 'input'); await c.waitForTimeout(500);
  await c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 30000 }).catch(() => {}); await c.waitForTimeout(400);
  const p3 = await pixel();
  esito(p3[1] > p0[1] + 10, 'luminosità +40: immagine più chiara', `${Math.round(p0[1])} → ${Math.round(p3[1])}`);
  // le annotazioni si ritrovano riaprendo il vetrino
  await apri(jp2k);
  esito((await VT(() => window.__dbg.VT.ann.length)) === nAnn, 'annotazioni ritrovate riaprendo il vetrino', String(nAnn));
  // importazione: il file esportato, aggiunto a un vetrino senza annotazioni, ridà le stesse forme
  await VT(() => { window.__dbg.VT.misure.length = 0; });
  await c.setInputFiles('.vt-importa input', fAnn); await c.waitForTimeout(500);
  esito((await VT(() => window.__dbg.VT.ann.length)) === nAnn, 'importazione del file DICOM di annotazioni', await c.textContent('.vt-aiuto'));
  // ------------------------------------------------ due vetrini affiancati
  await apri([...leica, ...jp2k]);
  const opz = await c.$$eval('.vt-affianca option', (o) => o.map((x) => x.value).filter(Boolean));
  esito(opz.length === 1, 'con due vetrini compare «Affianca»', String(opz.length));
  if (opz.length) {
    await c.selectOption('.vt-affianca', opz[0]);
    await c.waitForFunction(() => window.__dbg.VT.pannelli.length === 2 && window.__dbg.VT.pannelli[1].viewer.world.getItemCount() === 1, null, { timeout: 60000 });
    await c.waitForTimeout(1200);
    const s = await VT(() => { const [P, Q] = window.__dbg.VT.pannelli, z = (R) => R.viewer.viewport.viewportToImageZoom(R.viewer.viewport.getZoom(true)); return { a: P.sp / z(P), b: Q.sp / z(Q), n: document.querySelectorAll('.vt-pane').length }; });
    esito(s.n === 2 && vicino(s.a, s.b, 0.02), 'due vetrini affiancati alla stessa scala (µm per pixel dello schermo)', `${s.a.toFixed(3)} e ${s.b.toFixed(3)} µm/pixel`);
    await c.click('.vt-pane >> nth=0'); await c.click('.vt-ingr[data-m="4"]'); await fermo();
    const s2 = await VT(() => { const [P, Q] = window.__dbg.VT.pannelli, z = (R) => R.viewer.viewport.viewportToImageZoom(R.viewer.viewport.getZoom(true)); return [P.sp / z(P), Q.sp / z(Q)]; });
    esito(vicino(s2[0], s2[1], 0.02) && vicino(s2[0], 2.5, 0.03), '4× sul primo: anche il secondo a 4×', s2.map((x) => x.toFixed(2)).join(' e '));
    await c.click('.vt-lega'); await c.waitForTimeout(200);
    const q0 = await VT(() => window.__dbg.VT.pannelli[1].viewer.viewport.getZoom());
    await VT(() => { window.__dbg.VT.pannelli[0].viewer.viewport.zoomBy(2); }); await fermo();
    esito(vicino(await VT(() => window.__dbg.VT.pannelli[1].viewer.viewport.getZoom()), q0, 0.001), 'sganciati (🔗): il secondo non si muove più');
    await c.click('.vt-lega'); await c.click('.vt-pane >> nth=0'); await VT(() => { window.__dbg.VT.pannelli[0].viewer.viewport.zoomBy(0.5); }); await fermo();
    const s3 = await VT(() => { const [P, Q] = window.__dbg.VT.pannelli, z = (R) => R.viewer.viewport.viewportToImageZoom(R.viewer.viewport.getZoom(true)); return [P.sp / z(P), Q.sp / z(Q)]; });
    esito(vicino(s3[0], s3[1], 0.02), 'riagganciati: di nuovo alla stessa scala', s3.map((x) => x.toFixed(2)).join(' e '));
    await c.screenshot({ path: '/tmp/vetrini_affiancati.png' });
  }
  esito(!fuori.length, 'nessuna richiesta fuori dal computer', fuori.slice(0, 2).join(' '));
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | ').slice(0, 300));
} catch (e) { esito(false, 'prova interrotta', e.message.slice(0, 300)); }
finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); process.exit(ko ? 1 : 0);
