"""crea_galleria.py: immagini della galleria della pagina iniziale (una per metodica) dai casi pubblici anonimi.
Per ogni caso indicato: serie e immagine scelte, finestra dall'intestazione (o percentili), ritaglio quadrato, 480 px,
WebP e JPEG. Uso: python crea_galleria.py <cartella casi> <uscita> caso:serie:immagine:etichetta ...
(serie e immagine: indici; immagine -1 = metà della serie)"""
import sys, os, json, numpy as np, pydicom
from PIL import Image
casi, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
for voce in sys.argv[3:]:
    caso, si, ii, nome = voce.split(':', 3)
    s = json.load(open(os.path.join(casi, caso, 'serie.json')))[int(si)]
    files = s['files']; f = files[len(files) // 2 if int(ii) < 0 else int(ii)]
    d = pydicom.dcmread(os.path.join(casi, caso, f)); a = d.pixel_array.astype(np.float32)
    if a.ndim == 4 or (a.ndim == 3 and a.shape[-1] != 3): a = a[a.shape[0] // 2]
    if a.ndim == 2:
        a = a * float(getattr(d, 'RescaleSlope', 1) or 1) + float(getattr(d, 'RescaleIntercept', 0) or 0)
        wc, ww = getattr(d, 'WindowCenter', None), getattr(d, 'WindowWidth', None)
        if wc is not None and ww is not None:
            wc = float(wc[0] if isinstance(wc, pydicom.multival.MultiValue) else wc); ww = float(ww[0] if isinstance(ww, pydicom.multival.MultiValue) else ww)
            lo, hi = wc - ww / 2, wc + ww / 2
        else: lo, hi = np.percentile(a, [1, 99.5])
        a = np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1) * 255
        if getattr(d, 'PhotometricInterpretation', '') == 'MONOCHROME1': a = 255 - a
        im = Image.fromarray(a.astype(np.uint8)).convert('RGB')
    else: im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    w, h = im.size; q = min(w, h); im = im.crop(((w - q) // 2, (h - q) // 2, (w - q) // 2 + q, (h - q) // 2 + q)).resize((480, 480), Image.LANCZOS)
    im.save(os.path.join(out, nome + '.webp'), quality=82); im.save(os.path.join(out, nome + '.jpg'), quality=84)
    print(nome, caso, f, d.Modality, w, 'x', h)
