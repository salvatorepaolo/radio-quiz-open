#!/usr/bin/env python3
"""
radio-quiz — analisi 3D di una TC (solo strumenti open source).

Uso:
  analizza_tc.py <cartella_serie_DICOM> <cartella_uscita> [--modo torace|vasi|entrambi]
                 [--fast] [--device cpu|mps|gpu] [--senza-monai]

Cosa fa
  1. legge la serie DICOM (SimpleITK) e la salva come ct.nii.gz
  2. TotalSegmentator, task base «total» (Apache 2.0):
       torace -> 5 lobi polmonari (+ coste/vertebre per il contesto)
       vasi   -> aorta, iliache, reni, cuore, coste, vertebre, bacino
  3. noduli (solo torace):
       modello A = MONAI lung_nodule_ct_detection (RetinaNet, LUNA16, Apache 2.0)
       modello B = filtro di Hessian «dot enhancement» (classico, nessun peso)
       consenso: un nodulo trovato da entrambi = «entrambi», altrimenti il nome del modello
  4. per ogni nodulo: segmentazione locale, volume, diametro medio (asse lungo e corto
     sull'assiale di area massima, come Lung-RADS), densità, tipo (solido /
     parzialmente solido / vetro smerigliato), lobo, Lung-RADS v2022 al primo esame
  5. mesh .glb (lobi, noduli, vasi, ossa) per il riquadro 3D e risultati.json per la piattaforma
  6. anteprima.png per il controllo da parte del revisore

Nessun dato esce dal computer. I risultati sono una «seconda lettura» didattica,
non una diagnosi: il revisore indipendente li controlla come ogni altro caso.
"""
import argparse, json, os, sys, glob, math, time
import numpy as np

# ---------------------------------------------------------------- costanti
LOBI = {
    "lung_upper_lobe_right":  ("superiore destro", (0.80, 0.45, 0.35)),
    "lung_middle_lobe_right": ("medio",            (0.90, 0.65, 0.45)),
    "lung_lower_lobe_right":  ("inferiore destro", (0.75, 0.55, 0.50)),
    "lung_upper_lobe_left":   ("superiore sinistro", (0.55, 0.65, 0.85)),
    "lung_lower_lobe_left":   ("inferiore sinistro", (0.45, 0.55, 0.80)),
}
VASI = {  # nome TotalSegmentator -> (etichetta, colore RGB 0-1, opacità)
    "aorta": ("aorta", (0.95, 0.80, 0.78), 1.0),
    "iliac_artery_left": ("iliaca sinistra", (0.95, 0.75, 0.72), 1.0),
    "iliac_artery_right": ("iliaca destra", (0.95, 0.75, 0.72), 1.0),
    "kidney_left": ("rene sinistro", (0.85, 0.15, 0.10), 1.0),
    "kidney_right": ("rene destro", (0.85, 0.15, 0.10), 1.0),
    "heart": ("cuore", (0.75, 0.25, 0.20), 0.6),
    "pulmonary_vein": ("vene polmonari", (0.70, 0.30, 0.30), 1.0),
    "brachiocephalic_trunk": ("tronco brachiocefalico", (0.95, 0.80, 0.78), 1.0),
    "subclavian_artery_left": ("succlavia sinistra", (0.95, 0.80, 0.78), 1.0),
    "subclavian_artery_right": ("succlavia destra", (0.95, 0.80, 0.78), 1.0),
    "common_carotid_artery_left": ("carotide comune sinistra", (0.95, 0.80, 0.78), 1.0),
    "common_carotid_artery_right": ("carotide comune destra", (0.95, 0.80, 0.78), 1.0),
}
# strutture con mdc da togliere dall'albero arterioso (vene, vescica con mdc escreto)
ESCLUSI_ALBERO = ["superior_vena_cava", "inferior_vena_cava", "brachiocephalic_vein_left",
                  "brachiocephalic_vein_right", "portal_vein_and_splenic_vein", "iliac_vena_left",
                  "iliac_vena_right", "urinary_bladder", "atrial_appendage_left"]
OSSA_PREFISSI = ("rib_", "vertebrae_", "sternum", "hip_", "sacrum", "femur_",
                 "clavicula_", "scapula_", "humerus_", "costal_cartilages")
COLORE_OSSO = (0.72, 0.72, 0.70)
# nodulo «solido» se il diametro della parte > -300 HU è almeno questa frazione del totale
SOGLIA_SOLIDO = 0.65


# ---------------------------------------------------------------- lettura
def leggi_serie(cartella):
    import SimpleITK as sitk
    r = sitk.ImageSeriesReader()
    ids = r.GetGDCMSeriesIDs(cartella)
    if not ids:
        raise SystemExit(f"Nessuna serie DICOM in {cartella}")
    # la serie con più file
    ids = sorted(ids, key=lambda s: len(r.GetGDCMSeriesFileNames(cartella, s)), reverse=True)
    files = r.GetGDCMSeriesFileNames(cartella, ids[0])
    r.SetFileNames(files)
    img = r.Execute()
    return img, list(files)


def sop_uid(path):
    try:
        import pydicom
        return str(pydicom.dcmread(path, stop_before_pixels=True).SOPInstanceUID)
    except Exception:
        return None


# ---------------------------------------------------------------- TotalSegmentator
def totalseg(ct_nii, out_dir, roi, fast, device):
    from totalsegmentator.python_api import totalsegmentator
    os.makedirs(out_dir, exist_ok=True)
    mancano = [n for n in roi if not os.path.exists(os.path.join(out_dir, n + ".nii.gz"))]
    if mancano:
        totalsegmentator(ct_nii, out_dir, roi_subset=roi, fast=fast, device=device, quiet=True)
    return out_dir


