#!/usr/bin/env python3
"""Segmentazione con IA (TotalSegmentator, modalità veloce) delle TC di un caso.

Si lancia sul Mac, sulle immagini GIÀ ANONIME del caso (casi/<id>/serie), con l'ambiente
~/.radioquiz-ia/venv:

    ~/.radioquiz-ia/venv/bin/python strumenti/segmenta_ia.py caso-103            # tutte le TC adatte
    ~/.radioquiz-ia/venv/bin/python strumenti/segmenta_ia.py caso-103 --serie 2  # solo la serie 2 (indice di serie.json)
    ~/.radioquiz-ia/venv/bin/python strumenti/segmenta_ia.py --tutti             # tutti i casi con TC, senza rifare quelli fatti
    ~/.radioquiz-ia/venv/bin/python strumenti/segmenta_ia.py caso-066 --extra    # + emorragia e ventricoli / versamenti

Per ogni serie scrive in casi/<id>/ia/:
    <cartella>.json     geometria (mondo LPS) e nomi delle strutture
    <cartella>.lab.gz   etichette uint8 (strato, riga, colonna), metà risoluzione nel piano
Nessun dato del paziente: solo numeri di geometria ed etichette. Nel visualizzatore la
segmentazione IA si può disattivare per caso dall'editor («Segmentazione IA»).
"""
import argparse, gzip, json, os, sys, tempfile, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# RQ_CASI=…/casi-free per i casi del sito gratuito
CASI = os.environ.get("RQ_CASI") or os.path.join(BASE, "casi")


def serie_adatte(id_caso):
    import pydicom
    elenco = json.load(open(os.path.join(CASI, id_caso, "serie.json")))
    out = []
    for i, s in enumerate(elenco):
        files = s.get("files") or []
        if len(files) < 40:
            continue
        p0 = os.path.join(CASI, id_caso, files[0])
        try:
            d = pydicom.dcmread(p0, stop_before_pixels=True)
        except Exception:
            continue
        if str(d.get("Modality", "")) != "CT" or "ImageOrientationPatient" not in d:
            continue
        iop = [float(x) for x in d.ImageOrientationPatient]
        nz = abs(iop[0] * iop[4] - iop[1] * iop[3])      # componente z della normale: assiale ≈ 1
        if nz < 0.9:
            continue
        out.append((i, s))
    return out


def volume(id_caso, s):
    """Volume SimpleITK dalle fette ordinate per posizione; None se spaziatura irregolare."""
    import numpy as np, pydicom, SimpleITK as sitk
    pos = []
    for f in s["files"]:
        p = os.path.join(CASI, id_caso, f)
        d = pydicom.dcmread(p, stop_before_pixels=True)
        if "ImagePositionPatient" not in d:
            return None, "fette senza posizione"
        iop = [float(x) for x in d.ImageOrientationPatient]
        n = np.cross(iop[:3], iop[3:])
        pos.append((float(np.dot(n, [float(x) for x in d.ImagePositionPatient])), p, int(d.Rows), int(d.Columns)))
    pos.sort()
    if len({(r, c) for _, _, r, c in pos}) > 1:
        return None, "fette di dimensioni diverse"
    dz = np.diff([z for z, *_ in pos])
    if len(dz) == 0 or dz.min() <= 0.01 or dz.max() > dz.min() * 1.5 + 0.1:
        return None, "spaziatura tra le fette irregolare (fette mancanti o sovrapposte)"
    img = sitk.ReadImage([p for _, p, *_ in pos], sitk.sitkInt16)
    # geometria ricostruita dalle posizioni delle fette (ordine crescente lungo la normale): con alcune TC
    # (GE e Philips con SpacingBetweenSlices negativo, gantry inclinato) SimpleITK dava la direzione dello strato
    # invertita o il passo sbagliato, e il modello vedeva il paziente capovolto
    d0 = pydicom.dcmread(pos[0][1], stop_before_pixels=True)
    iop = [float(x) for x in d0.ImageOrientationPatient]
    r, c = np.array(iop[:3]), np.array(iop[3:]); n = np.cross(r, c)
    img.SetOrigin([float(x) for x in d0.ImagePositionPatient])
    sp = list(img.GetSpacing()); sp[2] = float((pos[-1][0] - pos[0][0]) / (len(pos) - 1)); img.SetSpacing(sp)
    img.SetDirection([r[0], c[0], n[0], r[1], c[1], n[1], r[2], c[2], n[2]])
    return img, None


