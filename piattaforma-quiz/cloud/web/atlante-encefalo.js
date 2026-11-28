// Atlante dell'encefalo nel visualizzatore: strutture e giri (MindSnap, 104 classi Desikan-Killiany), lobi e territori
// arteriosi (Digital 3D Brain MRI Arterial Territories Atlas, Johns Hopkins University, CC BY-SA 4.0) sopra le immagini.
// Nei casi del sito strutture e territori sono calcolati sul Mac (strumenti_claude/encefalo/segmenta_encefalo.py) e
// pubblicati con il caso; nel visualizzatore gratuito si calcolano qui, nel browser, con @brainchop/core (MIT): le
// immagini non escono dal computer. Strumento didattico: non è un dispositivo medico.

// ---------------------------------------------------------------- nomi italiani
const GIRI = {
  bankssts: 'sponde del solco temporale superiore', caudalanteriorcingulate: 'cingolo anteriore (parte caudale)',
  caudalmiddlefrontal: 'giro frontale medio (parte caudale)', cuneus: 'cuneo', entorhinal: 'corteccia entorinale', fusiform: 'giro fusiforme',
  inferiorparietal: 'lobulo parietale inferiore', inferiortemporal: 'giro temporale inferiore', isthmuscingulate: 'istmo del cingolo',
  lateraloccipital: 'corteccia occipitale laterale', lateralorbitofrontal: 'corteccia orbitofrontale laterale', lingual: 'giro linguale',
  medialorbitofrontal: 'corteccia orbitofrontale mediale', middletemporal: 'giro temporale medio', parahippocampal: 'giro paraippocampale',
  paracentral: 'lobulo paracentrale', parsopercularis: 'giro frontale inferiore, pars opercularis', parsorbitalis: 'giro frontale inferiore, pars orbitalis',
  parstriangularis: 'giro frontale inferiore, pars triangularis', pericalcarine: 'corteccia pericalcarina (scissura calcarina)',
  postcentral: 'giro postcentrale', posteriorcingulate: 'cingolo posteriore', precentral: 'giro precentrale', precuneus: 'precuneo',
  rostralanteriorcingulate: 'cingolo anteriore (parte rostrale)', rostralmiddlefrontal: 'giro frontale medio (parte rostrale)',
  superiorfrontal: 'giro frontale superiore', superiorparietal: 'lobulo parietale superiore', superiortemporal: 'giro temporale superiore',
  supramarginal: 'giro sopramarginale', frontalpole: 'polo frontale', temporalpole: 'polo temporale',
  transversetemporal: 'giro temporale trasverso (di Heschl)', insula: 'insula',
};
const ALTRE = {
  'Thalamus-Proper*': 'talamo', Caudate: 'nucleo caudato', Putamen: 'putamen', Pallidum: 'globo pallido', Hippocampus: 'ippocampo',
  Amygdala: 'amigdala', 'Accumbens-area': 'nucleo accumbens', VentralDC: 'diencefalo ventrale', 'Cerebral-White-Matter': 'sostanza bianca cerebrale',
  'Lateral-Ventricle': 'ventricolo laterale', 'Inf-Lat-Vent': 'corno temporale del ventricolo laterale', '3rd-Ventricle': 'III ventricolo',
  '4th-Ventricle': 'IV ventricolo', CSF: 'liquor', 'Brain-Stem': 'tronco encefalico', 'Cerebellum-White-Matter': 'sostanza bianca cerebellare',
  'Cerebellum-Cortex': 'corteccia cerebellare', CC_Posterior: 'corpo calloso, splenio', CC_Mid_Posterior: 'corpo calloso, corpo (parte posteriore)',
  CC_Central: 'corpo calloso, corpo', CC_Mid_Anterior: 'corpo calloso, corpo (parte anteriore)', CC_Anterior: 'corpo calloso, ginocchio',
};
// struttura FreeSurfer → { base, lato: 'sin'|'dx'|'' }
export function scomponi(n) {
  let m = /^ctx-(lh|rh)-(.+)$/.exec(n || '');
  if (m) return { base: m[2], lato: m[1] === 'lh' ? 'sin' : 'dx', corteccia: true };
  m = /^(Left|Right)-(.+)$/.exec(n || '');
  if (m) return { base: m[2], lato: m[1] === 'Left' ? 'sin' : 'dx' };
  return { base: n || '', lato: '' };
}
export function nomeStruttura(n) {
  const s = scomponi(n), t = (s.corteccia ? GIRI[s.base] : ALTRE[s.base]) || s.base.replace(/[-_]/g, ' ');
  return t + (s.lato ? ` ${s.lato === 'sin' ? 'sin.' : 'dx'}` : '');
}
export const eAtlanteEncefalo = (n) => /^ctx-(lh|rh)-|^(Left|Right)-(Cerebral|Cerebellum|Thalamus|Caudate|Putamen|Pallidum|Hippocampus|Amygdala|Accumbens|VentralDC|Lateral|Inf-Lat)|^CC_|^Brain-Stem$|^(3rd|4th)-Ventricle$/.test(n || '');

