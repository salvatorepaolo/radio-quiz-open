#!/usr/bin/env python3
"""27/11: le calcificazioni vascolari non sono osso.

Prima: ogni voxel piu' denso di semeOsso (450 HU o 1,4 x densita' dei vasi + 60) faceva da seme
per l'osso, cresceva nella "spongiosa" (>= 170 HU, cioe' anche nel lume opacizzato) e i buchi
venivano riempiti strato per strato: una placca calcifica si portava via un pezzo di vaso.

Ora: i semi densi si dividono in componenti 3D; una componente piccola (<= 6 cm3) che per almeno
il 25% del suo contorno tocca sangue opacizzato (0,75-1,35 x densita' dei vasi) e' una
calcificazione: resta nel vaso e non e' piu' osso (nel 3D Vascular si vede in giallo chiaro).
Vale solo quando i vasi sono ben opacizzati (densita' >= 250 HU), dove il midollo osseo non si
confonde con il sangue. La stessa regola vale per «togli l'osso» negli altri preset.
"""
import sys, pathlib

P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
if 'function calcificazioniR' in s:
    print('gia applicata'); sys.exit(0)

def sost(vecchio, nuovo, conta=1):
    global s
    n = s.count(vecchio)
    if n != conta:
        raise SystemExit(f'atteso {conta}, trovato {n}: {vecchio[:80]!r}')
    s = s.replace(vecchio, nuovo)

# 1) vasi(): semi dell'osso senza le calcificazioni
sost("""  let lo, semeOsso = 450;
  if (ct) { const dv = densitaVasi(R, corpo); lo = dv ? Math.max(140, dv * 0.6) : 160; if (dv) semeOsso = Math.max(450, Math.round(dv * 1.4 + 60)); }""",
"""  let lo, semeOsso = 450, dv = null;
  if (ct) { dv = densitaVasi(R, corpo); lo = dv ? Math.max(140, dv * 0.6) : 160; if (dv) semeOsso = Math.max(450, Math.round(dv * 1.4 + 60)); }""")
sost("""    let o = new Uint8Array(n); for (let p = 0; p < n; p++) o[p] = R.rmax[p] >= semeOsso ? 1 : 0;
    const spong""",
"""    let o = new Uint8Array(n); for (let p = 0; p < n; p++) o[p] = R.rmax[p] >= semeOsso ? 1 : 0;
    // le calcificazioni dei vasi non sono osso: prima facevano da seme e si portavano via un pezzo di vaso
    const calc = OPZ_VASI.calcio ? calcificazioniR(R, o, dv, semeOsso) : null;
    if (calc) for (let p = 0; p < n; p++) if (calc[p]) o[p] = 0;
    const spong""")