def etichette():
    from totalsegmentator.map_to_binary import class_map
    return {int(k): v for k, v in class_map["total"].items()}


def segmenta(id_caso, i, s, device):
    import numpy as np, SimpleITK as sitk
    from totalsegmentator.python_api import totalsegmentator
    cartella = s["files"][0].split("/")[1]
    img, motivo = volume(id_caso, s)
    if img is None:
        print(f"  serie {i} ({s['descrizione']}): saltata, {motivo}")
        return False
    t = time.time()
    with tempfile.TemporaryDirectory(dir=os.path.expanduser("~/.radioquiz-ia")) as tmp:
        ing, usc = os.path.join(tmp, "ct.nii.gz"), os.path.join(tmp, "seg.nii.gz")
        sitk.WriteImage(img, ing)
        totalsegmentator(ing, usc, fast=True, ml=True, device=device, quiet=True, nr_thr_resamp=1, nr_thr_saving=1)
        seg = sitk.ReadImage(usc)
    a = sitk.GetArrayFromImage(seg).astype(np.uint8)              # (strato, riga, colonna) come img
    if a.shape != sitk.GetArrayFromImage(img).shape:
        print(f"  serie {i}: geometria del risultato diversa, saltata")
        return False
    a = np.ascontiguousarray(a[:, ::2, ::2])                      # metà risoluzione nel piano
    sp = list(img.GetSpacing()); dirz = list(img.GetDirection())
    geo = {
        "serie": cartella, "dim": [int(a.shape[2]), int(a.shape[1]), int(a.shape[0])],
        "sp": [sp[0] * 2, sp[1] * 2, sp[2]], "origine": list(img.GetOrigin()),
        # assi: direzione (mondo LPS) di colonna, riga e strato
        "assi": [[dirz[0], dirz[3], dirz[6]], [dirz[1], dirz[4], dirz[7]], [dirz[2], dirz[5], dirz[8]]],
        "etichette": {str(k): v for k, v in etichette().items() if (a == k).any()},
        "modello": "TotalSegmentator (veloce, 3 mm)", "data": time.strftime("%Y-%m"),
    }
    dest = os.path.join(CASI, id_caso, "ia"); os.makedirs(dest, exist_ok=True)
    with gzip.open(os.path.join(dest, cartella + ".lab.gz"), "wb", compresslevel=9) as f:
        f.write(a.tobytes())
    json.dump(geo, open(os.path.join(dest, cartella + ".json"), "w"), ensure_ascii=False)
    print(f"  serie {i} ({s['descrizione']}): {len(geo['etichette'])} strutture in {time.time() - t:.0f} s")
    verifica(id_caso)
    return True


def verifica(id_caso):
    """Controlli automatici (strumenti/controlla_ia.py) subito dopo l'elaborazione: le serie con errori
    vengono segnate «scartata» e il sito non le usa; i risultati non plausibili tolti dalle analisi."""
    import subprocess
    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "controlla_ia.py"), CASI, "--correggi", "--caso", id_caso],
                       capture_output=True, text=True)
    for riga in (r.stdout or "").splitlines():
        if "ERRORE" in riga or "non plausibili" in riga:
            print("  " + riga.strip())


# ---- analisi aggiuntive (compiti di TotalSegmentator senza licenza commerciale, a piena risoluzione)
# Scrive <cartella>.x.gz (etichette dei reperti, stessa griglia ridotta delle etichette principali, numeri da 200)
# e, nel .json, «analisi»: volumi e misure calcolati sulle immagini originali.
X_ID = {"intracerebral_hemorrhage": 200}
for _k, _n in enumerate(["ventricle_frontal_horn_left", "ventricle_occipital_horn_left", "ventricle_body_left", "ventricle_temporal_horn_left",
                         "ventricle_trigone_left", "ventricle_frontal_horn_right", "ventricle_occipital_horn_right", "ventricle_body_right",
                         "ventricle_temporal_horn_right", "ventricle_trigone_right", "third_ventricle", "fourth_ventricle"]):
    X_ID[_n] = 201 + _k
X_ID.update({"pleural_effusion_left": 220, "pleural_effusion_right": 221, "pericardial_effusion": 222, "lung_nodules": 223,
             "liver_lesions": 224, "kidney_cyst_left": 225, "kidney_cyst_right": 226})
