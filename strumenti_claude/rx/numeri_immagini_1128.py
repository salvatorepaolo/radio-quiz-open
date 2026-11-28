"""Testi pubblici dei casi: numeri di immagine come li mostra il visualizzatore (da 1) e serie indicate per nome.
Nei testi scritti da Claude le immagini erano contate da 0 (come la «vista»), ma il visualizzatore mostra «Img N / tot»
da 1 e le serie per descrizione, senza numero. Uso: python numeri_immagini_1128.py [--scrivi]
"""
import json, os, re, sys
BASE = '/Volumes/Caloggero/piattaforma-quiz'
CASI, LINGUA = BASE + '/casi-free', BASE + '/cloud/web/lingua/casi'
SCRIVI = '--scrivi' in sys.argv
GIA_DA_1 = {'090', '091', '092', '110', '111', '112'}          # immagini già contate come il visualizzatore
SALTA = {'071'}                                         # «immagine 4 camere»: nessun indice
FETTA_E_SERIE = {'108', '109', '148', '149', '150'}    # «fetta N» = nome della serie (T2*), non indice
SERIE_DA_1 = {'079', '080', '081', '082', '083', '084', '085', '086', '087', '088', '089', '128'}
ITEM = r'~?\d+(?:\s*[-–]\s*~?\d+)?(?:\s*\([^()]*\))?'
NUM = ITEM + r'(?:\s*(?:,|\be\b|\bed\b|\band\b)\s*' + ITEM + r')*'
QUAL = r'(?:(?:circa|about|approximately|approx\.|assiali|coronali|centrali|axial|coronal|central)\s+)?'

def piu1(m):
    # +1 ai numeri fuori dalle parentesi (dentro ci sono tempi, SUV, misure)
    # (dentro le parentesi solo i numeri preceduti da «immagine»)
    return re.sub(r'\([^()]*\)|\d+', lambda x: re.sub(r'(\b(?:immagin[ei]|images?|img)\s*~?)(\d+)', lambda y: y.group(1) + str(int(y.group(2)) + 1), x.group(0), flags=re.I) if x.group(0).startswith('(') else str(int(x.group(0)) + 1), m)

def trasforma(t, S, n, en, nomi_en):
    if not t:
        return t
    base_s = 1 if n in SERIE_DA_1 else 0
    def serie(m):
        k = int(m.group(2)) - base_s
        if not 0 <= k < len(S):
            return m.group(0)
        d = S[k]['descrizione']
        if len(d) > 45:
            LUNGHE.append((n, d))
        if en:
            d = nomi_en.get(d, d)
        return f'{m.group(1)} «{d}»'
    # le serie si correggono a mano (CORREZIONI): il nome da solo non basta a rendere la frase
    if n in SALTA:
        return t
    if n in GIA_DA_1:
        return t
    parole = r'images?|img|slices?' if en else r'immagin[ei]|img|fett[ae]|immagine'
    if n in FETTA_E_SERIE:
        parole = r'images?|img' if en else r'immagin[ei]|img'
    t = re.sub(r"(\b(?:%s)\b\s*%s)(%s)" % (parole, QUAL, NUM), lambda m: m.group(1) + piu1(m.group(2)), t, flags=re.I)
    t = re.sub(r'(\bmeglio la |\bmeglio le |\bvista a |\bview at |\bbest (?:seen )?(?:on |at )?)(' + NUM + ')', lambda m: m.group(1) + piu1(m.group(2)), t)
    return t

from correzioni_serie_1128 import C as CORR
USATE = set()
def correggi(t, n, en):
    for i, (k, lg, a, b) in enumerate(CORR):
        if k == n and lg.startswith('en' if en else 'it') and a in t:
            t = t.replace(a, b) if lg.endswith('*') else t.replace(a, b, 1)
            USATE.add(i)
    return t
tot = 0
LUNGHE = []
for c in sorted(x for x in os.listdir(CASI) if x.startswith('caso-')):
    n = c[-3:]
    fc = f'{CASI}/{c}/caso.json'
    d = json.load(open(fc)); S = json.load(open(f'{CASI}/{c}/serie.json'))
    fl = f'{LINGUA}/{c}.json'
    L = json.load(open(fl)) if os.path.exists(fl) else {}
    nomi_en = {s['descrizione']: L[s['descrizione']] for s in S if s['descrizione'] in L}
    cambi = []
    def campo(ogg, k):
        v = ogg.get(k)
        if not isinstance(v, str) or not v:
            return
        nv = correggi(trasforma(v, S, n, False, nomi_en), n, False)
        if nv != v:
            cambi.append((v, nv)); ogg[k] = nv
    for k in ('anamnesi', 'domanda', 'spiegazione', 'regola'):
        campo(d, k)
    for o in d.get('opzioni', []):
        campo(o, 'testo'); campo(o, 'nota')
    if isinstance(d.get('vista'), dict):
        campo(d['vista'], 'nota')
    if not cambi:
        continue
    print(f'=== {c}')
    for v, nv in cambi:
        tot += 1
        en = L.pop(v, None)
        if en is None:
            print('   !! traduzione mancante per:', v[:80])
        else:
            nen = correggi(trasforma(en, S, n, True, nomi_en), n, True)
            L[nv] = nen
            if nen == en:
                print('   !! inglese invariato:', en[:120])
            from collections import Counter
            num = lambda x: Counter(re.findall(r'\d+', x))
            if (num(nv) - num(v)) != (num(nen) - num(en)):
                print('   !! numeri diversi tra italiano e inglese:', dict(num(nv) - num(v)), dict(num(nen) - num(en)))
        a = [x for x in re.split(r'(?<=[.;:¦])\s', v)]; b = [x for x in re.split(r'(?<=[.;:¦])\s', nv)]
        for x, y in zip(a, b):
            if x != y:
                print('   -', x[:230]); print('   +', y[:230])
        if en is not None:
            for x, y in zip(re.split(r'(?<=[.;:])\s', en), re.split(r'(?<=[.;:])\s', L[nv])):
                if x != y:
                    print('   EN+', y[:230])
    if SCRIVI:
        def scrivi(p, dati):
            vecchio = open(p).read()
            if vecchio.startswith('{\n'):
                nuovo = json.dumps(dati, ensure_ascii=False, indent=1)
            elif '", "' in vecchio[:2000]:
                nuovo = json.dumps(dati, ensure_ascii=False)
            else:
                nuovo = json.dumps(dati, ensure_ascii=False, separators=(',', ':'))
            open(p, 'w').write(nuovo + ('\n' if vecchio.endswith('\n') else ''))
        scrivi(fc, d)
        scrivi(fl, L)
print(tot, 'testi cambiati')
for i, x in enumerate(CORR):
    if i not in USATE and not x[1].endswith('?'):
        print('correzione non usata:', x)
for x in sorted(set(LUNGHE)): print('serie con nome lungo', x)
