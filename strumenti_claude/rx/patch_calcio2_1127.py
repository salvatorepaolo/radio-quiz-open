#!/usr/bin/env python3
"""27/11 (2): una calcificazione deve toccare il lume dei vasi principali (regione di sangue opacizzato grande,
almeno 30 cm³ o un quarto della più grande), non il midollo di una costa (piccolo e chiuso nella corticale)."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
vecchio = """  const { lab, comp } = componenti3d(semi, W, H, N), bordo = new Float64Array(comp.length + 1), sangue = new Float64Array(comp.length + 1);
  const lo = dv * 0.75, hi = Math.min(seme, dv * 1.35);
  for (let p = 0; p < n; p++) { const L = lab[p]; if (!L) continue; const i = p % W, j = ((p / W) | 0) % H, k = (p / WH) | 0;
    for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - WH, k > 0], [p + WH, k < N - 1]])
      if (ok && !semi[q]) { bordo[L]++; if (r[q] >= lo && r[q] < hi) sangue[L]++; } }"""
nuovo = """  const { lab, comp } = componenti3d(semi, W, H, N), bordo = new Float64Array(comp.length + 1), sangue = new Float64Array(comp.length + 1);
  const lo = dv * 0.75, hi = Math.min(seme, dv * 1.35);
  // lume dei vasi principali: regioni di sangue opacizzato grandi (il midollo delle coste è piccolo e chiuso nella corticale)
  const bl = new Uint8Array(n); for (let p = 0; p < n; p++) bl[p] = !semi[p] && r[p] >= lo && r[p] < hi ? 1 : 0;
  const S = componenti3d(bl, W, H, N), maxS = S.comp.reduce((a, c) => Math.max(a, c.n), 0), minS = Math.min(30000 / vv, maxS * 0.25);
  const lume = new Uint8Array(S.comp.length + 1); for (const c of S.comp) if (c.n >= minS) lume[c.L] = 1;
  for (let p = 0; p < n; p++) { const L = lab[p]; if (!L) continue; const i = p % W, j = ((p / W) | 0) % H, k = (p / WH) | 0;
    for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - WH, k > 0], [p + WH, k < N - 1]])
      if (ok && !semi[q]) { bordo[L]++; if (lume[S.lab[q]]) sangue[L]++; } }"""
assert s.count(vecchio) == 1
s = s.replace(vecchio, nuovo)
s = s.replace("// Calcificazioni dei vasi (griglia ridotta): componenti dei semi densi piccole (<= 6 cm³) che per almeno un quarto del\n// contorno toccano il sangue opacizzato",
              "// Calcificazioni dei vasi (griglia ridotta): componenti dei semi densi piccole (<= 6 cm³) che per almeno un quarto del\n// contorno toccano il lume dei vasi principali (sangue opacizzato")
P.write_text(s); print('ok')
