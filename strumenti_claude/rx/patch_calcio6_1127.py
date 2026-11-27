#!/usr/bin/env python3
"""27/11 (6): il lume di riferimento non deve essere racchiuso dall'osso: il midollo (sterno, vertebre) è circondato
dalla corticale densa, il lume di un vaso è circondato soprattutto dalla parete (tessuto molle). Si scarta la regione
di sangue con più di un quinto del contorno a contatto con i semi densi."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
v = """  const S = componenti3d(bl, W, H, N), dentro = new Float64Array(S.comp.length + 1);
  for (let p = 0; p < n; p++) if (S.lab[p] && vasiBase[p]) dentro[S.lab[p]]++;
  const lume = new Uint8Array(S.comp.length + 1); for (const c of S.comp) if (c.n * vv >= 2000 && dentro[c.L] >= c.n * 0.5) lume[c.L] = 1;"""
nv = """  // e non racchiuse dall'osso (il midollo di sterno e vertebre tocca la corticale densa per buona parte del contorno)
  const S = componenti3d(bl, W, H, N), dentro = new Float64Array(S.comp.length + 1), cont = new Float64Array(S.comp.length + 1), contO = new Float64Array(S.comp.length + 1);
  for (let p = 0; p < n; p++) { const L = S.lab[p]; if (!L) continue; if (vasiBase[p]) dentro[L]++;
    const i = p % W, j = ((p / W) | 0) % H, k = (p / WH) | 0;
    for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - WH, k > 0], [p + WH, k < N - 1]])
      if (ok && S.lab[q] !== L) { cont[L]++; if (semi[q]) contO[L]++; } }
  const lume = new Uint8Array(S.comp.length + 1);
  for (const c of S.comp) if (c.n * vv >= 2000 && dentro[c.L] >= c.n * 0.5 && contO[c.L] < cont[c.L] * 0.2) lume[c.L] = 1;"""
assert s.count(v) == 1
s = s.replace(v, nv); P.write_text(s); print('ok')
