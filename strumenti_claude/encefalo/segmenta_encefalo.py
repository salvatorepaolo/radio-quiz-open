#!/usr/bin/env python3
"""Atlante dell'encefalo per le RM dei casi: giri e strutture (MindSnap, 104 classi Desikan-Killiany) e territori
arteriosi (atlante JHU, Liu et al. 2023) adattati all'esame.

Si lancia sul Mac, sulle immagini GIÀ ANONIME del caso, con l'ambiente strumenti_claude/encefalo/.venv:

    .venv/bin/python segmenta_encefalo.py caso-tcia-062          # la serie 3D più adatta di ogni studio
    .venv/bin/python segmenta_encefalo.py caso-tcia-062 --serie 1
    .venv/bin/python segmenta_encefalo.py --tutti                # tutte le RM encefalo non ancora fatte

Per la serie scelta scrive in casi/<id>/ia/ (stesso formato di segmenta_ia.py, letto dal visualizzatore):
    <cartella>.json     geometria (mondo LPS), nomi delle strutture, territori arteriosi
    <cartella>.lab.gz   strutture (uint8, strato-riga-colonna, risoluzione piena)
    <cartella>.art.gz   territori arteriosi (uint8, stessa griglia; 0 fuori dal parenchima)
Nessun dato del paziente: solo numeri di geometria ed etichette.

Strumenti, tutti open source: brainchop 1.1.2 (MIT; modello MindSnap), template ICBM 2009c (licenza McGill,
permissiva), Digital 3D Brain MRI Arterial Territories Atlas (Johns Hopkins University, CC BY-SA 4.0).
"""
import argparse, gzip, json, os, subprocess, sys, tempfile, time
import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
CASI = os.environ.get("RQ_CASI") or "/Volumes/Caloggero/piattaforma-quiz/casi-free"
ATL = os.path.join(QUI, "atlante")
SOGLIA_MM = 6.0                       # scarto mediano massimo dei punti di riferimento dopo l'adattamento
BRAINCHOP = os.path.join(QUI, ".venv", "bin", "brainchop")
NOMI = ["BG", "ctx-lh-bankssts", "ctx-lh-caudalanteriorcingulate", "ctx-lh-caudalmiddlefrontal", "ctx-lh-cuneus", "ctx-lh-entorhinal", "ctx-lh-fusiform", "ctx-lh-inferiorparietal", "ctx-lh-inferiortemporal", "ctx-lh-isthmuscingulate", "ctx-lh-lateraloccipital", "ctx-lh-lateralorbitofrontal", "ctx-lh-lingual", "ctx-lh-medialorbitofrontal", "ctx-lh-middletemporal", "ctx-lh-parahippocampal", "ctx-lh-paracentral", "ctx-lh-parsopercularis", "ctx-lh-parsorbitalis", "ctx-lh-parstriangularis", "ctx-lh-pericalcarine", "ctx-lh-postcentral", "ctx-lh-posteriorcingulate", "ctx-lh-precentral", "ctx-lh-precuneus", "ctx-lh-rostralanteriorcingulate", "ctx-lh-rostralmiddlefrontal", "ctx-lh-superiorfrontal", "ctx-lh-superiorparietal", "ctx-lh-superiortemporal", "ctx-lh-supramarginal", "ctx-lh-frontalpole", "ctx-lh-temporalpole", "ctx-lh-transversetemporal", "ctx-lh-insula", "ctx-rh-bankssts", "ctx-rh-caudalanteriorcingulate", "ctx-rh-caudalmiddlefrontal", "ctx-rh-cuneus", "ctx-rh-entorhinal", "ctx-rh-fusiform", "ctx-rh-inferiorparietal", "ctx-rh-inferiortemporal", "ctx-rh-isthmuscingulate", "ctx-rh-lateraloccipital", "ctx-rh-lateralorbitofrontal", "ctx-rh-lingual", "ctx-rh-medialorbitofrontal", "ctx-rh-middletemporal", "ctx-rh-parahippocampal", "ctx-rh-paracentral", "ctx-rh-parsopercularis", "ctx-rh-parsorbitalis", "ctx-rh-parstriangularis", "ctx-rh-pericalcarine", "ctx-rh-postcentral", "ctx-rh-posteriorcingulate", "ctx-rh-precentral", "ctx-rh-precuneus", "ctx-rh-rostralanteriorcingulate", "ctx-rh-rostralmiddlefrontal", "ctx-rh-superiorfrontal", "ctx-rh-superiorparietal", "ctx-rh-superiortemporal", "ctx-rh-supramarginal", "ctx-rh-frontalpole", "ctx-rh-temporalpole", "ctx-rh-transversetemporal", "ctx-rh-insula", "Left-Thalamus-Proper*", "Right-Thalamus-Proper*", "Left-Caudate", "Right-Caudate", "Left-Putamen", "Right-Putamen", "Left-Pallidum", "Right-Pallidum", "Left-Hippocampus", "Right-Hippocampus", "Left-Amygdala", "Right-Amygdala", "Left-Accumbens-area", "Right-Accumbens-area", "Left-VentralDC", "Right-VentralDC", "Left-Cerebral-White-Matter", "Right-Cerebral-White-Matter", "Left-Lateral-Ventricle", "Left-Inf-Lat-Vent", "Right-Lateral-Ventricle", "Right-Inf-Lat-Vent", "3rd-Ventricle", "4th-Ventricle", "CSF", "Brain-Stem", "Left-Cerebellum-White-Matter", "Right-Cerebellum-White-Matter", "Left-Cerebellum-Cortex", "Right-Cerebellum-Cortex", "CC_Posterior", "CC_Mid_Posterior", "CC_Central", "CC_Mid_Anterior", "CC_Anterior"]
LIQUOR = {i for i, n in enumerate(NOMI) if "Vent" in n or n == "CSF"}          # niente territorio arterioso
# territori arteriosi (livello 1 dell'atlante JHU); i nomi italiani sono nel visualizzatore (atlante-encefalo.js)
ARTERIE = ["", "ACA sin", "ACA dx", "lenticolostriate mediali sin", "lenticolostriate mediali dx", "lenticolostriate laterali sin",
           "lenticolostriate laterali dx", "ACM frontale sin", "ACM frontale dx", "ACM parietale sin", "ACM parietale dx", "ACM temporale sin",
           "ACM temporale dx", "ACM occipitale sin", "ACM occipitale dx", "ACM insulare sin", "ACM insulare dx", "ACP temporale sin",
           "ACP temporale dx", "ACP occipitale sin", "ACP occipitale dx", "coroidee posteriori e talamoperforanti sin",
           "coroidee posteriori e talamoperforanti dx", "coroidea anteriore e talamoperforanti sin", "coroidea anteriore e talamoperforanti dx",
           "basilare sin", "basilare dx", "cerebellare superiore sin", "cerebellare superiore dx", "cerebellari inferiori sin",
           "cerebellari inferiori dx"]


