import shutil
M = '/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js'
shutil.copy(M, M + '.bak_1107j')
s = open(M, encoding='utf-8').read()
def sost(vecchio, nuovo, n=1):
    global s
    c = s.count(vecchio); assert c == n, (vecchio[:90], c); s = s.replace(vecchio, nuovo)

NUOVO = r'''
// ---- diametri del vaso nelle sezioni perpendicolari alla linea centrale (aneurismi, ectasie)
// parete esterna dalla segmentazione IA quando c'è (comprende il trombo), altrimenti il lume opacizzato
let iaVaso = null, cacheR = null;
function ridottaC() { if (!cacheR || cacheR.vol !== VOL) cacheR = { vol: VOL, R: ridotta() }; return cacheR.R; }
let cacheL = null;
function etichetteC(geo, lab) { if (!cacheL || cacheL.vol !== VOL || cacheL.lab !== lab) cacheL = { vol: VOL, lab, L: etichetteSuR(geo, lab, ridottaC()) }; return cacheL.L; }
/** sceglie il vaso della segmentazione IA per la parete esterna; senza nome: quello sotto la linea centrale */
export function impostaMascheraVaso({ geo, lab, nome } = {}) {
  iaVaso = null;
  if (!geo || !lab || !VOL) return null;
  const R = ridottaC(), L = etichetteC(geo, lab);
  let id = nome ? +(Object.entries(geo.etichette).find(([, v]) => v === nome)?.[0] || 0) : 0;
  if (!id && cpr?.punti.length >= 2) {   // etichetta più frequente lungo la linea centrale (solo vasi)
    const conta = {}, curva = curvaCPR(2);
    for (const w of curva) { const p = daMondo(R, w); if (p.some((v, a) => v < 0 || v >= [R.W, R.H, R.N][a])) continue; const e = L[(p[2] * R.H + p[1]) * R.W + p[0]]; if (e) conta[e] = (conta[e] || 0) + 1; }
    const vaso = /aorta|arter|vein|vena|trunk|carotid|subclavian|iliac/;
    const mig = Object.entries(conta).filter(([e]) => vaso.test(geo.etichette[e] || '')).sort((a, b) => b[1] - a[1])[0];
    if (mig && mig[1] >= curva.length * 0.4) id = +mig[0];
  }
  if (!id) return null;
  iaVaso = { R, L, id, nome: geo.etichette[id] };
  return iaVaso.nome;
}
function etichettaIn(w) {
  const { R, L } = iaVaso, p = daMondo(R, w);
  if (p.some((v, a) => v < 0 || v >= [R.W, R.H, R.N][a])) return 0;
  return L[(p[2] * R.H + p[1]) * R.W + p[0]];
}
/** sistemi di riferimento lungo la curva che ruotano il meno possibile (trasporto parallelo) */
function riferimentiCurva(curva) {
  const n = curva.length, norm = (v) => { const l = lung(v) || 1; return v.map((x) => x / l); }, out = [];
  let N = null;
  for (let i = 0; i < n; i++) {
    const T = norm(sotto(curva[Math.min(n - 1, i + 1)], curva[Math.max(0, i - 1)]));
    N = norm(N ? sotto(N, T.map((x) => x * punto(N, T))) : croce(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]));
    out.push({ T, A: N, B: croce(T, N) });
  }
  return out;
}
const RAGGI_D = 48;
/** una sezione: raggi del lume e della parete esterna, diametro massimo e quello perpendicolare */
function misuraSezione(c, A, B) {
  const ct = VOL.unita === 'HU', dir = (t) => { const a = t * 2 * Math.PI / RAGGI_D; return [0, 1, 2].map((q) => A[q] * Math.cos(a) + B[q] * Math.sin(a)); };
  let ic = 0, nc = 0;
  for (let t = 0; t < 8; t++) { const D = dir(t * RAGGI_D / 8), v = campiona([0, 1, 2].map((q) => c[q] + D[q] * 0.8)); if (v != null) { ic += v; nc++; } }
  const v0 = campiona(c); if (v0 != null) { ic += v0; nc++; }
  if (!nc) return null;
  ic /= nc; const soglia = ct ? Math.max(100, (ic + 20) / 2) : ic / 2;
  const rl = [], re = [], ia = iaVaso && etichettaIn(c) === iaVaso.id;
  for (let t = 0; t < RAGGI_D; t++) {
    const D = dir(t);
    let r = 0; for (let d = 0.2; d <= 45; d += 0.2) { const v = campiona([0, 1, 2].map((q) => c[q] + D[q] * d)); if (v == null || v < soglia) break; r = d; }
    rl.push(r + 0.1);
    if (ia) { let rr = 0, buchi = 0; for (let d = 0.25; d <= 70; d += 0.25) { if (etichettaIn([0, 1, 2].map((q) => c[q] + D[q] * d)) === iaVaso.id) { rr = d; buchi = 0; } else if (++buchi > 8) break; } re.push(rr + 0.5); }
  }
  // i raggi che escono lungo un ramo (arterie renali, tronco celiaco) non sono il diametro del vaso:
  // limitati a 1,6 volte la mediana della sezione
  const taglia = (r) => { const m = [...r].sort((a, b) => a - b)[r.length >> 1]; return r.map((x) => Math.min(x, 1.6 * m)); };
  const rL = taglia(rl), rE = ia ? taglia(re).map((x, t) => Math.max(x, rL[t])) : rL;
  const diam = (r) => { let dmax = 0, tmax = 0; for (let t = 0; t < RAGGI_D / 2; t++) { const d = r[t] + r[t + RAGGI_D / 2]; if (d > dmax) { dmax = d; tmax = t; } }
    const tp = (tmax + RAGGI_D / 4) % RAGGI_D; return { dmax, tmax, dperp: r[tp] + r[(tp + RAGGI_D / 2) % RAGGI_D] }; };
  const e = diam(rE), l = diam(rL);
  let area = 0; for (let t = 0; t < RAGGI_D; t++) area += 0.5 * rE[t] * rE[(t + 1) % RAGGI_D] * Math.sin(2 * Math.PI / RAGGI_D);
  return { rE, rL, ia, dmax: e.dmax, dperp: e.dperp, tmax: e.tmax, dlume: l.dmax, area };
}
/** profilo dei diametri ogni millimetro e punto di diametro massimo (lontano dagli estremi) */
export function diametriVaso() {
  if (!cpr || cpr.punti.length < 2 || !VOL) return { ok: false, motivo: 'servono almeno due punti sul vaso' };
  const curva = curvaCPR(1), rif = riferimentiCurva(curva), n = curva.length, out = [];
  for (let i = 0; i < n; i++) { const m = misuraSezione(curva[i], rif[i].A, rif[i].B); out.push(m ? { s: i, dmax: m.dmax, dperp: m.dperp, dlume: m.dlume, area: m.area, ia: m.ia } : null); }
  const m0 = Math.min(5, Math.floor(n * 0.05)), m1 = n - 1 - m0;
  let max = null;
  for (let i = Math.max(1, m0); i < Math.min(n - 1, m1 + 1); i++) {
    const w = out.slice(i - 1, i + 2); if (w.some((x) => !x)) continue;
    const d = [...w.map((x) => x.dmax)].sort((a, b) => a - b)[1];   // mediana di tre: niente picchi isolati
    if (!max || d > max.d) max = { d, i };
  }
  const val = out.filter(Boolean), med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const k = Math.max(2, Math.round(val.length * 0.15)), rifP = med(val.slice(0, k).map((x) => x.dmax)), rifD = med(val.slice(-k).map((x) => x.dmax));
  const massimo = max ? { s: max.i, dmax: out[max.i].dmax, dperp: out[max.i].dperp, dlume: out[max.i].dlume, area: out[max.i].area } : null;
  const ia = val.filter((x) => x.ia).length > val.length / 2;
  return { ok: true, profilo: out, lunghezza: n - 1, massimo, rifP, rifD, parete: ia ? 'ia' : 'lume', vaso: ia ? iaVaso.nome : null };
}
/** immagine della sezione perpendicolare alla linea centrale a «s» mm dall'inizio, con contorno e diametri */
export function sezioneVaso(s, { campo = 40, passo = 0.25 } = {}) {
  if (!cpr || cpr.punti.length < 2 || !VOL) return null;
  const curva = curvaCPR(1), i = Math.max(0, Math.min(curva.length - 1, Math.round(s))), rif = riferimentiCurva(curva.slice(0, i + 2))[i];
  const c = curva[i], { A, B } = rif, m = misuraSezione(c, A, B);
  const cm = m ? Math.max(campo, Math.max(...m.rE) * 1.35) : campo, lato = Math.round(2 * cm / passo), dati = new Float32Array(lato * lato);
  for (let y = 0; y < lato; y++) for (let x = 0; x < lato; x++) {
    const u = (x - lato / 2) * passo, v = (lato / 2 - y) * passo;
    const val = campiona([0, 1, 2].map((q) => c[q] + A[q] * u + B[q] * v)); dati[y * lato + x] = val == null ? -1024 : val;
  }
  const px = (r, t) => { const a = t * 2 * Math.PI / RAGGI_D; return [lato / 2 + r * Math.cos(a) / passo, lato / 2 - r * Math.sin(a) / passo]; };
  const out = { dati, lato, passo: cm * 2 / lato, s: i, voi: motore.getViewport(VP.assiale).getProperties().voiRange || { lower: -160, upper: 240 } };
  if (m) {
    out.contorno = m.rE.map((r, t) => px(r, t)); out.lume = m.ia ? m.rL.map((r, t) => px(r, t)) : null;
    const t0 = m.tmax, tp = (t0 + RAGGI_D / 4) % RAGGI_D;
    out.linee = [{ a: px(m.rE[t0], t0), b: px(m.rE[(t0 + RAGGI_D / 2) % RAGGI_D], t0 + RAGGI_D / 2), mm: m.dmax, tipo: 'max' },
      { a: px(m.rE[tp], tp), b: px(m.rE[(tp + RAGGI_D / 2) % RAGGI_D], tp + RAGGI_D / 2), mm: m.dperp, tipo: 'perp' }];
    out.dmax = m.dmax; out.dperp = m.dperp; out.dlume = m.dlume; out.ia = m.ia;
  }
  return out;
}
/** linea centrale di un vaso della segmentazione IA (non l'aorta, che ha la sua): dagli estremi più lontani */
export function lineaVasoIA({ geo, lab, nome }) {
  if (!motore || !VOL || !cpr) return { ok: false, motivo: 'apri prima lo strumento CPR' };
  const id = +(Object.entries(geo.etichette).find(([, v]) => v === nome)?.[0] || 0); if (!id) return { ok: false, motivo: 'vaso non segmentato in questa serie' };
  const R = ridottaC(), { W, H, N } = R, WH = W * H, L = etichetteC(geo, lab);
  const m = new Uint8Array(W * H * N); let primo = -1, tot = 0;
  for (let p = 0; p < m.length; p++) if (L[p] === id) { m[p] = 1; tot++; if (primo < 0) primo = p; }
  if (tot < 20) return { ok: false, motivo: 'vaso troppo piccolo in questa serie' };
  // componente più grande, poi gli estremi: il voxel più lontano da uno qualsiasi, e il più lontano da quello
  const segno = new Int32Array(m.length), coda = new Int32Array(tot + 1); let gen = 0;
  const visita = (da) => { gen++; let qi = 0, qn = 0, ult = da; segno[da] = gen; coda[qn++] = da;
    while (qi < qn) { const q = coda[qi++], i = q % W, j = ((q / W) | 0) % H, k = (q / WH) | 0; ult = q;
      for (const [r, ok] of [[q - 1, i > 0], [q + 1, i < W - 1], [q - W, j > 0], [q + W, j < H - 1], [q - WH, k > 0], [q + WH, k < N - 1]])
        if (ok && m[r] && segno[r] !== gen) { segno[r] = gen; coda[qn++] = r; } }
    return { ult, n: qn }; };
  let seme = primo, mig = visita(primo);
  if (mig.n < tot * 0.5) {   // la prima componente è piccola: cerca la più grande
    const fatto = new Uint8Array(m.length);
    for (let p = 0; p < m.length; p++) if (m[p] && !fatto[p]) { const v = visita(p); for (let x = 0; x < v.n; x++) fatto[coda[x]] = 1; if (v.n > mig.n) { mig = v; seme = p; } if (mig.n > tot * 0.5) break; }
  }
  const a = visita(seme).ult, b = visita(a).ult;
  const vox = (q) => [q % W, ((q / W) | 0) % H, (q / WH) | 0];
  const via = percorsoNelVaso(R, m, vox(a), vox(b));
  if (!via || via.length < 3) return { ok: false, motivo: 'non trovo un percorso continuo nel vaso' };
  const lisc = via.map((_, i) => { const x = Math.max(0, i - 3), y = Math.min(via.length - 1, i + 3); return [0, 1, 2].map((q) => { let t = 0; for (let k = x; k <= y; k++) t += via[k][q]; return t / (y - x + 1); }); });
  const punti = [lisc[0]]; let acc = 0, tl = 0;
  for (let i = 1; i < lisc.length; i++) { const d = lung(sotto(lisc[i], lisc[i - 1])); acc += d; tl += d; if (acc >= 8) { punti.push(lisc[i]); acc = 0; } }
  if (lung(sotto(punti[punti.length - 1], lisc[lisc.length - 1])) > 0.5) punti.push(lisc[lisc.length - 1]);
  // dall'alto verso il basso (craniale → caudale), come si legge
  if (punti[0][2] < punti[punti.length - 1][2]) punti.reverse();
  cpr.punti = punti; disegnaPuntiCPR(); cpr.suPunti?.(cpr.punti.length);
  return { ok: true, n: punti.length, lunghezza: Math.round(tl) };
}

// ---- CPR: ricostruzione curva lungo una linea centrale indicata con i clic nelle viste MPR'''
sost("\n// ---- CPR: ricostruzione curva lungo una linea centrale indicata con i clic nelle viste MPR", NUOVO)
# l'aorta IA usa la cache della volumetria ridotta
sost("  const R = ridotta(), { W, H, N } = R, WH = W * H, L = etichetteSuR(geo, lab, R);\n  const id = Object.entries(geo.etichette).find(([, v]) => v === 'aorta')?.[0];",
     "  const R = ridottaC(), { W, H, N } = R, WH = W * H, L = etichetteC(geo, lab);\n  const id = Object.entries(geo.etichette).find(([, v]) => v === 'aorta')?.[0];")
sost("  cpr = null;\n", "  cpr = null; iaVaso = null; cacheR = null; cacheL = null;\n")
open(M, 'w', encoding='utf-8').write(s)
print('ok')
