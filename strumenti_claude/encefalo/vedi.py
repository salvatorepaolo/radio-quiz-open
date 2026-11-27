"""Controllo visivo: sovrappone le etichette all'immagine (assiale, coronale, sagittale). Uso: vedi.py img.nii.gz lab.nii.gz out.png"""
import sys
import numpy as np, nibabel as nib
from PIL import Image
im = nib.as_closest_canonical(nib.load(sys.argv[1])); lb = nib.as_closest_canonical(nib.load(sys.argv[2]))
a = im.get_fdata(); l = np.rint(lb.get_fdata()).astype(int)
print("forme", a.shape, l.shape, "etichette", len(np.unique(l)) - 1, "max", l.max())
lo, hi = np.percentile(a[a > 0], [1, 99.5]); g = np.clip((a - lo) / (hi - lo), 0, 1)
rng = np.random.default_rng(3); col = rng.integers(40, 255, (l.max() + 1, 3)); col[0] = 0
def tav(gs, ls):
    rgb = np.repeat(gs[..., None], 3, -1) * 255
    m = ls > 0; rgb[m] = rgb[m] * 0.45 + col[ls[m]] * 0.55
    return Image.fromarray(np.rot90(rgb.astype(np.uint8)))
X, Y, Z = a.shape
pez = [tav(g[:, :, Z // 2 + 10], l[:, :, Z // 2 + 10]), tav(g[:, Y // 2, :], l[:, Y // 2, :]), tav(g[X // 2 - 8, :, :], l[X // 2 - 8, :, :])]
pez = [p.resize((int(p.width * 300 / p.height), 300)) for p in pez]
W = sum(p.width for p in pez); out = Image.new("RGB", (W, 300)); x = 0
for p in pez: out.paste(p, (x, 0)); x += p.width
out.save(sys.argv[3])
