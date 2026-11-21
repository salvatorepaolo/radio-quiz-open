import sys, json, numpy as np, SimpleITK as sitk
from scipy import ndimage as ndi
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); r = sitk.ImageSeriesReader(); r.SetFileNames(r.GetGDCMSeriesFileNames(d['cartella'])); im = r.Execute()
cm, X, Y, Z = map(np.array, (d['cm'], d['X'], d['Y'], d['Z']))
def piano(c, u, v, ext=110):   # immagine sul piano per c con assi u (orizzontale) e v (verticale), 0,5 mm
    s = np.arange(-ext, ext, 0.5); U, Vv = np.meshgrid(s, s)
    pts = c + U[..., None] * u + Vv[..., None] * v
    idx = np.array([im.TransformPhysicalPointToContinuousIndex(tuple(p)) for p in pts.reshape(-1, 3)[::1]])
    a = sitk.GetArrayFromImage(im).astype(np.float32)
    return ndi.map_coordinates(a, idx[:, ::-1].T, order=1, cval=-1024).reshape(U.shape)
def proj(p, c, u, v): q = np.array(p) - c; return q @ u, q @ v
g, m = d.get('globi') or [], d.get('meati') or []
fig, ax = plt.subplots(1, 4, figsize=(20, 5))
viste = []
if g: c = np.mean(g, 0); viste.append(('assiale ai globi', c, X, Y))
for i, mm in enumerate(m): viste.append((f'sagittale meato {i}', np.array(mm), Y, Z))
viste.append(('mediana', cm, Y, Z))
for k, (tit, c, u, v) in enumerate(viste[:4]):
    I = piano(c, u, v); ax[k].imshow(I, cmap='gray', vmin=np.percentile(I,1), vmax=np.percentile(I,99.5), origin='lower', extent=[-110, 110, -110, 110])
    for p, col in [(x, 'lime') for x in g] + [(x, 'red') for x in m]:
        a_, b_ = proj(p, c, u, v); ax[k].plot(a_, b_, 'o', mfc='none', mec=col, ms=10)
    ax[k].set_title(f"{tit} {d.get('motivo') or 'ok'}")
plt.tight_layout(); plt.savefig(sys.argv[2], dpi=55)
