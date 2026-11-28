import fs from 'node:fs'; import zlib from 'node:zlib';
const W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/', D = '/tmp/tcset/';
const { atlanteTC } = await import(W + 'atlante-tc.js');
const r = JSON.parse(fs.readFileSync(W + 'atlante/riferimento.json')), gz = (f) => new Uint8Array(zlib.gunzipSync(fs.readFileSync(W + 'atlante/' + f)));
const mni = { griglia: r.strutture, str: gz(r.strutture.file), art: gz(r.arterie.file) }, t1 = gz(r.t1.file);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lista = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(D).filter((f) => f.endsWith('.json') && !f.includes('.geo')).map((f) => f.slice(0, -5));
for (const nome of lista) {
  const m = JSON.parse(fs.readFileSync(D + nome + '.json')), b = fs.readFileSync(D + nome + '.f32');
  const v = { ...m, taglio: m.taglio || [0, 0, 0], dati: new Float32Array(b.buffer, b.byteOffset, b.length / 4) };
  const res = {};
  for (const deformabile of [false, true]) res[deformabile] = await atlanteTC(v, { mni, t1, deformabile, rifinitura: deformabile }).catch((e) => ({ errore: e.message }));
  if (res[false].errore) { console.log(nome, res[false].errore); continue; }
  const g = res[false].geo, [X, Y, Z] = g.dim, n = X * Y * Z, hu = new Float32Array(n);
  for (let k = 0, q = 0; k < Z; k++) for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++, q++) {
    const p = [0, 1, 2].map((t) => g.origine[t] + i * g.sp[0] * g.assi[0][t] + j * g.sp[1] * g.assi[1][t] + k * g.sp[2] * g.assi[2][t]), d = p.map((x, t) => x - v.origine[t]);
    const kk = Math.round(dot(d, v.assi[2]) / v.sp[2]), d2 = d.map((x, t) => x - kk * v.taglio[t]), ii = Math.round(dot(d2, v.assi[0]) / v.sp[0]), jj = Math.round(dot(d2, v.assi[1]) / v.sp[1]);
    hu[q] = ii < 0 || jj < 0 || kk < 0 || ii >= v.W || jj >= v.H || kk >= v.N ? -1000 : v.dati[(kk * v.H + jj) * v.W + ii];
  }
  const ven = (o) => { const e = o.geo.etichette, s = new Uint8Array(256); for (const [k, nm] of Object.entries(e)) if (/Lateral-Ventricle|Inf-Lat-Vent|3rd-Ventricle/.test(nm)) s[+k] = 1; return s; };
  // regione: ventricoli dell'affine allargati di ~8 voxel nel piano e 3 fuori piano
  const VA = ven(res[false]), reg = new Uint8Array(n);
  for (let k = 0, q = 0; k < Z; k++) for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++, q++) if (VA[res[false].lab[q]])
    for (let c = -3; c <= 3; c++) for (let bb = -8; bb <= 8; bb += 2) for (let a = -8; a <= 8; a += 2) { const x = i + a, y = j + bb, z = k + c; if (x >= 0 && y >= 0 && z >= 0 && x < X && y < Y && z < Z) reg[(z * Y + y) * X + x] = 1; }
  const out = [];
  for (const d of [false, true]) { const o = res[d]; if (o.errore) { out.push(o.errore); continue; } const V = ven(o); let a = 0, bv = 0, ab = 0;
    for (let q = 0; q < n; q++) { if (!reg[q]) continue; const csf = hu[q] > -5 && hu[q] < 16 ? 1 : 0, vv = V[o.lab[q]] ? 1 : 0; a += csf; bv += vv; ab += csf & vv; }
    out.push(`${d ? 'deform' : 'affine'} Dice ventricoli ${(2 * ab / (a + bv)).toFixed(3)} (${o.ms} ms, def ${o.tc.deformazione})`); }
  console.log(nome, '|', out.join(' | '));
}