// ---------------------------------------------------------------- lobi (raggruppamento dei giri; il limbico come nei testi italiani)
export const LOBI = {
  1: ['lobo frontale', [72, 120, 230]], 2: ['lobo parietale', [236, 190, 50]], 3: ['lobo temporale', [70, 190, 110]],
  4: ['lobo occipitale', [228, 82, 82]], 5: ['insula', [170, 110, 220]], 6: ['lobo limbico', [40, 200, 210]],
  7: ['nuclei della base, talamo e diencefalo', [235, 150, 190]], 8: ['tronco encefalico', [190, 160, 120]], 9: ['cervelletto', [150, 200, 150]],
  10: ['corpo calloso', [230, 230, 230]],
};
const DEL_LOBO = {
  1: 'superiorfrontal rostralmiddlefrontal caudalmiddlefrontal parsopercularis parstriangularis parsorbitalis lateralorbitofrontal medialorbitofrontal precentral paracentral frontalpole',
  2: 'superiorparietal inferiorparietal supramarginal postcentral precuneus',
  3: 'superiortemporal middletemporal inferiortemporal bankssts fusiform transversetemporal temporalpole',
  4: 'lateraloccipital lingual cuneus pericalcarine', 5: 'insula',
  6: 'rostralanteriorcingulate caudalanteriorcingulate posteriorcingulate isthmuscingulate parahippocampal entorhinal',
};
const LOBO_DI = {}; for (const [k, l] of Object.entries(DEL_LOBO)) for (const g of l.split(' ')) LOBO_DI[g] = +k;
export function loboDi(n) {
  const s = scomponi(n);
  if (s.corteccia) return LOBO_DI[s.base] || 0;
  if (/^(Thalamus|Caudate|Putamen|Pallidum|Accumbens|VentralDC|Hippocampus|Amygdala)/.test(s.base)) return s.base.startsWith('Hippo') || s.base.startsWith('Amyg') ? 6 : 7;
  if (s.base === 'Brain-Stem') return 8;
  if (/^Cerebellum/.test(s.base)) return 9;
  if (/^CC_/.test(s.base)) return 10;
  return 0;                                   // sostanza bianca (si assegna al lobo più vicino), ventricoli, liquor
}
// nome del lobo per il puntatore: il lobulo paracentrale è a cavallo tra frontale (parte anteriore) e parietale
export function nomeLobo(l, n) { return scomponi(n).base === 'paracentral' ? 'lobi frontale e parietale' : LOBI[l]?.[0] || ''; }
// colore del giro: tinta del lobo, chiarezza diversa per ogni giro
export function coloreStruttura(n) {
  const s = scomponi(n), l = loboDi(n);
  if (!l) return /White-Matter/.test(s.base) ? null : /Vent|CSF/.test(s.base) ? null : [200, 200, 200];
  const c = LOBI[l][1];
  if (!s.corteccia) return c;
  const elenco = DEL_LOBO[l].split(' '), i = Math.max(0, elenco.indexOf(s.base)), f = 0.62 + 0.76 * (i / Math.max(1, elenco.length - 1));
  return c.map((v) => Math.max(0, Math.min(255, Math.round(v * f + (f > 1 ? (f - 1) * 120 : 0)))));
}

