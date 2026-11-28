"""Prova approfondita dell'atlante (28/11): per molti pazienti ReMIND (TCIA, CC BY 4.0) la sede del tumore secondo
l'atlante (MindSnap sulla T1 3D, come nel visualizzatore) si confronta con la sede scritta nella tabella clinica della
collezione (lato e lobo). Il tumore viene dalla segmentazione degli esperti (DICOM SEG).
Uso: remind_sede.py [numero massimo di pazienti]. Scarica in _tcia_grezzi/remind/sede (solo locale)."""
import os, sys, json, glob, subprocess, tempfile, collections, numpy as np, pydicom, SimpleITK as sitk, openpyxl
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import segmenta_encefalo as se
R = '/Volumes/Caloggero/_tcia_grezzi/remind'; S = os.path.join(R, 'sede'); os.makedirs(S, exist_ok=True)
MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 40
LOBI = {'frontale': 'superiorfrontal rostralmiddlefrontal caudalmiddlefrontal parsopercularis parstriangularis parsorbitalis lateralorbitofrontal medialorbitofrontal precentral paracentral frontalpole',
        'parietale': 'superiorparietal inferiorparietal supramarginal postcentral precuneus',
        'temporale': 'superiortemporal middletemporal inferiortemporal bankssts fusiform transversetemporal entorhinal temporalpole parahippocampal',
        'occipitale': 'lateraloccipital lingual cuneus pericalcarine', 'insula': 'insula',
        'cingolo': 'caudalanteriorcingulate rostralanteriorcingulate posteriorcingulate isthmuscingulate'}
LOBO = {g: l for l, gs in LOBI.items() for g in gs.split()}
PAROLE = {'frontale': ['frontal', 'orbitofrontal', 'caudate', 'septal', 'precentral'], 'parietale': ['parietal', 'postcentral', 'post-central'],
          'temporale': ['temporal', 'sylvian', 'amygdala', 'mesial'], 'occipitale': ['occipital'], 'insula': ['insular', 'insula'],
          'cingolo': ['cingul', 'corpus callosum']}
wb = openpyxl.load_workbook(os.path.join(R, 'clinica.xlsx'), read_only=True); righe = list(wb.worksheets[0].iter_rows(values_only=True))
clin = {f'ReMIND-{int(r[0]):03d}': r for r in righe[1:] if r[0] is not None and str(r[0]).isdigit()}
serie = json.load(open('/tmp/remind.json'))
def scarica(u, dest):
    if os.path.isdir(dest) and os.listdir(dest): return
    os.makedirs(dest, exist_ok=True); z = dest + '.zip'
    subprocess.run(['curl', '-s', '-m', '900', '-o', z, f'https://services.cancerimagingarchive.net/nbia-api/services/v1/getImage?SeriesInstanceUID={u}'], check=True)
    subprocess.run(['unzip', '-oq', z, '-d', dest], check=True); os.remove(z)
def volume(cart):
    fs = sorted(glob.glob(cart + '/*.dcm')); ds = [pydicom.dcmread(f, stop_before_pixels=True) for f in fs]
    iop = np.array(ds[0].ImageOrientationPatient, float); n = np.cross(iop[:3], iop[3:])
    o = sorted(zip([np.dot(n, np.array(d.ImagePositionPatient, float)) for d in ds], fs)); img = sitk.ReadImage([f for _, f in o], sitk.sitkFloat32)
    d0 = pydicom.dcmread(o[0][1], stop_before_pixels=True); img.SetOrigin([float(x) for x in d0.ImagePositionPatient])
    sp = list(img.GetSpacing()); sp[2] = (o[-1][0] - o[0][0]) / (len(o) - 1); img.SetSpacing(sp)
    img.SetDirection([iop[0], iop[3], n[0], iop[1], iop[4], n[1], iop[2], iop[5], n[2]]); return img
