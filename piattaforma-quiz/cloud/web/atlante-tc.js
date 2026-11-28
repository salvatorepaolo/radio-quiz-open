// Atlante dell'encefalo sulla TC (28/11/2026). MindSnap è addestrato sulla RM e non segmenta la TC: qui si porta
// sull'esame l'atlante già calcolato sul template MNI ICBM 2009c (strutture MindSnap e territori arteriosi JHU) con una
// trasformazione affine (12 parametri). La trasformazione allinea una «TC simulata» del template (corteccia e nuclei
// 38 HU, sostanza bianca 28, liquor 6) alla TC dentro il cranio (correlazione normalizzata). Poi una registrazione
// deformabile adatta il template a ventricoli e solchi del paziente e i bordi liquor/parenchima si rifiniscono sulle
// densità (vedi deforma e rifinisci).
// Gira tutto sul computer di chi guarda: le immagini non escono. Meno preciso che sulla RM: i nomi dei giri sono indicativi.
import { NOMI_MINDSNAP } from './atlante-encefalo.js';

const DATI = {};
async function gunzip(url) {
  const r = await fetch(url); if (!r.ok) throw new Error('atlante non trovato (' + url + ')');
  return new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
export async function datiMNI(base = '/atlante/') {
  if (!DATI.p) DATI.p = (async () => {
    const r = await (await fetch(base + 'riferimento.json')).json();
    const [str, art] = await Promise.all([gunzip(base + r.strutture.file), gunzip(base + r.arterie.file)]);
    return { griglia: r.strutture, str, art };
  })().catch((e) => { DATI.p = null; throw e; });
  return DATI.p;
}
const huMNI = (n) => (!n || n === 'BG' ? 0 : /Vent|^CSF$/.test(n) ? 6 : /White-Matter|Brain-Stem|^CC_/.test(n) ? 28 : 38);
const liquor = (n) => /Vent|^CSF$/.test(n || '');

// media mobile 3x3x3 (separabile)
function liscia(v, X, Y, Z) {
  const t = new Float32Array(v.length), passi = [[1, X], [X, Y], [X * Y, Z]];
  let a = v, b = t;
  for (const [s, n] of passi) {
    for (let i = 0; i < a.length; i++) {
      const k = ((i / s) | 0) % n; let somma = a[i], c = 1;
      if (k > 0) { somma += a[i - s]; c++; } if (k < n - 1) { somma += a[i + s]; c++; }
      b[i] = somma / c;
    }
    [a, b] = [b, a];
  }
  return a;
}
// componente connessa più grande (vicini a 6)
function piuGrande(m, X, Y, Z) {
  const n = m.length, comp = new Int32Array(n), coda = new Int32Array(n); let id = 0, best = 0, bestN = 0;
  for (let s = 0; s < n; s++) {
    if (!m[s] || comp[s]) continue; id++; let t = 0, f = 0; coda[f++] = s; comp[s] = id;
    while (t < f) {
      const i = coda[t++], x = i % X, y = ((i / X) | 0) % Y, z = (i / (X * Y)) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < X - 1 ? i + 1 : -1, y > 0 ? i - X : -1, y < Y - 1 ? i + X : -1, z > 0 ? i - X * Y : -1, z < Z - 1 ? i + X * Y : -1])
        if (j >= 0 && m[j] && !comp[j]) { comp[j] = id; coda[f++] = j; }
    }
    if (f > bestN) { bestN = f; best = id; }
  }
  const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = comp[i] === best ? 1 : 0; return out;
}
function erodi(m, X, Y, Z, dentro = null, dilata = false) {
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) {
    const x = i % X, y = ((i / X) | 0) % Y, z = (i / (X * Y)) | 0;
    const v = [x > 0 ? m[i - 1] : 0, x < X - 1 ? m[i + 1] : 0, y > 0 ? m[i - X] : 0, y < Y - 1 ? m[i + X] : 0, z > 0 ? m[i - X * Y] : 0, z < Z - 1 ? m[i + X * Y] : 0];
    out[i] = dilata ? (m[i] || (v.some(Boolean) && (!dentro || dentro[i])) ? 1 : 0) : (m[i] && v.every(Boolean) ? 1 : 0);
  }
  return out;
}
// interno del cranio, piano per piano nei tre orientamenti: ciò che l'osso circonda e non si raggiunge dal bordo
function interno(osso, X, Y, Z) {
  const n = osso.length, dentro = new Uint8Array(n);
  const piani = [[[1, X], [X, Y], [X * Y, Z]], [[1, X], [X * Y, Z], [X, Y]], [[X, Y], [X * Y, Z], [1, X]]];
  for (const [[su, nu], [sv, nv], [sw, nw]] of piani) {
    const fuori = new Uint8Array(nu * nv), coda = new Int32Array(nu * nv);
    for (let w = 0; w < nw; w++) {
      fuori.fill(0); let t = 0, f = 0; const base = w * sw, idx = (u, v) => base + u * su + v * sv;
      const semina = (u, v) => { const k = v * nu + u; if (!fuori[k] && !osso[idx(u, v)]) { fuori[k] = 1; coda[f++] = k; } };
      for (let u = 0; u < nu; u++) { semina(u, 0); semina(u, nv - 1); }
      for (let v = 0; v < nv; v++) { semina(0, v); semina(nu - 1, v); }
      while (t < f) { const k = coda[t++], u = k % nu, v = (k / nu) | 0; if (u > 0) semina(u - 1, v); if (u < nu - 1) semina(u + 1, v); if (v > 0) semina(u, v - 1); if (v < nv - 1) semina(u, v + 1); }
      for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) if (!fuori[v * nu + u] && !osso[idx(u, v)]) dentro[idx(u, v)] = 1;
    }
  }
  return dentro;
}
const ruota = (rx, ry, rz) => {
  const [a, b, c] = [rx, ry, rz], ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  const Rx = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]], Ry = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], Rz = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]];
  return mul(Rz, mul(Ry, Rx));
};
function mul(A, B) { return A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])); }
// parametri → matrice 3x3 e traslazione (RAS paziente → RAS MNI): y = A (x − cP) + cM + t
function matrice(p, cP, cM) {
  const K = [[1, p[9], p[10]], [0, 1, p[11]], [0, 0, 1]], S = [[Math.exp(p[6]), 0, 0], [0, Math.exp(p[7]), 0], [0, 0, Math.exp(p[8])]];
  const A = mul(ruota(p[3], p[4], p[5]), mul(K, S));
  const t = [0, 1, 2].map((r) => cM[r] + p[r] - (A[r][0] * cP[0] + A[r][1] * cP[1] + A[r][2] * cP[2]));
  return { A, t };
}

