#!/usr/bin/env python3
"""Seconda lettura dei noduli polmonari per le TC di un caso, da aggiungere alla segmentazione IA.

Si lancia sul Mac DOPO strumenti/segmenta_ia.py (anche --extra), con l'ambiente che ha MONAI:

    RQ_CASI=…/casi-free  <venv analisi3d>/bin/python strumenti/noduli_ia.py caso-tcia-034 [--rifai]

Per ogni serie con la segmentazione IA (casi/<id>/ia/<cartella>.json) che contiene i polmoni:
  - lancia strumenti/analisi_tc.py (TotalSegmentator lobi + lung_nodules, MONAI lung_nodule_ct_detection,
    misure come a mano, tipo, Lung-RADS v2022 al primo esame);
  - sostituisce geo["analisi"]["noduli"] con l'elenco arricchito (i campi vecchi restano: volume_mm3,
    A, B, C, centro_vox, diametro_medio_mm) e aggiunge geo["analisi"]["noduli_metodo"].
Solo numeri: nessun dato del paziente. Le cartelle di lavoro (RQ_LAVORO) si possono cancellare.
"""
import argparse, json, os, subprocess, sys, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASI = os.environ.get("RQ_CASI") or os.path.join(BASE, "casi")
# cartelle di lavoro sul disco del progetto (il disco interno del Mac è quasi pieno)
LAVORO = os.environ.get("RQ_LAVORO") or "/Volumes/Caloggero/strumenti_claude/analisi3d/lavoro"
ANALISI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analisi_tc.py")


def ha_polmoni(geo):
    return sum(1 for n in geo.get("etichette", {}).values() if n.startswith("lung_")) >= 3


def converti(n, geo):
    """Nodulo di analisi_tc -> voce di geo.analisi.noduli (centro_vox a piena risoluzione, x y z)."""
    o, A, sp = geo["origine"], geo["assi"], geo["sp"]
    sp_full = [sp[0] / 2, sp[1] / 2, sp[2]]          # la geometria è a metà risoluzione nel piano
    w = n["centro_lps_mm"]
    vox = [sum((w[k] - o[k]) * A[a][k] for k in range(3)) / sp_full[a] for a in range(3)]
    return {
        "volume_mm3": n["volume_mm3"], "A": n["asse_lungo_mm"], "B": n["asse_corto_mm"], "C": None,
        "diametro_medio_mm": n["diametro_mm"], "centro_vox": [round(v, 1) for v in vox],
        "centro_lps": n["centro_lps_mm"], "immagine": n["immagine"], "lobo": n["lobo"],
        "tipo": n["tipo"], "solido_mm": n["diametro_solido_mm"], "hu": n["hu_medio"],
        "lung_rads": n["lung_rads"], "vicino_soglia": bool(n.get("vicino_soglia")), "modelli": n["modelli"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("caso")
    ap.add_argument("--rifai", action="store_true")
    ap.add_argument("--device", default="mps")
    a = ap.parse_args()
    dia = os.path.join(CASI, a.caso, "ia")
    if not os.path.isdir(dia):
        sys.exit(f"{a.caso}: nessuna segmentazione IA (lancia prima strumenti/segmenta_ia.py)")
    for f in sorted(os.listdir(dia)):
        if not f.endswith(".json"):
            continue
        pj = os.path.join(dia, f)
        geo = json.load(open(pj))
        if geo.get("scartata") or not ha_polmoni(geo):
            continue
        an = geo.setdefault("analisi", {})
        if an.get("noduli_metodo") and not a.rifai:
            print(f"  {a.caso}/{f}: già fatto"); continue
        cart = geo["serie"]
        serie = os.path.join(CASI, a.caso, "serie", cart)
        out = os.path.join(LAVORO, f"{a.caso}_{cart}")
        t = time.time()
        r = subprocess.run([sys.executable, ANALISI, serie, out, "--modo", "torace", "--device", a.device],
                           capture_output=True, text=True)
        rj = os.path.join(out, "risultati.json")
        if r.returncode != 0 or not os.path.exists(rj):
            print(f"  {a.caso}/{f}: analisi non riuscita\n{r.stderr[-1500:]}"); continue
        ris = json.load(open(rj))
        geo = json.load(open(pj))          # riletto: segmenta_ia può averlo cambiato nel frattempo
        an = geo.setdefault("analisi", {})
        an["noduli"] = [converti(n, geo) for n in ris["noduli"]]
        an["noduli_metodo"] = {"strumenti": ris["strumenti"], "data": time.strftime("%Y-%m"),
                               "nota": "Lung-RADS v2022 al primo esame; diametro = media di asse lungo e corto "
                                       "sull'assiale di area massima; stime automatiche da verificare."}
        tmp = pj + ".tmp"
        json.dump(geo, open(tmp, "w"), ensure_ascii=False); os.replace(tmp, pj)
        print(f"  {a.caso}/{f}: {len(an['noduli'])} noduli in {time.time() - t:.0f} s")


if __name__ == "__main__":
    main()
