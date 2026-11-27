#!/usr/bin/env python3
"""27/11 (7): prova: fetta assiale (griglia ridotta) con il confronto sovrapposto e strati dei pezzi aggiunti lontani."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
if '_fettaConfronto' in s: print('gia'); raise SystemExit
v = "grandi = comp.filter((c) => c.n * vv >= 0.3).map((c) => Math.round(c.n * vv * 10) / 10).sort((a, b) => b - a);"
nv = "grandi = comp.filter((c) => c.n * vv >= 0.3).sort((a, b) => b.n - a.n).map((c) => Math.round(c.n * vv * 10) / 10 + '@' + Math.round(c.cz));"
assert s.count(v) == 1; s = s.replace(v, nv)
a = "export function _opzioniVasi(o = {}) {"
s = s.replace(a, """export function _fettaConfronto(k) {
  if (!ultimiVasi) return null;
  const { m, R, calc } = ultimiVasi, { r, W, H } = R, WH = W * H, o = k * WH, prima = vasiSalvati || m;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H);
  for (let q = 0; q < WH; q++) { const p = o + q, v = Math.max(0, Math.min(255, (r[p] + 160) / 400 * 255)); let c = [v, v, v];
    if (calc?.[p] && m[p]) c = [255, 230, 0]; else if (m[p] && !prima[p]) c = [240, 40, 40]; else if (m[p]) c = [v * 0.5, v * 0.5 + 60, v * 0.5 + 120];
    img.data[q * 4] = c[0]; img.data[q * 4 + 1] = c[1]; img.data[q * 4 + 2] = c[2]; img.data[q * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); return cv.toDataURL('image/png');
}
""" + a, 1)
P.write_text(s); print('ok')