// ---------------------------------------------------------------- registrazione deformabile e bordi (28/11)
// Dopo l'affine il template segue la forma della testa ma non i solchi e i ventricoli del singolo paziente. Qui il T1
// del template si deforma punto per punto («demons» di Thirion: a ogni passo ogni voxel si sposta verso dove le
// intensità coincidono, poi il campo si liscia perché resti regolare) finché ricalca l'esame. Le intensità del T1 si
// traducono in quelle dell'esame con una corrispondenza stimata dai dati (media dell'esame per ogni livello del T1,
// aggiornata ogni 10 passi): vale per TC, FLAIR, T2 e T1. Spostamento al più di 15 mm.
// F: esame sulla griglia di lavoro (X, Y, Z); dove: voxel in cui contano le forze; ras(x, y, z): RAS del voxel;
// aff(r): RAS paziente → RAS MNI. Restituisce sposta(xf, yf, zf) → [dx, dy, dz] in mm (MNI) e lo spostamento medio.
// media mobile 3x3x3 separabile, scritta per righe (molto più veloce di liscia): restituisce un vettore nuovo
function liscia3(v, X, Y, Z) {
  const a = new Float32Array(v.length), b = new Float32Array(v.length), XY = X * Y;
  for (let z = 0; z < Z; z++) for (let y = 0; y < Y; y++) { const o = (z * Y + y) * X;
    if (X === 1) { a[o] = v[o]; continue; }
    a[o] = (v[o] + v[o + 1]) / 2; for (let x = 1; x < X - 1; x++) a[o + x] = (v[o + x - 1] + v[o + x] + v[o + x + 1]) / 3; a[o + X - 1] = (v[o + X - 2] + v[o + X - 1]) / 2; }
  for (let z = 0; z < Z; z++) { const o = z * XY;
    for (let x = 0; x < X; x++) b[o + x] = Y > 1 ? (a[o + x] + a[o + X + x]) / 2 : a[o + x];
    for (let y = 1; y < Y - 1; y++) { const r = o + y * X; for (let x = 0; x < X; x++) b[r + x] = (a[r - X + x] + a[r + x] + a[r + X + x]) / 3; }
    if (Y > 1) { const r = o + (Y - 1) * X; for (let x = 0; x < X; x++) b[r + x] = (a[r - X + x] + a[r + x]) / 2; } }
  if (Z === 1) return b;
  for (let q = 0; q < XY; q++) a[q] = (b[q] + b[q + XY]) / 2;
  for (let z = 1; z < Z - 1; z++) { const o = z * XY; for (let q = 0; q < XY; q++) a[o + q] = (b[o - XY + q] + b[o + q] + b[o + XY + q]) / 3; }
  { const o = (Z - 1) * XY; for (let q = 0; q < XY; q++) a[o + q] = (b[o - XY + q] + b[o + q]) / 2; }
  return a;
}
const T1L = {};
function t1Liscio(TM, G) {
  if (T1L.TM === TM) return T1L.d;
  const [MX, MY, MZ] = G.dim, mp = G.passo, T = Float32Array.from(TM), n = T.length, S = MX * MY;
  const gx = new Float32Array(n), gy = new Float32Array(n), gz = new Float32Array(n);
  for (let z = 1; z < MZ - 1; z++) for (let y = 1; y < MY - 1; y++) for (let x = 1, o = (z * MY + y) * MX + 1; x < MX - 1; x++, o++) {
    gx[o] = (T[o + 1] - T[o - 1]) / (2 * mp); gy[o] = (T[o + MX] - T[o - MX]) / (2 * mp); gz[o] = (T[o + S] - T[o - S]) / (2 * mp);
  }
  T1L.TM = TM; T1L.d = { T, gx, gy, gz }; return T1L.d;
}
async function deforma({ F, dove, X, Y, Z, ras, aff, TM, G, avanza = () => {}, livelli = [[40, 1], [40, 0]], massimo = 15 }) {
  const [MX, MY, MZ] = G.dim, mo = G.origine, mp = G.passo, S = MX * MY;
  let x0 = X, y0 = Y, z0 = Z, x1 = -1, y1 = -1, z1 = -1;
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) if (dove[q]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (x1 < 0) return null;
  const mg = 6; x0 = Math.max(0, x0 - mg); y0 = Math.max(0, y0 - mg); z0 = Math.max(0, z0 - mg); x1 = Math.min(X - 1, x1 + mg); y1 = Math.min(Y - 1, y1 + mg); z1 = Math.min(Z - 1, z1 + mg);
  const SX = x1 - x0 + 1, SY = y1 - y0 + 1, SZ = z1 - z0 + 1, n = SX * SY * SZ;
  const m0 = new Float32Array(n * 3), Fs = new Float32Array(n), att = [];
  for (let z = 0, s = 0; z < SZ; z++) for (let y = 0; y < SY; y++) for (let x = 0; x < SX; x++, s++) {
    const q = ((z + z0) * Y + y + y0) * X + x + x0, m = aff(ras(x + x0, y + y0, z + z0));
    m0[s * 3] = (m[0] - mo[0]) / mp; m0[s * 3 + 1] = (m[1] - mo[1]) / mp; m0[s * 3 + 2] = (m[2] - mo[2]) / mp;   // indici MNI
    Fs[s] = F[q]; if (dove[q]) att.push(s);
  }
  const { T, gx, gy, gz } = t1Liscio(TM, G), na = att.length;
  // campiona T e gradiente nel punto (indici MNI frazionari): [t, gx, gy, gz]
  const out = new Float32Array(4);
  const tri = (fx, fy, fz) => {
    if (fx < 0 || fy < 0 || fz < 0 || fx >= MX - 1 || fy >= MY - 1 || fz >= MZ - 1) { out[0] = out[1] = out[2] = out[3] = 0; return out; }
    const i = fx | 0, j = fy | 0, k = fz | 0, a = fx - i, b = fy - j, c = fz - k, o = (k * MY + j) * MX + i;
    const w = [(1 - a) * (1 - b) * (1 - c), a * (1 - b) * (1 - c), (1 - a) * b * (1 - c), a * b * (1 - c), (1 - a) * (1 - b) * c, a * (1 - b) * c, (1 - a) * b * c, a * b * c];
    const ox = [o, o + 1, o + MX, o + MX + 1, o + S, o + S + 1, o + S + MX, o + S + MX + 1];
    let t = 0, u = 0, v = 0, z = 0; for (let h = 0; h < 8; h++) { const p = ox[h], wh = w[h]; t += T[p] * wh; u += gx[p] * wh; v += gy[p] * wh; z += gz[p] * wh; }
    out[0] = t; out[1] = u; out[2] = v; out[3] = z; return out;
  };
  let Ux = new Float32Array(n), Uy = new Float32Array(n), Uz = new Float32Array(n);   // spostamento in mm (MNI)
  let soglia = Infinity; const NB = 64, sc = NB / 256, mappa = new Float32Array(NB), pend = new Float32Array(NB), Tw = new Float32Array(na);
  const stima = () => {
    const s1 = new Float64Array(NB), c1 = new Float64Array(NB);
    for (let h = 0; h < na; h++) { const s = att[h], r = tri(m0[s * 3] + Ux[s] / mp, m0[s * 3 + 1] + Uy[s] / mp, m0[s * 3 + 2] + Uz[s] / mp), b = Math.min(NB - 1, Math.max(0, (r[0] * sc) | 0)); Tw[h] = r[0]; s1[b] += Fs[s]; c1[b]++; }
    let ult = -1; for (let b = 0; b < NB; b++) if (c1[b] >= 20) { mappa[b] = s1[b] / c1[b]; if (ult < 0) for (let e = 0; e < b; e++) mappa[e] = mappa[b]; else for (let e = ult + 1; e < b; e++) mappa[e] = mappa[ult] + (mappa[b] - mappa[ult]) * (e - ult) / (b - ult); ult = b; }
    if (ult < 0) return false; for (let e = ult + 1; e < NB; e++) mappa[e] = mappa[ult];
    const m2 = mappa.slice(); for (let b = 1; b < NB - 1; b++) mappa[b] = (m2[b - 1] + 2 * m2[b] + m2[b + 1]) / 4;
    for (let b = 0; b < NB; b++) pend[b] = (mappa[Math.min(NB - 1, b + 1)] - mappa[Math.max(0, b - 1)]) / (b === 0 || b === NB - 1 ? 1 : 2) * sc;   // per unità di T
    // residuo tipico (mediana dei valori assoluti): oltre 3 volte non è anatomia del template (tumore, edema, sangue)
    const res = new Float32Array(na); for (let h = 0; h < na; h++) { const bf = Tw[h] * sc - 0.5, b = Math.min(NB - 2, Math.max(0, Math.floor(bf))), fb = Math.min(1, Math.max(0, bf - b)); res[h] = Math.abs(Fs[att[h]] - (mappa[b] * (1 - fb) + mappa[b + 1] * fb)); }
    res.sort(); soglia = 3 * 1.4826 * Math.max(1e-6, res[na >> 1]);
    return true;
  };
  const dx = new Float32Array(n), dy = new Float32Array(n), dz = new Float32Array(n);
  let passo = 0; const tot = livelli.reduce((a, [g]) => a + g, 0);
  for (const [giri, lisce] of livelli) for (let it = 0; it < giri; it++, passo++) {
    if (it % 10 === 0 && !stima()) return null;
    dx.fill(0); dy.fill(0); dz.fill(0); let mse = 0, fmax = 0;
    for (let h = 0; h < na; h++) {
      const s = att[h], r = tri(m0[s * 3] + Ux[s] / mp, m0[s * 3 + 1] + Uy[s] / mp, m0[s * 3 + 2] + Uz[s] / mp), bf = r[0] * sc - 0.5;
      const b = Math.min(NB - 2, Math.max(0, Math.floor(bf))), fb = Math.min(1, Math.max(0, bf - b)), g = mappa[b] * (1 - fb) + mappa[b + 1] * fb, gp = pend[b] * (1 - fb) + pend[b + 1] * fb;
      const diff = Fs[s] - g, jx = gp * r[1] * mp, jy = gp * r[2] * mp, jz = gp * r[3] * mp, den = jx * jx + jy * jy + jz * jz + diff * diff;
      mse += diff * diff;
      if (den < 1e-9 || Math.abs(diff) > soglia) continue;
      let ux = diff * jx / den * mp, uy = diff * jy / den * mp, uz = diff * jz / den * mp; const l = Math.hypot(ux, uy, uz);
      if (l > mp / 2) { const k = mp / 2 / l; ux *= k; uy *= k; uz *= k; }
      dx[s] = ux; dy[s] = uy; dz[s] = uz; if (l > fmax) fmax = l;
    }
    if (globalThis.__diagDef && (it % 10 === 0 || it === giri - 1)) { let um = 0; for (const s2 of att) um = Math.max(um, Math.hypot(Ux[s2], Uy[s2], Uz[s2])); console.log('demons', passo, 'rmse', Math.sqrt(mse / na).toFixed(2), 'umax', um.toFixed(1)); }
    for (let s = 0; s < n; s++) { Ux[s] += dx[s]; Uy[s] += dy[s]; Uz[s] += dz[s]; }
    // lisce: passaggi di media 3x3x3 a ogni passo; se minore di 1, un passaggio ogni 1/lisce passi
    const nl = lisce >= 1 ? lisce : (it % Math.round(1 / lisce) === 0 ? 1 : 0);
    for (let e = 0; e < nl; e++) { Ux = liscia3(Ux, SX, SY, SZ); Uy = liscia3(Uy, SX, SY, SZ); Uz = liscia3(Uz, SX, SY, SZ); }
    for (let s = 0; s < n; s++) { const l = Math.hypot(Ux[s], Uy[s], Uz[s]); if (l > massimo) { const k = massimo / l; Ux[s] *= k; Uy[s] *= k; Uz[s] *= k; } }
    if (passo % 4 === 3) { avanza(passo / tot); await new Promise((r) => setTimeout(r)); }
  }
  for (let e = 0; e < 1; e++) { Ux = liscia3(Ux, SX, SY, SZ); Uy = liscia3(Uy, SX, SY, SZ); Uz = liscia3(Uz, SX, SY, SZ); }   // campo finale regolare
  let medio = 0; for (const s of att) medio += Math.hypot(Ux[s], Uy[s], Uz[s]); medio /= Math.max(1, na);
  const vale = [0, 0, 0];
  const sposta = (xf, yf, zf) => {
    const x = Math.min(SX - 1.001, Math.max(0, xf - x0)), y = Math.min(SY - 1.001, Math.max(0, yf - y0)), z = Math.min(SZ - 1.001, Math.max(0, zf - z0));
    const i = x | 0, j = y | 0, k = z | 0, a = x - i, b = y - j, c = z - k, P = SX * SY, o = (k * SY + j) * SX + i;
    const I1 = Math.min(1, SX - 1 - i), J1 = Math.min(1, SY - 1 - j) * SX, K1 = Math.min(1, SZ - 1 - k) * P;
    for (let d = 0; d < 3; d++) { const U = d === 0 ? Ux : d === 1 ? Uy : Uz;
      vale[d] = ((U[o] * (1 - a) + U[o + I1] * a) * (1 - b) + (U[o + J1] * (1 - a) + U[o + J1 + I1] * a) * b) * (1 - c)
        + ((U[o + K1] * (1 - a) + U[o + K1 + I1] * a) * (1 - b) + (U[o + K1 + J1] * (1 - a) + U[o + K1 + J1 + I1] * a) * b) * c; }
    return vale;
  };
  return { sposta, medio };
}
// classe di tessuto delle strutture: 1 liquor, 2 sostanza grigia (corteccia e nuclei), 3 sostanza bianca e tronco
const CLASSE = new Uint8Array(256), VENTRICOLO = new Uint8Array(256);
NOMI_MINDSNAP.forEach((nm, k) => { VENTRICOLO[k] = /Lateral-Ventricle|3rd-Ventricle|4th-Ventricle/.test(nm || '') ? 1 : 0; });
NOMI_MINDSNAP.forEach((nm, k) => { CLASSE[k] = !k || nm === 'BG' ? 0 : liquor(nm) ? 1 : /White-Matter|Brain-Stem|^CC_/.test(nm) ? 3 : 2; });
// bordi che seguono l'immagine: un voxel sul confine tra due tessuti prende l'etichetta del vicino se la sua intensità
// somiglia molto di più a quella del tessuto vicino (medie e dispersioni misurate sull'esame). Due giri: il bordo si
// sposta al più di due voxel. Sulla TC solo liquor/parenchima (grigia e bianca differiscono di pochi HU).
function rifinisci(lab, V, dim, coppie) {
  const [Wo, Ho, No] = dim, n = lab.length, WH = Wo * Ho;
  // intensità lisciata nel piano (3x3) contro il rumore
  const Vs = new Float32Array(n);
  for (let k = 0; k < No; k++) for (let j = 0; j < Ho; j++) for (let i = 0; i < Wo; i++) {
    const q = k * WH + j * Wo + i; if (!lab[q]) continue; let s = 0, c = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= Wo || y >= Ho) continue; const p = q + b * Wo + a; if (lab[p]) { s += V[p]; c++; } }
    Vs[q] = s / c;
  }
  // statistiche robuste (mediana e MAD) sui voxel interni di ogni tessuto, lontani dai bordi; per il liquor solo i
  // ventricoli (il liquor esterno dell'atlante comprende vasi, dura e osso vicini)
  const val = [[], [], []];
  for (let k = 1; k < No - 1; k++) for (let j = 1; j < Ho - 1; j++) for (let i = 1; i < Wo - 1; i++) {
    const q = k * WH + j * Wo + i, e = lab[q], cl = CLASSE[e]; if (!cl || (q % 2)) continue;
    if (lab[q - 1] !== e || lab[q + 1] !== e || lab[q - Wo] !== e || lab[q + Wo] !== e || lab[q - WH] !== e || lab[q + WH] !== e) continue;
    if (cl === 1 && !VENTRICOLO[e]) continue; val[cl - 1].push(Vs[q]);
  }
  const st = val.map((v) => { if (v.length < 200) return { m: 0, sd: 0 }; v.sort((a, b) => a - b); const m = v[v.length >> 1], d = v.map((x) => Math.abs(x - m)).sort((a, b) => a - b);
    return { m, sd: Math.max(1e-3, 1.4826 * d[d.length >> 1]) }; });
  const ok = new Set(coppie.filter(([a, b]) => st[a - 1].sd && st[b - 1].sd && Math.abs(st[a - 1].m - st[b - 1].m) > 1.2 * Math.max(st[a - 1].sd, st[b - 1].sd)).map(([a, b]) => a * 4 + b));
  let cambiati = 0;
  if (globalThis.__diagDef) console.log('bordi', JSON.stringify(st.map((x) => [+x.m.toFixed(1), +x.sd.toFixed(1)])), [...ok]);
  if (!ok.size) return 0;
  const z = (cl, v) => Math.abs(v - st[cl - 1].m) / st[cl - 1].sd;
  for (let giro = 0; giro < 2; giro++) {
    const nuovo = lab.slice();
    for (let k = 0; k < No; k++) for (let j = 0; j < Ho; j++) for (let i = 0; i < Wo; i++) {
      const q = k * WH + j * Wo + i, e = lab[q], a = CLASSE[e]; if (!a) continue;
      let meglio = 0, zm = z(a, Vs[q]) - 0.75;
      for (const p of [i > 0 ? q - 1 : -1, i < Wo - 1 ? q + 1 : -1, j > 0 ? q - Wo : -1, j < Ho - 1 ? q + Wo : -1, k > 0 ? q - WH : -1, k < No - 1 ? q + WH : -1]) {
        if (p < 0) continue; const b = CLASSE[lab[p]]; if (!b || b === a || !(ok.has(a * 4 + b) || ok.has(b * 4 + a))) continue;
        const zb = z(b, Vs[q]); if (zb < zm) { zm = zb; meglio = lab[p]; }
      }
      if (meglio) { nuovo[q] = meglio; cambiati++; }
    }
    lab.set(nuovo);
  }
  return cambiati;
}
// riempie i voxel ammessi rimasti senza valore con quello del vicino (in ampiezza)
function riempiVol(v, ok, Wo, Ho, No) {
  const n = v.length, coda = new Int32Array(n), WH = Wo * Ho; let te = 0, fi = 0; for (let i = 0; i < n; i++) if (v[i]) coda[fi++] = i;
  while (te < fi) { const i = coda[te++], x = i % Wo, y = ((i / Wo) | 0) % Ho, z = (i / WH) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < Wo - 1 ? i + 1 : -1, y > 0 ? i - Wo : -1, y < Ho - 1 ? i + Wo : -1, z > 0 ? i - WH : -1, z < No - 1 ? i + WH : -1])
      if (j >= 0 && !v[j] && ok(j)) { v[j] = v[i]; coda[fi++] = j; } }
}

