// Contorno semiautomatico del ventricolo sinistro in ecocardiografia (apicale 4 o 2 camere).
// Codice nostro, senza modelli addestrati: nessun vincolo di licenza.
//  1. il medico clicca anulus (lato setto), apice, anulus (lato laterale);
//  2. da questi tre punti nasce una mezza ellisse di partenza; lungo 48 raggi perpendicolari si cerca il passaggio
//     dalla cavità scura alla parete chiara (immagine sfumata per togliere lo speckle);
//  3. la programmazione dinamica sceglie su tutti i raggi insieme il bordo più netto che resta continuo;
//  4. nel filmato anulus e apice si seguono da un fotogramma all'altro (confronto di blocchi) e il bordo si ricerca
//     vicino a quello del fotogramma precedente; dall'area di ogni fotogramma si trovano fine diastole e fine sistole.
// Tutto avviene nel browser, sulle immagini già anonime.

const N_RAGGI = 48, K = 56;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a) => Math.hypot(a.x, a.y);

// immagine sfumata (media su un quadrato di lato 2r+1) dentro un riquadro, con l'immagine integrale
export function sfuma(img, box, r) {
  const { cols, pix } = img;
  const x0 = Math.max(0, box.x0 | 0), y0 = Math.max(0, box.y0 | 0);
  const x1 = Math.min(img.cols - 1, Math.ceil(box.x1)), y1 = Math.min(img.rows - 1, Math.ceil(box.y1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1, W = w + 1;
  const S = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let riga = 0; const o = (y0 + y) * cols + x0;
    for (let x = 0; x < w; x++) { riga += pix[o + x]; S[(y + 1) * W + x + 1] = S[y * W + x + 1] + riga; }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w - 1, x + r);
      const s = S[(yb + 1) * W + xb + 1] - S[ya * W + xb + 1] - S[(yb + 1) * W + xa] + S[ya * W + xa];
      out[y * w + x] = s / ((yb - ya + 1) * (xb - xa + 1));
    }
  }
  return { x0, y0, w, h, v: out };
}
function campiona(m, x, y) {
  x -= m.x0; y -= m.y0;
  if (x < 0 || y < 0 || x > m.w - 1 || y > m.h - 1) return NaN;
  const xi = Math.min(m.w - 2, x | 0), yi = Math.min(m.h - 2, y | 0), fx = x - xi, fy = y - yi, o = yi * m.w + xi;
  return (m.v[o] * (1 - fx) + m.v[o + 1] * fx) * (1 - fy) + (m.v[o + m.w] * (1 - fx) + m.v[o + m.w + 1] * fx) * fy;
}

// mezza ellisse dai tre punti: θ = 0 anulus 1, π/2 apice, π anulus 2
function guida(A1, Ap, A2) {
  const M = { x: (A1.x + A2.x) / 2, y: (A1.y + A2.y) / 2 }, u = sub(Ap, M), d1 = sub(A1, M), d2 = sub(A2, M);
  const P = (t) => { const s = Math.sin(t), c = Math.cos(t), d = t < Math.PI / 2 ? d1 : d2, k = t < Math.PI / 2 ? c : -c;
    return { x: M.x + s * u.x + k * d.x, y: M.y + s * u.y + k * d.y }; };
  const C = { x: M.x + 0.45 * u.x, y: M.y + 0.45 * u.y };
  const raggi = [];
  for (let i = 1; i <= N_RAGGI; i++) {
    const t = i / (N_RAGGI + 1) * Math.PI, p = P(t), q = P(t + 1e-3), r = P(t - 1e-3);
    let n = { x: -(q.y - r.y), y: q.x - r.x }; const l = len(n) || 1; n = { x: n.x / l, y: n.y / l };
    if ((p.x - C.x) * n.x + (p.y - C.y) * n.y < 0) n = { x: -n.x, y: -n.y };     // verso l'esterno
    raggi.push({ p, n, R: Math.max(8, len(sub(p, C))), t });
  }
  return { raggi, M, C, a: len(u) };
}