def punti_seg(f):
    d = pydicom.dcmread(f); px = d.pixel_array
    if px.ndim == 2: px = px[None]
    sh = d.SharedFunctionalGroupsSequence[0]; iop = np.array(sh.PlaneOrientationSequence[0].ImageOrientationPatient, float)
    ps = [float(x) for x in sh.PixelMeasuresSequence[0].PixelSpacing]; P = []
    for k, fr in enumerate(d.PerFrameFunctionalGroupsSequence):
        ipp = np.array(fr.PlanePositionSequence[0].ImagePositionPatient, float); ys, xs = np.nonzero(px[k])
        if len(xs): P.append(ipp + np.outer(xs * ps[1], iop[:3]) + np.outer(ys * ps[0], iop[3:]))
    return np.vstack(P) if P else np.zeros((0, 3))
risultati = []
pazienti = sorted({s['PatientID'] for s in serie})
for p in pazienti:
    if len(risultati) >= MAX: break
    c = clin.get(p)
    if not c: continue
    ss = [s for s in serie if s['PatientID'] == p]
    t1 = [s for s in ss if s.get('SeriesDescription') == '3D_AX_T1_postcontrast']
    seg = [s for s in ss if s.get('Modality') == 'SEG' and (s.get('SeriesDescription') or '').startswith('tumor seg')]
    if not t1 or not seg: continue
    t1 = [s for s in t1 if s['StudyInstanceUID'] == seg[0]['StudyInstanceUID']] or t1
    try:
        scarica(t1[0]['SeriesInstanceUID'], os.path.join(S, p, 't1')); scarica(seg[0]['SeriesInstanceUID'], os.path.join(S, p, 'seg'))
        img = volume(os.path.join(S, p, 't1')); P = punti_seg(glob.glob(os.path.join(S, p, 'seg', '*.dcm'))[0])
        with tempfile.TemporaryDirectory() as tmp: lab = se.brainchop(img, tmp, 'x')
        L = sitk.GetArrayFromImage(lab)   # [k,j,i]
        # tumore sulla griglia delle etichette, poi allargato di 5 mm: lobi della corteccia toccata
        M = np.zeros(L.shape, bool)
        for q in P[:: max(1, len(P) // 200000)]:
            i, j, k = lab.TransformPhysicalPointToIndex([float(x) for x in q]); 
            if 0 <= i < L.shape[2] and 0 <= j < L.shape[1] and 0 <= k < L.shape[0]: M[k, j, i] = True
        import scipy.ndimage as nd
        r = int(round(5 / min(lab.GetSpacing()))); Md = nd.binary_dilation(M, iterations=r)
        cont = collections.Counter(); lato = collections.Counter()
        for v, n in zip(*np.unique(L[Md], return_counts=True)):
            nome = se.NOMI[v] if v < len(se.NOMI) else ''
            if nome.startswith('ctx-'): cont[LOBO.get(nome.split('-', 2)[2], '?')] += n
            if nome.startswith(('ctx-lh', 'Left')): lato['Left'] += n
            elif nome.startswith(('ctx-rh', 'Right')): lato['Right'] += n
        tot = sum(cont.values()) or 1; lobi = [(l, round(n / tot, 2)) for l, n in cont.most_common(3)]
        sede = str(c[26] or '').lower(); attesi = {l for l, ws in PAROLE.items() if any(w in sede for w in ws)}
        lato_atl = lato.most_common(1)[0][0] if lato else '?'
        ok_lato = lato_atl.lower() == str(c[5]).lower() or 'midline' in sede or 'paramedian' in sede
        ok_lobo = bool(attesi & {l for l, f in lobi if f >= 0.2})
        nstr = len([v for v in np.unique(L) if v])
        r_ = {'p': p, 'sede': c[26], 'lato': c[5], 'atlante_lato': lato_atl, 'lobi': lobi, 'ok_lato': ok_lato, 'ok_lobo': ok_lobo, 'strutture': nstr, 'scanner': c[29], 'pregressa': c[6], 'vol_ml': round(len(P) * 0 + float(c[27] or 0), 1)}
    except Exception as e:
        r_ = {'p': p, 'errore': str(e)[:150]}
    risultati.append(r_); print(json.dumps(r_, ensure_ascii=False), flush=True)
ok = [r for r in risultati if 'errore' not in r]
print('RIASSUNTO', len(ok), 'pazienti · lato giusto', sum(r['ok_lato'] for r in ok), '· lobo giusto', sum(r['ok_lobo'] for r in ok))
json.dump(risultati, open(os.path.join(S, 'risultati.json'), 'w'), ensure_ascii=False, indent=1)
