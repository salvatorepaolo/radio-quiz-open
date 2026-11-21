// 11/11: noduli polmonari anche nel visualizzatore scaricabile, FACOLTATIVO. Modello MONAI lung_nodule_ct_detection
// (RetinaNet 3D, Apache-2.0, addestrato su LUNA16) convertito in ONNX (strumenti_claude/noduli_onnx/esporta.py) ed
// eseguito nel browser con onnxruntime-web (MIT): WebGPU se c'è, altrimenti WebAssembly. Si scarica una volta sola da
// radio-quiz.it e resta nella cache del browser: dopo funziona anche senza rete. Le immagini non escono dal computer.
// Stessa preparazione del modello originale (RAS, 0,703 × 0,703 × 1,25 mm, HU −1024…300 → 0…1), finestre 192×192×80
// con le mappe della rete mediate dove si sovrappongono, poi ancore, decodifica dei box e NMS come in MONAI
// (verificato con strumenti_claude/noduli_onnx/riferimento.py). Il calcolo è diviso tra più «worker» (noduli-worker.js),
// ognuno con la sua copia del modello su WebAssembly: la WebGPU di onnxruntime non accelera le convoluzioni 3D.. Un solo modello: si tengono i candidati con punteggio
// ≥ 0,5, misurati sulle immagini (asse lungo e corto, componente solida > −300 HU) con il Lung-RADS v2022 da primo esame.