sost("""  } else ncomp = A.ok.reduce((a, b) => a + b, 0);
  return { m, soglia: Math.round(lo), componenti: ncomp, tot };
}""",
"""  } else ncomp = A.ok.reduce((a, b) => a + b, 0);
  ultimiVasi = { m, R, dv, semeOsso };
  return { m, soglia: Math.round(lo), componenti: ncomp, tot };
}
// Calcificazioni dei vasi (griglia ridotta): componenti dei semi densi piccole (<= 6 cm³) che per almeno un quarto del
// contorno toccano il sangue opacizzato (0,75-1,35 × densità dei vasi). Solo con i vasi ben opacizzati (≥ 250 HU):
// in fase venosa il midollo osseo ha la densità del sangue e non si distingue.
let OPZ_VASI = { calcio: true }, ultimiVasi = null;
function calcificazioniR(R, semi, dv, seme) {
  if (!dv || dv < 250) return null;
  const { r, W, H, N } = R, n = W * H * N, WH = W * H, vv = R.sp[0] * R.sp[1] * R.sp[2];
  const { lab, comp } = componenti3d(semi, W, H, N), bordo = new Float64Array(comp.length + 1), sangue = new Float64Array(comp.length + 1);
  const lo = dv * 0.75, hi = Math.min(seme, dv * 1.35);
  for (let p = 0; p < n; p++) { const L = lab[p]; if (!L) continue; const i = p % W, j = ((p / W) | 0) % H, k = (p / WH) | 0;
    for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - WH, k > 0], [p + WH, k < N - 1]])
      if (ok && !semi[q]) { bordo[L]++; if (r[q] >= lo && r[q] < hi) sangue[L]++; } }
  const ok = new Uint8Array(comp.length + 1); let tot = 0;
  for (const c of comp) if (c.n * vv <= 6000 && bordo[c.L] && sangue[c.L] / bordo[c.L] >= 0.25) { ok[c.L] = 1; tot += c.n; }
  if (!tot) return null;
  const out = new Uint8Array(n); for (let p = 0; p < n; p++) if (ok[lab[p]]) out[p] = 1;
  return out;
}
// calcificazioni per «togli l'osso» (stessi semi della segmentazione dei vasi), in cache per volume
let cacheCalcio = null;
function calcioPerOsso() {
  if (cacheCalcio?.vol === VOL) return cacheCalcio.c;
  let c = null;
  if (OPZ_VASI.calcio && VOL.unita === 'HU') {
    const R = ridottaC(), dv = densitaVasi(R, corpo3dR().m);
    if (dv) { const seme = Math.max(450, Math.round(dv * 1.4 + 60)), n = R.r.length, s0 = new Uint8Array(n);
      for (let p = 0; p < n; p++) s0[p] = R.rmax[p] >= seme ? 1 : 0;
      const m = calcificazioniR(R, s0, dv, seme); if (m) c = { m, W: R.W, H: R.H, N: R.N }; }
  }
  cacheCalcio = { vol: VOL, c };
  return c;
}
export function _opzioniVasi(o = {}) { Object.assign(OPZ_VASI, o); cacheCalcio = null; return { ...OPZ_VASI }; }
/** Diagnosi: calcificazioni e lume vicino, quanto ne resta nell'ultima maschera dei vasi (griglia ridotta). */
export function _diagnosiCalcio() {
  if (!ultimiVasi?.dv) return null;
  const { m, R, dv, semeOsso } = ultimiVasi, { r, W, H, N } = R, n = W * H * N, WH = W * H, s0 = new Uint8Array(n);
  for (let p = 0; p < n; p++) s0[p] = R.rmax[p] >= semeOsso ? 1 : 0;
  const c = calcificazioniR(R, s0, dv, semeOsso);
  if (!c) return { dv: Math.round(dv), calcificazioni: 0 };
  const vic = dilataIn(c, new Uint8Array(n).fill(1), W, H, N, 2), vv = R.sp[0] * R.sp[1] * R.sp[2] / 1000;
  let nc = 0, ncm = 0, nl = 0, nlm = 0;
  for (let p = 0; p < n; p++) { if (c[p]) { nc++; if (m[p]) ncm++; }
    else if (vic[p] && r[p] >= dv * 0.75 && r[p] < dv * 1.35) { nl++; if (m[p]) nlm++; } }
  const cm = (x) => Math.round(x * vv * 100) / 100;
  return { dv: Math.round(dv), calcificazioni: cm(nc), calcioNeiVasi: cm(ncm), lumeVicino: cm(nl), lumeVicinoNeiVasi: cm(nlm) };
}""")

# 2) mascheraOssoFine(): niente semi sulle calcificazioni
sost("""  const dist = new Uint8Array(n); let coda = [];
  for (let p = 0; p < n; p++) if (d[p] >= seme) { dist[p] = 1; coda.push(p); }
  for (let liv = 2; liv <= 8 && coda.length; liv++) {""",
"""  const dist = new Uint8Array(n); let coda = [];
  const cal = calcioPerOsso(), calR = (p) => { if (!cal) return 0; const i = p % W, j = ((p / W) | 0) % H, k = (p / (W * H)) | 0,
    ii = Math.min(cal.W - 1, i >> 1), jj = Math.min(cal.H - 1, j >> 1), q = (k * cal.H + jj) * cal.W + ii;
    return cal.m[q] || (ii > 0 && cal.m[q - 1]) || (ii < cal.W - 1 && cal.m[q + 1]) || (jj > 0 && cal.m[q - cal.W]) || (jj < cal.H - 1 && cal.m[q + cal.W]); };
  for (let p = 0; p < n; p++) if (d[p] >= seme && !calR(p)) { dist[p] = 1; coda.push(p); }
  for (let liv = 2; liv <= 8 && coda.length; liv++) {""")

P.write_text(s)
print('ok')
