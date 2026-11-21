// RM cardiaca: calcoli per la refertazione (codice nostro, senza modelli addestrati).
// - cavità ventricolari sulla pila di asse corto: crescita di regione dal centro della cavità (sangue chiaro nelle cine bSSFP)
//   con soglia = k × intensità del sangue; i buchi (muscoli papillari, trabecole) si includono nella cavità se richiesto
// - volumi: somma delle aree × distanza tra le fette (metodo di Simpson sulla pila di asse corto)
// - flusso (contrasto di fase): velocità media nella ROI × area, fotogramma per fotogramma, integrata nel ciclo
export const valore = (img, i) => img.pix[i] * (img.slope ?? 1) + (img.inter ?? 0);

function mediana(a) { if (!a.length) return 0; const b = Float64Array.from(a).sort(); return b[b.length >> 1]; }

// seme {x, y} in pixel (colonna, riga). Restituisce null se nel punto non c'è sangue (fetta oltre l'apice o la base).
// limite (facoltativo): funzione (x, y) → false per i pixel da non attraversare (es. oltre il piano valvolare mitralico)
export function segmentaCavita(img, seme, { k = 0.55, raggioMm = 50, riempi = true, minSangue = 0.45, limite = null } = {}) {
  const { rows, cols } = img, sx = img.spCol || 1, sy = img.spRow || 1;
  const cx = Math.round(seme.x), cy = Math.round(seme.y);
  if (!(cx >= 2 && cy >= 2 && cx < cols - 2 && cy < rows - 2)) return null;
  const rx = raggioMm / sx, ry = raggioMm / sy;
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(cols - 1, Math.ceil(cx + rx)), y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.ceil(cy + ry));
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const dentro = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const vicini = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) vicini.push(valore(img, (cy + dy) * cols + cx + dx));
  const B = mediana(vicini);
  const fin = []; for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (dentro(x, y)) fin.push(valore(img, y * cols + x));
  fin.sort((a, b) => a - b); const p95 = fin[Math.floor(fin.length * 0.95)] ?? B, p05 = fin[Math.floor(fin.length * 0.05)] ?? 0;
  if (!(B > p05 + minSangue * (p95 - p05))) return null;          // il seme non è nel sangue
  const thr = p05 + k * (B - p05);
  const m = new Uint8Array(W * H), coda = [(cy - y0) * W + (cx - x0)]; m[coda[0]] = 1;
  let n = 0, tocchi = 0;
  while (coda.length) {
    const j = coda.pop(), x = j % W, y = (j / W) | 0; n++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const jj = yy * W + xx; if (m[jj]) continue;
      if (!dentro(xx + x0, yy + y0)) { tocchi++; continue; }
      if (limite && !limite(xx + x0, yy + y0)) continue;
      if (valore(img, (yy + y0) * cols + xx + x0) >= thr) { m[jj] = 1; coda.push(jj); }
    }
  }
  if (riempi) {             // buchi = pixel non raggiungibili dal bordo della finestra senza attraversare la cavità
    const fuori = new Uint8Array(W * H), q = [];
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const j = y * W + x; if (!m[j] && !fuori[j]) { fuori[j] = 1; q.push(j); } }
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const j = y * W + x; if (!m[j] && !fuori[j]) { fuori[j] = 1; q.push(j); } }
    while (q.length) { const j = q.pop(), x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const jj = yy * W + xx; if (!m[jj] && !fuori[jj]) { fuori[jj] = 1; q.push(jj); } } }
    for (let j = 0; j < W * H; j++) if (!m[j] && !fuori[j]) { m[j] = 1; n++; }
  }
  const bordo = []; let sxc = 0, syc = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x; if (!m[j]) continue; sxc += x; syc += y;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || !m[j - 1] || !m[j + 1] || !m[j - W] || !m[j + W]) bordo.push({ x: x + x0, y: y + y0 });
  }
  const perim = Math.max(1, bordo.length), gx = sxc / n, gy = syc / n;
  // punto interno: il pixel della cavità più vicino al baricentro (nel VD, a semiluna, il baricentro può cadere fuori)
  let interno = { x: cx, y: cy }, dmin = Infinity;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { if (!m[y * W + x]) continue; const d = (x - gx) ** 2 + (y - gy) ** 2; if (d < dmin) { dmin = d; interno = { x: x + x0, y: y + y0 }; } }
  return { area: n * sx * sy, n, bordo, centro: interno, baricentro: { x: gx + x0, y: gy + y0 }, perdita: tocchi / perim, B, thr, maschera: { x0, y0, W, H, m } };
}