COMPITI = {"brain": ["cerebral_bleed", "ventricle_parts"], "lung": ["pleural_pericard_effusion", "lung_nodules"],
           "liver": ["liver_segments", "liver_lesions"], "kidney": ["kidney_cysts"], "L3": ["abdominal_muscles"],
           "heart": ["total_v1"]}   # total_v1 (gratuito) ha ancora le cavità cardiache: rapporto VD/VS


def componenti(m, sp, min_mm3=0):
    """Componenti connesse di una maschera (strato, riga, colonna): volume, diametro massimo nel piano, ABC/2."""
    import numpy as np
    from scipy import ndimage
    lab, n = ndimage.label(m)
    out = []
    vox = sp[0] * sp[1] * sp[2]
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        c = lab[sl] == k
        v = float(c.sum() * vox)
        if v < min_mm3:
            continue
        # strato con l'area più grande: asse lungo (A) e perpendicolare (B); C = estensione cranio-caudale
        aree = c.sum(axis=(1, 2)); z = int(aree.argmax())
        yy, xx = np.nonzero(c[z])
        pts = np.stack([xx * sp[0], yy * sp[1]], 1)
        if len(pts) > 400:
            pts = pts[np.linspace(0, len(pts) - 1, 400).astype(int)]
        d2 = ((pts[:, None, :] - pts[None, :, :]) ** 2).sum(-1); i, j = np.unravel_index(d2.argmax(), d2.shape)
        A = float(np.sqrt(d2[i, j])) + sp[0]
        u = (pts[j] - pts[i]) / max(1e-6, np.linalg.norm(pts[j] - pts[i])); w = np.array([-u[1], u[0]])
        B = float((pts @ w).max() - (pts @ w).min()) + sp[0]
        C = float((aree > 0).sum() * sp[2])
        zc, yc, xc = ndimage.center_of_mass(c)
        out.append({"volume_mm3": round(v, 1), "A": round(A, 1), "B": round(B, 1), "C": round(C, 1),
                    "centro_vox": [float(xc + sl[2].start), float(yc + sl[1].start), float(zc + sl[0].start)]})
    return sorted(out, key=lambda x: -x["volume_mm3"])


