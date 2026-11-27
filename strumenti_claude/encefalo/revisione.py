"""Revisione anatomica automatica dell'atlante su tutti gli esami pubblicati e sull'atlante arterioso di riferimento."""
import gzip, json, glob, os
import numpy as np
from scipy import ndimage
import nibabel as nib
CASI = "/Volumes/Caloggero/piattaforma-quiz/casi-free"
ATL = "/Volumes/Caloggero/strumenti_claude/encefalo/atlante"

print("== 1. Atlante arterioso (spazio MNI, RAS): lato e posizione di ogni territorio")
art = nib.load(os.path.join(ATL, "arterie_mni.nii.gz")); A = np.asarray(art.dataobj).astype(int)
nomi = {}
for r in open(os.path.join(ATL, "ArterialAtlasLables.txt"), encoding="latin-1"):
    c = r.rstrip("\n").split("\t")
    if len(c) > 2 and c[1].strip().isdigit(): nomi[int(c[1])] = c[0]
errori = 0
for v in range(1, 33):
    m = A == v
    if not m.any(): print(f"  {v:2d} assente"); continue
    c = art.affine[:3, :3] @ np.array(ndimage.center_of_mass(m)) + art.affine[:3, 3]
    lato_atteso = "sin" if v % 2 else "dx"; lato = "sin" if c[0] < 0 else "dx"
    flag = "" if lato == lato_atteso else "  <-- LATO SBAGLIATO"
    errori += bool(flag)
    print(f"  {v:2d} {nomi.get(v, '?')[:48]:48s} x={c[0]:6.1f} y={c[1]:6.1f} z={c[2]:6.1f} ({int(m.sum()/1000)} mL){flag}")
print("  errori di lato:", errori)

print("\n== 2. Ogni esame: lati, rapporti tra giri e territori (RAS del paziente)")
NOMI = None
for fj in sorted(glob.glob(os.path.join(CASI, "*/ia/*.json"))):
    g = json.load(open(fj))
    if g.get("atlante") != "encefalo": continue
    W, H, N = g["dim"]; lab = np.frombuffer(gzip.open(fj[:-5] + ".lab.gz").read(), np.uint8).reshape(N, H, W)
    art = np.frombuffer(gzip.open(fj[:-5] + ".art.gz").read(), np.uint8).reshape(N, H, W)
    o, a, s = np.array(g["origine"]), np.array(g["assi"]), np.array(g["sp"])
    def ras(ijk):   # ijk = (strato, riga, colonna)
        k, j, i = ijk; p = o + i * s[0] * a[0] + j * s[1] * a[1] + k * s[2] * a[2]; return np.array([-p[0], -p[1], p[2]])
    inv = {v: int(k) for k, v in g["etichette"].items()}
    def C(n, vol=lab, val=None):
        k = val if val is not None else inv.get(n)
        if k is None or not (vol == k).any(): return None
        return ras(ndimage.center_of_mass(vol == k))
    prob = []
    # lati: corteccia sinistra con x minore della destra (RAS: sinistra = x negativa)
    for gy in ["superiorfrontal", "precentral", "superiortemporal", "lateraloccipital", "insula"]:
        l, r = C("ctx-lh-" + gy), C("ctx-rh-" + gy)
        if l is not None and r is not None and not l[0] < r[0]: prob.append(f"lato {gy}")
    for st in ["Thalamus-Proper*", "Putamen", "Cerebellum-Cortex"]:
        l, r = C("Left-" + st), C("Right-" + st)
        if l is not None and r is not None and not l[0] < r[0]: prob.append(f"lato {st}")
    # rapporti: precentrale davanti alla postcentrale; temporale superiore sopra il medio; occipitale dietro al frontale
    for h in ["lh", "rh"]:
        pre, post = C(f"ctx-{h}-precentral"), C(f"ctx-{h}-postcentral")
        if pre is not None and post is not None and not pre[1] > post[1]: prob.append(f"{h}: precentrale non davanti alla postcentrale")
        st_, mt = C(f"ctx-{h}-superiortemporal"), C(f"ctx-{h}-middletemporal")
        if st_ is not None and mt is not None and not st_[2] > mt[2]: prob.append(f"{h}: temporale superiore non sopra il medio")
        cu, sf = C(f"ctx-{h}-cuneus"), C(f"ctx-{h}-superiorfrontal")
        if cu is not None and sf is not None and not cu[1] < sf[1] - 60: prob.append(f"{h}: cuneo non posteriore")
        ins, sfr = C(f"ctx-{h}-insula"), C(f"ctx-{h}-superiorfrontal")
    tr, ce = C("Brain-Stem"), C("Left-Cerebellum-Cortex")
    if tr is not None and ce is not None and not ce[1] < tr[1]: prob.append("cervelletto non dietro al tronco")
    # territori: ACA più mediale della ACM frontale; PCA occipitale dietro la ACM frontale; VB sotto la ACA
    aca, mcaf, pcao, vb = C(None, art, 1), C(None, art, 7), C(None, art, 19), C(None, art, 27)
    if aca is not None and mcaf is not None and not abs(aca[0]) < abs(mcaf[0]): prob.append("ACA non mediale rispetto alla ACM")
    if pcao is not None and mcaf is not None and not pcao[1] < mcaf[1]: prob.append("ACP occipitale non dietro alla ACM frontale")
    if vb is not None and aca is not None and not vb[2] < aca[2]: prob.append("territorio cerebellare superiore non sotto la ACA")
    # coerenza struttura/territorio: frazione del giro precentrale in ACM, del cuneo in ACP, del tronco in VB
    def frazione(nome, territori):
        k = inv.get(nome); m = lab == k
        return float(np.isin(art[m], territori).mean()) if k and m.any() else None
    f1 = frazione("ctx-lh-precentral", [7, 9, 5]); f2 = frazione("ctx-lh-cuneus", [19, 17]); f3 = frazione("Brain-Stem", [25, 26, 27, 28, 29, 30, 21, 22])
    f4 = frazione("ctx-lh-superiorfrontal", [1, 3]); f5 = frazione("ctx-lh-lateraloccipital", [19, 13, 17])
    caso = fj.split("/")[-3]
    print(f"  {caso:15s} {'OK' if not prob else 'PROBLEMI: ' + '; '.join(prob)}  | precentrale in ACM {f1:.0%} · giro frontale sup. in ACA {f4:.0%} · cuneo in ACP {f2:.0%} · occip. lat. in ACP/ACM-occ {f5:.0%} · tronco in VB/perforanti {f3:.0%}")
