"""Misure del tumore dalla segmentazione degli esperti (DICOM SEG ReMIND) riportate sulle serie anonime di un caso."""
import sys, json, glob, os, numpy as np, pydicom
seg, caso = sys.argv[1], sys.argv[2]
d = pydicom.dcmread(seg); px = d.pixel_array; px = px[None] if px.ndim == 2 else px
sh = d.SharedFunctionalGroupsSequence[0]; iop = np.array(sh.PlaneOrientationSequence[0].ImageOrientationPatient, float)
ps = [float(x) for x in sh.PixelMeasuresSequence[0].PixelSpacing]; st = float(sh.PixelMeasuresSequence[0].SliceThickness or ps[0])
P = []
for k, fr in enumerate(d.PerFrameFunctionalGroupsSequence):
    ipp = np.array(fr.PlanePositionSequence[0].ImagePositionPatient, float); ys, xs = np.nonzero(px[k])
    if len(xs): P.append(ipp + np.outer(xs * ps[1], iop[:3]) + np.outer(ys * ps[0], iop[3:]))
P = np.vstack(P); vol = len(P) * ps[0] * ps[1] * st / 1000
c = P.mean(0); ext = P.max(0) - P.min(0)
out = {'volume_ml': round(vol, 1), 'centro_LPS': c.round(1).tolist(), 'lato': 'sinistra' if c[0] > 0 else 'destra', 'estensione_mm_LR_AP_CC': ext.round(0).tolist()}
C = '/Volumes/Caloggero/piattaforma-quiz/casi-free/' + caso
for i, s in enumerate(json.load(open(C + '/serie.json'))):
    ds = [pydicom.dcmread(C + '/' + f, stop_before_pixels=True) for f in s['files']]
    io = np.array(ds[0].ImageOrientationPatient, float); n = np.cross(io[:3], io[3:])
    pos = np.array([np.dot(n, np.array(x.ImagePositionPatient, float)) for x in ds])
    pt = P @ n; best = None
    for k, z in enumerate(pos):
        a = np.sum(np.abs(pt - z) < float(ds[k].SliceThickness or 1) / 2)
        if best is None or a > best[1]: best = (k, a)
    # centro del tumore in quella immagine (pixel)
    k = best[0]; ipp = np.array(ds[k].ImagePositionPatient, float); sel = P[np.abs(pt - pos[k]) < float(ds[k].SliceThickness or 1) / 2]
    sp = [float(x) for x in ds[k].PixelSpacing]; q = sel - ipp
    xs, ys = q @ io[:3] / sp[1], q @ io[3:] / sp[0]
    out[f"serie {i} {s['descrizione']}"] = {'idx': int(k), 'n': len(ds), 'x': [int(xs.min()), int(xs.max())], 'y': [int(ys.min()), int(ys.max())], 'diametri_mm': [round((xs.max() - xs.min()) * sp[1]), round((ys.max() - ys.min()) * sp[0])]}
print(json.dumps(out, ensure_ascii=False, indent=1))