// ---------------------------------------------------------------- territori arteriosi (livello 1 dell'atlante JHU)
export const PRINCIPALI = {
  ACA: ['arteria cerebrale anteriore', [70, 130, 240]], ACM: ['arteria cerebrale media', [235, 90, 70]],
  ACP: ['arteria cerebrale posteriore', [80, 190, 100]], VB: ['sistema vertebro-basilare', [175, 110, 220]],
  CI: ['arteria coroidea anteriore (dalla carotide interna)', [170, 140, 20]],
};
const T = (n, p, c) => ({ n, p, c });
export const ARTERIE = {
  1: T('arteria cerebrale anteriore', 'ACA', [70, 130, 240]), 3: T('lenticolostriate mediali (ACA)', 'ACA', [130, 180, 250]),
  5: T('lenticolostriate laterali (ACM)', 'ACM', [250, 170, 120]), 7: T('ACM, rami frontali', 'ACM', [230, 70, 60]),
  9: T('ACM, rami parietali', 'ACM', [245, 130, 50]), 11: T('ACM, rami temporali', 'ACM', [240, 200, 60]),
  13: T('ACM, rami occipitali', 'ACM', [250, 150, 150]), 15: T('ACM, rami insulari', 'ACM', [220, 100, 160]),
  17: T('ACP, rami temporali', 'ACP', [90, 200, 110]), 19: T('ACP, rami occipitali', 'ACP', [40, 150, 80]),
  21: T('coroidee posteriori e talamoperforanti (ACP)', 'ACP', [110, 220, 200]),
  // coroidea anteriore: l'atlante JHU la raggruppa con i territori posteriori, ma nasce dalla carotide interna
  23: T('arteria coroidea anteriore (carotide interna)', 'CI', [170, 140, 20]),
  25: T('arteria basilare (perforanti del tronco)', 'VB', [160, 90, 210]), 27: T('arteria cerebellare superiore', 'VB', [200, 150, 240]),
  29: T('arterie cerebellari inferiori (anteriore e posteriore)', 'VB', [140, 120, 200]),
};
// i numeri dispari sono a sinistra, i pari a destra (stesso territorio)
export function arteria(v) { const a = ARTERIE[v % 2 ? v : v - 1]; return a ? { ...a, lato: v % 2 ? 'sin' : 'dx' } : null; }

// ---------------------------------------------------------------- volumi derivati
// lobi: corteccia per lobo; la sostanza bianca prende il lobo (frontale, parietale, temporale, occipitale) della corteccia più vicina dello stesso emisfero
// (crescita a partire dalla corteccia, vicini a 6, dentro la sostanza bianca).
export function volumeLobi(lab, dim, etichette) {
  const [W, H, N] = dim, n = W * H * N, out = new Uint8Array(n), lut = new Uint8Array(256), bianca = new Uint8Array(256);
  for (const [k, nome] of Object.entries(etichette)) { lut[+k] = loboDi(nome); if (/^(Left|Right)-Cerebral-White-Matter$/.test(nome)) bianca[+k] = nome.startsWith('Left') ? 1 : 2; }
  const emi = new Uint8Array(256);
  for (const [k, nome] of Object.entries(etichette)) { const s = scomponi(nome); emi[+k] = s.lato === 'sin' ? 1 : s.lato === 'dx' ? 2 : 0; }
  const coda = new Int32Array(n); let testa = 0, fine = 0;
  // solo i quattro lobi classici crescono nella sostanza bianca: insula e limbico restano sulla loro corteccia
  for (let i = 0; i < n; i++) { const l = lut[lab[i]]; out[i] = l; if (l >= 1 && l <= 4) coda[fine++] = i; }
  const WH = W * H;
  while (testa < fine) {
    const i = coda[testa++], l = out[i], e = emi[lab[i]], x = i % W, y = ((i / W) | 0) % H, z = (i / WH) | 0;
    const vicini = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1, z > 0 ? i - WH : -1, z < N - 1 ? i + WH : -1];
    for (const j of vicini) if (j >= 0 && !out[j] && bianca[lab[j]] && (!e || bianca[lab[j]] === e)) { out[j] = l; coda[fine++] = j; }
  }
  return out;
}

