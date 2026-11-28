"""Dati dell'atlante per il visualizzatore nel browser (web/atlante/):
- riferimento.json: centri (RAS mm, spazio MNI ICBM 2009c) delle strutture MindSnap calcolate sul template;
- arterie-mni-2mm.bin.gz: territori arteriosi (atlante JHU, CC BY-SA 4.0) a 2 mm, uint8, indice x più veloce;
  la geometria (origine e passo, RAS) è in riferimento.json.
"""
import gzip, json, os
import numpy as np, nibabel as nib
QUI = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(QUI, "atlante")
DEST = "/Volumes/Caloggero/piattaforma-quiz/cloud/web/atlante"; os.makedirs(DEST, exist_ok=True)
rif = json.load(open(os.path.join(D, "riferimento.json")))
art = nib.load(os.path.join(D, "arterie_mni.nii.gz")); A = np.asarray(art.dataobj).astype(np.uint8); aff = art.affine
assert np.allclose(aff[:3, :3], np.eye(3)), aff
# 2 mm: voto di maggioranza nei blocchi 2x2x2 (0 = fuori) per non perdere i territori sottili
X, Y, Z = (n // 2 for n in A.shape)
b = A[:2 * X, :2 * Y, :2 * Z].reshape(X, 2, Y, 2, Z, 2).transpose(0, 2, 4, 1, 3, 5).reshape(X, Y, Z, 8)
best = np.zeros((X, Y, Z), np.int8); out = np.zeros((X, Y, Z), np.uint8)
for v in range(1, 33):
    c = (b == v).sum(-1).astype(np.int8); m = c > best; best[m] = c[m]; out[m] = v
out[(b > 0).sum(-1) < 4] = 0                       # blocchi in gran parte fuori dall'atlante
origine = (aff[:3, 3] + 0.5).tolist()           # centro del blocco 2x2x2 del primo voxel
with gzip.open(os.path.join(DEST, "arterie-mni-2mm.bin.gz"), "wb", compresslevel=9) as f:
    f.write(np.ascontiguousarray(out.transpose(2, 1, 0)).tobytes())   # indice x più veloce (come i NIfTI)
json.dump({"spazio": rif["spazio"], "centri": rif["centri"],
           "arterie": {"dim": [X, Y, Z], "origine": origine, "passo": 2.0, "file": "arterie-mni-2mm.bin.gz"},
           "fonti": ["Template ICBM 2009c asimmetrico (Fonov et al., McGill University, licenza permissiva)",
                     "Digital 3D Brain MRI Arterial Territories Atlas, Liu et al., Sci Data 2023, Johns Hopkins University, CC BY-SA 4.0",
                     "Strutture: MindSnap (brainchop 1.1.2, MIT) calcolato sul template"]},
          open(os.path.join(DEST, "riferimento.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(out.shape, os.path.getsize(os.path.join(DEST, "arterie-mni-2mm.bin.gz")), "byte", np.unique(out).size - 1, "territori")

# 28/11 — strutture MindSnap sul template a 2 mm (per la TC: l'atlante si porta sull'esame con una trasformazione affine)
snap = nib.load(os.path.join(D, "mni_snap.nii.gz")); S = np.asarray(snap.dataobj).astype(np.uint8)
assert np.allclose(snap.affine, aff), (snap.affine, aff)
b = S[:2 * X, :2 * Y, :2 * Z].reshape(X, 2, Y, 2, Z, 2).transpose(0, 2, 4, 1, 3, 5).reshape(X, Y, Z, 8)
best = np.zeros((X, Y, Z), np.int8); st = np.zeros((X, Y, Z), np.uint8)
for v in range(1, 104):
    c = (b == v).sum(-1).astype(np.int8); m = c > best; best[m] = c[m]; st[m] = v
st[(b > 0).sum(-1) < 4] = 0
with gzip.open(os.path.join(DEST, "strutture-mni-2mm.bin.gz"), "wb", compresslevel=9) as f:
    f.write(np.ascontiguousarray(st.transpose(2, 1, 0)).tobytes())
r = json.load(open(os.path.join(DEST, "riferimento.json")))
r["strutture"] = {"dim": [X, Y, Z], "origine": origine, "passo": 2.0, "file": "strutture-mni-2mm.bin.gz"}
json.dump(r, open(os.path.join(DEST, "riferimento.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("strutture", st.shape, os.path.getsize(os.path.join(DEST, "strutture-mni-2mm.bin.gz")), "byte", np.unique(st).size - 1, "etichette")

# 28/11 — template T1 (testa intera) a 2 mm, 0–255: per allineare l'atlante alle RM su cui la segmentazione automatica
# non è affidabile (informazione mutua, indipendente dal contrasto: FLAIR, T2, ...)
t1 = nib.load(os.path.join(D, "tpl-MNI152NLin2009cAsym_res-01_T1w.nii.gz")); T = np.asarray(t1.dataobj).astype(np.float32)
assert np.allclose(t1.affine, aff), (t1.affine, aff)
Tb = T[:2 * X, :2 * Y, :2 * Z].reshape(X, 2, Y, 2, Z, 2).mean(axis=(1, 3, 5))
Tb = np.clip(Tb / np.percentile(Tb[Tb > 0], 99.5) * 255, 0, 255).astype(np.uint8)
with gzip.open(os.path.join(DEST, "t1-mni-2mm.bin.gz"), "wb", compresslevel=9) as f:
    f.write(np.ascontiguousarray(Tb.transpose(2, 1, 0)).tobytes())
r = json.load(open(os.path.join(DEST, "riferimento.json")))
r["t1"] = {"dim": [X, Y, Z], "origine": origine, "passo": 2.0, "file": "t1-mni-2mm.bin.gz"}
json.dump(r, open(os.path.join(DEST, "riferimento.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("t1", Tb.shape, os.path.getsize(os.path.join(DEST, "t1-mni-2mm.bin.gz")), "byte")
