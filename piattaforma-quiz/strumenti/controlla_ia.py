#!/usr/bin/env python3
"""Controlli automatici della segmentazione IA (lo lanciano segmenta_ia.py dopo ogni serie e pubblica.command).

Per ogni casi/<id>/ia/<serie>.json:
  ERRORI (la segmentazione viene «scartata»: nel .json si scrive "scartata" con i motivi e il sito non la usa)
    - geometria: origine, assi e passo non coincidono con le posizioni delle immagini della serie
      (l'errore del 10 ottobre 2026: TC con SpacingBetweenSlices negativo, paziente capovolto);
    - file delle etichette mancante o di dimensioni diverse da quelle dichiarate;
    - orientamento: strutture alte (encefalo, cuore, polmoni, vertebre cervicali) sotto quelle basse
      (vescica, femori, sacro, vertebre lombari), cioè etichette capovolte.
  RISULTATI NON PLAUSIBILI (tolti dalle «analisi» e messi in analisi._scartate, il resto resta):
    - noduli polmonari sopra 50 mm (masse o falsi positivi), versamento pleurico sopra 4 L,
      segmenti epatici che non tornano con il volume del fegato, area muscolare a L3 sopra 400 cm²;
  AVVISI (solo segnalati): volumi d'organo fuori dai limiti abituali quando l'organo è tutto nel campo.

uso: python3 controlla_ia.py [cartella casi] [--correggi] [--caso caso-NNN]
     uscita 2 se restano errori non corretti (senza --correggi), 0 altrimenti.
"""
import gzip, json, os, sys, glob

ALTE = ["brain", "heart", "trachea", "thyroid_gland", "lung_upper_lobe_left", "lung_upper_lobe_right", "esophagus",
        "vertebrae_C1", "vertebrae_C2", "vertebrae_C3", "vertebrae_C4", "vertebrae_C5", "vertebrae_C6", "vertebrae_C7"]
BASSE = ["urinary_bladder", "femur_left", "femur_right", "hip_left", "hip_right", "sacrum", "prostate",
         "vertebrae_L3", "vertebrae_L4", "vertebrae_L5"]
VOLUMI = {"liver": (600, 4500), "spleen": (30, 2000), "kidney_left": (40, 600), "kidney_right": (40, 600)}


def _np():
    import numpy as np
    return np