# ---------------------------------------------------------------- volume dalle fette DICOM (come segmenta_ia.py)
def volume(id_caso, s):
    import pydicom, SimpleITK as sitk
    pos = []
    for f in s["files"]:
        p = os.path.join(CASI, id_caso, f); d = pydicom.dcmread(p, stop_before_pixels=True)
        if "ImagePositionPatient" not in d or "ImageOrientationPatient" not in d:
            return None, "fette senza posizione"
        iop = [float(x) for x in d.ImageOrientationPatient]; n = np.cross(iop[:3], iop[3:])
        pos.append((float(np.dot(n, [float(x) for x in d.ImagePositionPatient])), p, int(d.Rows), int(d.Columns)))
    pos.sort()
    if len({(r, c) for _, _, r, c in pos}) > 1:
        return None, "fette di dimensioni diverse"
    dz = np.diff([z for z, *_ in pos])
    if len(dz) == 0 or dz.min() <= 0.01 or dz.max() > dz.min() * 1.5 + 0.1:
        return None, "spaziatura tra le fette irregolare"
    img = sitk.ReadImage([p for _, p, *_ in pos], sitk.sitkFloat32)
    d0 = pydicom.dcmread(pos[0][1], stop_before_pixels=True)
    iop = [float(x) for x in d0.ImageOrientationPatient]; r, c = np.array(iop[:3]), np.array(iop[3:]); n = np.cross(r, c)
    img.SetOrigin([float(x) for x in d0.ImagePositionPatient])
    sp = list(img.GetSpacing()); sp[2] = float((pos[-1][0] - pos[0][0]) / (len(pos) - 1)); img.SetSpacing(sp)
    img.SetDirection([r[0], c[0], n[0], r[1], c[1], n[1], r[2], c[2], n[2]])
    return img, None


