"""prepara_vetrino.py: vetrino in un formato del produttore → caso della piattaforma, senza dati del paziente.
Formati: Aperio SVS, TIFF piramidali/OME-TIFF, Hamamatsu NDPI, Philips TIFF, Leica SCN, Ventana BIF, 3DHISTECH MRXS,
Zeiss CZI, Philips iSyntax, Olympus VSI. (I DICOM passano da anonimizza_vetrino.py.)

Cosa fa, su una copia nella cartella serie/vetrino_N del caso (i file si chiamano «vetrino.*», nessun nome originale):
1. CONTROLLO dell'originale: legge etichetta e panoramica e cerca codici a barre/QR (zxing-cpp) e testo (OCR Tesseract);
   cerca nei metadati date, codici fiscali, email, codici a barre, nomi utente. Stampa solo forme mascherate.
2. TOGLIE etichetta e panoramica (e miniature): i loro byte diventano zeri, così le posizioni nel file non cambiano.
   Sulla piattaforma il visualizzatore non mostra mai etichetta e panoramica; nel client (esami propri) restano.
3. RIPULISCE i metadati di testo (data e ora di scansione, utente, nome del file, codice a barre, numero di serie dello
   scanner, campi DICOM del paziente nelle intestazioni XML): stesse lunghezze, valori sostituiti.
4. VERIFICA la copia (la stessa funzione che usa controlla.py a ogni pubblicazione): se resta qualcosa, si ferma.
5. Aggiunge in serie.json la voce {tipo: 'vetrino', files, dimensioni, descrizione} in fondo all'elenco.
Uso:  python prepara_vetrino.py <file del vetrino (.mrxs/.vsi: il file principale)> <cartella del caso> "<descrizione>"
      python prepara_vetrino.py --controlla <file o cartella serie/vetrino_N>     (solo controllo)
Dipendenze per il controllo dell'originale (facoltative): tifffile, imagecodecs, zxing-cpp, Pillow, tesseract.
"""
import os, re, sys, json, struct, shutil, base64, subprocess, tempfile, glob

# ------------------------------------------------------------------------------------------------ testo: ricerca e pulizia
DATA = re.compile(rb'\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/.]\d{2}[-/.]\d{2}(?:[T ]\d{2}:\d{2})?')
CF = re.compile(rb'\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b')
EMAIL = re.compile(rb'(?<![\w.+-])[\w.+-]{1,64}@[\w-]{1,63}\.[\w.]{2,63}')   # lunghezze limitate: niente tempi enormi sul base64
# campi da svuotare: chiave = valore (Aperio, NDPI, ini MRXS) e attributi XML (Philips, iSyntax, CZI)
CHIAVI = re.compile(rb'(?i)\b(Date|Time|User|Filename|ScanScope ID|Barcode|Patient[\w ]*|Accession[\w ]*|Operator|Reference|Created|Updated|SLIDE_NAME|PROJECT_NAME|SLIDE_CREATIONDATETIME|Serial\w*)(\s*=\s*)([^|\r\n]*)')
ATTR = re.compile(rb'(<Attribute\s+Name="(?:DICOM_ACQUISITION_DATETIME|DICOM_DEVICE_SERIAL_NUMBER|PIM_DP_UFS_BARCODE|DICOM_PATIENT\w*|DICOM_ACCESSION\w*|DICOM_STUDY_\w*|DICOM_INSTITUTION\w*|DICOM_\w*_DATE\w*|DICOM_\w*_TIME\w*|DICOM_DATE_OF_LAST_CALIBRATION|DICOM_TIME_OF_LAST_CALIBRATION|DICOM_REFERRING\w*|DICOM_OPERATORS\w*|PIM_DP_SCANNER_\w*SERIAL\w*|DICOM_SPECIMEN\w*|DICOM_CONTAINER\w*)"[^>]*>)(.*?)(</Attribute>)', re.S)
IMMAGINI_XML = re.compile(rb'(<Attribute\s+Name="PIM_DP_IMAGE_DATA"[^>]*>)(.*?)(</Attribute>)', re.S)   # etichetta e panoramica in base64
TAG_XML = re.compile(rb'(<(AcquisitionDateAndTime|CreationDate|LastModifiedDate|UserName|DisplayName|FirstName|LastName|MiddleName|Email|Institution|Phone|Fax|Login|BarCode|Barcode|Comment|Description|Title|Name|Id|Ids|Description)\b[^>/]*>)([^<]*)(</\2>)')
BLOCCO_CZI = re.compile(rb'<(User|Document)\b[\s\S]*?</\1>')
def _riempi(m, g, c=b'x'):
    return m.group(0)[:m.start(g) - m.start(0)] + c * (m.end(g) - m.start(g)) + m.group(0)[m.end(g) - m.start(0):]