export function areaPoligonoMm(punti, img) {
  let a = 0; for (let i = 0; i < punti.length; i++) { const p = punti[i], q = punti[(i + 1) % punti.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2 * (img.spCol || 1) * (img.spRow || 1);
}

// aree in mm², distanza tra i centri delle fette in mm → mL
export const volumeDaAree = (aree, passo) => aree.reduce((s, a) => s + (a || 0), 0) * passo / 1000;

export const superficieCorporea = (cm, kg) => (cm > 0 && kg > 0 ? Math.sqrt(cm * kg / 3600) : null);   // Mosteller

// contrasto di fase: valore memorizzato → velocità (cm/s). Codifica usuale: 0 … 2^bit − 1 ↔ −venc … +venc
export function velocita(img, i, venc, segno = 1) {
  const meta = 2 ** ((img.bitsSt || 12) - 1), s = img.pix[i];
  return (img.conSegno ? s / meta : (s - meta) / meta) * venc * segno;    // 0 … 2^bit − 1 (o −2^(bit−1) … ) ↔ −venc … +venc
}

// ROI circolare {x, y, r} in pixel su ogni fotogramma; tempi in ms (trigger) → curve e volumi
export function flussoROI(imgs, roi, venc, { segno = 1, tempi = null } = {}) {
  const img0 = imgs[0], sx = img0.spCol || 1, sy = img0.spRow || 1;
  const idx = [];
  for (let y = Math.floor(roi.y - roi.r); y <= Math.ceil(roi.y + roi.r); y++) for (let x = Math.floor(roi.x - roi.r); x <= Math.ceil(roi.x + roi.r); x++)
    if (x >= 0 && y >= 0 && x < img0.cols && y < img0.rows && (x - roi.x) ** 2 + (y - roi.y) ** 2 <= roi.r ** 2) idx.push(y * img0.cols + x);
  const areaCm2 = idx.length * sx * sy / 100;
  const curva = imgs.map((im) => { let s = 0, picco = 0; for (const i of idx) { const v = velocita(im, i, venc, segno); s += v; if (Math.abs(v) > Math.abs(picco)) picco = v; } const media = s / idx.length; return { media, picco, flusso: media * areaCm2 }; });
  const n = imgs.length;
  let t = tempi && tempi.every(Number.isFinite) ? tempi : imgs.map((_, i) => i);
  const passo = n > 1 ? (t[n - 1] - t[0]) / (n - 1) : 1, rr = passo * n;        // il ciclo copre n intervalli
  let avanti = 0, indietro = 0;
  for (const c of curva) { const vol = c.flusso * passo / 1000; if (vol >= 0) avanti += vol; else indietro -= vol; }
  const piccoV = curva.reduce((m, c) => (Math.abs(c.picco) > Math.abs(m) ? c.picco : m), 0);
  return { curva, areaCm2, avanti, indietro, netto: avanti - indietro, rigurgito: avanti > 0 ? indietro / avanti * 100 : null, piccoV, rr: tempi ? rr : null, pixel: idx.length };
}

// ---- altre misure
export function dentroPoligono(p, poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i], b = poli[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) d = !d;
  }
  return d;
}
// lunghezza dell'atrio: dal punto medio dell'anulus (primo e ultimo punto del contorno) al punto più lontano, in mm
export function lunghezzaDaAnulus(punti, img) {
  const q = punti.map((t) => ({ x: t.x * (img.spCol || 1), y: t.y * (img.spRow || 1) }));
  const M = { x: (q[0].x + q[q.length - 1].x) / 2, y: (q[0].y + q[q.length - 1].y) / 2 };
  return Math.max(...q.map((t) => Math.hypot(t.x - M.x, t.y - M.y)));
}
// volume atriale biplano area-lunghezza: 0,85 × A4 × A2 / L (aree in cm², L in cm) → mL
export const volumeAreaLunghezza = (a4, a2, Lcm) => (a4 > 0 && a2 > 0 && Lcm > 0 ? 0.85 * a4 * a2 / Lcm : null);
// volume extracellulare: (1 − Hct) × ΔR1 miocardio / ΔR1 sangue (T1 in ms) → %
export function ecv({ t1m, t1b, t1mp, t1bp, hct }) {
  if (![t1m, t1b, t1mp, t1bp, hct].every((x) => x > 0)) return null;
  const h = hct > 1 ? hct / 100 : hct;
  return (1 - h) * (1 / t1mp - 1 / t1m) / (1 / t1bp - 1 / t1b) * 100;
}
// enhancement tardivo su una fetta: miocardio = dentro l'epicardio e fuori dall'endocardio; soglia = media del
// miocardio remoto (ROI circolare) + n deviazioni standard
export function lgeFetta(img, epi, endo, remoto, n = 5) {
  const v = (i) => valore(img, i), cols = img.cols;
  const box = epi.reduce((b, t) => ({ x0: Math.min(b.x0, t.x), x1: Math.max(b.x1, t.x), y0: Math.min(b.y0, t.y), y1: Math.max(b.y1, t.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  const rem = [];
  for (let y = Math.floor(remoto.y - remoto.r); y <= Math.ceil(remoto.y + remoto.r); y++) for (let x = Math.floor(remoto.x - remoto.r); x <= Math.ceil(remoto.x + remoto.r); x++)
    if ((x - remoto.x) ** 2 + (y - remoto.y) ** 2 <= remoto.r ** 2 && x >= 0 && y >= 0 && x < cols && y < img.rows) rem.push(v(y * cols + x));
  if (rem.length < 5) return null;
  const media = rem.reduce((s, x) => s + x, 0) / rem.length, ds = Math.sqrt(rem.reduce((s, x) => s + (x - media) ** 2, 0) / (rem.length - 1));
  const soglia = media + n * ds, px = img.spCol * img.spRow;
  let mio = 0, lge = 0; const acceso = [];
  for (let y = Math.max(0, Math.floor(box.y0)); y <= Math.min(img.rows - 1, Math.ceil(box.y1)); y++) for (let x = Math.max(0, Math.floor(box.x0)); x <= Math.min(cols - 1, Math.ceil(box.x1)); x++) {
    const p = { x: x + 0.5, y: y + 0.5 }; if (!dentroPoligono(p, epi) || dentroPoligono(p, endo)) continue;
    mio++; if (v(y * cols + x) > soglia) { lge++; acceso.push({ x, y }); }
  }
  return { areaMio: mio * px, areaLge: lge * px, perc: mio ? lge / mio * 100 : 0, soglia, media, ds, acceso };
}
export function trovaCentri(fasi) {
  const im0 = fasi[0], { rows, cols } = im0, n = rows * cols, sx = im0.spCol || 1, sy = im0.spRow || 1;
  const v = (im, i) => im.pix[i] * (im.slope ?? 1) + (im.inter ?? 0);
  // massimo e minimo nel tempo: il sangue dei ventricoli cambia molto tra diastole e sistole
  const mx = new Float32Array(n), mn = new Float32Array(n).fill(Infinity);
  for (const im of fasi) for (let i = 0; i < n; i++) { const a = v(im, i); if (a > mx[i]) mx[i] = a; if (a < mn[i]) mn[i] = a; }
  const ord = Float32Array.from(mx).sort(), p99 = ord[Math.floor(n * 0.99)], p50 = ord[Math.floor(n * 0.5)];
  const var_ = new Float32Array(n); for (let i = 0; i < n; i++) var_[i] = mx[i] - mn[i];
  const vord = Float32Array.from(var_).sort(), v95 = vord[Math.floor(n * 0.95)];
  // pixel candidati: chiari in diastole (massimo alto) e vicino al centro (entro il 35% del campo)
  const thr = p50 + 0.45 * (p99 - p50), cx0 = cols / 2, cy0 = rows / 2, R = 0.38 * Math.min(rows * sy, cols * sx);
  const m = new Uint8Array(n);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x; if (mx[i] > thr && Math.hypot((x - cx0) * sx, (y - cy0) * sy) < R) m[i] = 1; }
  // componenti connesse
  const lab = new Int32Array(n), comp = [];
  for (let i = 0; i < n; i++) {
    if (!m[i] || lab[i]) continue;
    const id = comp.length + 1, q = [i]; lab[i] = id; let k = 0, sxs = 0, sys = 0, svar = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    while (q.length) { const j = q.pop(), x = j % cols, y = (j / cols) | 0; k++; sxs += x; sys += y; svar += var_[j]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const d of [1, -1, cols, -cols]) { const jj = j + d; if (jj < 0 || jj >= n || lab[jj] || !m[jj]) continue; if ((d === 1 && jj % cols === 0) || (d === -1 && j % cols === 0)) continue; lab[jj] = id; q.push(jj); } }
    const area = k * sx * sy, w = (x1 - x0 + 1) * sx, h = (y1 - y0 + 1) * sy, riemp = area / (w * h);
    comp.push({ id, area, cx: sxs / k, cy: sys / k, var: svar / k, w, h, riemp });
  }
  // VS: area 300-6000 mm², compatto (riempimento del riquadro alto, rapporto lati vicino a 1), molto variabile nel tempo
  const punteggio = (c) => (c.area < 250 || c.area > 7000 ? -1 : (c.var / v95) * c.riemp * Math.min(c.w, c.h) / Math.max(c.w, c.h) * Math.sqrt(c.area));
  const cand = comp.map((c) => ({ ...c, s: punteggio(c) })).filter((c) => c.s > 0).sort((a, b) => b.s - a.s);
  if (!cand.length) return null;
  const vs = cand[0];
  // VD: componente variabile nel tempo, vicina al VS (entro 80 mm), diversa dal VS
  const vd = cand.slice(1).filter((c) => Math.hypot((c.cx - vs.cx) * sx, (c.cy - vs.cy) * sy) < 80 && c.var > 0.3 * vs.var).sort((a, b) => b.area * b.var - a.area * a.var)[0] || null;
  const interno = (c) => { // pixel della componente più vicino al baricentro
    let best = null, d0 = Infinity; for (let i = 0; i < n; i++) if (lab[i] === c.id) { const x = i % cols, y = (i / cols) | 0, d = (x - c.cx) ** 2 + (y - c.cy) ** 2; if (d < d0) { d0 = d; best = { x, y }; } } return best; };
  return { vs: interno(vs), vd: vd ? interno(vd) : null, candidati: cand.slice(0, 4).map((c) => ({ x: Math.round(c.cx), y: Math.round(c.cy), area: Math.round(c.area), s: +c.s.toFixed(1) })) };
}
// consenso su più fette: mediana dei centri (in coordinate del paziente, calcolate da chi chiama), poi il candidato più vicino
export function mediana2(punti) {
  const m = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  return [0, 1, 2].map((i) => m(punti.map((p) => p[i])));
}
