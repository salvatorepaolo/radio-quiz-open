#!/usr/bin/env python3
"""27/11 (3): funzioni di prova per confrontare due maschere dei vasi (vecchia e nuova regola)."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
if '_confrontoVasi' in s: print('gia'); raise SystemExit
a = "export function _opzioniVasi(o = {}) {"
assert s.count(a) == 1
s = s.replace(a, """let vasiSalvati = null;
export function _salvaVasi() { vasiSalvati = ultimiVasi ? ultimiVasi.m.slice() : null; return !!vasiSalvati; }
/** confronto con la maschera salvata: voxel aggiunti / tolti e aggiunti lontani (> 3 voxel) dai vasi di prima */
export function _confrontoVasi() {
  if (!vasiSalvati || !ultimiVasi || vasiSalvati.length !== ultimiVasi.m.length) return null;
  const { m, R, semeOsso } = ultimiVasi, { W, H, N } = R, n = W * H * N, vv = R.sp[0] * R.sp[1] * R.sp[2] / 1000;
  const vic = dilataIn(vasiSalvati, new Uint8Array(n).fill(1), W, H, N, 3), lont = new Uint8Array(n);
  let ag = 0, to = 0, nl = 0, densi = 0;
  for (let p = 0; p < n; p++) { if (m[p] && !vasiSalvati[p]) { ag++; if (!vic[p]) { lont[p] = 1; nl++; if (R.rmax[p] >= semeOsso) densi++; } } else if (!m[p] && vasiSalvati[p]) to++; }
  const { comp } = componenti3d(lont, W, H, N), grandi = comp.filter((c) => c.n * vv >= 0.3).map((c) => Math.round(c.n * vv * 10) / 10).sort((a, b) => b - a);
  const cm = (x) => Math.round(x * vv * 100) / 100;
  return { aggiunti: cm(ag), tolti: cm(to), lontani: cm(nl), lontaniDensi: cm(densi), pezziLontani: grandi.slice(0, 8), prima: cm(vasiSalvati.reduce((a, b) => a + b, 0)), dopo: cm(m.reduce((a, b) => a + b, 0)) };
}
""" + a)
P.write_text(s); print('ok')