export const VERSIONE = 'noduli-v2';   // v2: pesi int8 (quantizzazione statica per canale, strumenti_claude/noduli_onnx/quantizza.py): 21 MB invece di 84
export const CARTELLA = `/modelli-ia/${VERSIONE}/`;
export const CACHE = 'rq-modelli-' + VERSIONE;
export const FILE = ['ort.webgpu.min.mjs', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm', 'noduli.onnx'];
export const DIMENSIONE = 'circa 50 MB';

// finestre: al massimo 224×224×96 voxel, sovrapposte di 32/32/16 (meno calcolo sprecato delle 192×192×80 con il 25%)
const SP = [0.703125, 0.703125, 1.25], MAXW = [224, 224, 96], OV = [32, 32, 16], DIV = [16, 16, 8], MIN = [64, 64, 32];
const STRIDE = [[4, 4, 2], [8, 8, 4], [16, 16, 8]], SCALA = [1, 2, 4], BASE = [[6, 8, 4], [8, 6, 5], [10, 10, 6]];
const CLIP = Math.log(1000 / 16), SOGLIA = 0.05, TOPK = 1000, NMS = 0.22, MAXDET = 100;
export const SCORE_MIN = 0.5, SOGLIA_SOLIDO = 0.65;

// ------------------------------------------------------------------ download e cache
// le versioni precedenti del modello si cancellano (spazio sul disco)
async function pulisciVecchie() { try { for (const k of await caches.keys()) if (k.startsWith('rq-modelli-noduli-') && k !== CACHE) await caches.delete(k); } catch {} }
export async function giaScaricato() {
  pulisciVecchie();
  try { const c = await caches.open(CACHE); for (const f of FILE) if (!(await c.match(CARTELLA + f))) return false; return true; } catch { return false; }
}
export async function scarica(avanza = () => {}) {
  const c = await caches.open(CACHE);
  const teste = await Promise.all(FILE.map((f) => fetch(CARTELLA + f, { method: 'HEAD', cache: 'no-store' }).then((r) => +r.headers.get('content-length') || 0).catch(() => 0)));
  const totale = teste.reduce((a, b) => a + b, 0) || 50e6; let fatto = 0;
  for (const [i, f] of FILE.entries()) {
    if (await c.match(CARTELLA + f)) { fatto += teste[i]; continue; }
    let ultimo = null;
    for (let prova = 1; prova <= 3; prova++) {
      try {
        const r = await fetch(CARTELLA + f, { cache: 'no-store' });
        if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
        const rd = r.body.getReader(), pezzi = []; let n = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; pezzi.push(value); n += value.length; avanza((fatto + n) / totale, `Scarico ${f} (${Math.round((fatto + n) / 1e6)} di ${Math.round(totale / 1e6)} MB)…`); }
        await c.put(CARTELLA + f, new Response(new Blob(pezzi), { headers: { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream' } }));
        fatto += n; ultimo = null; break;
      } catch (e) { ultimo = e; avanza(fatto / totale, `Download interrotto, riprovo (${prova + 1}/3)…`); await new Promise((ok) => setTimeout(ok, 2000 * prova)); }
    }
    if (ultimo) throw ultimo;
  }
  avanza(1, 'Modello scaricato');
}
export async function elimina() { try { (await MOTORE)?.chiudi(); } catch {} MOTORE = null; try { await caches.delete(CACHE); } catch {} }

let MOTORE = null;
// circa 0,5 GB di memoria per worker: fino a 6 con 8 GB o più (navigator.deviceMemory si ferma a 8), lasciando due processori liberi
export const quantiWorker = () => Math.max(1, Math.min(navigator.deviceMemory && navigator.deviceMemory < 8 ? 2 : 6, (navigator.hardwareConcurrency || 2) - 2));
async function motore(avanza, quanti = quantiWorker()) {
  if (MOTORE) return MOTORE;
  return (MOTORE = (async () => {
    if (!(await giaScaricato())) throw new Error('il modello dei noduli non è ancora stato scaricato');
    avanza?.(0, 'Avvio del modello…');
    const modello = await (await (await caches.open(CACHE)).match(CARTELLA + 'noduli.onnx')).arrayBuffer();
    const n = quanti, liberi = [], attesa = [];
    const avvia = () => new Promise((ok, ko) => {
      const w = new Worker(new URL('./noduli-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => { if (e.data.pronto) ok(w); else if (e.data.errore && !w.lavoro) ko(new Error(e.data.errore)); else { const l = w.lavoro; w.lavoro = null; e.data.errore ? l.ko(new Error(e.data.errore)) : l.ok(e.data.uscite); libera(w); } };
      w.onerror = (e) => { const l = w.lavoro; w.lavoro = null; (l?.ko || ko)(new Error(e.message || 'errore del worker')); };
      w.postMessage({ cartella: CARTELLA, modello: modello.slice(0) });
    });
    const libera = (w) => { const p = attesa.shift(); if (p) { w.lavoro = p; w.postMessage({ dati: p.dati, forma: p.forma }, [p.dati.buffer]); } else liberi.push(w); };
    const workers = await Promise.all(Array.from({ length: n }, avvia));
    workers.forEach(libera);
    const esegui = (dati, forma) => new Promise((ok, ko) => { const p = { dati, forma, ok, ko }; const w = liberi.shift(); if (w) { w.lavoro = p; w.postMessage({ dati, forma }, [dati.buffer]); } else attesa.push(p); });
    const chiudi = () => { workers.forEach((w) => w.terminate()); MOTORE = null; };
    return { esegui, chiudi, ep: `${n} ${n === 1 ? 'processo' : 'processi'} WebAssembly` };
  })().catch((e) => { MOTORE = null; throw e; }));
}

// ------------------------------------------------------------------ preparazione del volume
// vol = volumeDi(si) dell'app: {W,H,N,dati,assi:[col,row,normale],sp:[spCol,spRow,dz],origine}
// voxel (i,j,k) → LPS = origine + i·sp0·A0 + j·sp1·A1 + k·sp2·A2; dati[k·W·H + j·W + i]
function inversa3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
function griglia(vol) {
  const { W, H, N, assi: A, sp, origine: o } = vol, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const i of [0, W - 1]) for (const j of [0, H - 1]) for (const k of [0, N - 1])
    for (let c = 0; c < 3; c++) { const v = o[c] + i * sp[0] * A[0][c] + j * sp[1] * A[1][c] + k * sp[2] * A[2][c]; lo[c] = Math.min(lo[c], v); hi[c] = Math.max(hi[c], v); }
  const n = [0, 1, 2].map((c) => Math.floor((hi[c] - lo[c]) / SP[c]) + 1);
  // matrice colonne = assi × spaziatura (indice → mm), da invertire
  const M = [A[0][0] * sp[0], A[1][0] * sp[1], A[2][0] * sp[2], A[0][1] * sp[0], A[1][1] * sp[1], A[2][1] * sp[2], A[0][2] * sp[0], A[1][2] * sp[1], A[2][2] * sp[2]];
  return { n, org: [hi[0], hi[1], lo[2]], Mi: inversa3(M) };
}
// campiona il volume RAS (i verso R, j verso A, k verso S) nel riquadro [lo,hi) con passo f; lineare o vicino
function ricampiona(vol, G, lo, hi, f = [1, 1, 1], lineare = true) {
  const { W, H, N, dati, origine: o } = vol, { org, Mi } = G, WH = W * H;
  const d = [0, 1, 2].map((c) => Math.ceil((hi[c] - lo[c]) / f[c])), out = new Int16Array(d[0] * d[1] * d[2]);
  const idx = (p) => { const q = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; return [Mi[0] * q[0] + Mi[1] * q[1] + Mi[2] * q[2], Mi[3] * q[0] + Mi[4] * q[1] + Mi[5] * q[2], Mi[6] * q[0] + Mi[7] * q[1] + Mi[8] * q[2]]; };
  const p0 = [org[0] - lo[0] * SP[0], org[1] - lo[1] * SP[1], org[2] + lo[2] * SP[2]], q0 = idx(p0);
  const di = idx([p0[0] - f[0] * SP[0], p0[1], p0[2]]).map((v, c) => v - q0[c]);
  const dj = idx([p0[0], p0[1] - f[1] * SP[1], p0[2]]).map((v, c) => v - q0[c]);
  const dk = idx([p0[0], p0[1], p0[2] + f[2] * SP[2]]).map((v, c) => v - q0[c]);
  let w = 0;
  for (let i = 0; i < d[0]; i++) for (let j = 0; j < d[1]; j++) {
    let x = q0[0] + i * di[0] + j * dj[0], y = q0[1] + i * di[1] + j * dj[1], z = q0[2] + i * di[2] + j * dj[2];
    for (let k = 0; k < d[2]; k++, x += dk[0], y += dk[1], z += dk[2]) {
      if (!lineare) {
        const a = Math.round(x), b = Math.round(y), c = Math.round(z);
        out[w++] = a < 0 || b < 0 || c < 0 || a >= W || b >= H || c >= N ? -1024 : dati[c * WH + b * W + a]; continue;
      }
      if (x < 0 || y < 0 || z < 0 || x > W - 1 || y > H - 1 || z > N - 1) { out[w++] = -1024; continue; }
      const a = Math.min(W - 2, x | 0), b = Math.min(H - 2, y | 0), c = Math.min(N - 2, z | 0), fx = x - a, fy = y - b, fz = z - c;
      const s = c * WH + b * W + a, t = s + WH;
      const v0 = (dati[s] * (1 - fx) + dati[s + 1] * fx) * (1 - fy) + (dati[s + W] * (1 - fx) + dati[s + W + 1] * fx) * fy;
      const v1 = (dati[t] * (1 - fx) + dati[t + 1] * fx) * (1 - fy) + (dati[t + W] * (1 - fx) + dati[t + W + 1] * fx) * fy;
      out[w++] = Math.round(v0 * (1 - fz) + v1 * fz);
    }
  }
  return { hu: out, d };
}
// riquadro dei polmoni su una griglia grossolana (4×4×2): aria < −400 HU non collegata ai lati destro/sinistro e
// anteriore/posteriore, componenti > 50 mL, più 1 cm. (In alto e in basso i polmoni possono toccare il bordo.)
function riquadroPolmoni(vol, G) {
  const f = [4, 4, 2], { hu, d } = ricampiona(vol, G, [0, 0, 0], G.n, f, false), [X, Y, Z] = d, YZ = Y * Z;
  const lab = new Int32Array(X * Y * Z), aria = (q) => hu[q] < -400, coda = new Int32Array(X * Y * Z);
  const vicini = (q, fn) => { const i = (q / YZ) | 0, j = ((q / Z) | 0) % Y, k = q % Z;
    if (i > 0) fn(q - YZ); if (i < X - 1) fn(q + YZ); if (j > 0) fn(q - Z); if (j < Y - 1) fn(q + Z); if (k > 0) fn(q - 1); if (k < Z - 1) fn(q + 1); };
  const riempi = (semi, v) => { let t = 0, n = 0; for (const s of semi) if (!lab[s] && aria(s)) { lab[s] = v; coda[t++] = s; }
    for (let h = 0; h < t; h++) { n++; vicini(coda[h], (r) => { if (!lab[r] && aria(r)) { lab[r] = v; coda[t++] = r; } }); } return { n, t }; };
  const bordo = [];
  for (let j = 0; j < Y; j++) for (let k = 0; k < Z; k++) bordo.push(j * Z + k, (X - 1) * YZ + j * Z + k);
  for (let i = 0; i < X; i++) for (let k = 0; k < Z; k++) bordo.push(i * YZ + k, i * YZ + (Y - 1) * Z + k);
  riempi(bordo, 1);
  const vmin = 50000 / (f[0] * f[1] * f[2] * SP[0] * SP[1] * SP[2]), lo = [1e9, 1e9, 1e9], hi = [-1, -1, -1];
  let v = 2;
  for (let q = 0; q < lab.length; q++) {
    if (lab[q] || !aria(q)) continue;
    const { t } = riempi([q], v);
    if (t > vmin) for (let h = 0; h < t; h++) { const r = coda[h], c = [(r / YZ) | 0, ((r / Z) | 0) % Y, r % Z]; for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], c[a]); hi[a] = Math.max(hi[a], c[a]); } }
    v++;
  }
  if (hi[0] < 0) return { lo: [0, 0, 0], hi: G.n.slice() };
  const mg = SP.map((s, a) => Math.ceil(10 / s));
  return { lo: lo.map((x, a) => Math.max(0, x * f[a] - mg[a])), hi: hi.map((x, a) => Math.min(G.n[a], (x + 1) * f[a] + mg[a])) };
}

// ------------------------------------------------------------------ rete a finestre e decodifica (come MONAI)
const arrPari = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 ? r - 1 : r; };   // torch.round: metà al pari
function ancoreBase(l) { return BASE.map((s) => { const m = s.map((v) => (v * SCALA[l]) / 2); return [...m.map((v) => arrPari(-v)), ...m.map((v) => arrPari(v))]; }); }
function iou(a, b) {
  let inter = 1; for (let c = 0; c < 3; c++) { const s = Math.min(a[c + 3], b[c + 3]) - Math.max(a[c], b[c]); if (s <= 0) return 0; inter *= s; }
  const va = (a[3] - a[0]) * (a[4] - a[1]) * (a[5] - a[2]), vb = (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]);
  return inter / (va + vb - inter + 1e-9);
}
/** hu: Int16Array [X][Y][Z] (k più veloce) già in RAS a SP; esegui(Float32Array, [X,Y,Z]) → 6 Float32Array (cls0-2, box0-2).
 * Restituisce [{box:[x1,y1,z1,x2,y2,z2] in voxel, s}] ordinati per punteggio. */
