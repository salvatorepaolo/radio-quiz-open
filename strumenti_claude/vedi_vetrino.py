# vedi_vetrino.py <cartella vetrino> <livello> [x0 y0 x1 y1 (pixel del livello 0)] <out.png> [lato]
# Ritaglio di un vetrino DICOM (TILED_FULL) a un livello, leggendo solo le tessere necessarie; griglia in pixel del livello 0
import sys, glob, os, numpy as np, pydicom
from pydicom.pixels import pixel_array
from PIL import Image, ImageDraw

cart, liv = sys.argv[1], sys.argv[2]
coord = list(map(int, sys.argv[3:7])) if len(sys.argv) >= 8 else None
out = sys.argv[7] if coord else sys.argv[3]
lato = int(sys.argv[8] if coord and len(sys.argv) > 8 else (sys.argv[4] if not coord and len(sys.argv) > 4 else 1600))

f0 = os.path.join(cart, 'livello_0.dcm'); fl = os.path.join(cart, f'livello_{liv}.dcm')
d0 = pydicom.dcmread(f0, stop_before_pixels=True); d = pydicom.dcmread(fl, stop_before_pixels=True)
W0, H0 = d0.TotalPixelMatrixColumns, d0.TotalPixelMatrixRows
W, H, tw, th = d.TotalPixelMatrixColumns, d.TotalPixelMatrixRows, d.Columns, d.Rows
k = W0 / W
x0, y0, x1, y1 = coord if coord else (0, 0, W0, H0)
lx0, ly0, lx1, ly1 = int(x0 / k), int(y0 / k), min(W, int(x1 / k)), min(H, int(y1 / k))
nc = (W + tw - 1) // tw
img = np.full((ly1 - ly0, lx1 - lx0, 3), 255, np.uint8)
for ty in range(ly0 // th, (ly1 - 1) // th + 1):
    for tx in range(lx0 // tw, (lx1 - 1) // tw + 1):
        a = pixel_array(fl, index=ty * nc + tx, as_rgb=False)
        if a.ndim == 2: a = np.stack([a] * 3, -1)
        sx0, sy0 = tx * tw, ty * th
        ax0, ay0 = max(lx0, sx0), max(ly0, sy0); ax1, ay1 = min(lx1, sx0 + tw), min(ly1, sy0 + th)
        img[ay0 - ly0:ay1 - ly0, ax0 - lx0:ax1 - lx0] = a[ay0 - sy0:ay1 - sy0, ax0 - sx0:ax1 - sx0, :3]
im = Image.fromarray(img)
s = min(1, lato / max(im.size)); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
dr = ImageDraw.Draw(im); sc = s / k   # pixel livello 0 -> pixel immagine
pas = 10 ** int(np.log10(max(1, (x1 - x0) / 6))); pas = pas * (5 if (x1 - x0) / pas > 30 else 2 if (x1 - x0) / pas > 12 else 1)
for gx in range((x0 // pas + 1) * pas, x1, pas):
    X = (gx - x0) * sc; dr.line([(X, 0), (X, im.height)], fill=(0, 160, 255)); dr.text((X + 2, 2), str(gx), fill=(0, 0, 200))
for gy in range((y0 // pas + 1) * pas, y1, pas):
    Y = (gy - y0) * sc; dr.line([(0, Y), (im.width, Y)], fill=(0, 160, 255)); dr.text((2, Y + 2), str(gy), fill=(0, 0, 200))
im.save(out)
print(f'livello {liv}: {W}x{H} (x{k:.1f}), ritaglio livello0 {x0},{y0}-{x1},{y1}, immagine {im.size}, um/px livello0 ~{d0.SharedFunctionalGroupsSequence[0].PixelMeasuresSequence[0].PixelSpacing[0]*1000 if "SharedFunctionalGroupsSequence" in d0 else "?"}')
