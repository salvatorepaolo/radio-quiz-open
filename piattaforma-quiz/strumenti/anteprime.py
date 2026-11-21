"""Anteprime a bassa risoluzione delle serie lunghe (TC, RM) e delle immagini pesanti (RX, mammografie): un file per serie con tutte le fette ridotte (media a blocchi),
così il visualizzatore mostra subito ogni fetta mentre scarica quelle complete.

uso: ~/.radioquiz-ia/venv/bin/python strumenti/anteprime.py [caso-tcia-001 …] [--tutti] [--min 80] [--rifai]

Scrive <cartella della serie>/anteprima.rqa.gz e aggiunge a serie.json il campo "anteprima" (percorso) della serie.
Formato (gzip): 'RQA1', uint32 LE lunghezza JSON, JSON {n, w, h, f, cols, rows, ipp: [[x, y, z]…]}, poi n*w*h int16 LE
(valori già con slope e intercept: HU per la TC). Nessun dato del paziente: solo numeri e posizioni.
"""
import argparse, gzip, json, os, struct, sys
import numpy as np, pydicom
CASI = os.environ.get('RQ_CASI', '/Volumes/Caloggero/piattaforma-quiz/casi-free')

def anteprima(caso, s, rifai=False):
    files = s.get('files') or []
    cart = os.path.dirname(files[0]); dest = os.path.join(CASI, caso, cart, 'anteprima.rqa.gz'); rel = os.path.join(cart, 'anteprima.rqa.gz')
    if os.path.exists(dest) and not rifai: return rel, 'già fatta'
    fette, ipp, dim, fin = [], [], None, None
    for f in files:
        d = pydicom.dcmread(os.path.join(CASI, caso, f))
        if int(getattr(d, 'NumberOfFrames', 1) or 1) > 1 or getattr(d, 'SamplesPerPixel', 1) != 1: return None, 'multiframe o a colori'
        a = d.pixel_array.astype(np.float32) * float(getattr(d, 'RescaleSlope', 1) or 1) + float(getattr(d, 'RescaleIntercept', 0) or 0)
        if dim is None:
            dim = a.shape
            wc, ww = getattr(d, 'WindowCenter', None), getattr(d, 'WindowWidth', None)
            prima = lambda v: float(v[0] if isinstance(v, pydicom.multival.MultiValue) else v) if v is not None else None
            fin = {'wc': prima(wc), 'ww': prima(ww), 'sp': [float(x) for x in getattr(d, 'PixelSpacing', None) or getattr(d, 'ImagerPixelSpacing', None) or [1, 1]],
                   'mono1': getattr(d, 'PhotometricInterpretation', '') == 'MONOCHROME1'}
        if a.shape != dim: return None, 'fette di dimensioni diverse'
        fette.append(a); ipp.append([round(float(x), 3) for x in getattr(d, 'ImagePositionPatient', [0, 0, 0])])
    rows, cols = dim; n = len(fette)
    f = 4 if n <= 150 else 8
    if cols < 256: f = max(2, f // 2)
    f = max(f, -(-max(rows, cols) // 256))   # immagini grandi (RX, mammografie): al massimo 256 pixel per lato
    h, w = -(-rows // f), -(-cols // f)
    out = np.zeros((n, h, w), np.int16)
    for i, a in enumerate(fette):
        p = np.zeros((h * f, w * f), np.float32); p[:rows, :cols] = a
        m = np.zeros((h * f, w * f), np.float32); m[:rows, :cols] = 1
        s_ = p.reshape(h, f, w, f).sum((1, 3)); c_ = m.reshape(h, f, w, f).sum((1, 3))
        out[i] = np.clip(np.round(s_ / np.maximum(c_, 1)), -32768, 32767).astype(np.int16)
    testa = json.dumps({'n': n, 'w': w, 'h': h, 'f': f, 'cols': cols, 'rows': rows, 'ipp': ipp, **fin}, separators=(',', ':')).encode()
    with gzip.open(dest, 'wb', compresslevel=6) as g:
        g.write(b'RQA1'); g.write(struct.pack('<I', len(testa))); g.write(testa); g.write(out.astype('<i2').tobytes())
    return rel, f'{n} fette, {w}x{h}, {os.path.getsize(dest) / 1e6:.1f} MB'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('casi', nargs='*'); ap.add_argument('--tutti', action='store_true'); ap.add_argument('--min', type=int, default=80); ap.add_argument('--rifai', action='store_true')
    a = ap.parse_args()
    casi = sorted(d for d in os.listdir(CASI) if d.startswith('caso-')) if a.tutti else a.casi
    for c in casi:
        p = os.path.join(CASI, c, 'serie.json')
        if not os.path.exists(p): continue
        sj = json.load(open(p)); lista = sj if isinstance(sj, list) else sj.get('serie', [])
        cambiato = False
        for i, s in enumerate(lista):
            fl = s.get('files') or []
            grande = bool(fl) and os.path.getsize(os.path.join(CASI, c, fl[0])) > 2_000_000   # RX e mammografie: file pesanti
            if len(fl) < a.min and not grande: continue
            try: rel, msg = anteprima(c, s, a.rifai)
            except Exception as e: rel, msg = None, f'errore: {e}'
            print(f'{c} serie {i} ({s.get("descrizione", "")[:40]}): {msg}', flush=True)
            if rel and s.get('anteprima') != rel: s['anteprima'] = rel; cambiato = True
        if cambiato:
            json.dump(sj, open(p, 'w'), ensure_ascii=False, indent=1)   # serie.json e le anteprime si caricano con la pubblicazione (aws s3 sync)

if __name__ == '__main__':
    main()
