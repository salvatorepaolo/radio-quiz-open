"""Prepara i dati di riferimento dell'atlante dell'encefalo (una volta sola, sul Mac):
- atlante dei territori arteriosi (Liu et al., Sci Data 2023, CC BY-SA 4.0) portato sulla griglia del template
  ICBM 2009c (1 mm), con la geometria corretta (il file originale ha l'affine senza origine);
- centri (in mm, spazio MNI) delle 103 strutture di MindSnap calcolate sul template: punti di riferimento per
  adattare l'atlante a ogni esame.
Scrive atlante/riferimento.json e atlante/arterie_mni.nii.gz (+ un'immagine di controllo).
"""
import json, os
import numpy as np, nibabel as nib
from scipy import ndimage
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "atlante")
tpl = nib.load(os.path.join(D, "tpl-MNI152NLin2009cAsym_res-01_T1w.nii.gz"))
snap = nib.load(os.path.join(D, "mni_snap.nii.gz"))
art0 = nib.load(os.path.join(D, "ArterialAtlas.nii"))
a0 = np.rint(np.asarray(art0.dataobj)[..., 0] if art0.ndim == 4 else np.asarray(art0.dataobj)).astype(np.int16)
# griglia MNI152 a 1 mm di FSL (182x218x182): x_mm = 90 - i, y_mm = j - 126, z_mm = k - 72
A_ART = np.array([[-1, 0, 0, 90], [0, 1, 0, -126], [0, 0, 1, -72], [0, 0, 0, 1]], float)
# atlante sulla griglia del template (vicino più prossimo)
T = tpl.affine; inv_art = np.linalg.inv(A_ART)
I, J, K = np.meshgrid(*[np.arange(n) for n in tpl.shape[:3]], indexing="ij")
mm = T[:3, :3] @ np.stack([I.ravel(), J.ravel(), K.ravel()]) + T[:3, 3:4]
v = np.rint(inv_art[:3, :3] @ mm + inv_art[:3, 3:4]).astype(int)
ok = np.all((v >= 0) & (v < np.array(a0.shape)[:, None]), 0)
art = np.zeros(I.size, np.int16); art[ok] = a0[v[0, ok], v[1, ok], v[2, ok]]; art = art.reshape(tpl.shape[:3])
nib.save(nib.Nifti1Image(art.astype(np.uint8), T), os.path.join(D, "arterie_mni.nii.gz"))
# controllo lato: il territorio 1 (ACA sinistra) deve avere x_mm < 0 (sinistra in RAS)
def centro_mm(lab, val, aff):
    c = np.array(ndimage.center_of_mass(lab == val)); return (aff[:3, :3] @ c + aff[:3, 3]).tolist()
print("ACA sin (1):", [round(x, 1) for x in centro_mm(art, 1, T)], " ACA dx (2):", [round(x, 1) for x in centro_mm(art, 2, T)])
s = np.rint(np.asarray(snap.dataobj)).astype(np.int16)
print("ctx-lh-superiorfrontal (27):", [round(x, 1) for x in centro_mm(s, 27, snap.affine)])
# sovrapposizione: quante etichette arteriose cadono nel cervello del template
cerv = s > 0
print("voxel dell'atlante dentro il cervello del template: %.1f%%" % (100 * ((art > 0) & cerv).sum() / max(1, (art > 0).sum())))
print("cervello del template coperto dall'atlante: %.1f%%" % (100 * ((art > 0) & cerv).sum() / max(1, cerv.sum())))
# centri delle strutture MindSnap (RAS mm) e numero di voxel
centri = {}
for k in range(1, int(s.max()) + 1):
    n = int((s == k).sum())
    if n > 30: centri[k] = [round(x, 2) for x in centro_mm(s, k, snap.affine)] + [n]
json.dump({"spazio": "MNI152NLin2009cAsym (RAS mm)", "centri": centri}, open(os.path.join(D, "riferimento.json"), "w"))
print(len(centri), "centri")
# immagine di controllo
from PIL import Image
g = np.asarray(tpl.dataobj).astype(float); g = np.clip(g / np.percentile(g, 99.5), 0, 1)
rng = np.random.default_rng(1); col = rng.integers(40, 255, (40, 3)); col[0] = 0
def tav(gs, ls):
    rgb = np.repeat(gs[..., None], 3, -1) * 255; m = ls > 0; rgb[m] = rgb[m] * 0.5 + col[ls[m]] * 0.5
    return Image.fromarray(np.rot90(rgb.astype(np.uint8)))
X, Y, Z = art.shape
pz = [tav(g[:, :, 95], art[:, :, 95]), tav(g[:, :, 60], art[:, :, 60]), tav(g[:, 120, :], art[:, 120, :]), tav(g[70, :, :], art[70, :, :])]
W = sum(p.width for p in pz); out = Image.new("RGB", (W, max(p.height for p in pz))); x = 0
for p in pz: out.paste(p, (x, 0)); x += p.width
out.save(os.path.join(D, "controllo_arterie.png"))