def pulisci_testo(b: bytes, formato='') -> bytes:
    """stesse lunghezze: si sostituiscono solo i valori"""
    b = CHIAVI.sub(lambda m: _riempi(m, 3), b)
    b = ATTR.sub(lambda m: _riempi(m, 2), b)
    b = IMMAGINI_XML.sub(lambda m: _riempi(m, 2, b'A'), b)
    if formato == 'czi':
        b = BLOCCO_CZI.sub(lambda m: TAG_XML.sub(lambda t: _riempi(t, 3, b' '), m.group(0)), b)
        b = TAG_XML.sub(lambda t: _riempi(t, 3, b' ') if t.group(2) in (b'AcquisitionDateAndTime', b'CreationDate', b'LastModifiedDate', b'UserName', b'BarCode', b'Barcode', b'Email', b'Phone', b'Login') else t.group(0), b)
    b = DATA.sub(lambda m: b'0' * len(m.group(0)), b); b = CF.sub(lambda m: b'X' * len(m.group(0)), b); b = EMAIL.sub(lambda m: b'x' * len(m.group(0)), b)
    return b
def sospetti(b: bytes):
    """cose che non dovrebbero esserci (forma mascherata)"""
    out = []
    for nome, r in (('data', DATA), ('codice fiscale', CF), ('email', EMAIL)):
        for m in r.finditer(b):
            s = m.group(0).decode('latin-1'); out.append(f'{nome}: {s[:2]}…{s[-1:]} ({len(s)} caratteri)')
    for m in CHIAVI.finditer(b):
        v = m.group(3).strip(b' x0X')
        if v: out.append(f'campo «{m.group(1).decode("latin-1")}» con un valore')
    for m in ATTR.finditer(b):
        v = m.group(2).strip(b' x0X"')
        if v: out.append('attributo XML ' + re.search(rb'Name="(\w+)"', m.group(1)).group(1).decode())
    for m in IMMAGINI_XML.finditer(b):
        if m.group(2).strip(b'A \r\n='): out.append('immagine (etichetta o panoramica) nel testo XML')
    return out

# ------------------------------------------------------------------------------------------------ TIFF (anche BigTIFF)
TIPI = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8, 17: 8, 18: 8}
FMT = {3: 'H', 4: 'I', 13: 'I', 16: 'Q', 18: 'Q', 8: 'h', 9: 'i', 17: 'q', 11: 'f', 12: 'd', 1: 'B', 7: 'B', 6: 'b'}
def leggi_tiff(f):
    f.seek(0); h = f.read(16); le = h[:2] == b'II'; e = '<' if le else '>'
    big = struct.unpack(e + 'H', h[2:4])[0] == 43
    off = struct.unpack(e + 'Q', h[8:16])[0] if big else struct.unpack(e + 'I', h[4:8])[0]
    ifd, visti = [], set()
    def un_ifd(off):
        f.seek(off); n = struct.unpack(e + ('Q' if big else 'H'), f.read(8 if big else 2))[0]; eb = 20 if big else 12
        d = f.read(n * eb + (8 if big else 4)); tag = {}
        for i in range(n):
            p = i * eb; t, ty = struct.unpack(e + 'HH', d[p:p + 4]); cnt = struct.unpack(e + ('Q' if big else 'I'), d[p + 4:p + (12 if big else 8)])[0]
            sz = TIPI.get(ty, 1) * cnt; dentro = sz <= (8 if big else 4)
            pos = off + (8 if big else 2) + p + (12 if big else 8) if dentro else struct.unpack(e + ('Q' if big else 'I'), d[p + (12 if big else 8):p + (20 if big else 12)])[0]
            tag[t] = (ty, cnt, pos)
        nx = struct.unpack(e + ('Q' if big else 'I'), d[n * eb:n * eb + (8 if big else 4)])[0]
        return {'off': off, 'tag': tag}, nx
    while off and off not in visti and len(ifd) < 5000:
        visti.add(off); d, off = un_ifd(off); ifd.append(d)
    for d in list(ifd):
        if 330 in d['tag']:
            for o in valori(f, e, d['tag'][330]): s, _ = un_ifd(o); s['sub'] = True; ifd.append(s)
    return ifd, e