def totalseg_noduli(ct_nii, out_dir, device):
    """Task «lung_nodules» di TotalSegmentator (nnU-Net, senza licenza commerciale richiesta)."""
    from totalsegmentator.python_api import totalsegmentator
    d = os.path.join(out_dir, "noduli_ts")
    p = os.path.join(d, "lung_nodules.nii.gz")
    if not os.path.exists(p):
        os.makedirs(d, exist_ok=True)
        totalsegmentator(ct_nii, d, task="lung_nodules", device=device, quiet=True)
    return p


def componenti(m, sp, d_min=2.5):
    """Componenti connesse di una maschera -> [(centro zyx, diametro equivalente mm, 1.0, maschera ritagliata, slice)]."""
    from scipy import ndimage as ndi
    lab, n = ndi.label(m)
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None: continue
        sub = lab[sl] == i
        vol = sub.sum() * float(np.prod(sp))
        d = 2 * (3 * vol / (4 * math.pi)) ** (1 / 3)
        if d < d_min: continue
        c = np.round(ndi.center_of_mass(sub)).astype(int) + np.array([x.start for x in sl])
        # un po' di margine attorno al nodulo per le misure
        pad = np.ceil(5 / np.array(sp)).astype(int)
        sl2 = tuple(slice(max(0, x.start - p), min(N, x.stop + p)) for x, p, N in zip(sl, pad, m.shape))
        out.append((tuple(int(v) for v in c), float(d), 1.0, (lab[sl2] == i), sl2))
    return out


def carica_maschera(path, rif):
    """Maschera NIfTI riportata sulla griglia dell'immagine di riferimento (array z,y,x)."""
    import SimpleITK as sitk
    m = sitk.ReadImage(path)
    m = sitk.Resample(m, rif, sitk.Transform(), sitk.sitkNearestNeighbor, 0, sitk.sitkUInt8)
    return sitk.GetArrayFromImage(m) > 0


# ---------------------------------------------------------------- modello A: MONAI
def noduli_monai(ct_nii, cartella_bundle, device):
    """Restituisce [(centro_LPS_mm (x,y,z), diametro_box_mm, score)]."""
    import torch
    from monai.bundle import ConfigParser, download
    from monai.transforms import (Compose, LoadImaged, EnsureChannelFirstd, Orientationd,
                                  Spacingd, ScaleIntensityRanged, EnsureTyped)
    nome = "lung_nodule_ct_detection"
    radice = os.path.join(cartella_bundle, nome)
    if not os.path.isdir(radice):
        download(name=nome, bundle_dir=cartella_bundle)
    cp = ConfigParser()
    cp.read_config(os.path.join(radice, "configs", "inference.json"))
    cp["bundle_root"] = radice
    dev = torch.device("cuda" if device == "gpu" else ("mps" if device == "mps" else "cpu"))
    # la RetinaNet 3D usa operazioni non tutte supportate da MPS: CPU è più sicuro
    if dev.type == "mps":
        dev = torch.device("cpu")
    cp["device"] = f"$torch.device('{dev.type}')"
    rete = cp.get_parsed_content("network_def")
    pesi = os.path.join(radice, "models", "model.pt")
    stato = torch.load(pesi, map_location=dev)
    if isinstance(stato, dict) and "model" in stato:
        stato = stato["model"]
    rete.load_state_dict(stato)
    rete.to(dev).eval()
    det = cp.get_parsed_content("detector")
    det.network = rete
    try:
        det.set_box_selector_parameters(score_thresh=0.05, topk_candidates_per_level=1000,
                                        nms_thresh=0.22, detections_per_img=100)
    except Exception:
        pass
    try:
        # finestre piccole: con [512,512,192] un Mac da 16 GB va in swap
        det.set_sliding_window_inferer(roi_size=[192, 192, 80], overlap=0.25,
                                       sw_batch_size=1, mode="constant", device="cpu")
    except Exception:
        pass
    sp = (0.703125, 0.703125, 1.25)
    pre = Compose([
        LoadImaged(keys="image", image_only=False),
        EnsureChannelFirstd(keys="image"),
        Orientationd(keys="image", axcodes="RAS"),
        Spacingd(keys="image", pixdim=sp, mode="bilinear"),
        ScaleIntensityRanged(keys="image", a_min=-1024.0, a_max=300.0, b_min=0.0, b_max=1.0, clip=True),
        EnsureTyped(keys="image"),
    ])
    d = pre({"image": ct_nii})
    x = d["image"]
    aff = np.asarray(x.affine)  # voxel -> RAS mm
    det.eval()
    with torch.no_grad():
        out = det([x.to(dev)], use_inferer=True)[0]
    chiavi = list(out.keys())
    kb = [k for k in chiavi if "box" in k][0]
    ks = [k for k in chiavi if "score" in k][0]
    boxes = out[kb].cpu().numpy()  # xyzxyz in voxel (immagine ricampionata)
    scores = out[ks].cpu().numpy()
    ris = []
    for b, s in zip(boxes, scores):
        c_vox = np.array([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2, 1.0])
        c_ras = aff @ c_vox
        c_lps = (-c_ras[0], -c_ras[1], c_ras[2])
        dim = np.array([b[3] - b[0], b[4] - b[1], b[5] - b[2]]) * np.array(sp)
        ris.append((c_lps, float(np.mean(dim)), float(s)))
    return ris


