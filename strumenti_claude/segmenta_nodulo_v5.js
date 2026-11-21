// segmentaNodulo: volume di un nodulo polmonare in TC dal punto cliccato, in 3D (1.270).
// 1. Contesto: attorno al punto (guscio a 12–24 mm) prevale il parenchima aerato (< −600 HU), altrimenti non è un nodulo
//    polmonare e si usa la crescita di regione generale.
// 2. Seme: il voxel più denso entro 3 mm dal clic (un clic appena fuori dal bordo non fa fallire la misura).
// 3. Soglia: −400 HU per i noduli solidi e calcifici; −650 HU se attorno al nucleo c'è vetro smerigliato (nodulo
//    parzialmente solido o non solido), riconosciuto dai raggi che restano sopra −650 HU molto più a lungo che sopra −400.
// 4. Raggio del nodulo: mediana della lunghezza di 26 raggi dal seme fino al primo voxel sotto soglia. La mediana non
//    risente dei pochi raggi che corrono lungo un vaso o dentro la parete.
// 5. Crescita 3D (6-connessa) sopra soglia dentro una sfera di raggio 2 × mediana + 2 mm (lobulazioni comprese).
// 6. Apertura 3D con un ellissoide di circa un terzo del raggio (0,6–3 mm): stacca vasi e pleura attaccati; resta la
//    parte connessa al seme. Se l'apertura toglie quasi tutto (nodulo molto piccolo) si tiene la regione prima dell'apertura.
// Restituisce null se il punto non è in un polmone (si usa allora il metodo generale).
async function segmentaNodulo(p, idx, x0, y0, immagineDi, normaleDi) {
  const im0 = await immagineDi(p, idx);
  if (!im0 || im0.modalita !== 'CT' || im0.suv) return null;
  const W = im0.cols, H = im0.rows, sx = im0.spCol, sy = im0.spRow, n = normaleDi(im0.iop);
  const R = 30;                                            // mm: semilato del cubo di lavoro
  const rx = Math.ceil(R / sx), ry = Math.ceil(R / sy);
  const xa = Math.max(0, x0 - rx), xb = Math.min(W - 1, x0 + rx), ya = Math.max(0, y0 - ry), yb = Math.min(H - 1, y0 + ry);
  const NX = xb - xa + 1, NY = yb - ya + 1;
  const val = (im, i) => im.pix[i] * im.slope + im.inter;
  const pos = (im) => (im.ipp ? im.ipp[0] * n[0] + im.ipp[1] * n[1] + im.ipp[2] * n[2] : 0);
  const z0 = pos(im0), fette = [];                         // immagini entro 30 mm, in ordine
  for (const dir of [-1, 1]) for (let j = idx + (dir > 0 ? 1 : 0); j >= 0 && j < p.frames.length; j += dir) {
    const im = await immagineDi(p, j); if (!im || im.cols !== W || im.rows !== H) break;
    if (Math.abs(pos(im) - z0) > R) break; fette.push([j, im]);
  }
  fette.sort((a, b) => pos(a[1]) - pos(b[1]));
  const NZ = fette.length; if (NZ < 1) return null;
  const sz = NZ > 1 ? Math.abs(pos(fette[NZ - 1][1]) - pos(fette[0][1])) / (NZ - 1) : (im0.spessore || 1);
  const vol = new Float32Array(NX * NY * NZ);
  for (let k = 0; k < NZ; k++) { const im = fette[k][1]; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) vol[(k * NY + y) * NX + x] = val(im, (y + ya) * W + x + xa); }
  const k0 = fette.findIndex(([j]) => j === idx), I = (x, y, z) => (z * NY + y) * NX + x;
  const cx = x0 - xa, cy = y0 - ya;
  // 1. contesto polmonare
  let aria = 0, tot = 0;
  for (let z = 0; z < NZ; z++) for (let y = 0; y < NY; y += 2) for (let x = 0; x < NX; x += 2) {
    const d = Math.hypot((x - cx) * sx, (y - cy) * sy, (z - k0) * sz); if (d < 12 || d > 24) continue;
    tot++; if (vol[I(x, y, z)] < -600) aria++;
  }
  if (!tot || aria / tot < 0.2) return null;
  // 2. seme: il voxel più denso entro 3 mm
  let sxv = cx, syv = cy, szv = k0, best = -Infinity;
  const r3x = Math.ceil(3 / sx), r3y = Math.ceil(3 / sy), r3z = Math.ceil(3 / sz);
  for (let z = Math.max(0, k0 - r3z); z <= Math.min(NZ - 1, k0 + r3z); z++) for (let y = Math.max(0, cy - r3y); y <= Math.min(NY - 1, cy + r3y); y++) for (let x = Math.max(0, cx - r3x); x <= Math.min(NX - 1, cx + r3x); x++) {
    if (Math.hypot((x - cx) * sx, (y - cy) * sy, (z - k0) * sz) > 3) continue;
    const v = vol[I(x, y, z)]; if (v > best) { best = v; sxv = x; syv = y; szv = z; }
  }
  if (best < -750) return { errore: 'Punto non adatto: clicca dentro il nodulo' };
  // densità media entro 2,5 mm dal clic: decide tra nodulo solido e in vetro smerigliato (un vaso denso dentro un nodulo
  // in vetro smerigliato non lo fa sembrare solido)
  let sm = 0, nm = 0;
  for (let z = Math.max(0, k0 - r3z); z <= Math.min(NZ - 1, k0 + r3z); z++) for (let y = Math.max(0, cy - r3y); y <= Math.min(NY - 1, cy + r3y); y++) for (let x = Math.max(0, cx - r3x); x <= Math.min(NX - 1, cx + r3x); x++) {
    if (Math.hypot((x - cx) * sx, (y - cy) * sy, (z - k0) * sz) > 2.5) continue; sm += vol[I(x, y, z)]; nm++; }
  const media0 = sm / Math.max(1, nm);
  // 3–4. raggi
  const dirs = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (a || b || c) { const l = Math.hypot(a, b, c); dirs.push([a / l, b / l, c / l]); }
  const raggio = (T) => dirs.map(([a, b, c]) => {
    for (let t = 0.5; t <= R; t += 0.5) { const x = Math.round(sxv + a * t / sx), y = Math.round(syv + b * t / sy), z = Math.round(szv + c * t / sz);
      if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) return t; if (vol[I(x, y, z)] < T) return t; }
    return R;
  }).sort((u, v) => u - v);
  // raggio: quantile basso dei raggi (35%), prudente quando il nodulo poggia sulla parete, sul diaframma o sul mediastino
  const qnt = (l, q) => l[Math.min(l.length - 1, Math.floor(l.length * q))];
  const rS0 = raggio(-400), rG0 = raggio(-650), rSol = qnt(rS0, 0.35), rGg = qnt(rG0, 0.35);
  // vetro smerigliato: nessun nucleo solido vicino al clic, oppure alone di vetro smerigliato nettamente più esteso del
  // nucleo (nodulo parzialmente solido). Un piccolo nodulo solido cliccato sul bordo resta solido.
  const subsolido = best < -400 || (rSol < 1.5 && media0 < -350) || (rGg >= 4 && rGg > 2 * rSol);
  const T = subsolido ? -650 : -400, r0 = Math.max(subsolido ? rGg : rSol, 1);
  // in vetro smerigliato il seme è il voxel più vicino al clic sopra soglia (non il vaso più denso)
  if (subsolido) { let bd = Infinity; for (let z = Math.max(0, k0 - r3z); z <= Math.min(NZ - 1, k0 + r3z); z++) for (let y = Math.max(0, cy - r3y); y <= Math.min(NY - 1, cy + r3y); y++) for (let x = Math.max(0, cx - r3x); x <= Math.min(NX - 1, cx + r3x); x++) {
    const d = Math.hypot((x - cx) * sx, (y - cy) * sy, (z - k0) * sz); if (d < bd && vol[I(x, y, z)] >= T) { bd = d; sxv = x; syv = y; szv = z; } } }
  // 5. crescita 3D nella sfera
  const rS = Math.min(R, 1.8 * r0 + 2.5), mask = new Uint8Array(vol.length), coda = [I(sxv, syv, szv)];
  if (vol[coda[0]] < T) return { errore: 'Punto non adatto: clicca dentro il nodulo' };
  mask[coda[0]] = 1;
  while (coda.length) {
    const i = coda.pop(), x = i % NX, y = ((i / NX) | 0) % NY, z = (i / (NX * NY)) | 0;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= NX || Y >= NY || Z >= NZ) continue;
      const j = I(X, Y, Z); if (mask[j] || vol[j] < T) continue;
      if (Math.hypot((X - sxv) * sx, (Y - syv) * sy, (Z - szv) * sz) > rS) continue;
      mask[j] = 1; coda.push(j);
    }
  }
  // 6. distanza dal bordo (mm) di ogni voxel della regione, con una trasformata a smusso 3×3×3 in due passate
  const dist = (dentro, bordoDentro = false) => { const D = new Float32Array(vol.length); for (let i = 0; i < D.length; i++) D[i] = dentro[i] ? 1e9 : 0;
    const pesi = []; for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (a || b || c) pesi.push([a, b, c, Math.hypot(a * sx, b * sy, c * sz)]);
    const avanti = pesi.filter(([a, b, c]) => c < 0 || (c === 0 && (b < 0 || (b === 0 && a < 0)))), indietro = pesi.filter((w) => !avanti.includes(w));
    const passata = (l, z0, z1, dz, y0, y1, dy, x0, x1, dx) => { for (let z = z0; z !== z1; z += dz) for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
      const i = I(x, y, z); if (!D[i]) continue; let m = D[i];
      for (const [a, b, c, w] of l) { const X = x + a, Y = y + b, Z = z + c; const v = X < 0 || Y < 0 || X >= NX || Y >= NY ? (bordoDentro ? 1e9 : 0) : Z < 0 || Z >= NZ ? 1e9 : D[I(X, Y, Z)]; if (v + w < m) m = v + w; }
      D[i] = m; } };
    passata(avanti, 0, NZ, 1, 0, NY, 1, 0, NX, 1); passata(indietro, NZ - 1, -1, -1, NY - 1, -1, -1, NX - 1, -1, -1); return D; };
  const Dm = dist(mask);
  // spessore del nodulo: la distanza dal bordo più grande entro r0 + 1 mm dal seme (i vasi, sottili, non contano)
  let maxE = 0; for (let i = 0; i < Dm.length; i++) if (Dm[i] > maxE && Dm[i] < 1e8) { const x = i % NX, y = ((i / NX) | 0) % NY, z = (i / (NX * NY)) | 0; if (Math.hypot((x - sxv) * sx, (y - syv) * sy, (z - szv) * sz) <= r0 + 1) maxE = Dm[i]; }
  // sfera finale proporzionata al nodulo (al massimo 1,7 volte il suo raggio, più 2 mm per i contorni irregolari)
  const rF = Math.min(rS, 1.7 * Math.max(maxE, 1) + 2);
  for (let i = 0; i < mask.length; i++) if (mask[i]) { const x = i % NX, y = ((i / NX) | 0) % NY, z = (i / (NX * NY)) | 0; if (Math.hypot((x - sxv) * sx, (y - syv) * sy, (z - szv) * sz) > rF) mask[i] = 0; }
  // nodulo a contatto con la pleura: involucro del polmone = chiusura dell'aria (< −500 HU) con una sfera poco più grande
  // del nodulo. Le rientranze del polmone (il nodulo) restano dentro l'involucro, la parete toracica, il diaframma e il
  // mediastino restano fuori: la regione si taglia con l'involucro.
  { const rC = Math.min(14, 1.3 * Math.max(maxE, 1) + 1.5), tess = new Uint8Array(vol.length); for (let i = 0; i < vol.length; i++) tess[i] = vol[i] >= -500 ? 1 : 0;
    const Dt = dist(tess, true), dil = new Uint8Array(vol.length); for (let i = 0; i < vol.length; i++) dil[i] = Dt[i] <= rC ? 1 : 0;
    const Dd = dist(dil, true), prec = mask.slice(); let resta = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { if (!(Dd[i] > rC)) mask[i] = 0; else resta++; }
    if (resta < 4) mask.set(prec);   // involucro non affidabile (nodulo quasi tutto fuori dall'aria): si rinuncia al taglio
  }
  // apertura con una sfera di raggio metà dello spessore: erosione = distanza dal bordo ≥ rO; dilatazione = entro rO
  // dall'erosa. Stacca vasi e ponti più sottili del nodulo.
  const rO = Math.max(0.6, Math.min(5, maxE * 0.5));
  const D2 = dist(mask), erosa = new Uint8Array(mask.length); let nEr = 0; for (let i = 0; i < D2.length; i++) if (D2[i] >= rO) { erosa[i] = 1; nEr++; }
  let fin = mask;
  if (nEr) {
    const fuori = new Uint8Array(mask.length); for (let i = 0; i < fuori.length; i++) fuori[i] = erosa[i] ? 0 : 1;
    const De = dist(fuori), aperta = new Uint8Array(mask.length); for (let i = 0; i < aperta.length; i++) aperta[i] = mask[i] && De[i] <= rO + 1e-6 ? 1 : 0;
    let s0 = I(sxv, syv, szv);
    if (!aperta[s0]) { let bd = Infinity; for (let i = 0; i < aperta.length; i++) if (aperta[i]) { const x = i % NX, y = ((i / NX) | 0) % NY, z = (i / (NX * NY)) | 0, d = Math.hypot((x - sxv) * sx, (y - syv) * sy, (z - szv) * sz); if (d < bd) { bd = d; s0 = i; } } if (bd > r0 + 2) s0 = -1; }
    if (s0 >= 0) {
      const comp = new Uint8Array(aperta.length), q = [s0]; comp[s0] = 1;
      while (q.length) { const i = q.pop(), x = i % NX, y = ((i / NX) | 0) % NY, z = (i / (NX * NY)) | 0;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= NX || Y >= NY || Z >= NZ) continue; const j = I(X, Y, Z); if (!comp[j] && aperta[j]) { comp[j] = 1; q.push(j); } } }
      let nc = 0; for (let i = 0; i < comp.length; i++) nc += comp[i];
      if (nc >= 4) fin = comp;
    }
  }
  // maschere per immagine (indici nell'immagine intera), come la crescita di regione generale
  const maschere = new Map(); let vox = 0, somma = 0, sconfina = false;
  for (let z = 0; z < NZ; z++) { const l = [];
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = I(x, y, z); if (!fin[i]) continue; l.push((y + ya) * W + x + xa); vox++; somma += vol[i];
      if (Math.hypot((x - sxv) * sx, (y - syv) * sy, (z - szv) * sz) > rS - 1.5) sconfina = true; }
    if (l.length) maschere.set(fette[z][0], l); }
  return { maschere, vol: vox * sx * sy * sz / 1000, media: somma / Math.max(1, vox), sconfina: sconfina && rF >= R - 1, spessore: maxE, subsolido, soglia: T, raggio: r0, passo: sz };
}
