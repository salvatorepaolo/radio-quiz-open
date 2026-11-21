// T2* e R2* da una serie multi-eco (sovraccarico di ferro): calcoli per la refertazione (codice nostro).
// Si usa la media del segnale in una ROI per ogni tempo di eco (TE, ms).
// - modello con offset: S = S0·exp(−TE/T2*) + C  (C assorbe il «pavimento» del rumore negli echi tardivi: è il
//   modello raccomandato per i T2* bassi, come nel sovraccarico grave). Per ogni T2* provato S0 e C si ricavano con i
//   minimi quadrati lineari (C ≥ 0); il T2* si cerca su una griglia logaritmica e poi si affina con la sezione aurea.
// - retta su ln(S) con tutti gli echi; versione troncata: si tolgono gli ultimi echi finché R² ≥ 0,998 (almeno 3).
// Scelta del risultato: se la retta su tutti gli echi dà un T2* più lungo dell'ultimo TE, il segnale non arriva al
//   plateau del rumore (T2* lungo, cuore normale): vale la retta su tutti gli echi, perché il modello con offset non è
//   identificabile (scambia la coda per «rumore» e può dare un T2* falsamente basso). Altrimenti (decadimento rapido,
//   sovraccarico) vale il modello con offset e la retta troncata è il confronto. Con T2* molto più lunghi degli echi
//   acquisiti la stima è meno precisa: conta la classe (> 20 ms), non il numero esatto.
// Soglie del cuore (1,5 T): > 20 ms normale, 10-20 ms sovraccarico lieve-moderato, < 10 ms grave.
// Ferro epatico (LIC, mg/g di peso secco) da R2* a 1,5 T con la calibrazione su biopsia di
//   Garbowski MW et al., J Cardiovasc Magn Reson 2014;16:40: LIC = 0,029 × R2*^1,014 (R2* in s⁻¹).
//   Classi: < 2 normale, 2-7 lieve, 7-15 moderato, > 15 grave.

function lineare(te, s, t2) {
  // S = a·e + c con e = exp(−TE/T2*): minimi quadrati con c ≥ 0
  const n = te.length, e = te.map((t) => Math.exp(-t / t2));
  const se = e.reduce((x, y) => x + y, 0), ss = s.reduce((x, y) => x + y, 0);
  const see = e.reduce((x, y) => x + y * y, 0), ses = e.reduce((x, y, i) => x + y * s[i], 0);
  const det = n * see - se * se;
  let a = det ? (n * ses - se * ss) / det : 0, c = det ? (ss - a * se) / n : 0;
  if (c < 0) { c = 0; a = see ? ses / see : 0; }
  const sse = s.reduce((x, y, i) => x + (y - a * e[i] - c) ** 2, 0);
  return { a, c, sse };
}

function r2(s, pred) {
  const m = s.reduce((x, y) => x + y, 0) / s.length;
  const tot = s.reduce((x, y) => x + (y - m) ** 2, 0), res = s.reduce((x, y, i) => x + (y - pred[i]) ** 2, 0);
  return tot ? 1 - res / tot : 1;
}

export function fitOffset(te, s) {
  if (te.length < 3) return null;
  const err = (t2) => lineare(te, s, t2).sse;
  let best = 0.5, bestE = Infinity;
  for (let lt = Math.log(0.3); lt <= Math.log(300); lt += 0.05) { const t2 = Math.exp(lt), v = err(t2); if (v < bestE) { bestE = v; best = t2; } }
  // sezione aurea attorno al minimo (in log)
  let lo = Math.log(best) - 0.06, hi = Math.log(best) + 0.06; const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 40; k++) { const x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo); if (err(Math.exp(x1)) < err(Math.exp(x2))) hi = x2; else lo = x1; }
  const t2 = Math.exp((lo + hi) / 2), { a, c } = lineare(te, s, t2);
  const pred = te.map((t) => a * Math.exp(-t / t2) + c);
  return { t2, r2star: 1000 / t2, s0: a, c, r2: r2(s, pred), modello: 'offset' };
}

export function fitTroncato(te, s, { minR2 = 0.998 } = {}) {
  let n = te.length; if (n < 3) return null;
  let ris = null;
  for (; n >= 3; n--) {
    const x = te.slice(0, n), y = s.slice(0, n).map((v) => Math.log(Math.max(v, 1e-6)));
    const mx = x.reduce((p, q) => p + q, 0) / n, my = y.reduce((p, q) => p + q, 0) / n;
    const sxy = x.reduce((p, q, i) => p + (q - mx) * (y[i] - my), 0), sxx = x.reduce((p, q) => p + (q - mx) ** 2, 0);
    const b = sxx ? sxy / sxx : 0, a = my - b * mx;
    const q = r2(y, x.map((t) => a + b * t));
    ris = { t2: b < 0 ? -1 / b : Infinity, s0: Math.exp(a), r2: q, echi: n, modello: 'troncato' };
    ris.r2star = 1000 / ris.t2;
    if (q >= minR2) break;
  }
  return ris;
}

export function classeCuore(t2) {
  if (!(t2 > 0)) return null;
  return t2 > 20 ? 'nessun sovraccarico di ferro (T2* > 20 ms)' : t2 >= 10 ? 'sovraccarico di ferro lieve-moderato (T2* 10-20 ms)' : 'sovraccarico di ferro grave (T2* < 10 ms)';
}
export const licDaR2 = (r2star) => (r2star > 0 ? 0.029 * r2star ** 1.014 : null);
export function classeFegato(lic) {
  if (lic == null) return null;
  return lic < 2 ? 'nella norma (< 2 mg/g)' : lic < 7 ? 'sovraccarico lieve (2-7 mg/g)' : lic < 15 ? 'sovraccarico moderato (7-15 mg/g)' : 'sovraccarico grave (> 15 mg/g)';
}
// tutto insieme: te in ms, s = medie della ROI; organo 'cuore' | 'fegato'
export function analizza(te, s, organo = 'cuore') {
  const ord = te.map((t, i) => [t, s[i]]).filter(([t, v]) => t > 0 && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  const T = ord.map((x) => x[0]), S = ord.map((x) => x[1]);
  if (new Set(T).size < 3) return null;
  const off = fitOffset(T, S), tutti = fitTroncato(T, S, { minR2: -Infinity });
  const lungo = tutti.t2 > T[T.length - 1];
  const principale = lungo ? tutti : off, retta = lungo ? tutti : fitTroncato(T, S);
  const out = { te: T, s: S, offset: off, troncato: retta, principale, lungo, organo };
  if (organo === 'fegato') { out.lic = licDaR2(principale.r2star); out.classe = classeFegato(out.lic); }
  else out.classe = classeCuore(principale.t2);
  return out;
}