def serie_adatte(id_caso):
    """RM dell'encefalo con almeno 60 fette e spessore fino a 2 mm; prima le T1, poi le altre 3D."""
    import pydicom
    out = []
    for i, s in enumerate(json.load(open(os.path.join(CASI, id_caso, "serie.json")))):
        files = s.get("files") or []
        if len(files) < 60:
            continue
        try:
            d = pydicom.dcmread(os.path.join(CASI, id_caso, files[0]), stop_before_pixels=True)
        except Exception:
            continue
        if str(d.get("Modality", "")) != "MR":
            continue
        sp = float(d.get("SliceThickness", 0) or 0)
        if sp and sp > 2.0:
            continue
        descr = (s.get("descrizione", "") + " " + str(d.get("SeriesDescription", ""))).lower()
        out.append((0 if "t1" in descr else 1, -len(files), i, s, str(d.get("StudyInstanceUID", ""))))
    return [(i, s, st) for *_, i, s, st in sorted(out)]


# ---------------------------------------------------------------- adattamento dell'atlante: punti di riferimento
def centri(lab, aff_ras, minimo=30):
    """Centro (RAS mm) e numero di voxel di ogni struttura."""
    from scipy import ndimage
    out = {}
    idx = np.arange(1, len(NOMI))
    cnt = ndimage.sum(np.ones_like(lab, np.float32), lab, idx)
    com = ndimage.center_of_mass(np.ones_like(lab, np.float32), lab, idx)
    for k, n, c in zip(idx, cnt, com):
        if n >= minimo:
            out[int(k)] = (aff_ras[:3, :3] @ np.array(c) + aff_ras[:3, 3]).tolist() + [int(n)]
    return out


def adatta(pz, mni, liscio=8.0):
    """Trasformazione paziente (RAS mm) -> MNI: parte affine ai minimi quadrati + thin-plate spline regolarizzata.
    Stessa formula del visualizzatore (atlante-encefalo.js): U(r) = r² log r, sistema [K + λI, P; Pᵀ, 0]."""
    chiavi = [k for k in pz if k in mni and k not in LIQUOR]
    X = np.array([pz[k][:3] for k in chiavi], float); Y = np.array([mni[k][:3] for k in chiavi], float)
    n = len(X)
    d = np.sqrt(((X[:, None] - X[None]) ** 2).sum(-1)); K = np.where(d > 0, d * d * np.log(np.maximum(d, 1e-9)), 0)
    P = np.hstack([np.ones((n, 1)), X])
    lam = liscio * liscio * liscio * n          # regolarizzazione proporzionale al numero di punti
    A = np.zeros((n + 4, n + 4)); A[:n, :n] = K + lam * np.eye(n); A[:n, n:] = P; A[n:, :n] = P.T
    B = np.zeros((n + 4, 3)); B[:n] = Y
    sol = np.linalg.solve(A, B)
    return {"punti": X.tolist(), "w": sol[:n].tolist(), "a": sol[n:].tolist(), "chiavi": chiavi}


def applica(t, Q):
    X = np.array(t["punti"]); w = np.array(t["w"]); a = np.array(t["a"])
    d = np.sqrt(((Q[:, None] - X[None]) ** 2).sum(-1)); U = np.where(d > 0, d * d * np.log(np.maximum(d, 1e-9)), 0)
    return U @ w + np.hstack([np.ones((len(Q), 1)), Q]) @ a