export function finestre(dimA, a) {
  if (dimA <= MAXW[a]) return [[0, dimA]];
  const n = Math.ceil((dimA - OV[a]) / (MAXW[a] - OV[a])), w = Math.ceil((dimA + (n - 1) * OV[a]) / n / DIV[a]) * DIV[a], s = [];
  for (let i = 0; i < n; i++) s.push([Math.min(i * (w - OV[a]), dimA - w), w]);
  return s;
}
export async function rileva(hu, d, esegui, avanza = () => {}) {
  const dim = d.map((v, a) => Math.max(MIN[a], Math.ceil(v / DIV[a]) * DIV[a]));
  const gr = STRIDE.map((st) => st.map((s, a) => dim[a] / s));
  const somme = [3, 3, 3, 18, 18, 18].map((c, k) => new Float32Array(c * gr[k % 3][0] * gr[k % 3][1] * gr[k % 3][2]));
  const conta = gr.map((g) => new Uint8Array(g[0] * g[1] * g[2]));
  const F = [0, 1, 2].map((a) => finestre(dim[a], a)), lavori = [];
  for (const x of F[0]) for (const y of F[1]) for (const z of F[2]) lavori.push([x, y, z]);
  const tot = lavori.length; let nf = 0;
  const prepara = ([[a, wx], [b, wy], [c, wz]]) => {
    const fin = new Float32Array(wx * wy * wz);
    for (let i = 0; i < wx; i++) { const ii = a + i; if (ii >= d[0]) break;
      for (let j = 0; j < wy; j++) { const jj = b + j; if (jj >= d[1]) break;
        const o = (i * wy + j) * wz, s = (ii * d[1] + jj) * d[2] + c, n = Math.min(wz, d[2] - c);
        for (let k = 0; k < n; k++) { const v = (hu[s + k] + 1024) / 1324; fin[o + k] = v < 0 ? 0 : v > 1 ? 1 : v; } } }
    return fin;
  };
  const somma = ([[a, wx], [b, wy], [c, wz]], out) => {
    for (let k = 0; k < 6; k++) {
      const l = k % 3, st = STRIDE[l], g = gr[l], C = k < 3 ? 3 : 18, w = [wx / st[0], wy / st[1], wz / st[2]], o0 = [a / st[0], b / st[1], c / st[2]], src = out[k], dst = somme[k];
      for (let ch = 0; ch < C; ch++) for (let i = 0; i < w[0]; i++) for (let j = 0; j < w[1]; j++) {
        const s = ((ch * w[0] + i) * w[1] + j) * w[2], t = ((ch * g[0] + o0[0] + i) * g[1] + o0[1] + j) * g[2] + o0[2];
        for (let z = 0; z < w[2]; z++) dst[t + z] += src[s + z];
      }
      if (k < 3) for (let i = 0; i < w[0]; i++) for (let j = 0; j < w[1]; j++) { const t = ((o0[0] + i) * g[1] + o0[1] + j) * g[2] + o0[2]; for (let z = 0; z < w[2]; z++) conta[l][t + z]++; }
    }
  };
  // tutte le finestre in coda: i worker liberi le prendono una alla volta
  await Promise.all(lavori.map(async (f) => { const out = await esegui(prepara(f), f.map((x) => x[1])); somma(f, out); avanza(++nf / tot, `Analisi: ${nf} di ${tot} blocchi…`); }));
  const cand = [];
  for (let l = 0; l < 3; l++) {
    const g = gr[l], L = g[0] * g[1] * g[2], cls = somme[l], reg = somme[l + 3], cn = conta[l], st = STRIDE[l], base = ancoreBase(l), sel = [];
    for (let p = 0; p < L; p++) for (let an = 0; an < 3; an++) {
      const sc = 1 / (1 + Math.exp(-cls[an * L + p] / cn[p])); if (sc > SOGLIA) sel.push([sc, p, an]);
    }
    sel.sort((x, y) => y[0] - x[0]); sel.length = Math.min(sel.length, TOPK);
    for (const [sc, p, an] of sel) {
      const ix = [(p / (g[1] * g[2])) | 0, ((p / g[2]) | 0) % g[1], p % g[2]], b = base[an], box = new Array(6);
      let ok = true;
      for (let c = 0; c < 3; c++) {
        const ctrA = ix[c] * st[c] + (st[c] >> 1), x1 = ctrA + b[c], x2 = ctrA + b[c + 3], w = x2 - x1, ctr = x1 + w / 2;
        const dc = reg[(an * 6 + c) * L + p] / cn[p], dw = Math.min(reg[(an * 6 + 3 + c) * L + p] / cn[p], CLIP);
        const pc = dc * w + ctr, ps = Math.exp(dw) * w;
        box[c] = Math.min(Math.max(pc - ps / 2, 0), d[c]); box[c + 3] = Math.min(Math.max(pc + ps / 2, 0), d[c]);
        if (box[c + 3] <= box[c]) ok = false;
      }
      if (ok) cand.push({ box, s: sc });
    }
  }
  cand.sort((x, y) => y.s - x.s);
  const tenuti = [];
  for (const c of cand) { if (tenuti.length >= MAXDET) break; if (tenuti.every((t) => iou(t.box, c.box) <= NMS)) tenuti.push(c); }
  return tenuti;
}

