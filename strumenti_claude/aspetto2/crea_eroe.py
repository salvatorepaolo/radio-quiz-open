"""Immagine dell'apertura della pagina iniziale: RM sagittale vera di un caso del sito (immagini anonime da TCIA, CC BY 4.0)
con i lobi dell'atlante che compaiono da un lato. Uso: crea_eroe.py <caso> <x_mm RAS, dal lato senza lesione> <uscita senza estensione>"""
import gzip, json, glob, sys
import numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter
sys.path.insert(0, "/Volumes/Caloggero/strumenti_claude/encefalo")
from segmenta_encefalo import NOMI
CASO = sys.argv[1]; D = "/Volumes/Caloggero/piattaforma-quiz/casi-free/" + CASO
fj = sorted(glob.glob(D + "/ia/*.json"))[0]; g = json.load(open(fj)); W, H, N = g["dim"]
lab = np.frombuffer(gzip.open(fj[:-5] + ".lab.gz").read(), np.uint8).reshape(N, H, W)
import SimpleITK as sitk
from segmenta_encefalo import volume
S = [s for s in json.load(open(D + "/serie.json")) if s["files"][0].split("/")[1] == g["serie"] or g["serie"] in s["files"][0]][0]
vimg, _ = volume(CASO, S); vol = sitk.GetArrayFromImage(vimg).astype(np.float32)     # (strato, riga, colonna) come lab
assert vol.shape == lab.shape, (vol.shape, lab.shape)
o, a, sp = np.array(g["origine"]), np.array(g["assi"]), np.array(g["sp"])
# lobi: corteccia per lobo, sostanza bianca al lobo più vicino (come atlante-encefalo.js)
LOBO = {}
for k, v in {1: "superiorfrontal rostralmiddlefrontal caudalmiddlefrontal parsopercularis parstriangularis parsorbitalis lateralorbitofrontal medialorbitofrontal precentral paracentral frontalpole",
             2: "superiorparietal inferiorparietal supramarginal postcentral precuneus", 3: "superiortemporal middletemporal inferiortemporal bankssts fusiform transversetemporal temporalpole",
             4: "lateraloccipital lingual cuneus pericalcarine", 5: "insula", 6: "rostralanteriorcingulate caudalanteriorcingulate posteriorcingulate isthmuscingulate parahippocampal entorhinal"}.items():
    for x in v.split(): LOBO[x] = k
lut = np.zeros(256, np.uint8)
for i, n in enumerate(NOMI):
    if n.startswith("ctx-"): lut[i] = LOBO.get(n[7:], 0)
    elif "Cerebellum" in n: lut[i] = 9
    elif n == "Brain-Stem": lut[i] = 8
    elif any(t in n for t in ("Thalamus", "Caudate", "Putamen", "Pallidum", "Accumbens", "VentralDC")): lut[i] = 7
    elif any(t in n for t in ("Hippocampus", "Amygdala")): lut[i] = 6
lob = lut[lab]
bianca = np.isin(lab, [NOMI.index("Left-Cerebral-White-Matter"), NOMI.index("Right-Cerebral-White-Matter")])
semi = np.isin(lob, [1, 2, 3, 4])
_, idx = ndimage.distance_transform_edt(~semi, sampling=[sp[2], sp[1], sp[0]], return_indices=True)
lob[bianca] = lob[idx[0][bianca], idx[1][bianca], idx[2][bianca]]
COL = {1: (72, 120, 230), 2: (236, 190, 50), 3: (70, 190, 110), 4: (228, 82, 82), 5: (170, 110, 220), 6: (40, 200, 210), 7: (235, 150, 190), 8: (190, 160, 120), 9: (150, 200, 150)}
# piano sagittale a x_mm (RAS) → campionamento del volume su una griglia 1 mm (y anteriore→, z alto↑)
x_rel = float(sys.argv[2]); out = sys.argv[3]
# centro del cervello in RAS (le coordinate dello scanner non sono centrate sulla testa)
kk, jj, ii = [c.mean() for c in np.nonzero(lab[::2, ::2, ::2])]
cen = o + ii * 2 * sp[0] * a[0] + jj * 2 * sp[1] * a[1] + kk * 2 * sp[2] * a[2]; cen = np.array([-cen[0], -cen[1], cen[2]])
x_ras = cen[0] + x_rel
ys = cen[1] + np.arange(-100, 92, 0.2); zs = cen[2] + np.arange(82, -78, -0.2)
Y, Z = np.meshgrid(ys, zs)
P_lps = np.stack([-x_ras * np.ones_like(Y), -Y, Z], -1)                     # RAS → LPS
M = np.stack([a[0] * sp[0], a[1] * sp[1], a[2] * sp[2]], 1)                  # colonne: passo per i, j, k (mondo LPS)
ijk = np.linalg.solve(M, (P_lps - o).reshape(-1, 3).T)                       # (3, n): i colonna, j riga, k strato
coord = np.stack([ijk[2], ijk[1], ijk[0]])                                   # ordine (strato, riga, colonna)
img = ndimage.map_coordinates(vol, coord, order=3, mode="constant", cval=0).reshape(Y.shape)
lb0 = ndimage.map_coordinates(lob, coord, order=0, mode="constant", cval=0).reshape(Y.shape)
can = np.stack([ndimage.gaussian_filter((lb0 == k).astype(np.float32), 3.0) for k in range(0, 10)])
lb = can.argmax(0).astype(np.uint8)
# coordinate fuori dal volume acquisito: nero (si ritaglia sotto)
fuori = ((coord < -0.5) | (coord > (np.array(vol.shape)[:, None] - 0.5))).any(0).reshape(Y.shape)
lo, hi = np.percentile(img[img > img.max() * 0.05], [1, 99.7]); gr = np.clip((img - lo) / (hi - lo), 0, 1) ** 0.85
rgb = np.repeat(gr[..., None], 3, -1) * 255
# colori con dissolvenza: immagine pulita da un lato, atlante dall'altro
alfa = np.clip((0.70 - np.arange(Y.shape[1]) / Y.shape[1]) / 0.25, 0, 1)[None, :] * 0.50   # dopo il capovolgimento: pulita a sinistra, atlante a destra
cm = np.zeros_like(rgb)
for k, c in COL.items(): cm[lb == k] = c
m = lb > 0
rgb[m] = rgb[m] * (1 - alfa.repeat(Y.shape[0], 0)[m, None]) + cm[m] * alfa.repeat(Y.shape[0], 0)[m, None]
# bordi sottili tra i lobi
bordo = (ndimage.maximum_filter(lb, 3) != ndimage.minimum_filter(lb, 3)) & m & (ndimage.minimum_filter(lb, 3) > 0)
rgb[bordo] = rgb[bordo] * (1 - alfa.repeat(Y.shape[0], 0)[bordo, None] * 0.9) + 255 * alfa.repeat(Y.shape[0], 0)[bordo, None] * 0.9
rgb[fuori] = 0
im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
# il visualizzatore mostra l'anteriore a sinistra nel sagittale: si capovolge in orizzontale
im = im.transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.UnsharpMask(radius=1.6, percent=50))
im.save(out + ".jpg", quality=86, optimize=True, progressive=True); im.save(out + ".webp", quality=80, method=6)
print(im.size)