def posizioni(caso_dir, cartella):
    """Posizioni (lungo la normale) della prima, centrale e ultima immagine della serie, e la normale."""
    import pydicom
    np = _np()
    fs = sorted(glob.glob(os.path.join(caso_dir, "serie", cartella, "*.dcm")))
    if not fs:
        return None, None
    zs, n = [], None
    for f in {fs[0], fs[len(fs) // 2], fs[-1]}:
        d = pydicom.dcmread(f, stop_before_pixels=True)
        iop = [float(x) for x in d.ImageOrientationPatient]
        n = np.cross(iop[:3], iop[3:])
        zs.append(float(np.dot(n, [float(x) for x in d.ImagePositionPatient])))
    return (min(zs), max(zs), len(fs)), n


def controlla_serie(caso_dir, fjson):
    np = _np()
    g = json.load(open(fjson))
    errori, avvisi, togli = [], [], {}
    cartella = g.get("serie") or os.path.basename(fjson)[:-5]
    W, H, N = g["dim"]
    A = np.array(g["assi"], float); o = np.array(g["origine"], float); sp = [float(x) for x in g["sp"]]
    # 1. geometria rispetto alle immagini
    pos, n = posizioni(caso_dir, cartella)
    if pos is None:
        errori.append(f"serie {cartella} non trovata")
    else:
        lo, hi, nf = pos
        e = sorted([float(np.dot(n, o)), float(np.dot(n, o + A[2] * sp[2] * (N - 1)))])
        tol = max(sp[2], 1.0)
        if abs(e[0] - lo) > tol or abs(e[1] - hi) > tol:
            errori.append(f"geometria: etichette da {e[0]:.1f} a {e[1]:.1f} mm, immagini da {lo:.1f} a {hi:.1f} mm")
        if nf != N:
            avvisi.append(f"{N} strati nelle etichette, {nf} immagini nella serie")
    # 2. file delle etichette
    flab = fjson[:-5] + ".lab.gz"
    lab = None
    if not os.path.exists(flab):
        errori.append("manca il file delle etichette")
    else:
        b = gzip.open(flab).read()
        if len(b) != W * H * N:
            errori.append(f"etichette di {len(b)} byte invece di {W * H * N}")
        else:
            lab = np.frombuffer(b, np.uint8).reshape(N, H, W)
    # 3. orientamento e volumi
    if lab is not None:
        ids = {v: int(k) for k, v in g.get("etichette", {}).items()}
        vv = sp[0] * sp[1] * sp[2] / 1000
        conta = np.bincount(lab.ravel(), minlength=256)

        def zmedia(nome):
            k = ids.get(nome)
            if not k or conta[k] < 50:
                return None
            strati = np.nonzero((lab == k).any(axis=(1, 2)))[0]
            kk = float(np.average(np.arange(N), weights=(lab == k).sum(axis=(1, 2)))) if len(strati) else None
            return None if kk is None else float(np.dot(n if n is not None else A[2], o + A[2] * sp[2] * kk))
        alte = [z for z in (zmedia(x) for x in ALTE) if z is not None]
        basse = [z for z in (zmedia(x) for x in BASSE) if z is not None]
        if alte and basse and min(alte) < max(basse):
            errori.append("orientamento: strutture del torace/collo sotto quelle del bacino (etichette capovolte)")
        for nome, (a, b2) in VOLUMI.items():
            k = ids.get(nome)
            if not k or not conta[k]:
                continue
            strati = np.nonzero((lab == k).any(axis=(1, 2)))[0]
            if strati[0] == 0 or strati[-1] == N - 1:
                continue                                   # organo tagliato dal campo: volume non confrontabile
            ml = conta[k] * vv
            if ml < 5:
                continue                                   # organo assente (asportato o fuori campo)
            if not (a <= ml <= b2):
                avvisi.append(f"{nome} {ml:.0f} mL fuori dai limiti abituali ({a}-{b2})")
    # 4. analisi aggiuntive non plausibili
    an = g.get("analisi") or {}
    nod = an.get("noduli") or []
    grandi = [x for x in nod if x.get("diametro_medio_mm", 0) > 50]
    if grandi:
        togli["noduli_oltre_50mm"] = grandi
    v = an.get("versamenti") or {}
    if max(v.get("pleurico_dx_ml", 0) or 0, v.get("pleurico_sx_ml", 0) or 0) > 4000:
        togli["versamenti"] = v
    seg = an.get("fegato_segmenti")
    if isinstance(seg, dict) and lab is not None and ids.get("liver"):
        tot = seg.get("totale_ml") or sum(x for x in (seg.get("segmenti_ml") or {}).values() if isinstance(x, (int, float)))
        fl = conta[ids["liver"]] * vv
        if tot and fl and abs(tot - fl) / fl > 0.5:
            togli["segmenti_fegato"] = seg
    l3 = an.get("l3") or {}
    if (l3.get("sma_cm2") or 0) > 400:
        togli["l3"] = l3
    return g, errori, avvisi, togli


def main():
    a = [x for x in sys.argv[1:]]
    correggi = "--correggi" in a
    solo = a[a.index("--caso") + 1] if "--caso" in a else None
    pos = [x for x in a if not x.startswith("--") and x != solo]
    base = pos[0] if pos else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "casi")
    restano, n, scartate, ripulite = 0, 0, 0, 0
    for caso_dir in sorted(glob.glob(os.path.join(base, "caso-*"))):
        c = os.path.basename(caso_dir)
        if solo and c != solo:
            continue
        for fj in sorted(glob.glob(os.path.join(caso_dir, "ia", "*.json"))):
            if os.path.basename(fj).startswith("eco_"):      # misure ecocardiografiche (eco_ia.py): niente segmentazione TC
                continue
            if os.path.basename(fj).startswith("confronto"):  # confronto con il precedente (confronto_ia.py): non è una segmentazione
                continue
            n += 1
            try:
                g, err, avv, togli = controlla_serie(caso_dir, fj)
            except Exception as e:
                g, err, avv, togli = json.load(open(fj)), [f"controllo non riuscito: {e}"], [], {}
            nome = f"{c}/{os.path.basename(fj)[:-5]}"
            for x in avv:
                print(f"  avviso {nome}: {x}")
            cambiato = False
            if err:
                print(f"  ERRORE {nome}: " + "; ".join(err))
                if correggi and g.get("scartata") != err:
                    g["scartata"] = err; cambiato = True; scartate += 1
                elif not correggi and not g.get("scartata"):
                    restano += 1
            elif g.get("scartata") and correggi:
                del g["scartata"]; cambiato = True        # rifatta e ora corretta
            if togli:
                print(f"  risultati non plausibili {nome}: " + ", ".join(togli))
                if correggi:
                    an = g.setdefault("analisi", {}); sc = an.setdefault("_scartate", {})
                    for k, val in togli.items():
                        sc[k] = val
                        if k == "noduli_oltre_50mm":
                            an["noduli"] = [x for x in an.get("noduli", []) if x.get("diametro_medio_mm", 0) <= 50]
                        else:
                            an.pop({"segmenti_fegato": "fegato_segmenti"}.get(k, k), None)
                    cambiato = True; ripulite += 1
            if cambiato:
                json.dump(g, open(fj, "w"), ensure_ascii=False)
    print(f"Controllo IA: {n} serie, {scartate} scartate, {ripulite} analisi ripulite" + (f", {restano} ERRORI da correggere" if restano else ""))
    sys.exit(2 if restano else 0)


if __name__ == "__main__":
    main()
