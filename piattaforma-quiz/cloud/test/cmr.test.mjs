// RM cardiaca: segmentazione della cavità, volumi e flusso su immagini sintetiche
import test from 'node:test'; import assert from 'node:assert/strict';
import * as CM from '../web/cmr.js';
const img = (f, n = 128, sp = 1.5) => { const pix = new Uint16Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) pix[y * n + x] = f(x, y); return { rows: n, cols: n, pix, spCol: sp, spRow: sp, slope: 1, inter: 0 }; };
test('cavità circolare: area vicina a π r² e papillare inclusa', () => {
  // sangue 400 nel cerchio di raggio 20 px, miocardio 120 fino a 28 px, sfondo 30; «papillare» scuro dentro
  const im = img((x, y) => { const r = Math.hypot(x - 64, y - 64); if (Math.hypot(x - 70, y - 60) < 3) return 120; return r < 20 ? 400 : r < 28 ? 120 : 30; });
  const r = CM.segmentaCavita(im, { x: 62, y: 66 }, { k: 0.55, riempi: true });
  const atteso = Math.PI * 20 * 20 * 1.5 * 1.5;
  assert.ok(Math.abs(r.area - atteso) / atteso < 0.06, `${r.area} vs ${atteso}`);
  const r2 = CM.segmentaCavita(im, { x: 62, y: 66 }, { k: 0.55, riempi: false });
  assert.ok(r2.area < r.area, 'senza riempimento il papillare resta fuori');
  assert.ok(r.perdita < 0.05);
  assert.equal(CM.segmentaCavita(im, { x: 64, y: 40 }), null, 'seme nel miocardio: nessuna cavità');
});
test('volumi, superficie corporea e flusso', () => {
  assert.equal(CM.volumeDaAree([1000, 2000, 0], 10), 30);
  assert.ok(Math.abs(CM.superficieCorporea(170, 68) - 1.8) < 0.01);
  // contrasto di fase a 12 bit: 2048 = 0 cm/s; venc 200 → valore 3072 = +100 cm/s nel vaso (10 px di raggio, 2 mm/pixel)
  const fasi = [3072, 3072, 2048, 1536].map((v) => img((x, y) => (Math.hypot(x - 40, y - 40) < 10 ? v : 2048), 80, 2));
  fasi.forEach((f) => { f.bitsSt = 12; });
  const r = CM.flussoROI(fasi, { x: 40, y: 40, r: 9.5 }, 200, { tempi: [0, 250, 500, 750] });
  assert.ok(Math.abs(r.curva[0].media - 100) < 1e-6);
  const area = r.pixel * 4 / 100;                       // cm²
  assert.ok(Math.abs(r.avanti - 2 * 100 * area * 0.25) < 1e-6);
  assert.ok(Math.abs(r.indietro - 50 * area * 0.25) < 1e-6);
  assert.ok(Math.abs(r.rigurgito - 25) < 1e-6);
  assert.equal(r.piccoV, 100);
});
test('altre misure: atrio, ECV, enhancement tardivo', () => {
  assert.ok(Math.abs(CM.volumeAreaLunghezza(20, 20, 5) - 68) < 1e-9);
  // T1 miocardio 1000 → 450, sangue 1600 → 300, Hct 42%: ECV ≈ 25%
  const e = CM.ecv({ t1m: 1000, t1b: 1600, t1mp: 450, t1bp: 300, hct: 42 });
  assert.ok(e > 24 && e < 27, String(e));
  // anello di miocardio (r 15-25 px) con valore 100 ± rumore, un settore acceso a 400; remoto sul lato opposto
  const n = 100, pix = new Uint16Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x - 50, y - 50); pix[y * n + x] = r < 15 ? 600 : r < 25 ? (x > 60 && Math.abs(y - 50) < 8 ? 400 : 100 + ((x * 7 + y * 13) % 11) - 5) : 20; }
  const img = { rows: n, cols: n, pix, spCol: 1, spRow: 1, slope: 1, inter: 0 };
  const cerchio = (r) => Array.from({ length: 72 }, (_, i) => ({ x: 50 + r * Math.cos(i * Math.PI / 36), y: 50 + r * Math.sin(i * Math.PI / 36) }));
  const f = CM.lgeFetta(img, cerchio(24.5), cerchio(15.5), { x: 30, y: 50, r: 3 }, 5);
  assert.ok(f.perc > 5 && f.perc < 15, String(f.perc));
  assert.ok(Math.abs(f.areaMio - Math.PI * (24.5 ** 2 - 15.5 ** 2)) / f.areaMio < 0.05);
});
test('trova i ventricoli da solo su immagini sintetiche', () => {
  // VS rotondo (raggio 18 px) che si contrae, VD a mezzaluna a sinistra che si contrae meno, sfondo con grasso chiaro fisso
  const fasi = [0, 1, 2, 3, 4, 5].map((t) => { const r = 18 - 2 * Math.min(t, 5 - t); const n = 128, pix = new Uint16Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dv = Math.hypot(x - 72, y - 64), dd = Math.hypot(x - 52, y - 64);
      pix[y * n + x] = dv < r ? 500 : dv < r + 8 ? 120 : (dd < 26 - Math.min(t, 5 - t) && dv > 28) ? 480 : (x < 6 || y < 6) ? 450 : 60; }
    return { rows: n, cols: n, pix, spCol: 1.5, spRow: 1.5, slope: 1, inter: 0 }; });
  const r = CM.trovaCentri(fasi);
  assert.ok(Math.hypot(r.vs.x - 72, r.vs.y - 64) < 4, JSON.stringify(r));
  assert.ok(r.vd && r.vd.x < 60, JSON.stringify(r));
});
