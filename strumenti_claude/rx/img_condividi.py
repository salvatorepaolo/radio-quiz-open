# img_condividi.py: immagini 480×480 (fondo nero) per l'anteprima dei link dei casi sui social (web/img/condividi/<id>.jpg).
# I casi con l'immagine del «caso della settimana» la riusano; gli altri dalla prima immagine DICOM della serie indicata.
import sys, json, shutil, os, numpy as np, pydicom
from PIL import Image
B = '/Volumes/Caloggero/piattaforma-quiz/'; OUT = B + 'cloud/web/img/condividi/'
def da_dicom(id, serie=0, out=None):
    s = json.load(open(f'{B}casi-free/{id}/serie.json'))[serie]
    ds = pydicom.dcmread(f'{B}casi-free/{id}/{s["files"][0]}'); a = ds.pixel_array.astype(np.float32)
    if a.ndim == 3 and a.shape[-1] != 3: a = a[0]
    lo, hi = np.percentile(a, 0.5), np.percentile(a, 99.5); a = np.clip((a - lo) / (hi - lo) * 255, 0, 255)
    if ds.get('PhotometricInterpretation') == 'MONOCHROME1': a = 255 - a
    im = Image.fromarray(a.astype(np.uint8)); im.thumbnail((480, 480), Image.LANCZOS)
    q = Image.new('L', (480, 480), 0); q.paste(im, ((480 - im.width) // 2, (480 - im.height) // 2)); q.convert('RGB').save(out or OUT + id + '.jpg', quality=85)
for a in sys.argv[1:]:
    id, _, serie = a.partition(':')
    sett = B + f'cloud/web/img/settimana/{id}.jpg'
    if not serie and os.path.exists(sett): shutil.copyfile(sett, OUT + id + '.jpg')
    else: da_dicom(id, int(serie or 0))
    print(id, 'ok')
