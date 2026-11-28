// Prove approfondite dell'atlante sulla TC (28/11): esami reali (esportati da esporta_tc.py in /tmp/tcset, solo locali)
// e perturbazioni controllate (orientamento della pila, strato spesso, testa ruotata, ritagli, rumore, taratura).
// Uso: node prova_tc_robustezza.mjs [nomi...]   — stampa numeri, nessuna immagine.
import fs from 'node:fs'; import zlib from 'node:zlib';
const W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/', D = '/tmp/tcset/';
const { atlanteTC } = await import(W + 'atlante-tc.js'); const AE = await import(W + 'atlante-encefalo.js');
const r = JSON.parse(fs.readFileSync(W + 'atlante/riferimento.json'));
const mni = { griglia: r.strutture, str: new Uint8Array(zlib.gunzipSync(fs.readFileSync(W + 'atlante/' + r.strutture.file))), art: new Uint8Array(zlib.gunzipSync(fs.readFileSync(W + 'atlante/' + r.arterie.file))) };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const carica = (n) => { const m = JSON.parse(fs.readFileSync(D + n + '.json')), b = fs.readFileSync(D + n + '.f32'); return { ...m, taglio: m.taglio || [0, 0, 0], dati: new Float32Array(b.buffer, b.byteOffset, b.length / 4) }; };
const pos = (v, i, j, k) => [0, 1, 2].map((r) => v.origine[r] + i * v.sp[0] * v.assi[0][r] + j * v.sp[1] * v.assi[1][r] + k * (v.sp[2] * v.assi[2][r] + v.taglio[r]));
const indiceVol = (v, p) => { const q = p.map((x, r) => x - v.origine[r]), k = dot(q, v.assi[2]) / v.sp[2], q2 = q.map((x, r) => x - k * v.taglio[r]); return [dot(q2, v.assi[0]) / v.sp[0], dot(q2, v.assi[1]) / v.sp[1], k]; };
const campVol = (v, p) => { const [x, y, z] = indiceVol(v, p); const i = Math.round(x), j = Math.round(y), k = Math.round(z);
  return i < 0 || j < 0 || k < 0 || i >= v.W || j >= v.H || k >= v.N ? -1024 : v.dati[(k * v.H + j) * v.W + i]; };
const campTri = (v, p) => { const [x, y, z] = indiceVol(v, p); if (x < 0 || y < 0 || z < 0 || x > v.W - 1 || y > v.H - 1 || z > v.N - 1) return -1024;
  const i = Math.min(v.W - 2, x | 0), j = Math.min(v.H - 2, y | 0), k = Math.min(Math.max(0, v.N - 2), z | 0), a = x - i, b = y - j, c = z - k, W2 = v.W, S = v.W * v.H, d = v.dati, o = (k * v.H + j) * v.W + i;
  const p0 = (d[o] * (1 - a) + d[o + 1] * a) * (1 - b) + (d[o + W2] * (1 - a) + d[o + W2 + 1] * a) * b; if (v.N < 2) return p0;
  const p1 = (d[o + S] * (1 - a) + d[o + S + 1] * a) * (1 - b) + (d[o + S + W2] * (1 - a) + d[o + S + W2 + 1] * a) * b; return p0 * (1 - c) + p1 * c; };
// riduzione a ~1 mm nel piano (per le perturbazioni, più veloci)
function riduci(v, f) { const W2 = Math.floor(v.W / f), H2 = Math.floor(v.H / f), out = new Float32Array(W2 * H2 * v.N);
  for (let k = 0; k < v.N; k++) for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) { let s = 0; for (let b = 0; b < f; b++) for (let a = 0; a < f; a++) s += v.dati[(k * v.H + j * f + b) * v.W + i * f + a]; out[(k * H2 + j) * W2 + i] = s / (f * f); }
  return { ...v, W: W2, H: H2, dati: out, sp: [v.sp[0] * f, v.sp[1] * f, v.sp[2]], origine: v.origine.map((x, r) => x + (f - 1) / 2 * (v.sp[0] * v.assi[0][r] + v.sp[1] * v.assi[1][r])) }; }
// geometria dell'uscita (griglia ortogonale) → indice
const idxGeo = (g, p) => { const q = p.map((x, r) => x - g.origine[r]); const i = Math.round(dot(q, g.assi[0]) / g.sp[0]), j = Math.round(dot(q, g.assi[1]) / g.sp[1]), k = Math.round(dot(q, g.assi[2]) / g.sp[2]);
  return i < 0 || j < 0 || k < 0 || i >= g.dim[0] || j >= g.dim[1] || k >= g.dim[2] ? -1 : (k * g.dim[1] + j) * g.dim[0] + i; };