// voxel (i, j, k) della griglia → coordinate RAS (mm)
function ras(geo, i, j, k) {
  const o = geo.origine, a = geo.assi, s = geo.sp;
  const x = o[0] + i * s[0] * a[0][0] + j * s[1] * a[1][0] + k * s[2] * a[2][0];
  const y = o[1] + i * s[0] * a[0][1] + j * s[1] * a[1][1] + k * s[2] * a[2][1];
  const z = o[2] + i * s[0] * a[0][2] + j * s[1] * a[1][2] + k * s[2] * a[2][2];
  return [-x, -y, z];                          // mondo DICOM (LPS) → RAS
}
const liquor = (n) => /Vent|^CSF$/.test(n || '');
// centri delle strutture (RAS mm) e numero di voxel
export function centri(lab, geo) {
  const [W, H, N] = geo.dim, S = new Float64Array(256 * 4);
  for (let k = 0, q = 0; k < N; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++, q++) {
    const v = lab[q]; if (!v) continue; const b = v * 4; S[b] += i; S[b + 1] += j; S[b + 2] += k; S[b + 3]++;
  }
  const out = {};
  for (let v = 1; v < 256; v++) { const n = S[v * 4 + 3]; if (n >= 30) out[v] = [...ras(geo, S[v * 4] / n, S[v * 4 + 1] / n, S[v * 4 + 2] / n), n]; }
  return out;
}
// thin-plate spline regolarizzata paziente → MNI (stessa formula di segmenta_encefalo.py)
const U = (d) => (d > 0 ? d * d * Math.log(d) : 0);
export function adatta(pz, mni, etichette, liscio = 8) {
  const chiavi = Object.keys(pz).filter((k) => mni[k] && !liquor(etichette[k]));
  const X = chiavi.map((k) => pz[k].slice(0, 3)), Y = chiavi.map((k) => mni[k].slice(0, 3)), n = X.length, m = n + 4, lam = liscio ** 3 * n;
  const A = Array.from({ length: m }, () => new Float64Array(m)), B = Array.from({ length: m }, () => new Float64Array(3));
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) A[a][b] = U(Math.hypot(X[a][0] - X[b][0], X[a][1] - X[b][1], X[a][2] - X[b][2])) + (a === b ? lam : 0);
    const P = [1, ...X[a]]; for (let c = 0; c < 4; c++) { A[a][n + c] = P[c]; A[n + c][a] = P[c]; }
    B[a][0] = Y[a][0]; B[a][1] = Y[a][1]; B[a][2] = Y[a][2];
  }
  for (let c = 0; c < m; c++) {                // eliminazione di Gauss con pivot parziale
    let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = c + 1; r < m; r++) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let q = c; q < m; q++) A[r][q] -= f * A[c][q]; for (let q = 0; q < 3; q++) B[r][q] -= f * B[c][q]; }
  }
  const S = Array.from({ length: m }, () => new Float64Array(3));
  for (let r = m - 1; r >= 0; r--) for (let q = 0; q < 3; q++) { let v = B[r][q]; for (let c = r + 1; c < m; c++) v -= A[r][c] * S[c][q]; S[r][q] = v / A[r][r]; }
  const t = { X, w: S.slice(0, n), a: S.slice(n), chiavi };
  const res = X.map((x, i) => { const y = applica(t, x); return Math.hypot(y[0] - Y[i][0], y[1] - Y[i][1], y[2] - Y[i][2]); }).sort((p, q) => p - q);
  t.residuo = res[res.length >> 1] || 0;
  return t;
}
export function applica(t, q) {
  const out = [t.a[0][0] + t.a[1][0] * q[0] + t.a[2][0] * q[1] + t.a[3][0] * q[2], t.a[0][1] + t.a[1][1] * q[0] + t.a[2][1] * q[1] + t.a[3][1] * q[2],
    t.a[0][2] + t.a[1][2] * q[0] + t.a[2][2] * q[1] + t.a[3][2] * q[2]];
  for (let i = 0; i < t.X.length; i++) { const x = t.X[i], u = U(Math.hypot(q[0] - x[0], q[1] - x[1], q[2] - x[2])), w = t.w[i]; out[0] += u * w[0]; out[1] += u * w[1]; out[2] += u * w[2]; }
  return out;
}
const RIF = {};
async function riferimento(base) {
  if (!RIF.p) RIF.p = (async () => {
    const r = await (await fetch(base + 'riferimento.json')).json();
    const b = await fetch(base + r.arterie.file); if (!b.ok) throw new Error('atlante arterioso non trovato');
    const atl = new Uint8Array(await new Response(b.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return { ...r, atl };
  })().catch((e) => { RIF.p = null; throw e; });
  return RIF.p;
}
// territori arteriosi sulla griglia delle strutture: la trasformazione si calcola su una griglia rada (ogni 4 voxel)
// e si interpola; il parenchima senza territorio prende quello vicino.
export async function territori(lab, geo, base = '/atlante/') {
  const R = await riferimento(base), t = adatta(centri(lab, geo), R.centri, geo.etichette);
  const [W, H, N] = geo.dim, n = W * H * N, out = new Uint8Array(n), dentro = new Uint8Array(256);
  for (const [k, nome] of Object.entries(geo.etichette)) dentro[+k] = liquor(nome) ? 0 : 1;
  const P = 4, gw = Math.ceil((W - 1) / P) + 1, gh = Math.ceil((H - 1) / P) + 1, gn = Math.ceil((N - 1) / P) + 1, G = new Float32Array(gw * gh * gn * 3);
  for (let c = 0, q = 0; c < gn; c++) for (let b = 0; b < gh; b++) for (let a = 0; a < gw; a++, q += 3) { const m = applica(t, ras(geo, a * P, b * P, c * P)); G[q] = m[0]; G[q + 1] = m[1]; G[q + 2] = m[2]; }
  const [AX, AY, AZ] = R.arterie.dim, o = R.arterie.origine, ps = R.arterie.passo;
  for (let k = 0, q = 0; k < N; k++) {
    const c0 = Math.min(gn - 2, (k / P) | 0), fz = k / P - c0;
    for (let j = 0; j < H; j++) {
      const b0 = Math.min(gh - 2, (j / P) | 0), fy = j / P - b0;
      for (let i = 0; i < W; i++, q++) {
        if (!dentro[lab[q]]) continue;
        const a0 = Math.min(gw - 2, (i / P) | 0), fx = i / P - a0, m = [0, 0, 0];
        for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz); if (!w) continue;
          const g = (((c0 + dz) * gh + b0 + dy) * gw + a0 + dx) * 3; m[0] += w * G[g]; m[1] += w * G[g + 1]; m[2] += w * G[g + 2];
        }
        const x = Math.round((m[0] - o[0]) / ps), y = Math.round((m[1] - o[1]) / ps), z = Math.round((m[2] - o[2]) / ps);
        const v = x >= 0 && y >= 0 && z >= 0 && x < AX && y < AY && z < AZ ? R.atl[(z * AY + y) * AX + x] : 0;
        out[q] = v === 31 || v === 32 ? 0 : v;
      }
    }
  }
  // riempimento del parenchima rimasto senza territorio (bordi, ventricoli dell'atlante)
  const coda = new Int32Array(n); let testa = 0, fine = 0;
  for (let i = 0; i < n; i++) if (out[i]) coda[fine++] = i;
  const WH = W * H;
  while (testa < fine) {
    const i = coda[testa++], x = i % W, y = ((i / W) | 0) % H, z = (i / WH) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1, z > 0 ? i - WH : -1, z < N - 1 ? i + WH : -1]) {
      if (j >= 0 && !out[j] && dentro[lab[j]]) { out[j] = out[i]; coda[fine++] = j; }
    }
  }
  return { art: out, residuo: t.residuo };
}

