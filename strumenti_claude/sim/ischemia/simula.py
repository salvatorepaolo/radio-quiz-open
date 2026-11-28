# simula.py (28/11): infarto ischemico acuto-subacuto (circa 9 ore) nel territorio della divisione superiore della
# cerebrale media sinistra (territori JHU «ACM frontale sin» e «ACM insulare sin», portati sulla TC dall'atlante del
# visualizzatore: /tmp/em_art.u8) su TC encefalo normale (TotalSegmentator s0103, prepara.py della cartella emorragia).
# Effetti: ipodensità di corteccia e sostanza bianca sottocorticale, perdita della differenziazione grigia-bianca
# (nastro insulare, opercolo frontale), solchi meno visibili. Nuclei della base risparmiati. Rumore originale conservato.
import numpy as np, json
from scipy import ndimage as ndi
v = np.load('/tmp/em_v.npy'); br = np.load('/tmp/em_brain.npy'); K, R, C = v.shape
art = np.fromfile('/tmp/em_art.u8', np.uint8).reshape(K, R, C)
# ASPECTS voluto: insula, M1 e M4 (7). Frontale MCA solo nel terzo anteriore dell'emisfero (niente M2/M5); nuclei della
# base e capsula interna risparmiati (etichette dell'atlante /tmp/em_lab.u8, allargate di 3 mm)
lab = np.fromfile('/tmp/em_lab.u8', np.uint8).reshape(K, R, C)
NOMI = __import__('json').load(open('/tmp/nomi_mindsnap.json'))
prof = np.isin(lab, [i for i, n in enumerate(NOMI) if any(x in n for x in ('Caudate', 'Putamen', 'Pallidum', 'Thalamus', 'VentralDC', 'Accumbens'))])
prof = ndi.binary_dilation(prof, iterations=2)
taglio = np.full(K, R, float)
for k in range(K):
    rr = np.where(br[k].any(1))[0]
    if len(rr): taglio[k] = rr[0] + 0.40 * (rr[-1] - rr[0])
reg = (np.isin(art, [7, 15])) & ~prof & ndi.binary_erosion(br, iterations=1)
# lontano dalla linea mediana (nuclei della base e capsula interna sicuramente risparmiati): oltre 28 mm nelle fette dei
# nuclei della base (fino al tetto dei ventricoli laterali), oltre 20 mm più in alto
mid = np.array([np.mean(np.where(br[k].any(0))[0][[0, -1]]) if br[k].any() else C / 2 for k in range(K)])
dist = np.abs(np.arange(C)[None, None, :] - mid[:, None, None]) * 1.5
soglia = np.where(np.arange(K) < 72, 28, 20)[:, None, None]
reg = ndi.binary_closing(reg, iterations=2) & br
rng = np.random.default_rng(181)
pert = ndi.gaussian_filter(rng.normal(size=v.shape).astype(np.float32), 3.0); pert /= pert.std()
# limiti morbidi e irregolari (niente bordi dritti): taglio anteriore (solo ACM frontale) e distanza dalla linea mediana
sig = lambda x: 1 / (1 + np.exp(-x))
righe = np.arange(R)[None, :, None]
w_ant = np.where(art == 15, 1.0, sig((taglio[:, None, None] - righe) / 2.5 + 1.2 * pert))
w_med = sig((dist - soglia) / 3.0 + 1.2 * pert)
base = ndi.gaussian_filter(reg.astype(np.float32), 1.6) * 1.25 * w_ant * w_med
w = np.clip(base + 0.08 * pert * (base > 0.05), 0, 1) * br
reg = w > 0.5
vs = ndi.gaussian_filter(v, 1.0); res = v - vs
par = (vs > 18) & (vs < 55)
delta = (4.0 + 0.7 * np.clip(vs - 28, 0, None)) * par            # grigia (~38 HU) -11, bianca (~28) -4
liq = (vs <= 18) & (vs > -20) & ndi.binary_dilation(reg, iterations=2)
out = vs - w * delta + w * 10 * liq + res                          # solchi del territorio meno visibili
out[~br] = v[~br]
m = reg & par
print(json.dumps({'ml_territorio': round(float(reg.sum()) * 1.5 ** 3 / 1000, 1), 'HU_prima': round(float(v[m].mean()), 1), 'HU_dopo': round(float(out[m].mean()), 1),
                  'k': [int(np.where(reg.any((1, 2)))[0][0]), int(np.where(reg.any((1, 2)))[0][-1])]}))
np.save('/tmp/em_sim.npy', out.astype(np.float32)); np.save('/tmp/isch_mask.npy', reg)
