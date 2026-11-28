// atlanteRM (template) contro MindSnap (segmentazione del paziente) sui casi 178-180: accordo voxel per voxel
import fs from 'node:fs'; import zlib from 'node:zlib';
const W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/', D = '/tmp/rmset/', C = '/Volumes/Caloggero/piattaforma-quiz/casi-free/';
const { atlanteRM } = await import(W + 'atlante-tc.js'); const AE = await import(W + 'atlante-encefalo.js');
const r = JSON.parse(fs.readFileSync(W + 'atlante/riferimento.json')), gz = (f) => new Uint8Array(zlib.gunzipSync(fs.readFileSync(f)));
const mni = { griglia: r.strutture, str: gz(W + 'atlante/' + r.strutture.file), art: gz(W + 'atlante/' + r.arterie.file) }, t1 = gz(W + 'atlante/' + r.t1.file);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const coppie = [['0001_3D_AX_T_0', 'caso-tcia-180/ia/0001_3D_AX_T1_postcontrast'], ['0003_3D_AX_T_0', 'caso-tcia-179/ia/0003_3D_AX_T1_postcontrast'], ['0002_3D_AX_T_0', 'caso-tcia-178/ia/0002_3D_AX_T2_FLAIR'], ['0002_3D_SAG__0', 'caso-tcia-180/ia/0002_3D_SAG_T2_FLAIR']];
const classe = (nm) => !nm ? 0 : /Vent|^CSF$/.test(nm) ? 1 : /White-Matter|Brain-Stem|^CC_/.test(nm) ? 3 : 2;
const varianti = [['affine', { deformabile: false, rifinitura: false }], ['deform', { deformabile: true, rifinitura: false }], ['deform+bordi', { deformabile: true, rifinitura: true }], ['affine+bordi', { deformabile: false, rifinitura: true }]];
for (const [vn, ia] of coppie) {
  const m = JSON.parse(fs.readFileSync(D + vn + '.json')), b = fs.readFileSync(D + vn + '.f32'), v = { ...m, dati: new Float32Array(b.buffer, b.byteOffset, b.length / 4) };
  const sg = JSON.parse(fs.readFileSync(C + ia + '.json')), sl = gz(C + ia + '.lab.gz'), [SX, SY, SZ] = sg.dim, LS = AE.volumeLobi(sl, sg.dim, sg.etichette);
  const riga = [];
  for (const [nome, op] of varianti) {
    const o = await atlanteRM(v, { mni, t1, ...op }), g = o.geo, LO = AE.volumeLobi(o.lab, g.dim, g.etichette);
    let n = 0, uguale = 0, cl = 0, lobo = 0, nl = 0, va = 0, vb = 0, vab = 0;
    for (let k = 0, q = 0; k < SZ; k++) for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++, q++) {
      if (q % 5) continue; const es = sl[q], ns = sg.etichette[es] || '';
      const p = [0, 1, 2].map((t) => sg.origine[t] + i * sg.sp[0] * sg.assi[0][t] + j * sg.sp[1] * sg.assi[1][t] + k * sg.sp[2] * sg.assi[2][t]), d = p.map((x, t) => x - g.origine[t]);
      const ii = Math.round(dot(d, g.assi[0]) / g.sp[0]), jj = Math.round(dot(d, g.assi[1]) / g.sp[1]), kk = Math.round(dot(d, g.assi[2]) / g.sp[2]);
      const qo = ii < 0 || jj < 0 || kk < 0 || ii >= g.dim[0] || jj >= g.dim[1] || kk >= g.dim[2] ? -1 : (kk * g.dim[1] + jj) * g.dim[0] + ii;
      const eo = qo >= 0 ? o.lab[qo] : 0, no = g.etichette[eo] || '';
      const vs = /Lateral-Ventricle/.test(ns), vo = /Lateral-Ventricle/.test(no); va += vs; vb += vo; vab += vs && vo;
      if (!es) continue; n++; if (ns === no) uguale++; if (classe(ns) === classe(no)) cl++;
      if (LS[q]) { nl++; if (qo >= 0 && LO[qo] === LS[q]) lobo++; }
    }
    riga.push(`${nome}: strutt ${(uguale / n).toFixed(3)} tessuto ${(cl / n).toFixed(3)} lobo ${(lobo / nl).toFixed(3)} ventr ${(2 * vab / (va + vb)).toFixed(3)} ${o.ms}ms`);
  }
  console.log(vn, '\n  ' + riga.join('\n  '));
}