def brainchop(img, tmp, nome):
    import SimpleITK as sitk
    ing, usc = os.path.join(tmp, nome + ".nii.gz"), os.path.join(tmp, nome + "_snap.nii.gz")
    sitk.WriteImage(img, ing)
    r = subprocess.run([BRAINCHOP, "-m", "mindsnap", ing, "-o", usc], capture_output=True, text=True)
    if r.returncode or not os.path.exists(usc):
        raise RuntimeError("brainchop non riuscito: " + (r.stderr or r.stdout)[-300:])
    return sitk.ReadImage(usc)


def territori(lab, aff_ras, t):
    import nibabel as nib
    art = nib.load(os.path.join(ATL, "arterie_mni.nii.gz")); A = np.asarray(art.dataobj).astype(np.uint8); inv = np.linalg.inv(art.affine)
    out = np.zeros(lab.shape, np.uint8)
    m = (lab > 0) & ~np.isin(lab, list(LIQUOR))
    vox = np.argwhere(m)
    for i in range(0, len(vox), 200000):
        v = vox[i:i + 200000]
        q = (aff_ras[:3, :3] @ v.T + aff_ras[:3, 3:4]).T
        mm = applica(t, q)
        g = np.rint(inv[:3, :3] @ mm.T + inv[:3, 3:4]).astype(int)
        ok = np.all((g >= 0) & (g < np.array(A.shape)[:, None]), 0)
        val = np.zeros(len(v), np.uint8); val[ok] = A[g[0, ok], g[1, ok], g[2, ok]]
        out[v[:, 0], v[:, 1], v[:, 2]] = val
    out[np.isin(out, [31, 32])] = 0                 # ventricoli dell'atlante: nel paziente qui c'è parenchima
    # parenchima senza etichetta dell'atlante (bordi, ventricoli dell'atlante): territorio del vicino più prossimo
    from scipy import ndimage
    vuoti = m & (out == 0)
    if vuoti.any() and (out > 0).any():
        _, (ii, jj, kk) = ndimage.distance_transform_edt(out == 0, return_indices=True)
        out[vuoti] = out[ii[vuoti], jj[vuoti], kk[vuoti]]
    return out