// profilo di bordo per ogni raggio: differenza tra la media appena fuori e appena dentro (parete chiara, cavità scura)
function punteggi(m, raggi, centri, banda) {
  const S = [], T = [];
  for (let i = 0; i < raggi.length; i++) {
    const { p, n, R } = raggi[i], c0 = centri ? centri[i] : 0, lo = c0 - banda[0] * R, hi = c0 + banda[1] * R, passo = (hi - lo) / (K - 1);
    const I = new Float32Array(K + 16), tt = new Float32Array(K);
    for (let j = -8; j < K + 8; j++) { const t = lo + j * passo, v = campiona(m, p.x + n.x * t, p.y + n.y * t); I[j + 8] = Number.isNaN(v) ? 0 : v; if (j >= 0 && j < K) tt[j] = t; }
    const s = new Float32Array(K), w = 4;
    for (let j = 0; j < K; j++) {
      let fuori = 0, dentro = 0;
      for (let q = 1; q <= w; q++) { fuori += I[j + 8 + q]; dentro += I[j + 8 - q]; }
      s[j] = (fuori - dentro) / w - 0.35 * Math.max(0, dentro / w - m.scuro);   // la cavità deve essere scura
    }
    S.push(s); T.push(tt);
  }
  return { S, T };
}

// programmazione dinamica: bordo continuo (salto massimo 3 campioni tra raggi vicini) con il punteggio più alto
function percorso(S, T, raggi, priori, pesoPriori, scala) {
  const n = S.length, salto = 3, lam = 0.06 * scala;
  const costo = S.map((s, i) => Array.from(s, (v, j) => -v + pesoPriori(i) * scala * Math.abs(T[i][j] - priori[i]) / raggi[i].R));
  const acc = [Float64Array.from(costo[0])], da = [];
  for (let i = 1; i < n; i++) {
    const a = new Float64Array(K), b = new Int16Array(K);
    for (let j = 0; j < K; j++) {
      let best = Infinity, bj = j;
      for (let d = -salto; d <= salto; d++) { const q = j + d; if (q < 0 || q >= K) continue; const c = acc[i - 1][q] + lam * Math.abs(d); if (c < best) { best = c; bj = q; } }
      a[j] = best + costo[i][j]; b[j] = bj;
    }
    acc.push(a); da.push(b);
  }
  let j = acc[n - 1].indexOf(Math.min(...acc[n - 1]));
  const sel = new Array(n); sel[n - 1] = j;
  for (let i = n - 1; i > 0; i--) { j = da[i - 1][j]; sel[i - 1] = j; }
  return sel.map((q, i) => T[i][q]);
}

function preparaMappa(img, A1, Ap, A2, mm) {
  const xs = [A1.x, Ap.x, A2.x], ys = [A1.y, Ap.y, A2.y], d = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.6 + 20;
  const r = Math.max(2, Math.round(1.6 / (mm || 0.3)));       // ~1,6 mm: toglie lo speckle senza perdere il bordo
  const m = sfuma(img, { x0: Math.min(...xs) - d, y0: Math.min(...ys) - d, x1: Math.max(...xs) + d, y1: Math.max(...ys) + d }, r);
  const ord = Float32Array.from(m.v).sort();
  m.scuro = ord[(ord.length * 0.2) | 0]; m.scala = Math.max(10, ord[(ord.length * 0.95) | 0] - ord[(ord.length * 0.05) | 0]);
  return m;
}

// contorno in un fotogramma; «prima» = scostamenti del fotogramma precedente (filmato)
export function contornoVS(img, A1, Ap, A2, { prima = null, mappa = null } = {}) {
  const m = mappa || preparaMappa(img, A1, Ap, A2, img.spCol);
  const g = guida(A1, Ap, A2);
  const banda = prima ? [0.3, 0.3] : [0.55, 0.35];
  const { S, T } = punteggi(m, g.raggi, prima, banda);
  const priori = prima || g.raggi.map(() => 0);
  // vicino all'anulus e all'apice il bordo resta vicino ai punti cliccati; nel filmato tutto resta vicino al precedente
  const peso = (i) => { const t = g.raggi[i].t, e = Math.min(t, Math.PI - t) / (Math.PI / 2), ap = Math.abs(t - Math.PI / 2);
    return (prima ? 0.15 : 0.15) + (e < 0.25 ? 1.2 * (0.25 - e) / 0.25 : 0) + (ap < 0.25 ? 0.6 * (0.25 - ap) / 0.25 : 0); };
  let off = percorso(S, T, g.raggi, priori, peso, m.scala);
  off = off.map((v, i) => (i === 0 || i === off.length - 1 ? v : (off[i - 1] + 2 * v + off[i + 1]) / 4));   // lisciatura
  const punti = [A1, ...g.raggi.map((r, i) => ({ x: r.p.x + r.n.x * off[i], y: r.p.y + r.n.y * off[i] })), A2];
  return { punti, off, mappa: m };
}