// ------------------------------------------------------------------ misura del nodulo (come strumenti/analisi_tc.py, semplificata)
export function lungRads(tipo, dm, ds) {
  if (tipo === 'solido') return dm < 6 ? '2' : dm < 8 ? '3' : dm < 15 ? '4A' : '4B';
  if (tipo === 'parzialmente solido') return dm < 6 ? '2' : ds < 6 ? '3' : ds < 8 ? '4A' : '4B';
  return dm < 30 ? '2' : '3';
}
function misura(hu, d, c) {
  const r = SP.map((s) => Math.ceil(20 / s)), lo = c.map((v, a) => Math.max(0, Math.round(v) - r[a])), hi = c.map((v, a) => Math.min(d[a], Math.round(v) + r[a] + 1));
  const n = [0, 1, 2].map((a) => hi[a] - lo[a]), N = n[0] * n[1] * n[2], sub = new Float32Array(N), at = (i, j, k) => ((i - lo[0]) * n[1] + (j - lo[1])) * n[2] + (k - lo[2]);
  for (let i = lo[0]; i < hi[0]; i++) for (let j = lo[1]; j < hi[1]; j++) for (let k = lo[2]; k < hi[2]; k++) sub[at(i, j, k)] = hu[(i * d[1] + j) * d[2] + k];
  // lisciatura leggera 3×3×3 (media) e soglia adattiva a metà tra parenchima e picco, mai sopra −650 HU
  const sm = new Float32Array(N);
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    let s = 0, m = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) { const x = i + a, y = j + b, z = k + e; if (x < 0 || y < 0 || z < 0 || x >= n[0] || y >= n[1] || z >= n[2]) continue; s += sub[(x * n[1] + y) * n[2] + z]; m++; }
    sm[(i * n[1] + j) * n[2] + k] = s / m;
  }
  const paren = []; for (let q = 0; q < N; q += 3) if (sm[q] < -500 && sm[q] > -1000) paren.push(sm[q]);
  paren.sort((a, b) => a - b); const bg = paren.length ? paren[paren.length >> 1] : -850;
  const cc = c.map((v, a) => Math.round(v) - lo[a]); let picco = -2000, seme = -1;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) { const x = cc[0] + a, y = cc[1] + b, z = cc[2] + e; if (x < 0 || y < 0 || z < 0 || x >= n[0] || y >= n[1] || z >= n[2]) continue; const q = (x * n[1] + y) * n[2] + z; if (sm[q] > picco) { picco = sm[q]; seme = q; } }
  const soglia = Math.min(-650, bg + 0.5 * (picco - bg)); if (picco <= soglia) return null;
  // regione connessa al seme; i vasi sottili si staccano con un'erosione di 1 voxel prima della crescita
  const su = new Uint8Array(N); for (let q = 0; q < N; q++) su[q] = sm[q] > soglia ? 1 : 0;
  const nb = (q, fn) => { const i = (q / (n[1] * n[2])) | 0, j = ((q / n[2]) | 0) % n[1], k = q % n[2];
    if (i > 0) fn(q - n[1] * n[2]); if (i < n[0] - 1) fn(q + n[1] * n[2]); if (j > 0) fn(q - n[2]); if (j < n[1] - 1) fn(q + n[2]); if (k > 0) fn(q - 1); if (k < n[2] - 1) fn(q + 1); };
  const er = new Uint8Array(N); for (let q = 0; q < N; q++) if (su[q]) { let tutti = 1; nb(q, (r) => { if (!su[r]) tutti = 0; }); er[q] = tutti; }
  const cresci = (m, s0) => { const lab = new Uint8Array(N), coda = [s0]; lab[s0] = 1; for (let h = 0; h < coda.length; h++) nb(coda[h], (r) => { if (m[r] && !lab[r]) { lab[r] = 1; coda.push(r); } }); return lab; };
  let nod = er[seme] ? cresci(er, seme) : cresci(su, seme);
  if (er[seme]) { const dil = new Uint8Array(N); for (let q = 0; q < N; q++) if (nod[q]) { dil[q] = 1; nb(q, (r) => { if (su[r]) dil[r] = 1; }); } nod = dil; }
  let vol = 0, solidi = 0, tocca = false; const zArea = new Int32Array(n[2]);
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const q = (i * n[1] + j) * n[2] + k; if (!nod[q]) continue;
    vol++; zArea[k]++; if (sub[q] > -300) solidi++;
    if (i === 0 || j === 0 || k === 0 || i === n[0] - 1 || j === n[1] - 1 || k === n[2] - 1) tocca = true;
  }
  const vox = SP[0] * SP[1] * SP[2]; if (vol < 5) return null;
  let kz = 0; for (let k = 1; k < n[2]; k++) if (zArea[k] > zArea[kz]) kz = k;
  let pts = []; for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) if (nod[(i * n[1] + j) * n[2] + kz]) pts.push([i * SP[0], j * SP[1]]);
  if (pts.length > 700) { const p = Math.ceil(pts.length / 700); pts = pts.filter((_, q) => q % p === 0); }
  let lungo = 0, pi = 0, pj = 0;
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) { const dd = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]); if (dd > lungo) { lungo = dd; pi = a; pj = b; } }
  let corto = 0;
  if (lungo > 0) { const u = [(pts[pj][0] - pts[pi][0]) / lungo, (pts[pj][1] - pts[pi][1]) / lungo]; let mn = 1e9, mx = -1e9; for (const p of pts) { const v = -u[1] * p[0] + u[0] * p[1]; mn = Math.min(mn, v); mx = Math.max(mx, v); } corto = mx - mn; }
  // tra i centri dei pixel di bordo, come in strumenti/analisi_tc.py
  const dm = (lungo + corto) / 2, dsol = solidi ? 2 * Math.cbrt((3 * solidi * vox) / (4 * Math.PI)) : 0;
  const tipo = dm > 0 && dsol >= SOGLIA_SOLIDO * dm ? 'solido' : dsol >= 3 ? 'parzialmente solido' : 'vetro smerigliato';
  const ds = tipo === 'solido' ? dm : tipo === 'vetro smerigliato' ? 0 : dsol;
  let hm = 0; for (let q = 0; q < N; q++) if (nod[q]) hm += sub[q];
  const alt = new Set(); for (const a of [-1, 0, 1]) for (const b of tipo === 'parzialmente solido' ? [-2, -1, 0, 1, 2] : [0]) alt.add(lungRads(tipo, dm + a, ds + b));
  return { volume_mm3: +(vol * vox).toFixed(1), A: +lungo.toFixed(1), B: +corto.toFixed(1), diametro_medio_mm: +dm.toFixed(1), tipo, solido_mm: +ds.toFixed(1),
    hu: Math.round(hm / vol), lung_rads: lungRads(tipo, dm, ds), vicino_soglia: alt.size > 1, tocca, kz: lo[2] + kz };
}

