#!/usr/bin/env python3
"""27/11 (4): mappa del confronto (proiezione coronale e assiale): grigio = vasi di prima, verde = aggiunti vicino,
rosso = aggiunti lontani, giallo = calcificazioni riconosciute, blu = tolti."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
if '_mappaConfronto' in s: print('gia'); raise SystemExit
a = "export function _opzioniVasi(o = {}) {"
s = s.replace(a, """/** dataURL PNG: a sinistra proiezione coronale (x, z), a destra sagittale (y, z) */
export function _mappaConfronto() {
  if (!vasiSalvati || !ultimiVasi) return null;
  const { m, R, dv, semeOsso } = ultimiVasi, { W, H, N } = R, n = W * H * N, WH = W * H;
  const s0 = new Uint8Array(n); for (let p = 0; p < n; p++) s0[p] = R.rmax[p] >= semeOsso ? 1 : 0;
  const cal = calcificazioniR(R, s0, dv, semeOsso) || new Uint8Array(n);
  const vic = dilataIn(vasiSalvati, new Uint8Array(n).fill(1), W, H, N, 3);
  // classe per voxel: 1 prima, 2 aggiunto vicino, 3 aggiunto lontano, 4 calcificazione, 5 tolto (priorità crescente)
  const zs = Math.max(1, R.sp[2] / R.sp[0]), Hz = Math.round(N * zs), cw = W + H + 10;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = Hz; const g = cv.getContext('2d'), img = g.createImageData(cw, Hz);
  const pc = new Uint8Array(W * N), ps = new Uint8Array(H * N);
  for (let p = 0; p < n; p++) { let c = 0;
    if (vasiSalvati[p] && !m[p]) c = 5; else if (cal[p] && m[p]) c = 4; else if (m[p] && !vasiSalvati[p]) c = vic[p] ? 2 : 3; else if (m[p]) c = 1;
    if (!c) continue; const i = p % W, j = ((p / W) | 0) % H, k = (p / WH) | 0;
    if (c > pc[k * W + i]) pc[k * W + i] = c; if (c > ps[k * H + j]) ps[k * H + j] = c; }
  const col = [[0, 0, 0], [150, 150, 150], [40, 200, 60], [240, 40, 40], [255, 230, 0], [60, 120, 255]];
  const su = VOL.assi?.[2]?.[2] >= 0;
  for (let y = 0; y < Hz; y++) { const k0 = Math.min(N - 1, Math.floor(y / zs)), k = su ? N - 1 - k0 : k0;
    for (let x = 0; x < cw; x++) { let c = 0; if (x < W) c = pc[k * W + x]; else if (x >= W + 10) c = ps[k * H + (x - W - 10)]; const o = (y * cw + x) * 4, cc = col[c];
      img.data[o] = cc[0]; img.data[o + 1] = cc[1]; img.data[o + 2] = cc[2]; img.data[o + 3] = 255; } }
  g.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
""" + a, 1)
P.write_text(s); print('ok')