// spostamento di un punto tra due fotogrammi (somma dei quadrati delle differenze su un blocco)
// il blocco viene sempre dal fotogramma di partenza (imgA, punto p) e si cerca attorno alla posizione precedente
// («da»): così l'errore non si accumula di fotogramma in fotogramma
export function segui(imgA, imgB, p, { mezzo = 15, cerca = 12, da = p } = {}) {
  const { cols, rows } = imgA, A = imgA.pix, B = imgB.pix;
  const px = Math.round(p.x), py = Math.round(p.y), ox = Math.round(da.x) - px, oy = Math.round(da.y) - py;
  let best = Infinity, bx = ox, by = oy;
  for (let dy = oy - cerca; dy <= oy + cerca; dy += 1) for (let dx = ox - cerca; dx <= ox + cerca; dx += 1) {
    let s = 0;
    for (let y = -mezzo; y <= mezzo; y += 2) {
      const ya = py + y, yb = ya + dy; if (ya < 0 || ya >= rows || yb < 0 || yb >= rows) { s += 1e4; continue; }
      for (let x = -mezzo; x <= mezzo; x += 2) {
        const xa = px + x, xb = xa + dx; if (xa < 0 || xa >= cols || xb < 0 || xb >= cols) { s += 1e4; continue; }
        const d = A[ya * cols + xa] - B[yb * cols + xb]; s += d * d;
      }
    }
    s *= 1 + 0.002 * ((dx - ox) ** 2 + (dy - oy) ** 2);   // a parità di somiglianza, il movimento più piccolo
    if (s < best) { best = s; bx = dx; by = dy; }
  }
  return { x: p.x + bx, y: p.y + by };
}

export function areaPoligono(punti) {
  let a = 0; for (let i = 0; i < punti.length; i++) { const p = punti[i], q = punti[(i + 1) % punti.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

// fine diastole = picchi dell'area (lisciata), fine sistole = minimo fino al picco successivo; battito con la FE mediana
export function battiti(aree) {
  const n = aree.length, sm = aree.map((_, i) => (aree[Math.max(0, i - 1)] + aree[i] + aree[Math.min(n - 1, i + 1)]) / 3);
  const mx = Math.max(...sm), mn = Math.min(...sm), prom = (mx - mn) * 0.25, dist = Math.max(5, Math.floor(n / 10));
  let picchi = [];
  for (let i = 0; i < n; i++) {
    if ((i > 0 && sm[i] < sm[i - 1]) || (i < n - 1 && sm[i] < sm[i + 1])) continue;
    let sx = sm[i], dx = sm[i];
    for (let j = i - 1; j >= 0 && sm[j] <= sm[i]; j--) sx = Math.min(sx, sm[j]);
    for (let j = i + 1; j < n && sm[j] <= sm[i]; j++) dx = Math.min(dx, sm[j]);
    if (sm[i] - Math.max(i > 0 ? sx : -Infinity, i < n - 1 ? dx : -Infinity) < prom && !(i === 0 || i === n - 1)) continue;
    if (picchi.length && i - picchi[picchi.length - 1] < dist) { if (sm[i] > sm[picchi[picchi.length - 1]]) picchi[picchi.length - 1] = i; continue; }
    picchi.push(i);
  }
  const out = [];
  for (let k = 0; k + 1 < picchi.length; k++) {
    const p = picchi[k], q = picchi[k + 1]; let es = p;
    for (let j = p; j <= q; j++) if (aree[j] < aree[es]) es = j;
    if (es !== p && es !== q) out.push({ ed: p, es });
  }
  if (!out.length) {                  // meno di un battito completo: massimo, poi il minimo nel mezzo ciclo successivo (o precedente)
    const ed = sm.indexOf(mx), meta = Math.max(4, Math.floor(n / 2));
    const [a, b] = n - 1 - ed >= 4 ? [ed + 1, Math.min(n - 1, ed + meta)] : [Math.max(0, ed - meta), ed - 1];
    let es = a; for (let j = a; j <= b; j++) if (sm[j] < sm[es]) es = j;
    out.push({ ed, es });
  }
  return out;
}