def valori(f, e, t):
    ty, cnt, pos = t; f.seek(pos); b = f.read(TIPI.get(ty, 1) * cnt)
    if ty == 2: return b
    if ty in (5, 10): return [a / (c or 1) for a, c in zip(*[iter(struct.unpack(e + ('I' if ty == 5 else 'i') * (2 * cnt), b))] * 2)]
    return list(struct.unpack(e + FMT[ty] * cnt, b))
def uno(f, e, d, t, dflt=0):
    if t not in d['tag']: return dflt
    v = valori(f, e, d['tag'][t]); return v[0] if isinstance(v, list) and v else v
def testo(f, e, d, t):
    return valori(f, e, d['tag'][t]) if t in d['tag'] and d['tag'][t][0] in (1, 2, 7) else b''
def livelli_tiff(f, e, ifd):
    """IFD della piramide principale (come vetrini-formati.js); il resto è etichetta, panoramica, miniature, macro"""
    desc = lambda d: testo(f, e, d, 270)
    ndpi = any(65420 in d['tag'] for d in ifd)
    scn = re.search(rb'<scn\b', desc(ifd[0])) is not None
    if scn:   # Leica SCN: l'immagine di tessuto più grande (non la panoramica della collezione)
        x = desc(ifd[0]); coll = re.search(rb'<collection[^>]*sizeX="(\d+)"', x); blocchi = []
        for b in re.findall(rb'<image\b[\s\S]*?</image>', x):
            v = re.search(rb'<view[^>]*sizeX="(\d+)"', b); px = re.search(rb'<pixels[^>]*sizeX="(\d+)"', b)
            ids = [int(i) for i in re.findall(rb'<dimension\b[^>]*\bifd="(\d+)"', b)]
            blocchi.append((coll and v and v.group(1) == coll.group(1), int(px.group(1)) if px else 0, ids))
        t = [b for b in blocchi if not b[0]] or blocchi
        return {ifd[i]['off'] for i in max(t, key=lambda b: b[1])[2] if i < len(ifd)}
    sl = lambda d: uno(f, e, d, 65421, 0) if ndpi else 0
    etich = lambda d: re.search(rb'(?i)\blabel', desc(d)) or (ndpi and sl(d) in (-1, -2)) or re.search(rb'(?i)macro|overview|slide ?preview|thumbnail', desc(d))
    cand = [d for d in ifd if not etich(d) and uno(f, e, d, 256)]
    if not cand: return set()
    area = lambda d: uno(f, e, d, 256) * uno(f, e, d, 257); base = max(cand, key=area)
    r0 = uno(f, e, base, 256) / max(1, uno(f, e, base, 257)); tass = 322 in base['tag']
    return {d['off'] for d in cand if abs(uno(f, e, d, 256) / max(1, uno(f, e, d, 257)) / r0 - 1) < 0.03 and (not tass or 322 in d['tag'] or ndpi)}
def zona_dati(f, e, d):
    o = d['tag'].get(324) or d['tag'].get(273); c = d['tag'].get(325) or d['tag'].get(279)
    return list(zip(valori(f, e, o), valori(f, e, c))) if o and c else []
def azzera(f, zone):
    for a, n in zone:
        f.seek(a); r = n
        while r > 0: k = min(r, 1 << 20); f.write(b'\0' * k); r -= k