/** analisi completa di una serie TC del torace già caricata (volumeDi). Restituisce i noduli nel formato dei file IA del sito. */
export async function trovaNoduli(vol, avanza = () => {}) {
  // il processo unico rimasto acceso da secondoParere non basta per tutto il torace: si riparte con tutti
  clearTimeout(SPEGNI); if (MOTORE) { try { (await MOTORE).chiudi(); } catch {} }
  const m = await motore(avanza);
  avanza(0, 'Preparo le immagini…'); await new Promise((ok) => setTimeout(ok, 0));
  const G = griglia(vol), R = riquadroPolmoni(vol, G);
  const { hu, d } = ricampiona(vol, G, R.lo, R.hi);
  const t0 = performance.now();
  const box = await rileva(hu, d, m.esegui, (f, t) => avanza(f * 0.95, t));
  m.chiudi();   // libera la memoria dei worker (si riavviano alla prossima analisi)
  const meta = (R.lo[0] + R.hi[0]) / 2;   // linea mediana approssimata (centro del riquadro dei polmoni, asse R)
  const out = [];
  for (const b of box) {
    if (b.s < SCORE_MIN) break;
    const c = [0, 1, 2].map((a) => (b.box[a] + b.box[a + 3]) / 2);
    const mi = misura(hu, d, c); if (!mi) continue;
    if (mi.diametro_medio_mm < 4 || mi.diametro_medio_mm > 30 || mi.tocca) continue;
    const g = [c[0] + R.lo[0], c[1] + R.lo[1], mi.kz + R.lo[2]];
    const lps = [G.org[0] - g[0] * SP[0], G.org[1] - g[1] * SP[1], G.org[2] + g[2] * SP[2]].map((v) => +v.toFixed(1));
    const { tocca, kz, ...resto } = mi;
    const doppio = out.find((x) => Math.hypot(...x.centro_lps.map((v, a) => v - lps[a])) <= Math.max(5, Math.max(x.diametro_medio_mm, mi.diametro_medio_mm) / 2));
    if (doppio) continue;
    // asse R crescente = verso destra del paziente
    out.push({ ...resto, centro_lps: lps, lobo: c[0] + R.lo[0] > meta ? 'polmone destro' : 'polmone sinistro', modelli: 'solo MONAI', score: +b.s.toFixed(2) });
  }
  avanza(1, `Fatto (${((performance.now() - t0) / 1000).toFixed(0)} s, ${m.ep})`);
  return out.sort((a, b) => b.diametro_medio_mm - a.diametro_medio_mm);
}
// ------------------------------------------------------------------ secondo parere sul volume di un nodulo (1.272)
// Per il volume semiautomatico (app.js, segmentaNodulo) quando il metodo geometrico è incerto: la rete gira su un solo
// riquadro di circa 9 × 9 × 8 cm intorno al punto (qualche secondo), si prende il riquadro trovato che contiene il punto
// (o il più vicino entro 1 cm) e se ne ricavano i lati. La rete è addestrata su LUNA16, dove ogni nodulo è annotato
// con il suo diametro: i lati del riquadro sono una stima del diametro, il volume (ellissoide nei lati) una stima di
// ordine di grandezza, non una segmentazione.
let SPEGNI = null;
export async function secondoParere(vol, lps, avanza = () => {}) {
  // un solo riquadro: basta un processo (avviarne di più vuol dire preparare più copie del modello); resta acceso due
  // minuti per le misure successive
  clearTimeout(SPEGNI); const m = await motore(avanza, 1), pm = MOTORE, G = griglia(vol);
  const c = [(G.org[0] - lps[0]) / SP[0], (G.org[1] - lps[1]) / SP[1], (lps[2] - G.org[2]) / SP[2]], MEZZO = [64, 64, 32];
  const lo = c.map((v, a) => Math.max(0, Math.round(v) - MEZZO[a])), hi = c.map((v, a) => Math.min(G.n[a], Math.round(v) + MEZZO[a]));
  if (hi.some((v, a) => v <= lo[a])) return { trovato: false };
  const { hu, d } = ricampiona(vol, G, lo, hi), t0 = performance.now();
  let box; try { box = await rileva(hu, d, m.esegui, avanza); } finally { SPEGNI = setTimeout(() => { if (MOTORE === pm) m.chiudi(); }, 120000); }
  const q = c.map((v, a) => v - lo[a]);
  const dentro = (b) => [0, 1, 2].every((a) => q[a] >= b.box[a] - 1 && q[a] <= b.box[a + 3] + 1);
  const dist = (b) => Math.hypot(...[0, 1, 2].map((a) => ((b.box[a] + b.box[a + 3]) / 2 - q[a]) * SP[a]));
  const cand = box.filter((b) => b.s >= 0.2 && (dentro(b) || dist(b) <= 10)).sort((x, y) => y.s - x.s);
  const s = performance.now() - t0;
  if (!cand.length) return { trovato: false, secondi: +(s / 1000).toFixed(1) };
  const b = cand[0], lati = [0, 1, 2].map((a) => (b.box[a + 3] - b.box[a]) * SP[a]);
  return { trovato: true, score: +b.s.toFixed(2), lati: lati.map((x) => +x.toFixed(1)), diametro: +((lati[0] + lati[1] + lati[2]) / 3).toFixed(1),
    volume: Math.PI / 6 * lati[0] * lati[1] * lati[2], secondi: +(s / 1000).toFixed(1) };
}
// per le prove (Node): preparazione e decodifica senza il motore del browser
export const _interno = { griglia, riquadroPolmoni, ricampiona, rileva, misura };