def extra(id_caso, i, s, device, rifai=False):
    import numpy as np, SimpleITK as sitk
    from scipy import ndimage
    from totalsegmentator.python_api import totalsegmentator
    from totalsegmentator.map_to_binary import class_map
    cartella = s["files"][0].split("/")[1]
    dest = os.path.join(CASI, id_caso, "ia")
    pj, pl, px = (os.path.join(dest, cartella + e) for e in (".json", ".lab.gz", ".x.gz"))
    if not os.path.exists(pj):
        return False
    geo = json.load(open(pj))
    W, H, N = geo["dim"]
    lab = np.frombuffer(gzip.open(pl).read(), dtype=np.uint8).reshape(N, H, W)
    inv = {v: int(k) for k, v in geo["etichette"].items()}
    vox_lab = lambda nome: (lab == inv[nome]).sum() if nome in inv else 0
    compiti = []
    if vox_lab("brain") > 2000: compiti += COMPITI["brain"]
    if sum(vox_lab(n) for n in inv if n.startswith("lung_")) > 2000: compiti += COMPITI["lung"]
    if vox_lab("liver") > 2000: compiti += COMPITI["liver"]
    if vox_lab("kidney_left") + vox_lab("kidney_right") > 500: compiti += COMPITI["kidney"]
    if vox_lab("vertebrae_L3") > 100: compiti += COMPITI["L3"]
    fatti = {} if rifai else dict(geo.get("analisi", {}).get("_compiti", {}))
    compiti = [c for c in compiti if c not in fatti]
    if not compiti:
        return False
    img, motivo = volume(id_caso, s)
    if img is None:
        print(f"  serie {i}: saltata, {motivo}")
        return False
    ct = sitk.GetArrayFromImage(img).astype(np.int16)
    sp = list(img.GetSpacing())                       # (colonna, riga, strato) in mm
    xl = np.frombuffer(gzip.open(px).read(), dtype=np.uint8).reshape(N, H, W).copy() if os.path.exists(px) and not rifai else np.zeros((N, H, W), np.uint8)
    an = {} if rifai else dict(geo.get("analisi", {}))
    t = time.time()

    def metti(m, nome):
        xl[m[:, ::2, ::2]] = X_ID[nome]

    def lato_da_lab(m, sx_nomi, dx_nomi):
        """divide una maschera tra sinistra e destra: in ogni strato, la linea a metà tra i centri dei due polmoni
        (etichette ridotte; niente mappe di distanza a piena risoluzione, che occupano gigabyte di memoria)"""
        sx = np.isin(lab, [inv[n] for n in sx_nomi if n in inv]); dx = np.isin(lab, [inv[n] for n in dx_nomi if n in inv])
        if not sx.any() or not dx.any():
            return m, np.zeros_like(m)
        xs = np.arange(lab.shape[2]); conta_s = sx.sum(axis=1); conta_d = dx.sum(axis=1)       # (strato, colonna)
        ms, md = (conta_s * xs).sum(1), (conta_d * xs).sum(1); ns, nd = conta_s.sum(1), conta_d.sum(1)
        ok = (ns > 0) & (nd > 0)
        if not ok.any():
            return m, np.zeros_like(m)
        cs = np.where(ns > 0, ms / np.maximum(ns, 1), np.nan); cd = np.where(nd > 0, md / np.maximum(nd, 1), np.nan)
        zz = np.arange(lab.shape[0]); mid = np.interp(zz, zz[ok], ((cs + cd) / 2)[ok]) * 2          # colonna a piena risoluzione
        sinistra_maggiore = np.nanmean(cs - cd) > 0
        X = np.arange(m.shape[2])[None, None, :]
        lato_s = (X > mid[:m.shape[0], None, None]) if sinistra_maggiore else (X < mid[:m.shape[0], None, None])
        return m & lato_s, m & ~lato_s

    with tempfile.TemporaryDirectory(dir=os.path.expanduser("~/.radioquiz-ia")) as tmp:
        ing = os.path.join(tmp, "ct.nii.gz"); sitk.WriteImage(img, ing)
        for compito in compiti:
            usc = os.path.join(tmp, compito + ".nii.gz")
            t1 = time.time()
            print(f"    {id_caso} serie {i}: {compito}…", flush=True)
            # muscoli: solo una fetta di volume attorno a L3 (il modello ad alta risoluzione su tutto il tronco
            # richiede troppa memoria); il risultato torna nella sua posizione nel volume intero
            ing_c, z0 = ing, 0
            if compito == "abdominal_muscles":
                zl = np.nonzero((lab == inv["vertebrae_L3"]).any(axis=(1, 2)))[0]
                zc = int(round(zl.mean())); k = int(np.ceil(25 / sp[2]))
                z0, z1 = max(0, zc - k), min(N, zc + k + 1)
                ing_c = os.path.join(tmp, "ct_l3.nii.gz"); sitk.WriteImage(img[:, :, z0:z1], ing_c)
            try:
                # un solo processo di ricampionamento e salvataggio: meno memoria (il Mac ha 16 GB e altro aperto)
                totalsegmentator(ing_c, usc, task=compito, ml=True, device=device, quiet=True, nr_thr_resamp=1, nr_thr_saving=1,
                                 **({"fast": True} if compito == "total_v1" else {}))
            except Exception as e:
                print(f"  serie {i}: {compito} non riuscito ({str(e)[:200]})"); continue
            a = sitk.GetArrayFromImage(sitk.ReadImage(usc)).astype(np.uint8)
            if ing_c != ing:
                pieno = np.zeros(ct.shape, np.uint8); pieno[z0:z0 + a.shape[0]] = a; a = pieno
            if a.shape != ct.shape:
                print(f"  serie {i}: {compito}, geometria diversa: saltato"); continue
            cm = {v: k for k, v in class_map[compito].items()}
            ml = lambda m: round(float(m.sum()) * sp[0] * sp[1] * sp[2] / 1000, 2)
            if compito == "cerebral_bleed":
                m = a == cm["intracerebral_hemorrhage"]; metti(m, "intracerebral_hemorrhage")
                comp = componenti(m, sp, 20)
                an["emorragia"] = {"volume_ml": ml(m), "componenti": [{**c, "abc2_ml": round(c["A"] * c["B"] * c["C"] / 2 / 1000, 2)} for c in comp[:5]]}
            elif compito == "ventricle_parts":
                v = {}
                for nome in class_map[compito].values():
                    m = a == cm[nome]
                    if m.any(): metti(m, nome); v[nome] = ml(m)
                lat = lambda s_: round(sum(x for k, x in v.items() if k.startswith("ventricle_") and k.endswith(s_)), 2)
                r = {"totale_ml": round(sum(v.values()), 2), "laterale_sx_ml": lat("_left"), "laterale_dx_ml": lat("_right"),
                     "terzo_ml": v.get("third_ventricle", 0), "quarto_ml": v.get("fourth_ventricle", 0)}
                # indice di Evans: larghezza massima dei corni frontali / diametro interno massimo del cranio nello stesso strato
                fh = (a == cm["ventricle_frontal_horn_left"]) | (a == cm["ventricle_frontal_horn_right"])
                cervello = np.repeat(np.repeat(lab == inv.get("brain", -1), 2, 1), 2, 2)[:, :H * 2, :W * 2][:, :a.shape[1], :a.shape[2]]
                best = None
                for z in np.nonzero(fh.any(axis=(1, 2)))[0]:
                    xs = np.nonzero(fh[z].any(0))[0]; xb = np.nonzero(cervello[z].any(0))[0] if z < cervello.shape[0] else []
                    if len(xs) and len(xb):
                        fw = (xs.max() - xs.min() + 1) * sp[0]; bw = (xb.max() - xb.min() + 1) * sp[0]
                        if best is None or fw > best[0]: best = (fw, bw, int(z))
                if best:
                    r.update({"evans": round(best[0] / best[1], 3), "corni_frontali_mm": round(best[0], 1), "cranio_mm": round(best[1], 1), "evans_strato": best[2]})
                # spostamento della linea mediana: setto pellucido (tra i corni frontali) rispetto alla linea tra il polo
                # anteriore e posteriore della cavità cranica, nello strato con i corni frontali più ampi
                sxh, dxh = a == cm["ventricle_frontal_horn_left"], a == cm["ventricle_frontal_horn_right"]
                zz = [z for z in range(a.shape[0]) if sxh[z].any() and dxh[z].any() and z < cervello.shape[0] and cervello[z].any()]
                if zz:
                    z = max(zz, key=lambda q: sxh[q].sum() + dxh[q].sum())
                    righe = [y for y in range(a.shape[1]) if sxh[z, y].any() and dxh[z, y].any()]
                    setti = []
                    for y in righe:
                        xs_, xd_ = np.nonzero(sxh[z, y])[0], np.nonzero(dxh[z, y])[0]
                        # nelle immagini LPS la sinistra del paziente ha x maggiore: il bordo mediale del sinistro è il suo minimo
                        if xs_.mean() > xd_.mean(): setti.append(((xs_.min() + xd_.max()) / 2, y))
                        else: setti.append(((xs_.max() + xd_.min()) / 2, y))
                    if setti:
                        xsep = float(np.median([q[0] for q in setti])); ysep = float(np.median([q[1] for q in setti]))
                        # linea mediana ideale: per i righi del 5-15% anteriore e dell'85-95% posteriore della cavità, il punto
                        # medio tra il bordo destro e sinistro; la linea passa per le due medie (tiene conto della testa ruotata)
                        cb = cervello[z]; ys = np.nonzero(cb.any(1))[0]; est = ys.max() - ys.min()
                        def medio(r0, r1):
                            pts = [((np.nonzero(cb[y])[0].min() + np.nonzero(cb[y])[0].max()) / 2, y) for y in range(int(r0), int(r1) + 1) if cb[y].any()]
                            return np.mean([q[0] for q in pts]), np.mean([q[1] for q in pts])
                        xa, ya = medio(ys.min() + 0.05 * est, ys.min() + 0.15 * est); xp, yp = medio(ys.min() + 0.85 * est, ys.min() + 0.95 * est)
                        xlinea = xa + (xp - xa) * (ysep - ya) / max(1, yp - ya)
                        r.update({"mls_mm": round(abs(xsep - xlinea) * sp[0], 1), "mls_verso": "verso sinistra" if xsep > xlinea else "verso destra", "mls_strato": int(z)})
                an["ventricoli"] = r
            elif compito == "pleural_pericard_effusion":
                pe = a == cm["pleural_effusion"]
                sxm, dxm = lato_da_lab(pe, [n for n in inv if n.startswith("lung_") and n.endswith("_left")], [n for n in inv if n.startswith("lung_") and n.endswith("_right")])
                metti(sxm, "pleural_effusion_left"); metti(dxm, "pleural_effusion_right")
                pc = a == cm["pericardial_effusion"]; metti(pc, "pericardial_effusion")
                an["versamenti"] = {"pleurico_sx_ml": ml(sxm), "pleurico_dx_ml": ml(dxm), "pericardico_ml": ml(pc)}
            elif compito == "lung_nodules":
                m = a == cm["lung_nodules"]; metti(m, "lung_nodules")
                an["noduli"] = [{**c, "diametro_medio_mm": round((c["A"] + c["B"]) / 2, 1)} for c in componenti(m, sp, 8)[:20]]
            elif compito == "liver_segments":
                seg = {str(k): ml(a == k) for k in range(1, 9)}
                an["fegato_segmenti"] = {"segmenti_ml": seg, "totale_ml": round(sum(seg.values()), 1)}
                an["_segmenti_vox"] = None
                segm = a.copy()
            elif compito == "liver_lesions":
                m = a == cm["liver_lesions"]; metti(m, "liver_lesions")
                comp = componenti(m, sp, 30)[:15]
                if "segm" in locals():
                    for c in comp:
                        x, y, z = (int(round(q)) for q in c["centro_vox"]); c["segmento"] = int(segm[min(z, N - 1), min(y, segm.shape[1] - 1), min(x, segm.shape[2] - 1)])
                # le lesioni con il centro fuori dai segmenti epatici non sono del fegato (per es. una massa renale vicina)
                an["lesioni_fegato"] = [c for c in comp if c.get("segmento", 1) > 0] if "segm" in locals() else comp
            elif compito == "kidney_cysts":
                cc = []
                for nome, lato in (("kidney_cyst_left", "sx"), ("kidney_cyst_right", "dx")):
                    m = a == cm[nome]; metti(m, nome)
                    cc += [{**c, "lato": lato} for c in componenti(m, sp, 30)[:10]]
                an["cisti_renali"] = sorted(cc, key=lambda c: -c["volume_mm3"])
            elif compito == "total_v1":
                # rapporto VD/VS: diametro trasverso massimo delle due cavità nei piani assiali (come al tavolo di refertazione)
                def dmax(m):
                    best = 0.0
                    for z in np.nonzero(m.any(axis=(1, 2)))[0]:
                        xs = np.nonzero(m[z].any(0))[0]; ys = np.nonzero(m[z].any(1))[0]
                        yy, xx = np.nonzero(m[z]); pts = np.stack([xx * sp[0], yy * sp[1]], 1)
                        if len(pts) > 300: pts = pts[np.linspace(0, len(pts) - 1, 300).astype(int)]
                        d = float(np.sqrt(((pts[:, None] - pts[None]) ** 2).sum(-1).max())) if len(pts) > 1 else 0
                        best = max(best, d)
                    return best
                vd, vs = a == cm["heart_ventricle_right"], a == cm["heart_ventricle_left"]
                if vd.any() and vs.any():
                    dvd, dvs = dmax(vd), dmax(vs)
                    an["cuore"] = {"vd_mm": round(dvd, 1), "vs_mm": round(dvs, 1), "vd_vs": round(dvd / dvs, 2) if dvs else None,
                                   "vd_ml": ml(vd), "vs_ml": ml(vs), "vd_vs_volume": round(ml(vd) / ml(vs), 2) if ml(vs) else None}
            elif compito == "abdominal_muscles":
                # strato centrale di L3 (etichette ridotte → strato pieno, stessa z)
                l3 = lab == inv["vertebrae_L3"]; zs = np.nonzero(l3.any(axis=(1, 2)))[0]
                z = int(round(ndimage.center_of_mass(l3)[0]))
                mus = (a[z] > 0) & (ct[z] >= -29) & (ct[z] <= 150)
                area = lambda m2: round(float(m2.sum()) * sp[0] * sp[1] / 100, 1)
                corpo = ndimage.binary_fill_holes(ct[z] > -500)
                grasso = corpo & (ct[z] >= -190) & (ct[z] <= -30)
                # viscerale = grasso dentro l'involucro convesso dei muscoli del tronco (la parete non è un anello chiuso:
                # la linea alba e le fasce non sono segmentate); sottocutaneo = grasso fuori dall'involucro
                from skimage.morphology import convex_hull_image
                parete = a[z] > 0
                dentro = convex_hull_image(parete) & ~parete if parete.any() else np.zeros_like(parete)
                an["l3"] = {"strato": z, "sma_cm2": area(mus), "muscolo_hu": round(float(ct[z][mus].mean()), 1) if mus.any() else None,
                            "vat_cm2": area(grasso & dentro), "sat_cm2": area(grasso & ~dentro & ~parete)}
            fatti[compito] = round(time.time() - t1)
    an.pop("_segmenti_vox", None)
    an["_compiti"] = fatti
    geo["analisi"] = an
    geo["etichette_x"] = {str(k): n for n, k in X_ID.items() if (xl == k).any()}
    with gzip.open(px, "wb", compresslevel=9) as f:
        f.write(np.ascontiguousarray(xl).tobytes())
    json.dump(geo, open(pj, "w"), ensure_ascii=False)
    print(f"  serie {i} ({s['descrizione']}): {', '.join(f'{c} {fatti.get(c, "?")} s' for c in compiti)} (totale {time.time() - t:.0f} s)")
    verifica(id_caso)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("caso", nargs="?")
    ap.add_argument("--serie", type=int, action="append")
    ap.add_argument("--tutti", action="store_true")
    ap.add_argument("--rifai", action="store_true", help="rifà anche le serie già segmentate")
    ap.add_argument("--device", default=None, help="mps (GPU del Mac) o cpu")
    ap.add_argument("--extra", action="store_true", help="aggiunge emorragia e ventricoli (encefalo) o versamenti (torace) alle serie già segmentate")
    a = ap.parse_args()
    # niente statistiche d'uso inviate da TotalSegmentator
    cfg = os.path.expanduser("~/.totalsegmentator/config.json")
    try:
        c = json.load(open(cfg)) if os.path.exists(cfg) else {}
        if c.get("send_usage_stats", True):
            c["send_usage_stats"] = False; os.makedirs(os.path.dirname(cfg), exist_ok=True); json.dump(c, open(cfg, "w"), indent=2)
    except Exception:
        pass
    import torch
    device = a.device or ("mps" if torch.backends.mps.is_available() else "cpu")
    casi = sorted(d for d in os.listdir(CASI) if d.startswith("caso-")) if a.tutti else [a.caso]
    if not casi or not casi[0]:
        ap.print_help(); sys.exit(1)
    if a.extra:
        import re
        for c in casi:
            scelte = {}
            # una serie per esame (le analisi sono dell'esame): la più fine tra quelle non ricostruite per l'osso
            for i, s in serie_adatte(c):
                if a.serie and i not in a.serie:
                    continue
                m = re.match(r"Studio (\d+)", s.get("descrizione", "")); chiave = (m.group(1) if m else "1", s.get("regione", ""))
                osso = bool(re.search(r"oss[oa]|bone|teca|polmon|lung|parenchima|\b[bhi]([6-9]\d)[fs]?\b", s.get("descrizione", ""), re.I))
                punti = (0 if osso else 1, len(s.get("files", [])))
                if a.serie or chiave not in scelte or punti > scelte[chiave][0]:
                    scelte[chiave if not a.serie else (chiave, i)] = (punti, i, s)
            for _, i, s in scelte.values():
                for dev in ([device, "cpu"] if device == "mps" else [device]):
                    try:
                        extra(c, i, s, dev, rifai=a.rifai); break
                    except OSError as e:
                        if e.errno == 28:
                            sys.exit("Disco pieno: libera spazio sul Mac e rilancia.")
                        print(f"  {c} serie {i}: errore ({e})")
                    except Exception as e:
                        print(f"  {c} serie {i}: errore{' con la GPU, riprovo sulla CPU' if dev == 'mps' else ''} ({e})")
        return
    for c in casi:
        sel = [(i, s) for i, s in serie_adatte(c) if not a.serie or i in a.serie]
        if not a.rifai:
            sel = [(i, s) for i, s in sel if not os.path.exists(os.path.join(CASI, c, "ia", s["files"][0].split("/")[1] + ".json"))]
        if not sel:
            continue
        print(f"{c}: {len(sel)} serie TC")
        for i, s in sel:
            for dev in ([device, "cpu"] if device == "mps" else [device]):
                try:
                    segmenta(c, i, s, dev)
                    break
                except OSError as e:
                    if e.errno == 28:
                        sys.exit("Disco pieno: libera spazio sul Mac e rilancia (le serie già fatte non si rifanno).")
                    print(f"  serie {i}: errore ({e})")
                except Exception as e:
                    print(f"  serie {i}: errore{' con la GPU, riprovo sulla CPU' if dev == 'mps' else ''} ({e})")


if __name__ == "__main__":
    main()