def tutto_zero(f, zone, campione=1 << 16):
    for a, n in zone:
        f.seek(a)
        if f.read(min(n, campione)).strip(b'\0'): return False
    return True
def immagini_tiff_accessorie(path):
    """byte (compressi) di etichetta e panoramica per il controllo dell'originale: (nome, tifffile page) se disponibile"""
    try: import tifffile
    except ImportError: return []
    out = []
    with open(path, 'rb') as f:
        ifd, e = leggi_tiff(f); liv = livelli_tiff(f, e, ifd)
    with tifffile.TiffFile(path) as t:
        for p in t.pages:
            if p.offset not in liv and p.shape and p.shape[0] * p.shape[1] < 64e6:
                try: out.append((f'immagine accessoria {p.index}', p.asarray()))
                except Exception: pass
    return out
def pulisci_tiff(path):
    with open(path, 'r+b') as f:
        ifd, e = leggi_tiff(f); liv = livelli_tiff(f, e, ifd)
        if not liv: raise SystemExit('nessuna piramide riconosciuta nel TIFF')
        for d in ifd:
            if d['off'] not in liv: azzera(f, zona_dati(f, e, d))   # etichetta, panoramica, miniature
            for t, (ty, cnt, pos) in d['tag'].items():
                if ty == 2 or (t == 700 and ty in (1, 7)) or t in (65449, 65468):
                    f.seek(pos); b = f.read(cnt)
                    nb = pulisci_testo(b) if t in (270, 700, 65449) else (b if t in (305,) else b' ' * len(b.rstrip(b'\0')) + b'\0' * (len(b) - len(b.rstrip(b'\0'))))
                    if nb != b: f.seek(pos); f.write(nb)
def controlla_tiff(path):
    prob = []
    with open(path, 'rb') as f:
        ifd, e = leggi_tiff(f); liv = livelli_tiff(f, e, ifd)
        for d in ifd:
            if d['off'] not in liv and not tutto_zero(f, zona_dati(f, e, d)): prob.append(f'IFD {ifd.index(d)} (etichetta/panoramica) non azzerato')
            for t, (ty, cnt, pos) in d['tag'].items():
                if (ty == 2 or t == 700) and t not in (305,):
                    f.seek(pos); prob += [f'tag {t}: {s}' for s in sospetti(f.read(cnt))]
    return prob

# ------------------------------------------------------------------------------------------------ iSyntax: intestazione XML
def fine_xml_isyntax(f):
    f.seek(0); b = f.read(64 << 20); i = b.find(b'\r\n\x04')
    if i < 0: raise SystemExit('iSyntax: intestazione non trovata')
    return b[:i]
def pulisci_isyntax(path):
    with open(path, 'r+b') as f:
        x = fine_xml_isyntax(f); nx = pulisci_testo(x)
        assert len(nx) == len(x); f.seek(0); f.write(nx)
def controlla_isyntax(path):
    with open(path, 'rb') as f: return sospetti(fine_xml_isyntax(f))
def immagini_isyntax(path):
    out = []
    with open(path, 'rb') as f: x = fine_xml_isyntax(f)
    for m in IMMAGINI_XML.finditer(x):
        try: out.append(('immagine nell\'intestazione', base64.b64decode(m.group(2))))
        except Exception: pass
    return out

# ------------------------------------------------------------------------------------------------ CZI
def czi_allegati(f):
    f.seek(32 + 72); ap = struct.unpack('<q', f.read(8))[0]; out = []
    if ap <= 0: return out
    f.seek(ap + 32); n = struct.unpack('<i', f.read(4))[0]; f.seek(ap + 32 + 256)
    for k in range(n):
        e = f.read(128); pos = struct.unpack('<q', e[12:20])[0]; tipo = e[40:48].rstrip(b'\0'); nome = e[48:128].split(b'\0')[0]
        out.append((pos, tipo, nome))
    return out