const posGeo = (g, i, j, k) => [0, 1, 2].map((r) => g.origine[r] + i * g.sp[0] * g.assi[0][r] + j * g.sp[1] * g.assi[1][r] + k * g.sp[2] * g.assi[2][r]);
const lobi = (o) => (o.lobi ||= AE.volumeLobi(o.lab, o.geo.dim, o.geo.etichette));
// accordo tra due risultati: per ogni voxel di B la posizione corrispondente in A (mappa)
function accordo(A, B, mappa = (p) => p) {
  const LA = lobi(A), LB = lobi(B), [X, Y, Z] = B.geo.dim; let n = 0, s = 0, l = 0, a = 0, na = 0, nb = 0, fuori = 0;
  for (let k = 0, q = 0; k < Z; k++) for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++, q++) {
    if (!B.lab[q]) continue; if ((q % 7) !== 0) continue; nb++;
    const m = idxGeo(A.geo, mappa(posGeo(B.geo, i, j, k))); if (m < 0 || !A.lab[m]) { fuori++; continue; }
    n++; if (A.lab[m] === B.lab[q]) s++; if (LA[m] && LA[m] === LB[q]) l++; if (A.art[m] && B.art[q]) { na++; if (A.art[m] === B.art[q]) a++; }
  }
  return { strutture: +(s / n).toFixed(3), lobi: +(l / n).toFixed(3), territori: +(a / Math.max(1, na)).toFixed(3), soloB: +(fuori / Math.max(1, nb)).toFixed(3) };
}
// controlli anatomici su un risultato
function anatomia(v, o) {
  const g = o.geo, [X, Y, Z] = g.dim, S = {}, add = (k, p, hu) => { const e = (S[k] ||= [0, 0, 0, 0, 0, 0]); e[0] += p[0]; e[1] += p[1]; e[2] += p[2]; e[3]++; if (hu > -500) { e[4] += hu; e[5]++; } };
  const nomi = g.etichette, LB = lobi(o);
  for (let k = 0, q = 0; k < Z; k++) for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++, q++) {
    const v0 = o.lab[q]; if (!v0 || (q % 3)) continue; const n = nomi[v0] || '', p = posGeo(g, i, j, k), hu = campVol(v, p);
    if (/^ctx-lh|^Left-/.test(n)) add('sin', p, hu); else if (/^ctx-rh|^Right-/.test(n)) add('dx', p, hu);
    if (/Lateral-Ventricle/.test(n)) add('ventricoli', p, hu); else if (/Cerebral-White-Matter/.test(n)) add('bianca', p, hu); else if (/^ctx-/.test(n)) add('corteccia', p, hu);
    if (/Cerebellum/.test(n)) add('cervelletto', p, hu); if (LB[q] === 1) add('frontale', p, hu); if (LB[q] === 4) add('occipitale', p, hu); if (LB[q] === 2) add('parietale', p, hu);
  }
  const c = (k) => S[k] ? S[k].slice(0, 3).map((x) => x / S[k][3]) : [NaN, NaN, NaN], hu = (k) => S[k]?.[5] ? +(S[k][4] / S[k][5]).toFixed(1) : NaN;
  // LPS: sinistra = x maggiore, dietro = y maggiore, sopra = z maggiore
  return { lateralita_mm: +(c('sin')[0] - c('dx')[0]).toFixed(1), fronte_dietro_mm: +(c('occipitale')[1] - c('frontale')[1]).toFixed(1), cervelletto_sotto_mm: +(c('parietale')[2] - c('cervelletto')[2]).toFixed(1),
    hu_ventricoli: hu('ventricoli'), hu_bianca: hu('bianca'), hu_corteccia: hu('corteccia') };
}
const esegui = async (v) => { try { return await atlanteTC(v, { mni }); } catch (e) { return { errore: e.message }; } };
const riga = (nome, o, extra = {}) => console.log(JSON.stringify({ nome, ...(o.errore ? { errore: o.errore } : { ms: o.ms, dice: +o.tc.dice.toFixed(3), ncc: +o.tc.ncc.toFixed(3), mL: Math.round(o.tc.volume), hu_v: o.tc.huVentricoli?.toFixed(1), hu_b: o.tc.huBianca?.toFixed(1), qualita: o.tc.tagliato ? 'scarsa (tagliata)' : (o.tc.huBianca - o.tc.huVentricoli) < 6 ? 'scarsa (ventricoli)' : o.tc.dice >= 0.85 && o.tc.ncc >= 0.45 ? 'discreta' : 'scarsa' }), ...extra }));
const modo = process.argv[2] || 'reali';
if (modo === 'reali') {
  for (const n of process.argv.slice(3).length ? process.argv.slice(3) : fs.readdirSync(D).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))) {
    const v = carica(n), o = await esegui(v);
    riga(n, o, { descr: v.descrizione, strato: v.sp[2].toFixed(2), taglio: +Math.hypot(...v.taglio).toFixed(3), ...(o.errore ? {} : anatomia(v, o)) });
  }
} else {
  // perturbazioni su un esame (ridotto a ~1 mm nel piano)
  const n = process.argv[3], v0 = carica(n), f = Math.max(1, Math.round(0.9 / v0.sp[0])), v = f > 1 ? riduci(v0, f) : v0, A = await esegui(v);
  riga(n + ' base', A, anatomia(v, A));
  const prova = async (nome, w, mappa) => { const B = await esegui(w); riga(nome, B, B.errore ? {} : { ...accordo(A, B, mappa), ...anatomia(w, B) }); };
  // 1. stessa TC salvata come pila sagittale (righe = fette, fette = colonne)
  { const d = new Float32Array(v.dati.length); for (let k = 0; k < v.N; k++) for (let j = 0; j < v.H; j++) for (let i = 0; i < v.W; i++) d[(i * v.N + k) * v.H + j] = v.dati[(k * v.H + j) * v.W + i];
    if (Math.hypot(...v.taglio) < 1e-6) await prova('pila sagittale', { ...v, W: v.H, H: v.N, N: v.W, dati: d, assi: [v.assi[1], v.assi[2], v.assi[0]], sp: [v.sp[1], v.sp[2], v.sp[0]] }); }
  // 2. strato spesso (5 mm, media delle fette)
  { const g = Math.max(1, Math.round(5 / v.sp[2])), N2 = Math.floor(v.N / g), d = new Float32Array(v.W * v.H * N2);
    for (let k = 0; k < N2; k++) for (let q = 0; q < v.W * v.H; q++) { let s = 0; for (let t = 0; t < g; t++) s += v.dati[(k * g + t) * v.W * v.H + q]; d[k * v.W * v.H + q] = s / g; }
    if (g > 1) await prova('strato 5 mm', { ...v, N: N2, dati: d, sp: [v.sp[0], v.sp[1], v.sp[2] * g], taglio: v.taglio.map((x) => x * g), origine: v.origine.map((x, r) => x + (g - 1) / 2 * (v.sp[2] * v.assi[2][r] + v.taglio[r])) }); }
  // 3. testa ruotata (flessione/estensione, rotazione, inclinazione laterale) attorno al centro
  const c = pos(v, v.W / 2, v.H / 2, v.N / 2);
  const R = (ax, g) => { const s = Math.sin(g * Math.PI / 180), co = Math.cos(g * Math.PI / 180); return ax === 0 ? [[1, 0, 0], [0, co, -s], [0, s, co]] : ax === 1 ? [[co, 0, s], [0, 1, 0], [-s, 0, co]] : [[co, -s, 0], [s, co, 0], [0, 0, 1]]; };
  const ap = (M, p) => [0, 1, 2].map((r) => M[r][0] * p[0] + M[r][1] * p[1] + M[r][2] * p[2]), tr = (M) => M[0].map((_, j) => M.map((row) => row[j]));
  for (const [ax, g, nome] of [[0, 20, 'flessione 20°'], [0, -20, 'estensione 20°'], [2, 15, 'rotazione 15°'], [1, 10, 'inclinazione laterale 10°'], [0, 35, 'flessione 35°']]) {
    const M = R(ax, g), Mi = tr(M), indietro = (p) => { const q = ap(Mi, p.map((x, r) => x - c[r])); return q.map((x, r) => x + c[r]); }, d = new Float32Array(v.dati.length);
    for (let k = 0, q = 0; k < v.N; k++) for (let j = 0; j < v.H; j++) for (let i = 0; i < v.W; i++, q++) d[q] = campTri(v, indietro(pos(v, i, j, k)));
    await prova(nome, { ...v, dati: d }, indietro);
  }
  // 4. ritagli: manca la volta (alto) o la base (basso)
  for (const [mm, alto] of [[30, true], [50, true], [40, false]]) { const m = Math.round(mm / v.sp[2]), N2 = v.N - m, o0 = alto ? 0 : m;
    await prova(`senza ${mm} mm ${alto ? 'in alto' : 'in basso'}`, { ...v, N: N2, dati: v.dati.slice(o0 * v.W * v.H, (o0 + N2) * v.W * v.H), origine: alto ? v.origine : pos(v, 0, 0, m) }); }
  // 5. rumore (σ 15 HU) e taratura spostata (+20 HU)
  { let sem = 12345; const rnd = () => ((sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648); const d = new Float32Array(v.dati.length);
    for (let q = 0; q < d.length; q++) d[q] = v.dati[q] + 15 * Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    await prova('rumore σ 15 HU', { ...v, dati: d }); }
  await prova('taratura +20 HU', { ...v, dati: v.dati.map((x) => x + 20) });
}