# ---------------------------------------------------------------- modello B: Hessian
def noduli_hessian(hu, spacing_zyx, polmoni, diam_min=4.0, diam_max=30.0, soglia=0.10):
    """Filtro «dot enhancement» (Li et al. 2003) multiscala dentro i polmoni.
    Restituisce [(indice zyx, diametro stimato mm, score 0-1)]."""
    from scipy import ndimage as ndi
    # per la memoria: ritaglio sui polmoni e griglia di ~1 mm
    zs, ys, xs = [np.where(polmoni.any(axis=ax))[0] for ax in [(1, 2), (0, 2), (0, 1)]]
    if len(zs) == 0:
        return []
    lo = np.array([zs[0], ys[0], xs[0]]); hi = np.array([zs[-1], ys[-1], xs[-1]]) + 1
    sp0 = np.array(spacing_zyx, float)
    f = np.minimum(1.0, sp0 / 1.0)  # fattore di riduzione per asse
    sub = hu[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]].astype(np.float32)
    pm = polmoni[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    if np.any(f < 0.99):
        sub = ndi.zoom(sub, f, order=1)
        pm = ndi.zoom(pm.astype(np.uint8), f, order=0) > 0
    sp_r = sp0 / f
    ris_r = _hessian_griglia(sub, sp_r, pm, diam_min, diam_max, soglia)
    ris = []
    for (z, y, x), d, s in ris_r:
        i = np.round(np.array([z, y, x]) / f).astype(int) + lo
        i = np.minimum(i, np.array(hu.shape) - 1)
        ris.append((tuple(int(v) for v in i), d, s))
    return ris


def _hessian_griglia(hu, sp, polmoni, diam_min, diam_max, soglia):
    from scipy import ndimage as ndi
    sp = np.array(sp, float)
    img = np.clip(hu.astype(np.float32), -1000, 200)
    img = (img + 1000) / 1200.0
    best = np.zeros_like(img)
    best_s = np.zeros_like(img)
    sigmas = np.geomspace(diam_min / 2 / math.sqrt(3), diam_max / 2 / math.sqrt(3), 6)  # mm
    for s in sigmas:
        sv = s / sp
        g = lambda o: ndi.gaussian_filter(img, sv, order=o)
        Hzz, Hyy, Hxx = g((2, 0, 0)), g((0, 2, 0)), g((0, 0, 2))
        Hzy, Hzx, Hyx = g((1, 1, 0)), g((1, 0, 1)), g((0, 1, 1))
        H = np.stack([np.stack([Hzz, Hzy, Hzx], -1),
                      np.stack([Hzy, Hyy, Hyx], -1),
                      np.stack([Hzx, Hyx, Hxx], -1)], -2)
        del Hzz, Hyy, Hxx, Hzy, Hzx, Hyx
        ev = np.linalg.eigvalsh(H)  # crescenti: l1 <= l2 <= l3
        del H
        l3 = ev[..., 2]
        l1 = ev[..., 0]
        # blob chiaro: tutti gli autovalori negativi; risposta = |l3|^2/|l1| * s^2
        risp = np.where(l3 < 0, (l3 ** 2) / np.maximum(np.abs(l1), 1e-6), 0) * (s ** 2)
        del ev
        m = risp > best
        best[m] = risp[m]
        best_s[m] = s
    best[~polmoni] = 0
    if best.max() <= 0:
        return []
    best /= np.percentile(best[polmoni], 99.99) + 1e-9
    # massimi locali
    mx = ndi.maximum_filter(best, size=tuple(np.maximum(1, np.round(4.0 / sp)).astype(int)))
    pic = (best == mx) & (best > soglia) & (hu > -750)
    ris = []
    for z, y, x in np.argwhere(pic):
        d = 2 * math.sqrt(3) * best_s[z, y, x]
        ris.append(((int(z), int(y), int(x)), float(d), float(min(1.0, best[z, y, x]))))
    ris.sort(key=lambda r: -r[2])
    return ris[:200]


# ---------------------------------------------------------------- misure
def segmenta_nodulo(hu, sp, c, polmoni_dil, soglia=None, raggio_mm=20):
    """Regione connessa al seme sopra soglia, in un cubo attorno al centro.
    Taglia i vasi con un'apertura morfologica."""
    from scipy import ndimage as ndi
    r = np.ceil(raggio_mm / np.array(sp)).astype(int)
    lo = np.maximum(np.array(c) - r, 0)
    hi = np.minimum(np.array(c) + r + 1, hu.shape)
    sl = tuple(slice(a, b) for a, b in zip(lo, hi))
    sub = ndi.gaussian_filter(hu[sl].astype(np.float32), 0.6 / np.array(sp))
    if soglia is None:
        # soglia adattiva: a metà tra parenchima e nodulo, mai sopra -650 HU
        # (così il vetro smerigliato attorno a una parte solida resta nel nodulo)
        pm = polmoni_dil[sl]
        bg = float(np.median(sub[pm])) if pm.any() else -850.0
        cc0 = tuple(np.array(c) - lo)
        r1 = tuple(slice(max(0, k - 1), k + 2) for k in cc0)
        picco = float(sub[r1].max())
        soglia = min(-650.0, bg + 0.5 * (picco - bg))
    m = (sub > soglia) & polmoni_dil[sl]
    # apertura con sfera di ~1,5 mm: stacca i vasi sottili
    rr = np.maximum(1, np.round(1.5 / np.array(sp))).astype(int)
    zz, yy, xx = np.ogrid[-rr[0]:rr[0] + 1, -rr[1]:rr[1] + 1, -rr[2]:rr[2] + 1]
    ball = (zz / max(rr[0], 1)) ** 2 + (yy / max(rr[1], 1)) ** 2 + (xx / max(rr[2], 1)) ** 2 <= 1
    m2 = ndi.binary_opening(m, ball)
    if m2.sum() >= 5:
        m = m2
    lab, n = ndi.label(m)
    cc = tuple(np.array(c) - lo)
    v = lab[cc]
    if v == 0:  # seme fuori: prendo la componente più vicina
        if n == 0:
            return None, sl
        dist = ndi.distance_transform_edt(lab == 0, return_indices=True)[1]
        v = lab[tuple(dist[:, cc[0], cc[1], cc[2]])]
    nod = lab == v
    # nodulo che tocca il bordo del cubo = probabilmente vaso/parete: segnalo
    return nod, sl


def espandi_vetro(hu, sp, nod, sl, polmoni_dil, raggio_mm=20, delta_hu=150, min_alone_mm=4.0):
    """Aggiunge al nodulo del modello l'alone a vetro smerigliato connesso.
    Il modello nnU-Net tende a segmentare solo la parte densa dei parzialmente solidi.
    Soglia = parenchima locale + delta_hu, sull'immagine lisciata; i vasi sottili sono
    staccati con un'apertura; se l'alone «esplode» (fuga nei vasi) si tiene il modello."""
    from scipy import ndimage as ndi
    spa = np.array(sp, float)
    c = np.round(ndi.center_of_mass(nod)).astype(int) + np.array([x.start for x in sl])
    r = np.ceil(raggio_mm / spa).astype(int)
    lo = np.maximum(c - r, 0); hi = np.minimum(c + r + 1, hu.shape)
    sl2 = tuple(slice(int(a), int(b)) for a, b in zip(lo, hi))
    sm = ndi.gaussian_filter(hu[sl2].astype(np.float32), 0.8 / spa)
    pm = polmoni_dil[sl2]
    base = np.zeros(sm.shape, bool)
    off = [s1.start - s2.start for s1, s2 in zip(sl, sl2)]
    zz, yy, xx = np.nonzero(nod)
    zz, yy, xx = zz + off[0], yy + off[1], xx + off[2]
    ok = (zz >= 0) & (yy >= 0) & (xx >= 0) & (zz < sm.shape[0]) & (yy < sm.shape[1]) & (xx < sm.shape[2])
    base[zz[ok], yy[ok], xx[ok]] = True
    paren = sm[pm & ~ndi.binary_dilation(base, iterations=3) & (sm < -700)]
    if paren.size < 100:
        return nod, sl
    T = float(np.median(paren)) + delta_hu
    cand = (sm > T) & pm
    rr = np.maximum(1, np.round(1.5 / spa)).astype(int)
    g = np.ogrid[-rr[0]:rr[0] + 1, -rr[1]:rr[1] + 1, -rr[2]:rr[2] + 1]
    ball = sum((gi / max(ri, 1)) ** 2 for gi, ri in zip(g, rr)) <= 1
    cand = ndi.binary_opening(cand, ball) | base
    lab, _ = ndi.label(cand)
    ids = np.unique(lab[base]); ids = ids[ids > 0]
    nuovo = np.isin(lab, ids)
    v0 = base.sum(); v1 = nuovo.sum()
    d0 = 2 * (3 * v0 * spa.prod() / (4 * math.pi)) ** (1 / 3)
    d1 = 2 * (3 * v1 * spa.prod() / (4 * math.pi)) ** (1 / 3)
    tocca = nuovo[0].any() or nuovo[-1].any() or nuovo[:, 0].any() or nuovo[:, -1].any() \
        or nuovo[:, :, 0].any() or nuovo[:, :, -1].any()
    if tocca or d1 > max(3.5 * d0, d0 + 15) or d1 > 35:
        return nod, sl
    # un orletto di 1-2 mm è volume parziale del nodulo solido, non un alone a vetro
    if d1 - d0 < min_alone_mm:
        return nod, sl
    # se la parte densa (> -300 HU) resta grande rispetto al totale, l'«alone» sono
    # spicule/volume parziale di un nodulo solido: si tiene la maschera del modello
    vs = (hu[sl2][nuovo] > -300).sum() * spa.prod()
    ds = 2 * (3 * vs / (4 * math.pi)) ** (1 / 3)
    if ds >= SOGLIA_SOLIDO * d1:
        return nod, sl
    return nuovo, sl2


def misura(hu, sp, nod, sl):
    from skimage.measure import regionprops, label
    vox = float(np.prod(sp))
    vol = nod.sum() * vox
    hu_sub = hu[sl]
    vals = hu_sub[nod]
    solida = (vals > -300).mean() if vals.size else 0
    # assiale con area massima
    aree = nod.sum(axis=(1, 2))
    z = int(np.argmax(aree))
    lungo = corto = 0.0
    if aree[z] > 0:
        # come si misura a mano: asse lungo = diametro massimo (Feret), asse corto =
        # larghezza massima perpendicolare all'asse lungo, sull'assiale di area massima
        p = regionprops(label(nod[z]))
        p = max(p, key=lambda q: q.area)
        pts = p.coords.astype(float) * np.array([sp[1], sp[2]])
        if len(pts) > 1500:
            pts = pts[np.random.default_rng(0).choice(len(pts), 1500, replace=False)]
        from scipy.spatial.distance import pdist, squareform
        D = squareform(pdist(pts))
        i, j = np.unravel_index(np.argmax(D), D.shape)
        # tra i centri dei pixel di bordo: le maschere dei modelli sono già un po' generose
        lungo = D[i, j]
        u = (pts[j] - pts[i]) / max(D[i, j], 1e-6)
        perp = pts @ np.array([-u[1], u[0]])
        corto = perp.max() - perp.min()
    diam = (lungo + corto) / 2
    # componente solida: diametro equivalente della parte > -300 HU
    solido_vol = (vals > -300).sum() * vox
    d_solido = 2 * (3 * solido_vol / (4 * math.pi)) ** (1 / 3) if solido_vol > 0 else 0.0
    # tipo dal diametro della componente solida rispetto al nodulo intero
    # (la frazione in volume penalizza troppo: 7 mm solidi in 18 mm = 6% del volume)
    if diam > 0 and d_solido >= SOGLIA_SOLIDO * diam:
        tipo = "solido"
    elif d_solido >= 3.0:
        tipo = "parzialmente solido"
    else:
        tipo = "vetro smerigliato"
    bordo = any(nod[i].any() for i in [(0,), (-1,)]) or nod[:, 0].any() or nod[:, -1].any() \
        or nod[:, :, 0].any() or nod[:, :, -1].any()
    return dict(volume_mm3=round(vol, 1), diametro_mm=round(diam, 1), asse_lungo_mm=round(lungo, 1),
                asse_corto_mm=round(corto, 1), hu_medio=round(float(vals.mean()), 0) if vals.size else None,
                frazione_solida=round(float(solida), 2), diametro_solido_mm=round(d_solido, 1),
                tipo=tipo, tocca_bordo=bool(bordo), z_area_max=int(sl[0].start + z))


def lung_rads_baseline(tipo, d, d_sol):
    """Lung-RADS v2022, primo esame (senza precedenti). d e d_sol in mm."""
    if tipo == "solido":
        if d < 6: return "2"
        if d < 8: return "3"
        if d < 15: return "4A"
        return "4B"
    if tipo == "parzialmente solido":
        if d < 6: return "2"
        if d_sol < 6: return "3"
        if d_sol < 8: return "4A"
        return "4B"
    # vetro smerigliato
    return "2" if d < 30 else "3"


def consenso(lista_a, lista_b, sp, nome_b="Hessian"):
    """lista_* = [(indice zyx, diametro mm, score)]. Abbina per distanza dei centri."""
    usati_b = set()
    out = []
    for ca, da, sa in lista_a:
        best, bd = None, 1e9
        for j, (cb, db, sb) in enumerate(lista_b):
            if j in usati_b: continue
            dist = np.linalg.norm((np.array(ca) - np.array(cb)) * np.array(sp))
            if dist < max(5.0, 0.5 * max(da, db)) and dist < bd:
                best, bd = j, dist
        if best is not None:
            usati_b.add(best)
            out.append(dict(centro=ca, d=da, score_monai=sa, score_hessian=lista_b[best][2], modelli="entrambi", jb=best))
        else:
            out.append(dict(centro=ca, d=da, score_monai=sa, score_hessian=None, modelli="solo MONAI", jb=None))
    for j, (cb, db, sb) in enumerate(lista_b):
        if j not in usati_b:
            out.append(dict(centro=cb, d=db, score_monai=None, score_hessian=sb, modelli="solo " + nome_b, jb=j))
    return out


# ---------------------------------------------------------------- mesh
def mesh_da_maschera(m, sp_zyx, origine_idx_to_lps, passo=2, liscia=True):
    """Marching cubes -> trimesh in coordinate LPS (mm)."""
    import trimesh
    from skimage.measure import marching_cubes
    from scipy import ndimage as ndi
    if m.sum() < 20:
        return None
    mm = m[::passo, ::passo, ::passo].astype(np.float32)
    if liscia:
        mm = ndi.gaussian_filter(mm, 0.8)
    mm = np.pad(mm, 1)
    # struttura troppo sottile o tagliata ai bordi (es. lobo appena visibile nelle TC dell'addome): niente superficie
    if not (mm.min() < 0.5 < mm.max()):
        return None
    try:
        v, f, _, _ = marching_cubes(mm, 0.5)
    except (ValueError, RuntimeError):
        return None
    v = (v - 1) * passo  # indici zyx nella griglia originale
    v_lps = origine_idx_to_lps(v)
    t = trimesh.Trimesh(v_lps, f[:, ::-1], process=True)
    try:
        t = t.simplify_quadric_decimation(face_count=min(len(t.faces), 40000))
    except Exception:
        pass
    return t


def scrivi_glb(parti, path):
    """parti = [(nome, trimesh, rgb, alpha)]"""
    import trimesh
    sc = trimesh.Scene()
    tri = 0
    for nome, t, rgb, a in parti:
        if t is None: continue
        c = np.array([*(np.array(rgb) * 255), a * 255], dtype=np.uint8)
        t.visual = trimesh.visual.ColorVisuals(t, face_colors=np.tile(c, (len(t.faces), 1)))
        sc.add_geometry(t, node_name=nome, geom_name=nome)
        tri += len(t.faces)
    sc.export(path)
    return tri


# ---------------------------------------------------------------- anteprima
def anteprima(hu, sp, noduli, parti, path, finestra=(-600, 1500)):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    n = min(len(noduli), 8)
    col = max(n, 1) + 1
    fig = plt.figure(figsize=(3.2 * col, 3.6), facecolor="black")
    ax = fig.add_subplot(1, col, 1, projection="3d")
    ax.set_facecolor("black")
    for nome, t, rgb, a in parti:
        if t is None: continue
        f = t.faces[:: max(1, len(t.faces) // 6000)]
        pc = Poly3DCollection(t.vertices[f], facecolor=(*rgb, min(a, 0.35)), edgecolor="none")
        ax.add_collection3d(pc)
    allv = np.vstack([t.vertices for _, t, _, _ in parti if t is not None]) if any(p[1] is not None for p in parti) else np.zeros((1, 3))
    for i, nd in enumerate(noduli):
        c = nd["centro_lps_mm"]
        ax.scatter([c[0]], [c[1]], [c[2]], s=25, c="red" if nd["modelli"] == "entrambi" else "white")
    ax.set_xlim(allv[:, 0].min(), allv[:, 0].max())  # vista anteriore: destra del paziente a sinistra
    ax.set_ylim(allv[:, 1].min(), allv[:, 1].max())
    ax.set_zlim(allv[:, 2].min(), allv[:, 2].max())
    ax.view_init(elev=5, azim=-90)
    ax.set_axis_off()
    lo, w = finestra[0], finestra[1]
    for i, nd in enumerate(noduli[:n]):
        a = fig.add_subplot(1, col, i + 2)
        z, y, x = nd["indice_zyx"]
        r = int(25 / sp[1])
        sl = hu[z, max(0, y - r):y + r, max(0, x - r):x + r]
        a.imshow(np.clip((sl - (lo - w / 2)) / w, 0, 1), cmap="gray")
        a.add_patch(plt.Circle((min(r, x), min(r, y)), nd["diametro_mm"] / sp[2] / 2 + 3,
                               fill=False, color="red" if nd["modelli"] == "entrambi" else "yellow", lw=1))
        a.set_title(f"#{i+1} {nd['diametro_mm']} mm {nd['tipo'][:12]}\n{nd['lobo']} · LR {nd['lung_rads']} · img {nd['immagine']}",
                    color="white", fontsize=7)
        a.axis("off")
    plt.tight_layout()
    plt.savefig(path, dpi=130, facecolor="black")
    plt.close(fig)


# ---------------------------------------------------------------- principale
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("serie")
    ap.add_argument("uscita")
    ap.add_argument("--modo", default="torace", choices=["torace", "vasi", "entrambi"])
    ap.add_argument("--fast", action="store_true")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--senza-monai", action="store_true")
    ap.add_argument("--bundle", default=os.path.expanduser("~/.radioquiz-ia/monai"))
    ap.add_argument("--max-noduli", type=int, default=15)
    a = ap.parse_args()
    t0 = time.time()
    import SimpleITK as sitk
    os.makedirs(a.uscita, exist_ok=True)
    img, files = leggi_serie(a.serie)
    ct_nii = os.path.join(a.uscita, "ct.nii.gz")
    if not os.path.exists(ct_nii):
        tmp = ct_nii.replace(".nii.gz", ".tmp.nii.gz")  # scrittura atomica: un'interruzione non lascia file troncati
        sitk.WriteImage(img, tmp)
        os.replace(tmp, ct_nii)
    hu = sitk.GetArrayFromImage(img).astype(np.int16)  # z,y,x
    # ordine delle immagini nella piattaforma (serie.json del caso), se c'è
    ordine_pf = {}
    sj = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(a.serie))), "serie.json")
    if os.path.exists(sj):
        try:
            for s_ in json.load(open(sj)):
                for k, rel in enumerate(s_.get("files", []), 1):
                    ordine_pf[os.path.basename(rel)] = (s_.get("numero"), k)
        except Exception:
            pass
    def immagine_pf(iz):
        b = os.path.basename(files[iz]) if 0 <= iz < len(files) else None
        return ordine_pf.get(b, (None, iz + 1))[1]
    sp = img.GetSpacing()[::-1]  # z,y,x
    print(f"serie: {len(files)} immagini, griglia {hu.shape}, spacing {tuple(round(s,2) for s in sp)} mm", flush=True)

    def idx_to_lps(v_zyx):
        v = np.asarray(v_zyx, float)
        d = np.array(img.GetDirection()).reshape(3, 3)
        o = np.array(img.GetOrigin())
        s = np.array(img.GetSpacing())
        xyz = v[..., ::-1] * s
        return xyz @ d.T + o

    roi = []
    if a.modo in ("torace", "entrambi"):
        roi += list(LOBI)
    if a.modo in ("vasi", "entrambi"):
        roi += list(VASI)
    roi += ["rib_left_%d" % i for i in range(1, 13)] + ["rib_right_%d" % i for i in range(1, 13)]
    roi += ["vertebrae_%s" % v for v in ["T%d" % i for i in range(1, 13)] + ["L%d" % i for i in range(1, 6)]]
    roi += ["sternum"]
    if a.modo in ("vasi", "entrambi"):
        roi += ["hip_left", "hip_right", "sacrum", "femur_left", "femur_right"] + ESCLUSI_ALBERO
    seg = totalseg(ct_nii, os.path.join(a.uscita, "seg"), roi, a.fast, a.device)
    print(f"TotalSegmentator fatto ({time.time()-t0:.0f} s)", flush=True)

    maschere = {}
    for n in roi:
        p = os.path.join(seg, n + ".nii.gz")
        if os.path.exists(p):
            m = carica_maschera(p, img)
            if m.any():
                maschere[n] = m

    parti = []
    risultati = dict(versione=1, serie_file=len(files), spacing_zyx_mm=list(map(float, sp)),
                     strumenti=["TotalSegmentator (task total, Apache 2.0)"], noduli=[], strutture=[])

    # ---------- torace
    if a.modo in ("torace", "entrambi"):
        lobi_lab = np.zeros(hu.shape, np.uint8)
        for i, n in enumerate(LOBI, 1):
            if n in maschere:
                lobi_lab[maschere[n]] = i
        polmoni = lobi_lab > 0
        from scipy import ndimage as ndi
        polmoni_dil = ndi.binary_dilation(polmoni, iterations=3)
        cand_a = []
        if not a.senza_monai:
            try:
                # solo il riquadro dei polmoni (+1 cm): meno memoria e meno tempo
                zs, ys, xs = [np.where(polmoni.any(axis=ax))[0] for ax in [(1, 2), (0, 2), (0, 1)]]
                mg = np.ceil(10 / np.array(sp)).astype(int)
                lo = np.maximum([zs[0], ys[0], xs[0]] - mg, 0)
                hi = np.minimum(np.array([zs[-1], ys[-1], xs[-1]]) + mg + 1, hu.shape)
                ct_crop = os.path.join(a.uscita, "ct_polmoni.nii.gz")
                sitk.WriteImage(img[int(lo[2]):int(hi[2]), int(lo[1]):int(hi[1]), int(lo[0]):int(hi[0])], ct_crop)
                cache = os.path.join(a.uscita, "monai.json")
                if os.path.exists(cache):
                    lista_m = json.load(open(cache))
                else:
                    lista_m = noduli_monai(ct_crop, a.bundle, a.device)
                    json.dump([[list(map(float, c)), d, s] for c, d, s in lista_m], open(cache, "w"))
                for c_lps, d, s in lista_m:
                    idx = img.TransformPhysicalPointToIndex(tuple(map(float, c_lps)))[::-1]
                    if all(0 <= idx[k] < hu.shape[k] for k in range(3)):
                        cand_a.append((tuple(int(v) for v in idx), d, s))
                risultati["strumenti"].append("MONAI lung_nodule_ct_detection (Apache 2.0, LUNA16)")
                print(f"MONAI: {len(cand_a)} candidati ({time.time()-t0:.0f} s)", flush=True)
            except Exception as e:
                print("MONAI non disponibile:", e, flush=True)
        maschere_b = None
        try:
            pn = totalseg_noduli(ct_nii, a.uscita, a.device)
            mn = carica_maschera(pn, img) & polmoni_dil
            comp = componenti(mn, sp)
            cand_b = [(c, d, s) for c, d, s, _, _ in comp]
            maschere_b = [(m, sl) for _, _, _, m, sl in comp]
            nome_b = "TotalSegmentator"
            risultati["strumenti"].append("TotalSegmentator lung_nodules (nnU-Net)")
        except Exception as e:
            print("TotalSegmentator lung_nodules non disponibile:", e, flush=True)
            cand_b = noduli_hessian(hu, sp, polmoni)
            nome_b = "Hessian"
            risultati["strumenti"].append("filtro di Hessian multiscala (classico)")
        print(f"{nome_b}: {len(cand_b)} candidati ({time.time()-t0:.0f} s)", flush=True)
        # soglie: MONAI score >= 0.5 da solo, Hessian da solo solo se molto netto
        cand_a = [c for c in cand_a if c[2] >= 0.30]
        cons = consenso(cand_a, cand_b, sp, nome_b)
        tenuti = []
        for nd in cons:
            if nd["modelli"] == "solo MONAI" and nd["score_monai"] < 0.5: continue
            if nd["modelli"] == "solo Hessian" and nd["score_hessian"] < 0.6: continue
            if maschere_b is not None and nd["jb"] is not None:
                # misura sulla segmentazione del modello (comprende anche il vetro smerigliato)
                nodm, sl = maschere_b[nd["jb"]]
                nodm, sl = espandi_vetro(hu, sp, nodm, sl, polmoni_dil)
                da_modello = True
            else:
                nodm, sl = segmenta_nodulo(hu, sp, nd["centro"], polmoni_dil)
                da_modello = False
            if nodm is None: continue
            mi = misura(hu, sp, nodm, sl)
            if da_modello:
                mi["tocca_bordo"] = False
            if mi["diametro_mm"] < 3 or mi["diametro_mm"] > 40: continue
            if nd["modelli"].startswith("solo") and mi["diametro_mm"] < 4: continue  # micronoduli da un solo modello: troppo rumore
            if mi["tocca_bordo"] and nd["modelli"] != "entrambi": continue  # probabile vaso o parete
            z, y, x = nd["centro"]
            lb = lobi_lab[z, y, x]
            if lb == 0:
                vals, cnt = np.unique(lobi_lab[sl][nodm], return_counts=True)
                cnt = cnt[vals > 0]; vals = vals[vals > 0]
                lb = int(vals[np.argmax(cnt)]) if len(vals) else 0
            lobo = list(LOBI.values())[lb - 1][0] if lb else "fuori dai lobi"
            iz = mi["z_area_max"]
            nd2 = dict(indice_zyx=[int(iz), int(y), int(x)],
                       centro_lps_mm=[round(float(v), 1) for v in idx_to_lps([iz, y, x])],
                       immagine=immagine_pf(iz), sop_uid=sop_uid(files[iz]) if iz < len(files) else None,
                       lobo=lobo, modelli=nd["modelli"],
                       score_monai=None if nd["score_monai"] is None else round(nd["score_monai"], 2),
                       score_hessian=None if nd["score_hessian"] is None else round(nd["score_hessian"], 2),
                       **mi)
            # componente solida solo per i parzialmente solidi (revisione 2/11: nei solidi e nel vetro confondeva)
            if mi["tipo"] == "solido":
                mi["diametro_solido_mm"] = mi["diametro_mm"]
            elif mi["tipo"] == "vetro smerigliato":
                mi["diametro_solido_mm"] = 0.0
            nd2.update(diametro_solido_mm=mi["diametro_solido_mm"])
            nd2["lung_rads"] = lung_rads_baseline(mi["tipo"], mi["diametro_mm"], mi["diametro_solido_mm"])
            # categoria fragile: una differenza di misura di 1 mm la cambierebbe
            # (la componente solida dipende molto dalla soglia e dai vasi che convergono: ±2 mm)
            alt = {lung_rads_baseline(mi["tipo"], mi["diametro_mm"] + dd, mi["diametro_solido_mm"] + ds)
                   for dd in (-1, 0, 1) for ds in ((-2, -1, 0, 1, 2) if mi["tipo"] == "parzialmente solido" else (0,))}
            nd2["vicino_soglia"] = len(alt) > 1
            tenuti.append((nd2, nodm, sl))
        # tolgo i doppioni (stessa massa da due centri)
        # stesso nodulo visto due volte (es. il modello segmenta il nucleo solido, MONAI il
        # nodulo intero): si tiene la misura più grande e si uniscono i modelli
        tenuti.sort(key=lambda t: -t[0]["volume_mm3"])
        finali = []
        for t in tenuti:
            c = np.array(t[0]["centro_lps_mm"])
            doppio = None
            for f in finali:
                dist = np.linalg.norm(c - np.array(f[0]["centro_lps_mm"]))
                if dist <= max(5, max(f[0]["diametro_mm"], t[0]["diametro_mm"]) / 2):
                    doppio = f; break
            if doppio is None:
                finali.append(t)
            else:
                m1, m2 = doppio[0]["modelli"], t[0]["modelli"]
                if m1 != m2 or "entrambi" in (m1, m2):
                    doppio[0]["modelli"] = "entrambi"
                for k in ("score_monai", "score_hessian"):
                    if doppio[0][k] is None:
                        doppio[0][k] = t[0][k]
        finali = finali[: a.max_noduli]
        for i, (nd2, nodm, sl) in enumerate(finali, 1):
            nd2["n"] = i
            del nd2["tocca_bordo"]
            risultati["noduli"].append(nd2)
        print(f"noduli finali: {len(finali)}", flush=True)
        for i, (n, (et, rgb)) in enumerate(LOBI.items(), 1):
            t = mesh_da_maschera(lobi_lab == i, sp, idx_to_lps)
            parti.append(("lobo " + et, t, rgb, 0.35))
            if t is not None:
                risultati["strutture"].append(dict(nome="lobo " + et, volume_ml=round(float((lobi_lab == i).sum() * np.prod(sp) / 1000), 0)))
        for i, (nd2, nodm, sl) in enumerate(finali, 1):
            full = np.zeros(hu.shape, bool)
            full[sl] = nodm
            t = mesh_da_maschera(full, sp, idx_to_lps, passo=1, liscia=False)
            rgb = (0.85, 0.1, 0.1) if nd2["modelli"] == "entrambi" else (1, 1, 1)
            parti.append((f"nodulo {i}", t, rgb, 1.0))

    # ---------- vasi
    if a.modo in ("vasi", "entrambi"):
        for n, (et, rgb, al) in VASI.items():
            if n in maschere:
                parti.append((et, mesh_da_maschera(maschere[n], sp, idx_to_lps), rgb, al))
                risultati["strutture"].append(dict(nome=et, volume_ml=round(float(maschere[n].sum() * np.prod(sp) / 1000), 1)))
        # albero arterioso opacizzato: voxel con mdc connessi all'aorta, ossa escluse
        # (porta nel 3D anche i rami che TotalSegmentator non segmenta: renali, mesenteriche, femorali)
        if "aorta" in maschere:
            from scipy import ndimage as ndi
            ossa_v = np.zeros(hu.shape, bool)
            for n, m in maschere.items():
                if n.startswith(OSSA_PREFISSI):
                    ossa_v |= m
            ossa_v = ndi.binary_dilation(ossa_v, iterations=2)
            hu_ao = float(np.median(hu[maschere["aorta"]]))
            if hu_ao > 180:  # c'è davvero contrasto arterioso
                T = max(150.0, 0.45 * hu_ao)
                sm = ndi.gaussian_filter(hu.astype(np.float32), 0.5)
                cand = (sm > T) & (sm < 1200) & ~ossa_v
                for k in ["kidney_left", "kidney_right", "heart", "pulmonary_vein"] + ESCLUSI_ALBERO:
                    if k in maschere:
                        cand &= ~ndi.binary_dilation(maschere[k], iterations=1)
                lab, _ = ndi.label(cand)
                ids = np.unique(lab[maschere["aorta"] & cand]); ids = ids[ids > 0]
                albero = np.isin(lab, ids) | maschere["aorta"]
                parti.append(("albero arterioso", mesh_da_maschera(albero, sp, idx_to_lps, passo=1, liscia=True),
                              (0.95, 0.82, 0.80), 1.0))
                risultati["aorta_hu_mediana"] = round(hu_ao)
                risultati["albero_arterioso_ml"] = round(float(albero.sum() * np.prod(sp) / 1000), 1)
            # diametro massimo dell'aorta sugli assiali (diametro equivalente, indicativo)
            # sezioni assiali solo dove l'aorta è tagliata di traverso (componente rotonda):
            # nell'arco il taglio assiale è obliquo e il diametro non avrebbe senso
            from skimage.measure import label as _lab, regionprops as _rp
            ao = maschere["aorta"]
            best = (0.0, None)
            for z in range(ao.shape[0]):
                if not ao[z].any(): continue
                for p_ in _rp(_lab(ao[z])):
                    if p_.area < 30 or p_.axis_major_length == 0: continue
                    if p_.axis_minor_length / p_.axis_major_length < 0.8: continue
                    dmax = p_.axis_major_length * math.sqrt(sp[1] * sp[2])
                    if dmax > best[0]:
                        best = (dmax, z)
            if best[1] is not None:
                risultati["aorta_diametro_max_mm"] = round(best[0], 1)
                risultati["aorta_immagine_diametro_max"] = immagine_pf(best[1])
                risultati["aorta_diametro_nota"] = ("asse maggiore della sezione assiale rotonda più grande "
                                                    "(arco escluso); indicativo, da misurare in MPR perpendicolare")

    # ---------- ossa (contesto)
    ossa = np.zeros(hu.shape, bool)
    for n, m in maschere.items():
        if n.startswith(OSSA_PREFISSI):
            ossa |= m
    if ossa.any():
        parti.append(("ossa", mesh_da_maschera(ossa, sp, idx_to_lps, passo=2), COLORE_OSSO, 0.5))

    tri = scrivi_glb(parti, os.path.join(a.uscita, "modello3d.glb"))
    risultati["triangoli"] = int(tri)
    risultati["nota"] = ("Seconda lettura automatica a scopo didattico, non diagnostica. "
                         "Lung-RADS calcolato come primo esame (nessun precedente). "
                         "Da controllare dal revisore indipendente.")
    with open(os.path.join(a.uscita, "risultati.json"), "w") as f:
        json.dump(risultati, f, ensure_ascii=False, indent=1)
    try:
        anteprima(hu, sp, risultati["noduli"], parti, os.path.join(a.uscita, "anteprima.png"))
    except Exception as e:
        print("anteprima non creata:", e)
    print(f"fatto in {time.time()-t0:.0f} s: {len(risultati['noduli'])} noduli, {tri} triangoli -> {a.uscita}")


if __name__ == "__main__":
    main()
