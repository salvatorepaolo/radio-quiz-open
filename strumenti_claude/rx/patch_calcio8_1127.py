#!/usr/bin/env python3
"""27/11 (8): le regioni di sangue si individuano dopo un'erosione di un voxel (si staccano i ponti sottili di volume
parziale: midollo dello sterno saldato ai vasi mammari interni), poi il lume scelto si ricostruisce dentro il sangue."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
v = """  const S = componenti3d(bl, W, H, N), dentro"""
nv = """  const S = componenti3d(erodi(bl, W, H, N, 1), W, H, N), dentro"""
assert s.count(v) == 1; s = s.replace(v, nv)
v2 = """  for (const c of S.comp) if (c.n * vv >= 2000 && dentro[c.L] >= c.n * 0.5 && contO[c.L] < cont[c.L] * 0.2) lume[c.L] = 1;"""
nv2 = """  for (const c of S.comp) if (c.n * vv >= 2000 && dentro[c.L] >= c.n * 0.5 && contO[c.L] < cont[c.L] * 0.2) lume[c.L] = 1;
  let lm = new Uint8Array(n); for (let p = 0; p < n; p++) if (lume[S.lab[p]]) lm[p] = 1;
  lm = dilataIn(lm, bl, W, H, N, 2);"""
assert s.count(v2) == 1; s = s.replace(v2, nv2)
v3 = """      if (ok && !semi[q]) { bordo[L]++; if (lume[S.lab[q]]) sangue[L]++; } }"""
nv3 = """      if (ok && !semi[q]) { bordo[L]++; if (lm[q]) sangue[L]++; } }"""
assert s.count(v3) == 1; s = s.replace(v3, nv3)
P.write_text(s); print('ok')
