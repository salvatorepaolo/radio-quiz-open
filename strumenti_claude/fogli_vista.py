#!/usr/bin/env python3
"""Fogli di miniature: l'immagine «vista» (chiave) di ogni caso con finestra e nota, per il controllo da medico.
Uscita: /Volumes/Caloggero/_viste/revisione/vista_NN.jpg (12 casi per foglio, 3×4)."""
import json, glob, os, sys, textwrap, traceback
import numpy as np, pydicom
from PIL import Image, ImageDraw, ImageFont
BASE = '/Volumes/Caloggero/piattaforma-quiz/casi-free'; OUT = '/Volumes/Caloggero/_viste/revisione'
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15); F2 = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
except Exception: F = F2 = ImageFont.load_default()
S = 420
def file_serie(cart, s):
    sj = json.load(open(os.path.join(cart, 'serie.json')))
    lst = sj if isinstance(sj, list) else sj.get('serie', sj)
    voce = lst[s] if isinstance(lst, list) and s < len(lst) else None
    files = None
    if isinstance(voce, dict):
        for k in ('file', 'files', 'immagini', 'fette'):
            if k in voce: files = voce[k]; break
        cartella = voce.get('cartella') or voce.get('dir') or voce.get('id')
    else: cartella = None
    if files:
        return [os.path.join(cart, 'serie', f) if not os.path.isabs(f) and not f.startswith('serie') else os.path.join(cart, f) for f in files], voce
    cand = sorted(glob.glob(os.path.join(cart, 'serie', str(cartella if cartella is not None else s), '*')))
    if not cand: cand = sorted(glob.glob(os.path.join(cart, 'serie', '*', '*')))
    return cand, voce
def rende(cid):
    cart = os.path.join(BASE, cid); d = json.load(open(os.path.join(cart, 'caso.json')))
    v = d.get('vista') or {}; s = v.get('serie', d.get('serie_iniziale', 0) or 0); idx = v.get('idx', 0)
    files, voce = file_serie(cart, s)
    files = [f for f in files if os.path.isfile(f)]
    if not files: raise RuntimeError('nessun file')
    ds = None
    if len(files) == 1:
        ds = pydicom.dcmread(files[0]); arr = ds.pixel_array
        if arr.ndim >= 3 and getattr(ds, 'NumberOfFrames', 1) > 1: arr = arr[min(idx, arr.shape[0] - 1)]
    else:
        ds = pydicom.dcmread(files[min(idx, len(files) - 1)]); arr = ds.pixel_array
        if arr.ndim == 3 and getattr(ds, 'NumberOfFrames', 1) > 1: arr = arr[0]
    if arr.ndim == 3 and arr.shape[-1] == 3: im = Image.fromarray(arr.astype(np.uint8))
    else:
        a = arr.astype(np.float32) * float(getattr(ds, 'RescaleSlope', 1) or 1) + float(getattr(ds, 'RescaleIntercept', 0) or 0)
        wc, ww = v.get('wc'), v.get('ww')
        if wc is None:
            try: wc = float(np.atleast_1d(ds.WindowCenter)[0]); ww = float(np.atleast_1d(ds.WindowWidth)[0])
            except Exception: lo, hi = np.percentile(a, [1, 99]); wc, ww = (lo + hi) / 2, max(1, hi - lo)
        a = np.clip((a - (wc - ww / 2)) / ww, 0, 1) * 255
        if str(getattr(ds, 'PhotometricInterpretation', '')) == 'MONOCHROME1': a = 255 - a
        im = Image.fromarray(a.astype(np.uint8)).convert('RGB')
    im.thumbnail((S, S - 70))
    return im, d, v, len(files)
casi = sorted(os.path.basename(p) for p in glob.glob(BASE + '/caso-*'))
tiles = []
import time
for cid in casi:
    t0=time.time(); print(cid, flush=True)
    t = Image.new('RGB', (S, S), (20, 20, 24)); dr = ImageDraw.Draw(t)
    try:
        if json.load(open(os.path.join(BASE, cid, 'caso.json'))).get('modalita') == 'Vetrini': raise RuntimeError('vetrino: non mostrato')
        im, d, v, n = rende(cid); t.paste(im, ((S - im.width) // 2, 0))
        dr.text((4, S - 68), f"{cid[5:]} · {d.get('modalita')} · img {v.get('idx', 0)}/{n}", fill=(255, 220, 90), font=F)
        nota = v.get('nota') or d.get('titolo_interno') or ''
        for i, r in enumerate(textwrap.wrap(nota, 58)[:3]): dr.text((4, S - 50 + i * 15), r, fill=(230, 230, 230), font=F2)
    except Exception as e:
        dr.text((4, S // 2), f"{cid}: {str(e)[:50]}", fill=(255, 80, 80), font=F)
    tiles.append(t)
for k in range(0, len(tiles), 12):
    foglio = Image.new('RGB', (S * 4, S * 3), (0, 0, 0))
    for i, t in enumerate(tiles[k:k + 12]): foglio.paste(t, ((i % 4) * S, (i // 4) * S))
    foglio.save(f"{OUT}/vista_{k // 12:02d}.jpg", quality=82)
print(len(tiles), 'casi', (len(tiles) + 11) // 12, 'fogli')