export async function atlanteTC(vol, { avanza = () => {}, mni = null, t1 = null, base = '/atlante/', partenze = [[-0.35, 0, 0], [0, 0, 0], [0.35, 0, 0]], deformabile = true, rifinitura = true } = {}) {
  const t0 = Date.now();
  const M = mni || await datiMNI(base), G = M.griglia, [MX, MY, MZ] = G.dim, mo = G.origine, mp = G.passo;
  const { W, H, N, dati, assi, sp, origine } = vol, tg = vol.taglio || [0, 0, 0];   // taglio: gantry inclinato
  // 1. griglia di lavoro a circa 2 mm
  const f = sp.map((s) => Math.max(1, Math.round(2 / s))), X = Math.floor(W / f[0]), Y = Math.floor(H / f[1]), Z = Math.floor(N / f[2]);
  if (X < 20 || Y < 20 || Z < 10) throw new Error('la TC copre troppo poco per riconoscere l\'encefalo');
  const C = new Float32Array(X * Y * Z);
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) {
    let s = 0; for (let c = 0; c < f[2]; c++) for (let b = 0; b < f[1]; b++) { const o = ((z * f[2] + c) * H + y * f[1] + b) * W + x * f[0]; for (let a = 0; a < f[0]; a++) s += dati[o + a]; }
    C[q] = s / (f[0] * f[1] * f[2]);
  }
  const pazL = (x, y, z) => { const u = (x * f[0] + (f[0] - 1) / 2) * sp[0], v = (y * f[1] + (f[1] - 1) / 2) * sp[1], k = z * f[2] + (f[2] - 1) / 2, w = k * sp[2];
    return [0, 1, 2].map((r) => origine[r] + u * assi[0][r] + v * assi[1][r] + w * assi[2][r] + k * tg[r]); };
  const rasL = (x, y, z) => { const p = pazL(x, y, z); return [-p[0], -p[1], p[2]]; };
  avanza(0.1, 'Riconosco il cranio…');
  // 2. interno del cranio
  const osso = new Uint8Array(C.length); for (let i = 0; i < C.length; i++) osso[i] = C[i] > 200 ? 1 : 0;
  const ossoD = erodi(osso, X, Y, Z, null, true), din = interno(ossoD, X, Y, Z), molle = new Uint8Array(C.length);
  for (let i = 0; i < C.length; i++) molle[i] = C[i] > -10 && C[i] < 100 && !osso[i] ? 1 : 0;
  let I = new Uint8Array(C.length); for (let i = 0; i < C.length; i++) I[i] = din[i] && molle[i] ? 1 : 0;
  I = erodi(I, X, Y, Z); I = piuGrande(I, X, Y, Z); I = erodi(I, X, Y, Z, molle, true); I = erodi(I, X, Y, Z, molle, true);
  // sotto la fossa posteriore: canale vertebrale e collo (TC testa-collo) spostano il baricentro e l'inclinazione.
  // Si misura l'area per fasce di 4 mm in altezza e si toglie ciò che sta sotto la prima fascia (scendendo dalla
  // più ampia) con meno del 12% dell'area massima.
  { const zz = new Float32Array(C.length); let zmin = Infinity, zmax = -Infinity;
    for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) if (I[q]) { const h = rasL(x, y, z)[2]; zz[q] = h; if (h < zmin) zmin = h; if (h > zmax) zmax = h; }
    // fascia almeno grande quanto il passo della griglia in altezza (strato spesso: nessuna fascia vuota tra le fette)
    const fascia = Math.max(4, ...[0, 1, 2].map((a) => Math.abs(assi[a][2]) * f[a] * sp[a] * 1.05));
    const nb = Math.floor((zmax - zmin) / fascia) + 1, area = new Uint32Array(nb); for (let q = 0; q < C.length; q++) if (I[q]) area[Math.floor((zz[q] - zmin) / fascia)]++;
    let bm = 0; for (let k = 1; k < nb; k++) if (area[k] > area[bm]) bm = k;
    let taglia = -1; for (let k = bm; k >= 0; k--) if (area[k] < 0.12 * area[bm]) { taglia = k; break; }
    if (taglia >= 0) for (let q = 0; q < C.length; q++) if (I[q] && Math.floor((zz[q] - zmin) / fascia) < taglia) I[q] = 0; }
  // encefalo tagliato dal campo di vista: interno del cranio sulle facce della griglia (oltre 15 cm²)
  let tagliato = false;
  { const facce = [[0, X, Y, Z, (a, b) => (b * Y + a) * X, f[1] * sp[1] * f[2] * sp[2]], [0, Y, X, Z, (a, b) => (b * Y) * X + a, f[0] * sp[0] * f[2] * sp[2]], [0, Z, X, Y, (a, b) => b * X + a, f[0] * sp[0] * f[1] * sp[1]]];
    for (const [, n, A, B, idx, mm2] of facce) for (const t of [0, n - 1]) {
      let c = 0; for (let b = 0; b < B; b++) for (let a = 0; a < A; a++) { const base = idx(a, b), q = n === X ? base + t : n === Y ? base + t * X : base + t * X * Y; if (I[q]) c++; }
      if (c * mm2 > 1500) tagliato = true;
    } }
  const vox = f[0] * sp[0] * f[1] * sp[1] * f[2] * sp[2] / 1000; let nI = 0, cP = [0, 0, 0];
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) if (I[q]) { nI++; const r = rasL(x, y, z); cP[0] += r[0]; cP[1] += r[1]; cP[2] += r[2]; }
  const mL = nI * vox;
  if (mL < 600 || mL > 2300) throw new Error(`nella TC non riconosco un encefalo intero (volume dentro il cranio ${Math.round(mL)} mL)`);
  cP = cP.map((v) => v / nI);
  // 3. TC simulata del template e TC di lavoro (0–60 HU dentro il cranio), entrambe lisciate
  const hu = new Float32Array(256); NOMI_MINDSNAP.forEach((n, k) => { hu[k] = huMNI(n); });
  let P = new Float32Array(MX * MY * MZ), nM = 0, cM = [0, 0, 0];
  for (let z = 0, q = 0; z < MZ; z++) for (let y = 0; y < MY; y++) for (let x = 0; x < MX; x++, q++) {
    const v = M.str[q]; P[q] = hu[v]; if (v) { nM++; cM[0] += mo[0] + x * mp; cM[1] += mo[1] + y * mp; cM[2] += mo[2] + z * mp; }
  }
  cM = cM.map((v) => v / nM); P = liscia(P, MX, MY, MZ);
  let T = new Float32Array(C.length); for (let i = 0; i < C.length; i++) T[i] = I[i] ? Math.min(60, Math.max(0, C[i])) : 0;
  T = liscia(T, X, Y, Z);
  // punti di confronto: interno del cranio allargato di 4 mm (il bordo dà la forma), al più 30 000
  const Ib = erodi(erodi(I, X, Y, Z, null, true), X, Y, Z, null, true), cand = [];
  for (let i = 0; i < Ib.length; i++) if (Ib[i]) cand.push(i);
  const passo = Math.max(1, Math.ceil(cand.length / 30000)), np = Math.ceil(cand.length / passo), px = new Float32Array(np * 3), pv = new Float32Array(np);
  for (let k = 0, j = 0; k < cand.length; k += passo, j++) { const i = cand[k], x = i % X, y = ((i / X) | 0) % Y, z = (i / (X * Y)) | 0, r = rasL(x, y, z); px[j * 3] = r[0]; px[j * 3 + 1] = r[1]; px[j * 3 + 2] = r[2]; pv[j] = T[i]; }
  let ma = 0; for (let j = 0; j < np; j++) ma += pv[j]; ma /= np; let sa = 0; for (let j = 0; j < np; j++) sa += (pv[j] - ma) ** 2;
  const campiona = (v, x, y, z) => {
    const fx = (x - mo[0]) / mp, fy = (y - mo[1]) / mp, fz = (z - mo[2]) / mp;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= MX - 1 || fy >= MY - 1 || fz >= MZ - 1) return 0;
    const i = fx | 0, j = fy | 0, k = fz | 0, a = fx - i, b = fy - j, c = fz - k, o = (k * MY + j) * MX + i, S = MX * MY;
    return ((v[o] * (1 - a) + v[o + 1] * a) * (1 - b) + (v[o + MX] * (1 - a) + v[o + MX + 1] * a) * b) * (1 - c)
      + ((v[o + S] * (1 - a) + v[o + S + 1] * a) * (1 - b) + (v[o + S + MX] * (1 - a) + v[o + S + MX + 1] * a) * b) * c;
  };
  const costo = (p) => {
    const { A, t } = matrice(p, cP, cM); let sb = 0, sbb = 0, sab = 0;
    for (let j = 0; j < np; j++) {
      const x = px[j * 3], y = px[j * 3 + 1], z = px[j * 3 + 2];
      const v = campiona(P, A[0][0] * x + A[0][1] * y + A[0][2] * z + t[0], A[1][0] * x + A[1][1] * y + A[1][2] * z + t[1], A[2][0] * x + A[2][1] * y + A[2][2] * z + t[2]);
      sb += v; sbb += v * v; sab += (pv[j] - ma) * v;
    }
    const vb = sbb - sb * sb / np; return vb > 1e-6 ? -sab / Math.sqrt(sa * vb) : 1;
  };
  // 4. ottimizzazione per coordinate con passi che si dimezzano; tre partenze per l'inclinazione del gantry
  const passi0 = [4, 4, 4, 0.07, 0.07, 0.07, 0.04, 0.04, 0.04, 0.03, 0.03, 0.03];
  const ottimizza = (p, livelli) => {
    let c = costo(p), st = passi0.slice();
    for (let l = 0; l < livelli; l++) {
      for (let giro = 0, meglio = true; meglio && giro < 8; giro++) {
        meglio = false;
        for (let k = 0; k < 12; k++) for (const s of [1, -1]) { const q = p.slice(); q[k] += s * st[k]; const cq = costo(q); if (cq < c - 1e-6) { p = q; c = cq; meglio = true; } }
      }
      st = st.map((v) => v / 2);
    }
    return { p, c };
  };
  const s0 = Math.log(Math.cbrt((nM * mp ** 3 / 1000) / mL));
  let migliore = null;
  for (const [i, [rx, ry, rz]] of partenze.entries()) {
    avanza(0.25 + 0.45 * i / partenze.length, 'Allineo l\'atlante alla TC…');
    await new Promise((r) => setTimeout(r));
    const r = ottimizza([0, 0, 0, rx, ry, rz, s0, s0, s0, 0, 0, 0], 3);
    if (!migliore || r.c < migliore.c) migliore = r;
  }
  avanza(0.7, 'Rifinisco l\'allineamento…'); await new Promise((r) => setTimeout(r));
  const fin = ottimizza(migliore.p, 7), { A, t } = matrice(fin.p, cP, cM);
  const aMNI = (r) => [A[0][0] * r[0] + A[0][1] * r[1] + A[0][2] * r[2] + t[0], A[1][0] * r[0] + A[1][1] * r[1] + A[1][2] * r[2] + t[1], A[2][0] * r[0] + A[2][1] * r[1] + A[2][2] * r[2] + t[2]];
  const indice = (m) => { const x = Math.round((m[0] - mo[0]) / mp), y = Math.round((m[1] - mo[1]) / mp), z = Math.round((m[2] - mo[2]) / mp);
    return x >= 0 && y >= 0 && z >= 0 && x < MX && y < MY && z < MZ ? (z * MY + y) * MX + x : -1; };
  // sovrapposizione (Dice) tra l'encefalo del template portato sulla TC e l'interno del cranio
  // e densità della TC dove l'atlante mette i ventricoli laterali e la sostanza bianca (i ventricoli devono essere liquor)
  const vent = new Uint8Array(256), bianca = new Uint8Array(256); NOMI_MINDSNAP.forEach((nm, k) => { vent[k] = /Lateral-Ventricle/.test(nm) ? 1 : 0; bianca[k] = /Cerebral-White-Matter/.test(nm) ? 1 : 0; });
  let inter = 0, nT = 0, sv = 0, nv = 0, sw = 0, nw = 0;
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) {
    const k = indice(aMNI(rasL(x, y, z))), e = k >= 0 ? M.str[k] : 0, m = e ? 1 : 0; nT += m; if (m && I[q]) inter++;
    if (I[q] && C[q] > -10 && C[q] < 80) { if (vent[e]) { sv += C[q]; nv++; } else if (bianca[e]) { sw += C[q]; nw++; } }
  }
  const dice = 2 * inter / (nT + nI), huVentricoli = nv ? sv / nv : null, huBianca = nw ? sw / nw : null;
  // 4b. deformazione: il template si adatta ai solchi e ai ventricoli di questo encefalo (dentro il cranio)
  let def = null;
  if (deformabile) {
    const msg = 'Adatto l\'atlante alla forma di questo encefalo…'; avanza(0.72, msg); await new Promise((r) => setTimeout(r));
    try { const TM = DATI.pseudoTC?.str === M.str ? DATI.pseudoTC.v : (DATI.pseudoTC = { str: M.str, v: liscia3(Float32Array.from(M.str, (e) => hu[e] * 4), MX, MY, MZ) }).v; const FT = new Float32Array(C.length); for (let i = 0; i < C.length; i++) FT[i] = I[i] ? Math.min(70, Math.max(-5, C[i])) : 0;
    def = await deforma({ F: FT, dove: I, X, Y, Z, ras: rasL, aff: aMNI, TM, G, avanza: (q) => avanza(0.72 + 0.13 * q, msg) }); } catch { def = null; }
  }
  avanza(0.85, 'Porto giri, lobi e territori sulla TC…'); await new Promise((r) => setTimeout(r));
  // 5. etichette sulla griglia della serie (nel piano al più un voxel ogni ~0,9 mm)
  // griglia ortogonale (assi della serie): con il gantry inclinato si allarga nel piano di quanto scivolano le fette
  const q0 = Math.max(1, Math.round(0.9 / sp[0])), q1 = Math.max(1, Math.round(0.9 / sp[1])), spo = [sp[0] * q0, sp[1] * q1, sp[2]];
  const sr = (N - 1) * (tg[0] * assi[0][0] + tg[1] * assi[0][1] + tg[2] * assi[0][2]), sc = (N - 1) * (tg[0] * assi[1][0] + tg[1] * assi[1][1] + tg[2] * assi[1][2]);
  const Wo = Math.floor(W / q0) + Math.ceil(Math.abs(sr) / spo[0]), Ho = Math.floor(H / q1) + Math.ceil(Math.abs(sc) / spo[1]), No = N;
  const oo = [0, 1, 2].map((r) => origine[r] + assi[0][r] * (sp[0] * (q0 - 1) / 2 + Math.min(0, sr)) + assi[1][r] * (sp[1] * (q1 - 1) / 2 + Math.min(0, sc)));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const n = Wo * Ho * No, lab = new Uint8Array(n), art = new Uint8Array(n), mask = new Uint8Array(n), Vo = new Float32Array(n);
  for (let k = 0, q = 0; k < No; k++) for (let j = 0; j < Ho; j++) for (let i = 0; i < Wo; i++, q++) {
    const p = [0, 1, 2].map((r) => oo[r] + i * spo[0] * assi[0][r] + j * spo[1] * assi[1][r] + k * spo[2] * assi[2][r]);
    const dq = [0, 1, 2].map((r) => p[r] - origine[r] - k * (sp[2] * assi[2][r] + tg[r])), ii = dot(dq, assi[0]) / sp[0], jj = dot(dq, assi[1]) / sp[1];
    if (ii < -0.5 || jj < -0.5 || ii > W - 0.5 || jj > H - 0.5) continue;
    const xw = Math.min(X - 1, Math.max(0, Math.floor(ii / f[0]))), yw = Math.min(Y - 1, Math.max(0, Math.floor(jj / f[1]))), zw = Math.min(Z - 1, Math.floor(k / f[2]));
    if (!I[(zw * Y + yw) * X + xw]) continue;
    mask[q] = 1; Vo[q] = dati[(k * H + Math.min(H - 1, Math.max(0, Math.round(jj)))) * W + Math.min(W - 1, Math.max(0, Math.round(ii)))];
    const r0 = aMNI([-p[0], -p[1], p[2]]);
    if (def) { const d = def.sposta((ii - (f[0] - 1) / 2) / f[0], (jj - (f[1] - 1) / 2) / f[1], (k - (f[2] - 1) / 2) / f[2]); r0[0] += d[0]; r0[1] += d[1]; r0[2] += d[2]; }
    const m = indice(r0); if (m < 0) continue;
    lab[q] = M.str[m]; const a = M.art[m]; art[q] = a === 31 || a === 32 ? 0 : a;
  }
  // il parenchima dentro il cranio rimasto senza etichetta prende quella vicina (bordi dell'atlante)
  const riempi = (v, ok) => {
    const coda = new Int32Array(n); let te = 0, fi = 0; for (let i = 0; i < n; i++) if (v[i]) coda[fi++] = i;
    const WH = Wo * Ho;
    while (te < fi) { const i = coda[te++], x = i % Wo, y = ((i / Wo) | 0) % Ho, z = (i / WH) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < Wo - 1 ? i + 1 : -1, y > 0 ? i - Wo : -1, y < Ho - 1 ? i + Wo : -1, z > 0 ? i - WH : -1, z < No - 1 ? i + WH : -1])
        if (j >= 0 && !v[j] && ok(j)) { v[j] = v[i]; coda[fi++] = j; } }
  };
  riempi(lab, (j) => mask[j]);
  // densità dei ventricoli e della bianca con l'atlante deformato, prima di rifinire i bordi (controllo onesto
  // dell'allineamento: i bordi rifiniti sulle densità renderebbero i ventricoli «giusti» per costruzione)
  let sv2 = 0, nv2 = 0, sw2 = 0, nw2 = 0;
  for (let q = 0; q < n; q += 2) { const e = lab[q], v = Vo[q]; if (!e || v < -10 || v > 80) continue; if (vent[e]) { sv2 += v; nv2++; } else if (bianca[e]) { sw2 += v; nw2++; } }
  // 6. bordi liquor/parenchima sulle densità della TC
  // quanto le etichette spiegano le densità (correlazione tra HU e HU attese per etichetta), prima dei bordi
  let spiega = null; { let a = 0, b2 = 0, aa = 0, bb = 0, ab = 0, c = 0; for (let q = 0; q < n; q += 2) { const e = lab[q], v = Vo[q]; if (!e || v < -10 || v > 80) continue; const h = hu[e]; a += v; b2 += h; aa += v * v; bb += h * h; ab += v * h; c++; }
    if (c > 100) spiega = (ab - a * b2 / c) / Math.sqrt(Math.max(1e-9, (aa - a * a / c) * (bb - b2 * b2 / c))); }
  const bordi = rifinitura ? rifinisci(lab, Vo, [Wo, Ho, No], [[1, 2], [1, 3]]) : 0;
  const liq = new Uint8Array(256); NOMI_MINDSNAP.forEach((nm, k) => { liq[k] = liquor(nm) ? 1 : 0; });
  for (let i = 0; i < n; i++) if (liq[lab[i]]) art[i] = 0;
  riempi(art, (j) => mask[j] && lab[j] && !liq[lab[j]]);
  const presenti = new Set(lab);
  const etichette = Object.fromEntries(NOMI_MINDSNAP.map((nm, k) => [k, nm]).filter(([k]) => k > 0 && presenti.has(k)));
  const geo = { dim: [Wo, Ho, No], sp: spo, origine: oo, assi, etichette, atlante: 'encefalo', modello: def ? 'atlante MNI portato sulla TC (allineamento affine e deformabile)' : 'atlante MNI portato sulla TC (allineamento affine)' };
  return { geo, lab, art, tc: { dice, ncc: -fin.c, volume: mL, parametri: fin.p, huVentricoli: nv2 > 50 ? sv2 / nv2 : huVentricoli, huBianca: nw2 > 50 ? sw2 / nw2 : huBianca, huVentricoliAffine: huVentricoli, spiega, tagliato, deformazione: def ? +def.medio.toFixed(1) : null, bordi }, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------- RM su cui la segmentazione automatica non è affidabile
// (28/11). MindSnap è addestrato soprattutto sul T1: su alcune FLAIR o T2 (per esempio FLAIR 3D a 1,5 T) riconosce
// poche strutture e le mette fuori posto. Qui il template T1 (testa intera) si allinea all'esame con una trasformazione
// affine che massimizza l'informazione mutua: funziona con qualsiasi contrasto. Poi si portano giri e territori come
// sulla TC. Meno preciso di una buona segmentazione, ma non mette etichette fuori dalla testa.
async function t1MNI(base) {
  if (!DATI.t1) DATI.t1 = (async () => { const r = await (await fetch(base + 'riferimento.json')).json(); return gunzip(base + r.t1.file); })().catch((e) => { DATI.t1 = null; throw e; });
  return DATI.t1;
}
export async function atlanteRM(vol, { avanza = () => {}, mni = null, t1 = null, base = '/atlante/', partenze = [[-0.3, 0, 0], [0, 0, 0], [0.3, 0, 0], [0, 0, -0.45], [0, 0, 0.45]], scala = null, deformabile = true, rifinitura = true } = {}) {
  const t0 = Date.now();
  const M = mni || await datiMNI(base), TM = t1 || await t1MNI(base), G = M.griglia, [MX, MY, MZ] = G.dim, mo = G.origine, mp = G.passo;
  const { W, H, N, dati, assi, sp, origine } = vol;
  const f = sp.map((s) => Math.max(1, Math.round(2 / s))), X = Math.floor(W / f[0]), Y = Math.floor(H / f[1]), Z = Math.floor(N / f[2]);
  if (X < 20 || Y < 20 || Z < 10) throw new Error('la serie copre troppo poco per allineare l\'atlante');
  const C = new Float32Array(X * Y * Z);
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) {
    let s = 0; for (let c = 0; c < f[2]; c++) for (let b = 0; b < f[1]; b++) { const o = ((z * f[2] + c) * H + y * f[1] + b) * W + x * f[0]; for (let a = 0; a < f[0]; a++) s += dati[o + a]; }
    C[q] = s / (f[0] * f[1] * f[2]);
  }
  const rasL = (x, y, z) => { const u = (x * f[0] + (f[0] - 1) / 2) * sp[0], v = (y * f[1] + (f[1] - 1) / 2) * sp[1], w = (z * f[2] + (f[2] - 1) / 2) * sp[2];
    const p = [0, 1, 2].map((r) => origine[r] + u * assi[0][r] + v * assi[1][r] + w * assi[2][r]); return [-p[0], -p[1], p[2]]; };
  // intensità: 1° e 99,5° percentile dei voxel non nulli; testa = sopra l'8% del 99,5°
  const cam = []; for (let i = 0; i < C.length; i += 7) if (C[i] > 0) cam.push(C[i]); cam.sort((a, b) => a - b);
  if (cam.length < 1000) throw new Error('la serie è quasi vuota');
  const lo = cam[Math.floor(cam.length * 0.01)], hi = cam[Math.floor(cam.length * 0.995)];
  let testa = new Uint8Array(C.length); for (let i = 0; i < C.length; i++) testa[i] = C[i] > lo + 0.08 * (hi - lo) ? 1 : 0;
  testa = piuGrande(testa, X, Y, Z);
  avanza(0.15, 'Allineo il template all\'esame…');
  // template: testa = valore > 20
  let nM = 0, cM = [0, 0, 0];
  for (let z = 0, q = 0; z < MZ; z++) for (let y = 0; y < MY; y++) for (let x = 0; x < MX; x++, q++) if (TM[q] > 20) { nM++; cM[0] += mo[0] + x * mp; cM[1] += mo[1] + y * mp; cM[2] += mo[2] + z * mp; }
  cM = cM.map((v) => v / nM);
  // punti: testa allargata di 4 mm (il bordo testa/aria dà la forma), al più 30 000
  const tb = erodi(erodi(testa, X, Y, Z, null, true), X, Y, Z, null, true), cand = []; let nT = 0, cP = [0, 0, 0];
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) { if (testa[q]) { nT++; const r = rasL(x, y, z); cP[0] += r[0]; cP[1] += r[1]; cP[2] += r[2]; } if (tb[q]) cand.push(q); }
  cP = cP.map((v) => v / nT);
  const vox = f[0] * sp[0] * f[1] * sp[1] * f[2] * sp[2];
  const passo = Math.max(1, Math.ceil(cand.length / 30000)), NB = 32; let np = Math.ceil(cand.length / passo), px = new Float32Array(np * 3), pb = new Uint8Array(np);
  for (let k = 0, j = 0; k < cand.length; k += passo, j++) { const i = cand[k], x = i % X, y = ((i / X) | 0) % Y, z = (i / (X * Y)) | 0, r = rasL(x, y, z); px[j * 3] = r[0]; px[j * 3 + 1] = r[1]; px[j * 3 + 2] = r[2]; pb[j] = Math.max(0, Math.min(NB - 1, Math.floor(NB * (C[i] - lo) / (hi - lo)))); }
  const TF = Float32Array.from(TM), campiona = (x, y, z) => {
    const fx = (x - mo[0]) / mp, fy = (y - mo[1]) / mp, fz = (z - mo[2]) / mp;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= MX - 1 || fy >= MY - 1 || fz >= MZ - 1) return 0;
    const i = fx | 0, j = fy | 0, k = fz | 0, a = fx - i, b = fy - j, c = fz - k, o = (k * MY + j) * MX + i, S = MX * MY, v = TF;
    return ((v[o] * (1 - a) + v[o + 1] * a) * (1 - b) + (v[o + MX] * (1 - a) + v[o + MX + 1] * a) * b) * (1 - c)
      + ((v[o + S] * (1 - a) + v[o + S + 1] * a) * (1 - b) + (v[o + S + MX] * (1 - a) + v[o + S + MX + 1] * a) * b) * c;
  };
  const Hst = new Float64Array(NB * NB), costo = (p) => {
    const { A, t } = matrice(p, cP, cM); Hst.fill(0);
    for (let j = 0; j < np; j++) { const x = px[j * 3], y = px[j * 3 + 1], z = px[j * 3 + 2];
      const v = campiona(A[0][0] * x + A[0][1] * y + A[0][2] * z + t[0], A[1][0] * x + A[1][1] * y + A[1][2] * z + t[1], A[2][0] * x + A[2][1] * y + A[2][2] * z + t[2]);
      Hst[pb[j] * NB + Math.min(NB - 1, (v * NB / 256) | 0)]++; }
    const pa = new Float64Array(NB), pt = new Float64Array(NB); for (let a = 0; a < NB; a++) for (let b = 0; b < NB; b++) { const h = Hst[a * NB + b] / np; pa[a] += h; pt[b] += h; }
    let ha = 0, ht = 0, hj = 0; for (let a = 0; a < NB; a++) { if (pa[a]) ha -= pa[a] * Math.log(pa[a]); if (pt[a]) ht -= pt[a] * Math.log(pt[a]); }
    for (let i = 0; i < NB * NB; i++) { const h = Hst[i] / np; if (h) hj -= h * Math.log(h); }
    return -(ha + ht) / hj;     // informazione mutua normalizzata (cambiata di segno)
  };
  const passi0 = [4, 4, 4, 0.07, 0.07, 0.07, 0.04, 0.04, 0.04, 0.03, 0.03, 0.03];
  const ottimizza = (p, livelli) => { let c = costo(p), st = passi0.slice();
    for (let l = 0; l < livelli; l++) { for (let giro = 0, meglio = true; meglio && giro < 8; giro++) { meglio = false;
      for (let k = 0; k < 12; k++) for (const s of [1, -1]) { const q = p.slice(); q[k] += s * st[k]; const cq = costo(q); if (cq < c - 1e-7) { p = q; c = cq; meglio = true; } } }
      st = st.map((v) => v / 2); }
    return { p, c }; };
  // la testa nell'esame dipende dal campo di vista (collo, viso): si parte dalla scala 1 (encefalo adulto come il template)
  const s0 = scala ?? 0;
  let migliore = null;
  for (const [i, [rx, ry, rz]] of partenze.entries()) {
    avanza(0.2 + 0.45 * i / partenze.length, 'Allineo il template all\'esame…'); await new Promise((r) => setTimeout(r));
    const r = ottimizza([0, 0, 0, rx, ry, rz, s0, s0, s0, 0, 0, 0], 3); if (!migliore || r.c < migliore.c) migliore = r;
  }
  avanza(0.6, 'Rifinisco l\'allineamento…'); await new Promise((r) => setTimeout(r));
  const tappa1 = ottimizza(migliore.p, 6);
  // seconda tappa: solo l'encefalo (allargato di 6 mm) con le intensità dell'encefalo: ventricoli e solchi, scuri sia
  // nel T1 del template sia in FLAIR e T2, guidano l'allineamento interno
  { const cerv = new Uint8Array(M.str.length); for (let i = 0; i < cerv.length; i++) cerv[i] = M.str[i] ? 1 : 0;
    let cd = cerv; for (let e = 0; e < 3; e++) cd = erodi(cd, MX, MY, MZ, null, true);
    const { A: A1, t: t1v } = matrice(tappa1.p, cP, cM), sel = [], val = [];
    for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) {
      if (!testa[q]) continue; const r = rasL(x, y, z), m = [0, 1, 2].map((a) => A1[a][0] * r[0] + A1[a][1] * r[1] + A1[a][2] * r[2] + t1v[a]);
      const ix = Math.round((m[0] - mo[0]) / mp), iy = Math.round((m[1] - mo[1]) / mp), iz = Math.round((m[2] - mo[2]) / mp);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= MX || iy >= MY || iz >= MZ || !cd[(iz * MY + iy) * MX + ix]) continue; sel.push(q); val.push(C[q]); }
    if (sel.length > 2000) {
      const ord = val.slice().sort((a, b) => a - b), l2 = ord[Math.floor(ord.length * 0.01)], h2 = ord[Math.floor(ord.length * 0.99)], ps = Math.max(1, Math.ceil(sel.length / 30000));
      np = Math.ceil(sel.length / ps); px = new Float32Array(np * 3); pb = new Uint8Array(np);
      for (let k = 0, j = 0; k < sel.length; k += ps, j++) { const i = sel[k], x = i % X, y = ((i / X) | 0) % Y, z = (i / (X * Y)) | 0, r = rasL(x, y, z); px[j * 3] = r[0]; px[j * 3 + 1] = r[1]; px[j * 3 + 2] = r[2]; pb[j] = Math.max(0, Math.min(NB - 1, Math.floor(NB * (C[i] - l2) / (h2 - l2 + 1e-6)))); }
    } }
  const fin = ottimizza(tappa1.p, 6), { A, t } = matrice(fin.p, cP, cM);
  const aMNI = (r) => [A[0][0] * r[0] + A[0][1] * r[1] + A[0][2] * r[2] + t[0], A[1][0] * r[0] + A[1][1] * r[1] + A[1][2] * r[2] + t[1], A[2][0] * r[0] + A[2][1] * r[1] + A[2][2] * r[2] + t[2]];
  const indice = (m) => { const x = Math.round((m[0] - mo[0]) / mp), y = Math.round((m[1] - mo[1]) / mp), z = Math.round((m[2] - mo[2]) / mp);
    return x >= 0 && y >= 0 && z >= 0 && x < MX && y < MY && z < MZ ? (z * MY + y) * MX + x : -1; };
  // coincidenza testa del template / testa dell'esame (Dice)
  let inter = 0, nTT = 0; for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) { const k = indice(aMNI(rasL(x, y, z))), m = k >= 0 && TM[k] > 20 ? 1 : 0; nTT += m; if (m && testa[q]) inter++; }
  const dice = 2 * inter / (nTT + nT);
  // deformazione dentro l'encefalo del template (allargato di 6 mm) e nella testa dell'esame
  let def = null;
  if (deformabile) {
    const msg = 'Adatto l\'atlante alla forma di questo encefalo…'; avanza(0.72, msg); await new Promise((r) => setTimeout(r));
    let cd = new Uint8Array(M.str.length); for (let i = 0; i < cd.length; i++) cd[i] = M.str[i] ? 1 : 0; for (let e = 0; e < 3; e++) cd = erodi(cd, MX, MY, MZ, null, true);
    const dove = new Uint8Array(C.length), val = [];
    for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) { if (!testa[q]) continue; const k = indice(aMNI(rasL(x, y, z))); if (k >= 0 && cd[k]) { dove[q] = 1; val.push(C[q]); } }
    if (val.length > 2000) {
      val.sort((a, b) => a - b); const l2 = val[Math.floor(val.length * 0.01)], h2 = val[Math.floor(val.length * 0.99)], F = new Float32Array(C.length);
      for (let i = 0; i < C.length; i++) F[i] = Math.max(-0.2, Math.min(1.2, (C[i] - l2) / (h2 - l2 + 1e-6))) * 100;
      try { def = await deforma({ F, dove, X, Y, Z, ras: rasL, aff: aMNI, TM, G, avanza: (q) => avanza(0.72 + 0.13 * q, msg) }); } catch { def = null; }
    }
  }
  avanza(0.85, 'Porto giri, lobi e territori sull\'esame…'); await new Promise((r) => setTimeout(r));
  const q0 = Math.max(1, Math.round(0.9 / sp[0])), q1 = Math.max(1, Math.round(0.9 / sp[1])), spo = [sp[0] * q0, sp[1] * q1, sp[2]], Wo = Math.floor(W / q0), Ho = Math.floor(H / q1), No = N;
  const oo = [0, 1, 2].map((r) => origine[r] + assi[0][r] * sp[0] * (q0 - 1) / 2 + assi[1][r] * sp[1] * (q1 - 1) / 2);
  const n = Wo * Ho * No, lab = new Uint8Array(n), art = new Uint8Array(n), Vo = new Float32Array(n);
  for (let k = 0, q = 0; k < No; k++) for (let j = 0; j < Ho; j++) for (let i = 0; i < Wo; i++, q++) {
    const xw = Math.min(X - 1, Math.floor((i * q0 + (q0 - 1) / 2) / f[0])), yw = Math.min(Y - 1, Math.floor((j * q1 + (q1 - 1) / 2) / f[1])), zw = Math.min(Z - 1, Math.floor(k / f[2]));
    if (!testa[(zw * Y + yw) * X + xw]) continue;
    const p = [0, 1, 2].map((r) => oo[r] + i * spo[0] * assi[0][r] + j * spo[1] * assi[1][r] + k * spo[2] * assi[2][r]);
    const r0 = aMNI([-p[0], -p[1], p[2]]);
    if (def) { const d = def.sposta((i * q0 + (q0 - 1) / 2 - (f[0] - 1) / 2) / f[0], (j * q1 + (q1 - 1) / 2 - (f[1] - 1) / 2) / f[1], (k - (f[2] - 1) / 2) / f[2]); r0[0] += d[0]; r0[1] += d[1]; r0[2] += d[2]; }
    const m = indice(r0); if (m < 0) continue;
    Vo[q] = dati[(k * H + Math.min(H - 1, j * q1 + (q1 >> 1))) * W + Math.min(W - 1, i * q0 + (q0 >> 1))];
    lab[q] = M.str[m]; const a = M.art[m]; art[q] = a === 31 || a === 32 || liquor(NOMI_MINDSNAP[lab[q]]) ? 0 : a;
  }
  // bordi sui tessuti dell'esame (liquor, grigia, bianca: in RM il contrasto c'è per tutti)
  const bordi = rifinitura ? rifinisci(lab, Vo, [Wo, Ho, No], [[1, 2], [1, 3], [2, 3]]) : 0;
  for (let q = 0; q < n; q++) if (CLASSE[lab[q]] === 1) art[q] = 0;
  riempiVol(art, (q) => lab[q] && CLASSE[lab[q]] > 1, Wo, Ho, No);
  const presenti = new Set(lab);
  const etichette = Object.fromEntries(NOMI_MINDSNAP.map((nm, k) => [k, nm]).filter(([k]) => k > 0 && presenti.has(k)));
  const geo = { dim: [Wo, Ho, No], sp: spo, origine: oo, assi, etichette, atlante: 'encefalo', modello: def ? 'atlante MNI allineato alla RM (affine e deformabile)' : 'atlante MNI allineato alla RM (affine, informazione mutua)' };
  return { geo, lab, art, tm: { dice, nmi: -fin.c, parametri: fin.p, deformazione: def ? +def.medio.toFixed(1) : null, bordi }, ms: Date.now() - t0 };
}