def czi_meta(f):
    f.seek(32 + 60); mp = struct.unpack('<q', f.read(8))[0]
    if mp <= 0: return None, b''
    f.seek(mp + 32); n = struct.unpack('<i', f.read(4))[0]; f.seek(mp + 32 + 256); return mp + 32 + 256, f.read(n)
def pulisci_czi(path):
    with open(path, 'r+b') as f:
        for pos, tipo, nome in czi_allegati(f):   # etichetta, panoramica, miniatura, misure: tutti gli allegati
            f.seek(pos + 32); n = struct.unpack('<i', f.read(4))[0]; azzera(f, [(pos + 32 + 256, n)])
        p, x = czi_meta(f)
        if p: nx = pulisci_testo(x, 'czi'); assert len(nx) == len(x); f.seek(p); f.write(nx)
def controlla_czi(path):
    prob = []
    with open(path, 'rb') as f:
        for pos, tipo, nome in czi_allegati(f):
            f.seek(pos + 32); n = struct.unpack('<i', f.read(4))[0]
            if not tutto_zero(f, [(pos + 32 + 256, n)]): prob.append(f'allegato «{nome.decode("latin-1")}» non azzerato')
        prob += sospetti(czi_meta(f)[1])
    return prob
def immagini_czi(path):
    out = []
    with open(path, 'rb') as f:
        for pos, tipo, nome in czi_allegati(f):
            if tipo in (b'JPG', b'JPEG'):
                f.seek(pos + 32); n = struct.unpack('<i', f.read(4))[0]; f.seek(pos + 32 + 256); out.append((nome.decode('latin-1'), f.read(n)))
    return out

# ------------------------------------------------------------------------------------------------ MRXS
SEGNAPOSTO = b'radio-quiz: file principale senza immagini (tolte)\n'
def mrxs_parti(mrxs):
    d = os.path.join(os.path.dirname(mrxs), os.path.splitext(os.path.basename(mrxs))[0]); return d
def leggi_ini(p):
    b = open(p, 'rb').read(); t = b.decode('utf-16') if b[:2] in (b'\xff\xfe', b'\xfe\xff') else b.decode('utf-8-sig', 'replace')
    o, s = {}, None
    for r in t.splitlines():
        m = re.match(r'\s*\[(.+)\]\s*$', r)
        if m: s = m.group(1); o.setdefault(s, {}); continue
        if '=' in r and s: k, v = r.split('=', 1); o[s][k.strip()] = v.strip()
    return o
def mrxs_record(cart, nomi=('ScanDataLayer_SlideBarcode', 'ScanDataLayer_SlidePreview', 'ScanDataLayer_SlideThumbnail')):
    I = leggi_ini(os.path.join(cart, 'Slidedat.ini')); H = I['HIERARCHICAL']; G = I['GENERAL']
    d = open(os.path.join(cart, H.get('INDEXFILE', 'Index.dat')), 'rb').read(); lid = len(G.get('SLIDE_ID', ''))
    nr = struct.unpack_from('<i', d, 9 + lid)[0]; out, k = [], 0
    for i in range(int(H.get('NONHIER_COUNT', 0))):
        c = int(H[f'NONHIER_{i}_COUNT'])
        for j in range(c):
            if H.get(f'NONHIER_{i}_VAL_{j}') in nomi:
                p = struct.unpack_from('<i', d, nr + 4 * (k + j))[0]; pg = struct.unpack_from('<i', d, p + 4)[0]
                if pg > 0 and struct.unpack_from('<i', d, pg)[0] > 0:
                    _, _, off, lun, fn = struct.unpack_from('<iiiii', d, pg + 8)
                    out.append((H[f'NONHIER_{i}_VAL_{j}'], os.path.join(cart, I['DATAFILE'][f'FILE_{fn}']), off, lun))
        k += c
    return out