// ---------------------------------------------------------------- visualizzatore gratuito: segmentazione nel browser
// volume del visualizzatore (volumeDi: dati indice x più veloce, assi LPS, origine, passo) → NIfTI-1 float32
export function nifti(vol) {
  const { W, H, N, dati, assi, sp, origine } = vol, h = new ArrayBuffer(352), d = new DataView(h);
  d.setInt32(0, 348, true); d.setInt16(40, 3, true); d.setInt16(42, W, true); d.setInt16(44, H, true); d.setInt16(46, N, true);
  for (let i = 48; i < 56; i += 2) d.setInt16(i, 1, true);
  d.setInt16(70, 16, true); d.setInt16(72, 32, true);                         // FLOAT32
  d.setFloat32(76, 1, true); d.setFloat32(80, sp[0], true); d.setFloat32(84, sp[1], true); d.setFloat32(88, sp[2], true);
  d.setFloat32(108, 352, true); d.setFloat32(112, 1, true); d.setFloat32(116, 0, true); d.setUint8(123, 2, true);  // vox_offset, scl, xyzt mm
  d.setInt16(252, 0, true); d.setInt16(254, 1, true);                       // qform no, sform sì
  for (let r = 0; r < 3; r++) {
    const f = r < 2 ? -1 : 1;                                                // LPS → RAS
    for (let c = 0; c < 3; c++) d.setFloat32(280 + r * 16 + c * 4, f * assi[c][r] * sp[c], true);
    d.setFloat32(280 + r * 16 + 12, f * origine[r], true);
  }
  [0x6e, 0x2b, 0x31, 0].forEach((b, i) => d.setUint8(344 + i, b));         // "n+1"
  const out = new Uint8Array(352 + W * H * N * 4); out.set(new Uint8Array(h), 0);
  new Float32Array(out.buffer, 352).set(dati instanceof Float32Array ? dati : Float32Array.from(dati));
  return out.buffer;
}
// NIfTI-1 di etichette (eventualmente compresso) → Uint8Array, stessa griglia dell'ingresso
export async function leggiEtichette(buf) {
  let u = new Uint8Array(buf);
  if (u[0] === 0x1f && u[1] === 0x8b) u = new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const d = new DataView(u.buffer, u.byteOffset), W = d.getInt16(42, true), H = d.getInt16(44, true), N = d.getInt16(46, true), tipo = d.getInt16(70, true);
  const off = Math.round(d.getFloat32(108, true)), sl = d.getFloat32(112, true) || 1, it = d.getFloat32(116, true) || 0, n = W * H * N, out = new Uint8Array(n);
  const leggi = { 2: (i) => u[off + i], 4: (i) => d.getInt16(off + i * 2, true), 512: (i) => d.getUint16(off + i * 2, true), 8: (i) => d.getInt32(off + i * 4, true), 16: (i) => d.getFloat32(off + i * 4, true), 256: (i) => d.getInt8(off + i) }[tipo];
  if (!leggi) throw new Error('formato delle etichette non previsto (' + tipo + ')');
  for (let i = 0; i < n; i++) out[i] = Math.round(leggi(i) * sl + it);
  return { dim: [W, H, N], lab: out };
}
const ORDINE_GIRI = ['bankssts', 'caudalanteriorcingulate', 'caudalmiddlefrontal', 'cuneus', 'entorhinal', 'fusiform', 'inferiorparietal', 'inferiortemporal',
  'isthmuscingulate', 'lateraloccipital', 'lateralorbitofrontal', 'lingual', 'medialorbitofrontal', 'middletemporal', 'parahippocampal', 'paracentral',
  'parsopercularis', 'parsorbitalis', 'parstriangularis', 'pericalcarine', 'postcentral', 'posteriorcingulate', 'precentral', 'precuneus',
  'rostralanteriorcingulate', 'rostralmiddlefrontal', 'superiorfrontal', 'superiorparietal', 'superiortemporal', 'supramarginal', 'frontalpole',
  'temporalpole', 'transversetemporal', 'insula'];
