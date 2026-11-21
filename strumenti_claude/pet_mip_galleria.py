import json, os, numpy as np, pydicom
from PIL import Image
import sys; c = '/Volumes/Caloggero/piattaforma-quiz/casi-free/' + sys.argv[1]; s = [x for x in json.load(open(c + '/serie.json')) if 'PET' in x.get('descrizione', '')][0]
fe = []
for f in s['files']:
    d = pydicom.dcmread(os.path.join(c, f)); a = d.pixel_array.astype(np.float32) * float(d.RescaleSlope or 1) + float(d.RescaleIntercept or 0)
    fe.append((float(d.ImagePositionPatient[2]), a, [float(x) for x in d.PixelSpacing], float(d.SliceThickness or 0)))
fe.sort(key=lambda x: -x[0]); vol = np.stack([x[1] for x in fe]); ps = fe[0][2]; dz = abs(fe[0][0] - fe[1][0])
mip = vol.max(axis=1)   # coronale: z × x
hi = np.percentile(mip, 99.6); im = 255 - np.clip(mip / hi, 0, 1) * 255
img = Image.fromarray(im.astype(np.uint8)).resize((mip.shape[1], int(mip.shape[0] * dz / ps[0])), Image.LANCZOS).convert('RGB')
w, h = img.size; q = min(w, h); top = int(h * 0.05); img = img.crop(((w - q) // 2, top, (w - q) // 2 + q, top + q)).resize((480, 480), Image.LANCZOS)
out = '/Volumes/Caloggero/strumenti_claude/tmp_img/gal'; img.save(out + '/pet.webp', quality=82); img.save(out + '/pet.jpg', quality=84); print('pet', vol.shape, dz, ps)