def pulisci_mrxs(mrxs):
    cart = mrxs_parti(mrxs)
    for nome, df, off, lun in mrxs_record(cart):
        with open(df, 'r+b') as f: azzera(f, [(off, lun)])
    open(mrxs, 'wb').write(SEGNAPOSTO)   # il .mrxs è una foto del vetrino (con l'etichetta): resta solo come segnaposto
    ini = os.path.join(cart, 'Slidedat.ini'); b = open(ini, 'rb').read()
    if b[:2] in (b'\xff\xfe', b'\xfe\xff'): t = b.decode('utf-16'); open(ini, 'wb').write(pulisci_testo(t.encode('utf-8')).decode('utf-8').encode('utf-16'))
    else: open(ini, 'wb').write(pulisci_testo(b))
def controlla_mrxs(mrxs):
    cart = mrxs_parti(mrxs); prob = []
    if os.path.getsize(mrxs) > 64: prob.append('il file .mrxs (foto del vetrino) non è stato tolto')
    for nome, df, off, lun in mrxs_record(cart):
        with open(df, 'rb') as f:
            if not tutto_zero(f, [(off, lun)]): prob.append(f'{nome} non azzerato')
    b = open(os.path.join(cart, 'Slidedat.ini'), 'rb').read()
    return prob + sospetti(b.decode('utf-16').encode('utf-8') if b[:2] in (b'\xff\xfe', b'\xfe\xff') else b)
def immagini_mrxs(mrxs):
    out = []
    for nome, df, off, lun in mrxs_record(mrxs_parti(mrxs)):
        with open(df, 'rb') as f: f.seek(off); out.append((nome, f.read(lun)))
    return out

# ------------------------------------------------------------------------------------------------ riconoscimento e controllo
def formato(p):
    x = p.lower()
    if x.endswith('.mrxs'): return 'mrxs'
    if x.endswith('.czi'): return 'czi'
    if x.endswith(('.isyntax', '.i2syntax')): return 'isyntax'
    if x.endswith('.vsi'): return 'vsi'
    with open(p, 'rb') as f: h = f.read(4)
    if h[:2] in (b'II', b'MM'): return 'tiff'
    if h == b'ZISR': return 'czi'
    raise SystemExit(f'formato non riconosciuto: {p}')
def controlla(p):
    """problemi rimasti in un vetrino già preparato (usata anche da controlla.py)"""
    fm = formato(p)
    if fm == 'tiff': return controlla_tiff(p)
    if fm == 'czi': return controlla_czi(p)
    if fm == 'isyntax': return controlla_isyntax(p)
    if fm == 'mrxs': return controlla_mrxs(p)
    if fm == 'vsi': return [] if os.path.getsize(p) <= 64 else ['il file .vsi (miniature e metadati) non è stato tolto']
    return []
