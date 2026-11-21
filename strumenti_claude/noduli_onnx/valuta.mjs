import fs from 'fs'; import ort from 'onnxruntime-node';
const { _interno: I, SCORE_MIN } = await import('./noduli-client.mjs');
const [modello, uscita, ...casi] = process.argv.slice(2);
const s = await ort.InferenceSession.create(modello);
const esegui = async (x, f) => { const o = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1, 1, ...f]) }); return s.outputNames.map((n) => o[n].data); };
const SP = [0.703125, 0.703125, 1.25], ris = fs.existsSync(uscita) ? JSON.parse(fs.readFileSync(uscita)) : {};
for (const c of casi) {
  if (ris[c]) continue;
  const meta = JSON.parse(fs.readFileSync(`/tmp/crop/${c}.raw.json`)), b = fs.readFileSync(`/tmp/crop/${c}.raw`);
  const hu = new Int16Array(b.buffer, b.byteOffset, b.length / 2), t0 = Date.now();
  const box = await I.rileva(hu, meta.d, esegui);
  const l = [];
  for (const x of box) { if (x.s < 0.3) break;
    const cc = [0, 1, 2].map((a) => (x.box[a] + x.box[a + 3]) / 2), g = cc.map((v, a) => v + meta.lo[a]);
    const lps = [meta.org[0] - g[0] * SP[0], meta.org[1] - g[1] * SP[1], meta.org[2] + g[2] * SP[2]].map((v) => +v.toFixed(1));
    const m = I.misura(hu, meta.d, cc); l.push({ s: +x.s.toFixed(3), lps, d: m?.diametro_medio_mm ?? null, lr: m?.lung_rads ?? null, tocca: m?.tocca ?? null }); }
  ris[c] = { t: (Date.now() - t0) / 1000, l }; fs.writeFileSync(uscita, JSON.stringify(ris, null, 1));
  console.log(c, ris[c].t, 's', l.filter((x) => x.s >= SCORE_MIN).length, 'candidati >= 0,5');
}
