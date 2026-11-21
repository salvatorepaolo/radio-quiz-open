# uso: ~/.radioquiz-ia/venv/bin/python strumenti/anonimato_ocr.py casi [caso-NNN ...]   (risultato in ocr.json)
# Testo impresso nei pixel: OCR open source Tesseract (Apache-2.0; brew install tesseract) su un campione di immagini
# di ogni serie, con i modelli italiano e inglese (tessdata_fast) in ~/.radioquiz-ia/tessdata.
# Stampa solo una forma mascherata delle scritte sospette (nessun nome in chiaro nei log).
import os, re, sys, json, shutil, tempfile, subprocess, collections
import numpy as np, pydicom
from PIL import Image, ImageOps
BASE = sys.argv[1]; SOLO = sys.argv[2:] if len(sys.argv) > 2 else None
PROIEZ = {'CR','DX','MG','US','PX','XA','RF','OT','SC','IO','ES','XC','DOC'}
# scritte normali sulle immagini: lateralità, proiezioni, unità, marcatori
BENIGNE = re.compile(r"^(?:[LRDSXAPHFI]{1,3}|DX|SX|PA|AP|LL|LAT|MLO|CC|RCC|LCC|RMLO|LMLO|CM|MM|KV|MAS|HU|SUP|INF|ANT|POST|TRASV|LONG|SAG|COR|AX|DIST|PROX|\d+(?:[.,]\d+)?\s*(?:CM|MM|%|DB|HZ|MHZ|S|MS|KV|MAS)?)$", re.I)
SOSP = re.compile(r"ospedal|presidio|policlinic|azienda|\basp\b|\baou?\b|\basl\b|irccs|clinica|casa di cura|dott|dr\.|prof\.|cannizzaro|garibaldi|via |viale|piazza|tel|@|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]|\d{6,}|\bnato|\bnata|\bpaz|anni\b|sesso|\bid\b|esame|referto|radiolog|tecnico|tsrm", re.I)
def maschera(t): return re.sub(r'[A-Za-zÀ-ÿ]', 'a', re.sub(r'\d', '9', t))
TESS = shutil.which('tesseract') or '/opt/homebrew/bin/tesseract'
DATI = os.path.expanduser('~/.radioquiz-ia/tessdata')
LINGUE = 'ita+eng' if os.path.exists(os.path.join(DATI, 'ita.traineddata')) else 'eng'
def ocr(png):
    """righe di testo trovate da Tesseract, con la confidenza media delle parole (0-1). --psm 11: testo sparso, come le
    scritte impresse ai bordi delle immagini"""
    env = dict(os.environ, **({'TESSDATA_PREFIX': DATI} if os.path.isdir(DATI) else {}))
    base = os.path.splitext(png)[0] + '_ocr'
    subprocess.run([TESS, png, base, '-l', LINGUE, '--psm', '11', '-c', 'tessedit_create_tsv=1', '-c', 'tessedit_create_txt=0'], capture_output=True, env=env, timeout=120, check=True)
    testo = open(base + '.tsv', encoding='utf-8', errors='replace').read(); os.remove(base + '.tsv')
    righe = collections.OrderedDict()
    for l in testo.splitlines()[1:]:
        c = l.split('\t')
        if len(c) < 12 or not c[11].strip(): continue
        try: conf = float(c[10])
        except ValueError: continue
        if conf < 0: continue
        righe.setdefault((c[2], c[3], c[4]), []).append((c[11].strip(), conf / 100))
    return [(' '.join(w for w, _ in p), sum(k for _, k in p) / len(p)) for p in righe.values()]
def immagine(d):
    a = d.pixel_array
    if a.ndim == 4: a = a[0]
    if a.ndim == 3 and a.shape[-1] in (3, 4): a = a[..., :3].mean(-1)
    elif a.ndim == 3: a = a[a.shape[0] // 2]
    a = a.astype(np.float32)
    if str(d.get('PhotometricInterpretation', '')) == 'MONOCHROME1': a = a.max() - a
    lo, hi = np.percentile(a, 1), np.percentile(a, 99.7)
    if hi <= lo: hi = a.max(); lo = a.min()
    b = np.clip((a - lo) / max(hi - lo, 1e-6) * 255, 0, 255).astype(np.uint8)
    im = Image.fromarray(b)
    if max(im.size) < 1200: im = im.resize((im.size[0] * 2, im.size[1] * 2))
    return im
# cartella temporanea nella home: lanciato da Python, Tesseract non riesce a leggere i file in /tmp su questo Mac
ris = collections.defaultdict(list); conti = collections.Counter(); tmp = tempfile.mkdtemp(dir=os.makedirs(os.path.expanduser('~/.radioquiz-ia'), exist_ok=True) or os.path.expanduser('~/.radioquiz-ia'))
for caso in sorted(os.listdir(BASE)):
    if SOLO and caso not in SOLO: continue
    cd = os.path.join(BASE, caso)
    try: serie = json.load(open(os.path.join(cd, 'serie.json')))
    except Exception: continue
    for i, s in enumerate(serie):
        fs = s.get('files', [])
        if not fs: continue
        if s.get('tipo') == 'vetrino': continue   # vetrino digitale: solo tessuto (etichetta e panoramica scartate da anonimizza_vetrino.py)
        try: d0 = pydicom.dcmread(os.path.join(cd, fs[0]), stop_before_pixels=True)
        except Exception: continue
        mod = str(d0.get('Modality', '')); it = ' '.join(map(str, d0.get('ImageType') or [])).upper()
        tutte = mod in PROIEZ or 'SECONDARY' in it or str(d0.get('SOPClassUID', '')).startswith('1.2.840.10008.5.1.4.1.1.7')
        if tutte: scelti = fs if len(fs) <= 12 else [fs[k * (len(fs) - 1) // 11] for k in range(12)]
        else: scelti = sorted({fs[0], fs[len(fs) // 2], fs[-1]})
        for f in scelti:
            try:
                d = pydicom.dcmread(os.path.join(cd, f)); im = immagine(d)
                # Tesseract (Leptonica di Homebrew) legge male i PNG: si usa il TIFF. Due passaggi: immagine e negativo,
                # perché il testo impresso può essere chiaro su scuro o scuro su chiaro
                testi = []
                for k, x in enumerate((im, ImageOps.invert(im.convert('L')))):
                    p = os.path.join(tmp, f'x{k}.tif'); x.save(p); testi += ocr(p)
                conti['immagini'] += 1
            except Exception as e:
                conti['errori lettura'] += 1; continue
            visti = set()
            for t, c in testi:
                if t.strip().lower() in visti: continue
                visti.add(t.strip().lower())
                t2 = t.strip()
                if c < 0.5 or len(t2) < 3 or BENIGNE.match(t2): continue
                lettere = sum(ch.isalpha() for ch in t2)
                sosp = bool(SOSP.search(t2)) or bool(re.search(r"[A-ZÀ-Ý][a-zà-ÿ]{2,}\s+[A-ZÀ-Ý][a-zà-ÿ]{2,}|[A-Z]{3,}\s+[A-Z]{3,}", t2))
                ris[caso].append({'serie': i, 'file': f, 'mod': mod, 'sospetto': sosp, 'forma': maschera(t2), 'lettere': lettere, 'conf': round(c, 2)})
    print(caso, conti['immagini'], len(ris[caso]), flush=True)
json.dump({'conti': conti, 'testi': ris}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ocr.json'), 'w'), indent=1)
shutil.rmtree(tmp, ignore_errors=True)
print('FINE', dict(conti))