// le 104 classi di MindSnap, nell'ordine del modello (0 = sfondo)
export const NOMI_MINDSNAP = ['BG', ...ORDINE_GIRI.map((g) => 'ctx-lh-' + g), ...ORDINE_GIRI.map((g) => 'ctx-rh-' + g),
  'Left-Thalamus-Proper*', 'Right-Thalamus-Proper*', 'Left-Caudate', 'Right-Caudate', 'Left-Putamen', 'Right-Putamen', 'Left-Pallidum', 'Right-Pallidum',
  'Left-Hippocampus', 'Right-Hippocampus', 'Left-Amygdala', 'Right-Amygdala', 'Left-Accumbens-area', 'Right-Accumbens-area', 'Left-VentralDC', 'Right-VentralDC',
  'Left-Cerebral-White-Matter', 'Right-Cerebral-White-Matter', 'Left-Lateral-Ventricle', 'Left-Inf-Lat-Vent', 'Right-Lateral-Ventricle', 'Right-Inf-Lat-Vent',
  '3rd-Ventricle', '4th-Ventricle', 'CSF', 'Brain-Stem', 'Left-Cerebellum-White-Matter', 'Right-Cerebellum-White-Matter', 'Left-Cerebellum-Cortex',
  'Right-Cerebellum-Cortex', 'CC_Posterior', 'CC_Mid_Posterior', 'CC_Central', 'CC_Mid_Anterior', 'CC_Anterior'];
// segmentazione con MindSnap sul computer di chi usa il visualizzatore (WebGPU, altrimenti WebGL2)
export async function segmentaNelBrowser(vol, avanza = () => {}, backend = 'auto') {
  const B = await import('./lib/brainchop/mindsnap.js');
  const base = new URL('./lib/brainchop/', import.meta.url).href;
  const r = await B.segment(nifti(vol), { model: 'mindsnap', worker: true, assetPath: base, gzipOutput: false, backend,
    onProgress: (e) => avanza(e.progress ?? 0, e.stage) });
  const { dim, lab } = await leggiEtichette(r.image);
  if (dim[0] !== vol.W || dim[1] !== vol.H || dim[2] !== vol.N) throw new Error('la segmentazione ha una geometria diversa dalla serie');
  const presenti = new Set(lab);
  const etichette = Object.fromEntries(NOMI_MINDSNAP.map((n, k) => [k, n]).filter(([k]) => k > 0 && presenti.has(k)));
  const geo = { dim, sp: vol.sp, origine: vol.origine, assi: vol.assi, etichette, atlante: 'encefalo', modello: `MindSnap (brainchop, ${r.backend})` };
  return { geo, lab, backend: r.backend, ms: r.elapsedMs };
}
