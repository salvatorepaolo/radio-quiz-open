"""meta_serie.py: per ogni caso scrive serie-meta.json, le informazioni delle intestazioni DICOM che il visualizzatore
usa all'apertura del caso: modalità, frame of reference, piano e posizione. Così il browser non deve scaricare immagini
intere solo per leggerne l'intestazione (online le immagini sono compresse con brotli e non si possono leggere a pezzi).
Voci: la prima immagine di ogni serie e tutte le immagini delle serie da 2 a 60 immagini (quelle che il visualizzatore
divide per piano). Formato: { "v": 1, "f": { "<percorso>": [modalità, frame of reference, piano, posizione] } }.
Si rifà solo se serie.json o la cartella delle serie sono più recenti del file.
Uso: python meta_serie.py <cartella dei casi> [--tutti]"""
import json, os, sys
import pydicom

PIANI = ['sagittale', 'coronale', 'assiale']

def voce(path):
    d = pydicom.dcmread(path, stop_before_pixels=True, specific_tags=['Modality', 'FrameOfReferenceUID', 'ImageOrientationPatient', 'ImagePositionPatient'])
    mod = str(getattr(d, 'Modality', '') or '').strip(); fr = str(getattr(d, 'FrameOfReferenceUID', '') or '')
    iop = getattr(d, 'ImageOrientationPatient', None); ipp = getattr(d, 'ImagePositionPatient', None)
    piano, ordine = None, None
    if iop is not None and len(iop) == 6:
        r, c = [float(x) for x in iop[:3]], [float(x) for x in iop[3:]]
        n = [r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0]]
        k = max(range(3), key=lambda i: abs(n[i]))
        piano = 'obliqua' if abs(n[k]) < 0.9 else PIANI[k]
        if ipp is not None and len(ipp) == 3: ordine = round(sum(float(ipp[i]) * n[i] for i in range(3)), 3)
    return [mod, fr, piano, ordine]

def caso(dir_caso, tutti):
    sj, out = os.path.join(dir_caso, 'serie.json'), os.path.join(dir_caso, 'serie-meta.json')
    if not os.path.exists(sj): return None
    if not tutti and os.path.exists(out):
        t = os.path.getmtime(out)
        if os.path.getmtime(sj) <= t and os.path.getmtime(os.path.join(dir_caso, 'serie')) <= t: return False
    f = {}
    for s in json.load(open(sj, encoding='utf-8')):
        if s.get('tipo') == 'vetrino' or not s.get('files'): continue
        files = s['files'] if 2 <= len(s['files']) <= 60 else s['files'][:1]
        for x in files:
            p = os.path.join(dir_caso, x)
            if not os.path.exists(p): continue
            try: f[x] = voce(p)
            except Exception as e: print(f'  {os.path.basename(dir_caso)}/{x}: {e}')
    json.dump({'v': 1, 'f': f}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return len(f)

if __name__ == '__main__':
    base, tutti, fatti, voci = sys.argv[1], '--tutti' in sys.argv, 0, 0
    for c in sorted(os.listdir(base)):
        d = os.path.join(base, c)
        if not os.path.isdir(d) or c.startswith(('.', '_')): continue
        n = caso(d, tutti)
        if n: fatti += 1; voci += n
    print(f'serie-meta.json: {fatti} casi aggiornati, {voci} immagini descritte')
