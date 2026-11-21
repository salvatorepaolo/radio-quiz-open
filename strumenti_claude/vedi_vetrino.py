"""vedi_vetrino.py <livello.dcm> <uscita.jpg> [x y w h] [lato]: ricompone (una parte di) un livello TILED_FULL JPEG di un
vetrino DICOM e la salva ridotta a <lato> px (per controllare il tessuto). Coordinate in pixel del livello."""
import sys, io
import pydicom, numpy as np
from pydicom.encaps import generate_fragmented_frames
from PIL import Image
f, out = sys.argv[1], sys.argv[2]
d = pydicom.dcmread(f, stop_before_pixels=False, defer_size='1 KB')
W, H, tw, th = d.TotalPixelMatrixColumns, d.TotalPixelMatrixRows, d.Columns, d.Rows
x, y, w, h = (float(v) for v in sys.argv[3:7]) if len(sys.argv) >= 7 else (0, 0, W, H)
if max(x, y, w, h) <= 1: x, y, w, h = x * W, y * H, w * W, h * H   # frazioni del vetrino
x, y, w, h = int(x), int(y), int(w), int(h)
lato = int(sys.argv[7]) if len(sys.argv) >= 8 else 1600
nx = -(-W // tw)
frames = [b''.join(fr) if isinstance(fr, (list, tuple)) else fr for fr in generate_fragmented_frames(d.PixelData, number_of_frames=int(d.NumberOfFrames))]
img = Image.new('RGB', (w, h), 'white')
for ty in range(y // th, -(-(y + h) // th)):
    for tx in range(x // tw, -(-(x + w) // tw)):
        k = ty * nx + tx
        if k >= len(frames) or tx * tw >= W: continue
        t = Image.open(io.BytesIO(frames[k])).convert('RGB')
        img.paste(t, (tx * tw - x, ty * th - y))
img.thumbnail((lato, lato)); img.save(out, quality=88)
print(out, img.size, 'livello', W, 'x', H)
