"""Prove dell'atlante sulla TC: esporta le serie TC (DICOM) come volume grezzo float32 + json per prova_tc_robustezza.mjs.
Solo locale (/tmp/tcset): i dati CQ500 non escono dal Mac."""
import os, sys, json, glob, numpy as np, pydicom, SimpleITK as sitk
OUT = '/tmp/tcset'; os.makedirs(OUT, exist_ok=True)
def serie(cartella):
    gruppi = {}
    for f in glob.glob(os.path.join(cartella, '**', '*'), recursive=True):
        if not os.path.isfile(f) or f.endswith(('.zip', '.log', '.sh', '.json')): continue
        try: d = pydicom.dcmread(f, stop_before_pixels=True)
        except Exception: continue
        if getattr(d, 'Modality', '') != 'CT' or 'ImagePositionPatient' not in d: continue
        gruppi.setdefault(d.SeriesInstanceUID, []).append((f, d))
    return gruppi
def esporta(nome, voci):
    d0 = voci[0][1]; iop = np.array([float(x) for x in d0.ImageOrientationPatient]); r, c = iop[:3], iop[3:]; n = np.cross(r, c)
    voci = [v for v in voci if (int(v[1].Rows), int(v[1].Columns)) == (int(d0.Rows), int(d0.Columns))]
    pos = sorted(((float(np.dot(n, [float(x) for x in v[1].ImagePositionPatient])), v[0], v[1]) for v in voci), key=lambda t: t[0])
    # posizioni ripetute: una sola fetta per posizione
    uniche = []; 
    for p in pos:
        if not uniche or p[0] - uniche[-1][0] > 0.01: uniche.append(p)
    if len(uniche) < 20: return None
    dz = np.median(np.diff([p[0] for p in uniche]))
    img = sitk.ReadImage([p[1] for p in uniche], sitk.sitkFloat32)
    a = sitk.GetArrayFromImage(img).astype(np.float32)
    ipp0 = [float(x) for x in uniche[0][2].ImagePositionPatient]; ps = [float(x) for x in d0.PixelSpacing]
    ipl = np.array([float(x) for x in uniche[-1][2].ImagePositionPatient]); L = uniche[-1][0] - uniche[0][0]; resto = ipl - np.array(ipp0) - L * n
    taglio = (resto * dz / L).tolist() if L > 0 and np.linalg.norm(resto) > 0.5 else [0.0, 0.0, 0.0]
    m = {'taglio': taglio, 'W': int(a.shape[2]), 'H': int(a.shape[1]), 'N': int(a.shape[0]), 'sp': [ps[1], ps[0], float(dz)], 'origine': ipp0,
         'assi': [r.tolist(), c.tolist(), n.tolist()], 'descrizione': str(getattr(d0, 'SeriesDescription', '')), 'spessore': float(getattr(d0, 'SliceThickness', 0) or 0)}
    a.tofile(os.path.join(OUT, nome + '.f32')); json.dump(m, open(os.path.join(OUT, nome + '.json'), 'w'))
    return m
for k, cart in enumerate(sys.argv[1:]):
    for j, (uid, voci) in enumerate(serie(cart).items()):
        nome = (f"tcia{k}_{j}" if os.path.basename(cart).startswith("1.3.6") else f"{os.path.basename(cart.rstrip('/'))[:12]}_{j}").replace(" ", "_")
        m = esporta(nome, voci)
        if m: print(nome, m['descrizione'], m['W'], m['H'], m['N'], [round(x, 2) for x in m['sp']], 'iop', [round(x, 2) for x in m['assi'][2]])
