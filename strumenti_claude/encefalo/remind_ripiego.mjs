// ripiego (atlanteRM) sui pazienti ReMIND: lobi nella zona del tumore (allargata di 5 mm) contro la tabella clinica
import fs from 'node:fs'; import zlib from 'node:zlib';
const W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/', D = '/tmp/remind_vol/';
const { atlanteRM } = await import(W + 'atlante-tc.js'); const AE = await import(W + 'atlante-encefalo.js');
const r = JSON.parse(fs.readFileSync(W + 'atlante/riferimento.json')), gz = (f) => new Uint8Array(zlib.gunzipSync(fs.readFileSync(W + 'atlante/' + f)));
const mni = { griglia: r.strutture, str: gz(r.strutture.file), art: gz(r.arterie.file) }, t1 = gz(r.t1.file);
const LOBO = { 1: 'frontale', 2: 'parietale', 3: 'temporale', 4: 'occipitale', 5: 'insula', 6: 'cingolo' };
const PAROLE = { frontale: ['frontal', 'orbitofrontal', 'caudate', 'septal', 'precentral'], parietale: ['parietal', 'postcentral', 'post-central'], temporale: ['temporal', 'sylvian', 'amygdala', 'mesial'], occipitale: ['occipital'], insula: ['insular', 'insula'], cingolo: ['cingul', 'corpus callosum'] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let n = 0, okL = 0, okB = 0, nSnap = 0, accordo = 0;
for (const f of fs.readdirSync(D).filter((x) => x.endsWith('.json'))) {
  const m = JSON.parse(fs.readFileSync(D + f)), b = fs.readFileSync(D + f.replace('.json', '.f32'));
  const o = await atlanteRM({ ...m, dati: new Float32Array(b.buffer, b.byteOffset, b.length / 4) }, { mni, t1 }), g = o.geo;
  const L = AE.volumeLobi(o.lab, g.dim, g.etichette), cont = {}, lato = { Left: 0, Right: 0 };
  for (const p of m.tumore) for (let dz = -5; dz <= 5; dz += 2.5) for (let dy = -5; dy <= 5; dy += 2.5) for (let dx = -5; dx <= 5; dx += 2.5) {
    const q = [p[0] + dx - g.origine[0], p[1] + dy - g.origine[1], p[2] + dz - g.origine[2]];
    const i = Math.round(dot(q, g.assi[0]) / g.sp[0]), j = Math.round(dot(q, g.assi[1]) / g.sp[1]), k = Math.round(dot(q, g.assi[2]) / g.sp[2]);
    if (i < 0 || j < 0 || k < 0 || i >= g.dim[0] || j >= g.dim[1] || k >= g.dim[2]) continue;
    const idx = (k * g.dim[1] + j) * g.dim[0] + i, nm = g.etichette[o.lab[idx]] || '';
    if (/^ctx-/.test(nm)) { const l = LOBO[L[idx]] || (/insula/.test(nm) ? 'insula' : /cingulate/.test(nm) ? 'cingolo' : null); if (l) cont[l] = (cont[l] || 0) + 1; }
    if (/^ctx-lh|^Left/.test(nm)) lato.Left++; else if (/^ctx-rh|^Right/.test(nm)) lato.Right++;
  }
  const tot = Object.values(cont).reduce((a, x) => a + x, 0) || 1, lobi = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l, c]) => [l, +(c / tot).toFixed(2)]);
  const sede = String(m.sede).toLowerCase(), attesi = Object.keys(PAROLE).filter((l) => PAROLE[l].some((w) => sede.includes(w)));
  const latoA = lato.Left >= lato.Right ? 'Left' : 'Right', ok1 = latoA.toLowerCase() === String(m.lato).toLowerCase() || /midline|paramedian/.test(sede), ok2 = lobi.some(([l, fr]) => fr >= 0.2 && attesi.includes(l));
  const snapTop = m.snap?.[0]?.[0], tmTop = lobi[0]?.[0]; if (snapTop) { nSnap++; if (snapTop === tmTop) accordo++; }
  n++; okL += ok1; okB += ok2;
  console.log(f.replace('.json', ''), '|', m.sede, '| template:', latoA, JSON.stringify(lobi), ok1 ? '' : 'LATO✖', ok2 ? '' : 'LOBO✖', '| MindSnap:', snapTop, '| dice testa', o.tm.dice.toFixed(2));
}
console.log(`RIASSUNTO ripiego: ${n} pazienti · lato ${okL} · lobo ${okB} · stesso lobo principale di MindSnap ${accordo}/${nSnap}`);