# ---------------------------------------------------------------- una serie
def elabora(id_caso, i, s):
    import nibabel as nib, SimpleITK as sitk
    cartella = s["files"][0].split("/")[1]
    img, motivo = volume(id_caso, s)
    if img is None:
        print(f"  serie {i} ({s.get('descrizione')}): saltata, {motivo}"); return False
    t0 = time.time()
    rif = json.load(open(os.path.join(ATL, "riferimento.json")))["centri"]
    mni = {int(k): v for k, v in rif.items()}
    with tempfile.TemporaryDirectory() as tmp:
        sitk.WriteImage(img, os.path.join(tmp, "mr.nii.gz")); aff = nib.load(os.path.join(tmp, "mr.nii.gz")).affine
        try:
            seg = brainchop(img, tmp, "mr")
        except RuntimeError as e:
            print(f"  serie {i}: {e}"); return False
        lab = sitk.GetArrayFromImage(seg).astype(np.uint8)      # (strato, riga, colonna)
        if lab.shape != sitk.GetArrayFromImage(img).shape:
            print(f"  serie {i}: geometria del risultato diversa, saltata"); return False
        pz = centri(np.ascontiguousarray(lab.transpose(2, 1, 0)), aff)
    labT = np.ascontiguousarray(lab.transpose(2, 1, 0))       # affine RAS (nibabel) per l'indice (colonna, riga, strato)
    if len(pz) < 60:
        print(f"  serie {i}: solo {len(pz)} strutture riconosciute, saltata (non sembra una RM dell'encefalo intera)"); return False
    t = adatta(pz, mni)
    res = np.sqrt(((applica(t, np.array([pz[k][:3] for k in t["chiavi"]])) - np.array([mni[k][:3] for k in t["chiavi"]])) ** 2).sum(-1))
    if np.median(res) > SOGLIA_MM:
        # lesione voluminosa, anatomia molto diversa o segmentazione povera: un atlante sbagliato insegna cose sbagliate
        print(f"  serie {i}: scarto mediano {np.median(res):.1f} mm (oltre {SOGLIA_MM} mm): atlante NON salvato")
        for e in (".json", ".lab.gz", ".art.gz"):
            f = os.path.join(CASI, id_caso, "ia", cartella + e)
            if os.path.exists(f) and (e != ".json" or json.load(open(f)).get("atlante") == "encefalo"): os.remove(f)
        return False
    art = territori(labT, aff, t).transpose(2, 1, 0)
    sp = list(img.GetSpacing()); dirz = list(img.GetDirection())
    geo = {
        "serie": cartella, "dim": [int(lab.shape[2]), int(lab.shape[1]), int(lab.shape[0])], "sp": sp, "origine": list(img.GetOrigin()),
        "assi": [[dirz[0], dirz[3], dirz[6]], [dirz[1], dirz[4], dirz[7]], [dirz[2], dirz[5], dirz[8]]],
        "etichette": {str(k): NOMI[k] for k in range(1, len(NOMI)) if (lab == k).any()},
        "atlante": "encefalo",
        "arterie": {"file": cartella + ".art.gz", "etichette": {str(k): ARTERIE[k] for k in range(1, 31) if (art == k).any()},
                    "residuo_mm": round(float(np.median(res)), 1)},
        "modello": "MindSnap (brainchop 1.1.2, Desikan-Killiany 104) + atlante arterioso JHU", "data": time.strftime("%Y-%m"),
    }
    dest = os.path.join(CASI, id_caso, "ia"); os.makedirs(dest, exist_ok=True)
    with gzip.open(os.path.join(dest, cartella + ".lab.gz"), "wb", compresslevel=9) as f: f.write(np.ascontiguousarray(lab).tobytes())
    with gzip.open(os.path.join(dest, cartella + ".art.gz"), "wb", compresslevel=9) as f: f.write(np.ascontiguousarray(art).tobytes())
    json.dump(geo, open(os.path.join(dest, cartella + ".json"), "w"), ensure_ascii=False)
    print(f"  serie {i} ({s.get('descrizione')}): {len(geo['etichette'])} strutture, {len(geo['arterie']['etichette'])} territori, "
          f"scarto mediano dei punti di riferimento {geo['arterie']['residuo_mm']} mm, {time.time() - t0:.0f} s")
    return True


def caso_encefalo(id_caso):
    c = json.load(open(os.path.join(CASI, id_caso, "caso.json")))
    t = (c.get("titolo", "") + " " + c.get("distretto", "")).lower()
    return any(k in t for k in ("encefal", "cervello", "cerebral", "cranio"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("casi", nargs="*"); ap.add_argument("--serie", type=int); ap.add_argument("--tutti", action="store_true")
    ap.add_argument("--rifai", action="store_true")
    a = ap.parse_args()
    ids = a.casi or ([d for d in sorted(os.listdir(CASI)) if os.path.exists(os.path.join(CASI, d, "serie.json")) and caso_encefalo(d)] if a.tutti else [])
    for id_caso in ids:
        print(id_caso)
        cand = serie_adatte(id_caso)
        if a.serie is not None:
            cand = [c for c in cand if c[0] == a.serie]
        if not cand:
            print("  nessuna RM 3D dell'encefalo adatta"); continue
        visti = set()
        for i, s, st in cand:                      # la serie migliore di ogni studio (esami di date diverse)
            if st in visti:
                continue
            visti.add(st)
            cart = s["files"][0].split("/")[1]
            if not a.rifai and os.path.exists(os.path.join(CASI, id_caso, "ia", cart + ".art.gz")):
                print(f"  serie {i}: già fatta"); continue
            elabora(id_caso, i, s)


if __name__ == "__main__":
    main()
