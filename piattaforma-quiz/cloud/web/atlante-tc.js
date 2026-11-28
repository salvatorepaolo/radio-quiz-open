// Atlante dell'encefalo sulla TC (28/11/2026). MindSnap è addestrato sulla RM e non segmenta la TC: qui si porta
// sull'esame l'atlante già calcolato sul template MNI ICBM 2009c (strutture MindSnap e territori arteriosi JHU) con una
// trasformazione affine (12 parametri). La trasformazione allinea una «TC simulata» del template (corteccia e nuclei
// 38 HU, sostanza bianca 28, liquor 6) alla TC dentro il cranio (correlazione normalizzata).
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

export async function atlanteTC(vol, { avanza = () => {}, mni = null, base = '/atlante/' } = {}) {
  const t0 = Date.now();
  const M = mni || await datiMNI(base), G = M.griglia, [MX, MY, MZ] = G.dim, mo = G.origine, mp = G.passo;
  const { W, H, N, dati, assi, sp, origine } = vol;
  // 1. griglia di lavoro a circa 2 mm
  const f = sp.map((s) => Math.max(1, Math.round(2 / s))), X = Math.floor(W / f[0]), Y = Math.floor(H / f[1]), Z = Math.floor(N / f[2]);
  if (X < 20 || Y < 20 || Z < 10) throw new Error('la TC copre troppo poco per riconoscere l\'encefalo');
  const C = new Float32Array(X * Y * Z);
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) {
    let s = 0; for (let c = 0; c < f[2]; c++) for (let b = 0; b < f[1]; b++) { const o = ((z * f[2] + c) * H + y * f[1] + b) * W + x * f[0]; for (let a = 0; a < f[0]; a++) s += dati[o + a]; }
    C[q] = s / (f[0] * f[1] * f[2]);
  }
  const pazL = (x, y, z) => { const u = (x * f[0] + (f[0] - 1) / 2) * sp[0], v = (y * f[1] + (f[1] - 1) / 2) * sp[1], w = (z * f[2] + (f[2] - 1) / 2) * sp[2];
    return [0, 1, 2].map((r) => origine[r] + u * assi[0][r] + v * assi[1][r] + w * assi[2][r]); };
  const rasL = (x, y, z) => { const p = pazL(x, y, z); return [-p[0], -p[1], p[2]]; };
  avanza(0.1, 'Riconosco il cranio…');
  // 2. interno del cranio
  const osso = new Uint8Array(C.length); for (let i = 0; i < C.length; i++) osso[i] = C[i] > 200 ? 1 : 0;
  const ossoD = erodi(osso, X, Y, Z, null, true), din = interno(ossoD, X, Y, Z), molle = new Uint8Array(C.length);
  for (let i = 0; i < C.length; i++) molle[i] = C[i] > -10 && C[i] < 100 && !osso[i] ? 1 : 0;
  let I = new Uint8Array(C.length); for (let i = 0; i < C.length; i++) I[i] = din[i] && molle[i] ? 1 : 0;
  I = erodi(I, X, Y, Z); I = piuGrande(I, X, Y, Z); I = erodi(I, X, Y, Z, molle, true); I = erodi(I, X, Y, Z, molle, true);
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
  for (const [i, rx] of [-0.35, 0, 0.35].entries()) {
    avanza(0.25 + 0.15 * i, 'Allineo l\'atlante alla TC…');
    await new Promise((r) => setTimeout(r));
    const r = ottimizza([0, 0, 0, rx, 0, 0, s0, s0, s0, 0, 0, 0], 3);
    if (!migliore || r.c < migliore.c) migliore = r;
  }
  avanza(0.7, 'Rifinisco l\'allineamento…'); await new Promise((r) => setTimeout(r));
  const fin = ottimizza(migliore.p, 7), { A, t } = matrice(fin.p, cP, cM);
  const aMNI = (r) => [A[0][0] * r[0] + A[0][1] * r[1] + A[0][2] * r[2] + t[0], A[1][0] * r[0] + A[1][1] * r[1] + A[1][2] * r[2] + t[1], A[2][0] * r[0] + A[2][1] * r[1] + A[2][2] * r[2] + t[2]];
  const indice = (m) => { const x = Math.round((m[0] - mo[0]) / mp), y = Math.round((m[1] - mo[1]) / mp), z = Math.round((m[2] - mo[2]) / mp);
    return x >= 0 && y >= 0 && z >= 0 && x < MX && y < MY && z < MZ ? (z * MY + y) * MX + x : -1; };
  // sovrapposizione (Dice) tra l'encefalo del template portato sulla TC e l'interno del cranio
  let inter = 0, nT = 0;
  for (let z = 0, q = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++, q++) { const k = indice(aMNI(rasL(x, y, z))), m = k >= 0 && M.str[k] ? 1 : 0; nT += m; if (m && I[q]) inter++; }
  const dice = 2 * inter / (nT + nI);
  avanza(0.85, 'Porto giri, lobi e territori sulla TC…'); await new Promise((r) => setTimeout(r));
  // 5. etichette sulla griglia della serie (nel piano al più un voxel ogni ~0,9 mm)
  const q0 = Math.max(1, Math.round(0.9 / sp[0])), q1 = Math.max(1, Math.round(0.9 / sp[1])), Wo = Math.floor(W / q0), Ho = Math.floor(H / q1), No = N;
  const spo = [sp[0] * q0, sp[1] * q1, sp[2]], oo = [0, 1, 2].map((r) => origine[r] + assi[0][r] * sp[0] * (q0 - 1) / 2 + assi[1][r] * sp[1] * (q1 - 1) / 2);
  const n = Wo * Ho * No, lab = new Uint8Array(n), art = new Uint8Array(n), mask = new Uint8Array(n);
  for (let k = 0, q = 0; k < No; k++) for (let j = 0; j < Ho; j++) for (let i = 0; i < Wo; i++, q++) {
    const xw = Math.min(X - 1, Math.floor((i * q0 + (q0 - 1) / 2) / f[0])), yw = Math.min(Y - 1, Math.floor((j * q1 + (q1 - 1) / 2) / f[1])), zw = Math.min(Z - 1, Math.floor(k / f[2]));
    if (!I[(zw * Y + yw) * X + xw]) continue;
    mask[q] = 1;
    const p = [0, 1, 2].map((r) => oo[r] + i * spo[0] * assi[0][r] + j * spo[1] * assi[1][r] + k * spo[2] * assi[2][r]);
    const m = indice(aMNI([-p[0], -p[1], p[2]])); if (m < 0) continue;
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
  const liq = new Uint8Array(256); NOMI_MINDSNAP.forEach((nm, k) => { liq[k] = liquor(nm) ? 1 : 0; });
  for (let i = 0; i < n; i++) if (liq[lab[i]]) art[i] = 0;
  riempi(art, (j) => mask[j] && lab[j] && !liq[lab[j]]);
  const presenti = new Set(lab);
  const etichette = Object.fromEntries(NOMI_MINDSNAP.map((nm, k) => [k, nm]).filter(([k]) => k > 0 && presenti.has(k)));
  const geo = { dim: [Wo, Ho, No], sp: spo, origine: oo, assi, etichette, atlante: 'encefalo', modello: 'atlante MNI portato sulla TC (allineamento affine)' };
  return { geo, lab, art, tc: { dice, ncc: -fin.c, volume: mL, parametri: fin.p }, ms: Date.now() - t0 };
}
