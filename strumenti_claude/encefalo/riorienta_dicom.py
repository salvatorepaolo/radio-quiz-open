"""Prove: ricampiona una serie DICOM (caso pubblico) in un altro orientamento (sagittale o coronale) e la riscrive come
DICOM, per provare l'atlante su acquisizioni non assiali. Uso: riorienta_dicom.py <caso> <indice serie> <sag|cor> <uscita>"""
import os, sys, json, copy, numpy as np, pydicom, SimpleITK as sitk
from pydicom.uid import generate_uid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import segmenta_encefalo as se
caso, i, modo, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
# opzioni: passo=a,b,c (mm: colonne, righe, fette)  incl=gradi (rotazione attorno all'asse destra-sinistra)  sotto=mm (campo esteso in basso)
opz = dict(a.split('=') for a in sys.argv[5:]); passo = [float(x) for x in opz.get('passo', '1,1,1').split(',')]
incl = np.radians(float(opz.get('incl', 0))); sotto = float(opz.get('sotto', 0))
s = json.load(open(os.path.join(se.CASI, caso, 'serie.json'))); s = (s if isinstance(s, list) else s['serie'])[i]
img, e = se.volume(caso, s); assert img is not None, e
r, c = ((0, 1, 0), (0, 0, -1)) if modo == 'sag' else ((1, 0, 0), (0, 0, -1))
R = np.array([[1, 0, 0], [0, np.cos(incl), -np.sin(incl)], [0, np.sin(incl), np.cos(incl)]])
r, c = R @ np.array(r, float), R @ np.array(c, float)
n = np.cross(r, c); D = np.array([r, c, n]).T
# estensione: angoli del volume nel nuovo sistema
sz = img.GetSize(); ang = [img.TransformContinuousIndexToPhysicalPoint([a * (sz[0] - 1), b * (sz[1] - 1), k * (sz[2] - 1)]) for a in (0, 1) for b in (0, 1) for k in (0, 1)]
P = np.array(ang) @ D; lo, hi = P.min(0), P.max(0); sp = passo
if sotto:   # campo esteso verso i piedi lungo l'asse del nuovo sistema più vicino a S-I
    a = int(np.argmax(np.abs(D[2, :]))); seg = np.sign(D[2, a])
    if seg > 0: lo[a] -= sotto
    else: hi[a] += sotto
dims = [int(np.ceil((hi[k] - lo[k]) / sp[k])) + 1 for k in range(3)]
orig = (D @ lo).tolist()
ref = sitk.Image(dims, sitk.sitkFloat32); ref.SetSpacing(sp); ref.SetOrigin(orig); ref.SetDirection(D.flatten().tolist())
res = sitk.Resample(img, ref, sitk.Transform(), sitk.sitkLinear, float(sitk.GetArrayViewFromImage(img).min()))
A = sitk.GetArrayFromImage(res)            # [k, y, x]
src = pydicom.dcmread(os.path.join(se.CASI, caso, s['files'][0]))
os.makedirs(out, exist_ok=True); serie_uid = generate_uid()
slope = float(getattr(src, 'RescaleSlope', 1) or 1); inter = float(getattr(src, 'RescaleIntercept', 0) or 0)
for k in range(A.shape[0]):
    d = copy.deepcopy(src); d.SOPInstanceUID = generate_uid(); d.file_meta.MediaStorageSOPInstanceUID = d.SOPInstanceUID
    d.file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
    d.SeriesInstanceUID = serie_uid; d.SeriesDescription = f"{s['descrizione']} {modo} (prova)"; d.InstanceNumber = k + 1
    d.ImageOrientationPatient = [float(x) for x in (*r, *c)]
    d.ImagePositionPatient = [float(x) for x in (np.array(orig) + k * sp[2] * n)]
    d.PixelSpacing = [sp[1], sp[0]]; d.SliceThickness = sp[2]; d.Rows, d.Columns = A.shape[1], A.shape[2]
    px = np.round((A[k] - inter) / slope).astype(np.int16)
    d.BitsAllocated = 16; d.BitsStored = 16; d.HighBit = 15; d.PixelRepresentation = 1; d.SamplesPerPixel = 1; d.PhotometricInterpretation = 'MONOCHROME2'
    for t in ('LargestImagePixelValue', 'SmallestImagePixelValue', 'WindowCenter', 'WindowWidth'):
        if t in d: delattr(d, t)
    d.PixelData = px.tobytes(); d.save_as(os.path.join(out, f'img_{k:04d}.dcm'), enforce_file_format=True)
print(modo, A.shape, 'scritti in', out)