def leggi_codici_e_testo(nome, dati):
    """codici a barre/QR e testo in un'immagine (array o JPEG/PNG compressi): risultati mascherati"""
    out = []
    try:
        from PIL import Image; import numpy as np, io
        im = Image.fromarray(dati) if not isinstance(dati, (bytes, bytearray)) else Image.open(io.BytesIO(dati))
        im = im.convert('RGB')
    except Exception: return out
    try:
        import zxingcpp
        for r in zxingcpp.read_barcodes(im): out.append(f'{nome}: codice {r.format.name} «{r.text[:2]}…» ({len(r.text)} caratteri)')
    except ImportError: out.append('(zxing-cpp non installato: codici a barre non cercati)')
    except Exception: pass
    tess = shutil.which('tesseract')
    if tess:
        with tempfile.NamedTemporaryFile(suffix='.png') as t:
            g = im.convert('L'); w, h = g.size; k = max(1, 1600 // max(w, h)); g = g.resize((w * k, h * k)); g.save(t.name)
            td = os.path.expanduser('~/.radioquiz-ia/tessdata'); env = dict(os.environ, **({'TESSDATA_PREFIX': td} if os.path.isdir(td) else {}))
            r = subprocess.run([tess, t.name, '-', '-l', 'ita+eng', '--psm', '11'], capture_output=True, env=env, timeout=120)
            parole = [x for x in re.findall(r'[\wÀ-ÿ/.-]{3,}', r.stdout.decode('utf-8', 'replace')) if re.search(r'[A-Za-z0-9]', x)]
            if parole: out.append(f'{nome}: testo leggibile ({len(parole)} parole, es. «{parole[0][:2]}…»)')
    return out
def controllo_originale(p, fm):
    acc = {'tiff': immagini_tiff_accessorie, 'isyntax': immagini_isyntax, 'czi': immagini_czi, 'mrxs': immagini_mrxs}.get(fm, lambda x: [])(p)
    trovati = [s for n, d in acc for s in leggi_codici_e_testo(n, d)]
    return acc, trovati

def prepara(src, caso, descr):
    src = os.path.abspath(src); fm = formato(src)
    sj = os.path.join(caso, 'serie.json'); serie = json.load(open(sj)) if os.path.exists(sj) else []
    n = 0
    while os.path.exists(os.path.join(caso, 'serie', f'vetrino_{n}')): n += 1
    dst = os.path.join(caso, 'serie', f'vetrino_{n}'); os.makedirs(dst)
    acc, trovati = controllo_originale(src, fm)
    print(f'Originale ({fm}): {len(acc)} immagini accessorie (etichetta/panoramica).' + (' Trovati:' if trovati else ' Nessun codice o testo riconosciuto.'))
    for t in trovati: print('  ·', t)
    files = []
    if fm == 'mrxs':
        cart = mrxs_parti(src); shutil.copyfile(src, os.path.join(dst, 'vetrino.mrxs')); shutil.copytree(cart, os.path.join(dst, 'vetrino'))
        principale = os.path.join(dst, 'vetrino.mrxs'); pulisci_mrxs(principale)
        files = ['vetrino.mrxs'] + [os.path.join('vetrino', x) for x in sorted(os.listdir(os.path.join(dst, 'vetrino')))]
    elif fm == 'vsi':
        nome = os.path.splitext(os.path.basename(src))[0]; ets = sorted(glob.glob(os.path.join(os.path.dirname(src), f'_{nome}_', '**', '*.ets'), recursive=True), key=os.path.getsize)
        if not ets: raise SystemExit('VSI: file .ets non trovati')
        principale = os.path.join(dst, 'vetrino.vsi'); open(principale, 'wb').write(SEGNAPOSTO)
        rel = os.path.join('vetrino_ets', 'stack1', 'frame_t.ets')   # niente «_» iniziale: il sito non pubblica le cartelle che cominciano così; os.makedirs(os.path.dirname(os.path.join(dst, rel))); shutil.copyfile(ets[-1], os.path.join(dst, rel))
        files = ['vetrino.vsi', rel]
    else:
        est = {'tiff': os.path.splitext(src)[1].lower() or '.tiff', 'czi': '.czi', 'isyntax': '.isyntax'}[fm]
        principale = os.path.join(dst, 'vetrino' + est); shutil.copyfile(src, principale); files = ['vetrino' + est]
        {'tiff': pulisci_tiff, 'czi': pulisci_czi, 'isyntax': pulisci_isyntax}[fm](principale)
    prob = controlla(principale)
    if prob:
        print('ATTENZIONE, nella copia resta:'); [print('  ·', x) for x in dict.fromkeys(prob)]
        shutil.rmtree(dst); raise SystemExit('vetrino NON aggiunto al caso')
    rel = [os.path.join('serie', f'vetrino_{n}', x) for x in files]
    serie.append({'descrizione': descr, 'tipo': 'vetrino', 'files': rel, 'dimensioni': [os.path.getsize(os.path.join(caso, x)) for x in rel]})
    json.dump(serie, open(sj, 'w'), ensure_ascii=False, indent=1)
    print(f'{os.path.basename(caso)}: vetrino {fm} in serie/vetrino_{n} ({len(rel)} file), etichetta e panoramica tolte, metadati ripuliti, voce aggiunta in serie.json')

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--controlla':
        p = a[1]
        if os.path.isdir(p): p = next(os.path.join(p, x) for x in sorted(os.listdir(p)) if not os.path.isdir(os.path.join(p, x)))
        prob = controlla(p); print('\n'.join('· ' + x for x in prob) or 'nessun problema'); sys.exit(2 if prob else 0)
    if len(a) != 3: print(__doc__); sys.exit(1)
    prepara(*a)
