"""Immagini per il revisore indipendente: per ogni nodulo della seconda lettura, assiale intera,
assiale ingrandita e coronale ingrandita in finestra polmonare, con barra di 10 mm e cerchio sul centro.
Uso: revisione_img.py <cartella lavoro> <uscita.png>"""
import sys, json, numpy as np, SimpleITK as sitk
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt

lav, out = sys.argv[1], sys.argv[2]
img = sitk.ReadImage(f"{lav}/ct.nii.gz"); hu = sitk.GetArrayFromImage(img).astype(float)
sp = img.GetSpacing()[::-1]  # z y x
ris = json.load(open(f"{lav}/risultati.json"))
nod = ris["noduli"]
W = lambda a: np.clip((a + 1350) / 1500, 0, 1)   # L -600 W 1500
fig, ax = plt.subplots(max(1, len(nod)), 3, figsize=(12, 4 * max(1, len(nod))), facecolor="black", squeeze=False)
for r, n in enumerate(nod):
    z, y, x = n["indice_zyx"]
    a = ax[r]
    a[0].imshow(W(hu[z]), cmap="gray"); a[0].add_patch(plt.Circle((x, y), 18 / sp[2], fill=False, color="yellow"))
    a[0].set_title(f"#{n['n']} assiale (immagine {n['immagine']} nella piattaforma)", color="white", fontsize=9)
    h = int(25 / sp[1]); sub = hu[z, max(0, y - h):y + h, max(0, x - h):x + h]
    a[1].imshow(W(sub), cmap="gray"); a[1].plot([5, 5 + 10 / sp[2]], [sub.shape[0] - 6] * 2, color="cyan", lw=2)
    a[1].set_title("assiale ingrandita (barra 10 mm)", color="white", fontsize=9)
    hz = int(25 / sp[0]); cor = hu[max(0, z - hz):z + hz, y, max(0, x - h):x + h]
    a[2].imshow(W(cor)[::-1], cmap="gray", aspect=sp[0] / sp[2]); a[2].set_title("coronale ingrandita", color="white", fontsize=9)
    for q in a: q.axis("off")
plt.tight_layout(); plt.savefig(out, dpi=110, facecolor="black")
print("ok", out)
