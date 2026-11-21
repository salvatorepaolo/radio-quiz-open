import sys, pydicom, numpy as np
from PIL import Image
for i, p in enumerate(sys.argv[2:]):
    d = pydicom.dcmread(p); a = d.pixel_array
    if a.ndim == 4: a = a[0]
    if a.ndim == 3 and a.shape[-1] != 3: a = a[0]
    a = a.astype(float); a = (a - a.min()) / max(1, a.max() - a.min()) * 255
    Image.fromarray(a.astype('uint8')).save(f'{sys.argv[1]}_{i}.png')
