"""Prova: serie DICOM anonima di un caso -> NIfTI (geometria come segmenta_ia.py). Uso: prova_vol.py <caso> <indice serie> <uscita.nii.gz>"""
import json, os, sys
import numpy as np, pydicom, SimpleITK as sitk
CASI = "/Volumes/Caloggero/piattaforma-quiz/casi-free"
caso, i, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
s = json.load(open(os.path.join(CASI, caso, "serie.json")))[i]
pos = []
for f in s["files"]:
    p = os.path.join(CASI, caso, f); d = pydicom.dcmread(p, stop_before_pixels=True)
    iop = [float(x) for x in d.ImageOrientationPatient]; n = np.cross(iop[:3], iop[3:])
    pos.append((float(np.dot(n, [float(x) for x in d.ImagePositionPatient])), p))
pos.sort()
img = sitk.ReadImage([p for _, p in pos], sitk.sitkFloat32)
d0 = pydicom.dcmread(pos[0][1], stop_before_pixels=True)
iop = [float(x) for x in d0.ImageOrientationPatient]; r, c = np.array(iop[:3]), np.array(iop[3:]); n = np.cross(r, c)
img.SetOrigin([float(x) for x in d0.ImagePositionPatient])
sp = list(img.GetSpacing()); sp[2] = float((pos[-1][0] - pos[0][0]) / (len(pos) - 1)); img.SetSpacing(sp)
img.SetDirection([r[0], c[0], n[0], r[1], c[1], n[1], r[2], c[2], n[2]])
sitk.WriteImage(img, out)
print(img.GetSize(), [round(x, 2) for x in img.GetSpacing()])
