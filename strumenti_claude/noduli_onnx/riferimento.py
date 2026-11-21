#!/usr/bin/env python3
"""riferimento.py: decodifica di riferimento (Python + onnxruntime) identica a quella che farà noduli-client.js.
Uso: riferimento.py <cartella_dicom> [json_ia_atteso]"""
import sys, os, json, time, math, glob
import numpy as np, SimpleITK as sitk, onnxruntime as ort
from scipy import ndimage as ndi
QUI = os.path.dirname(os.path.abspath(__file__))
SP = np.array([0.703125, 0.703125, 1.25]); ROI = np.array([192, 192, 80]); PASSO = np.array([144, 144, 64]); DIV = np.array([16, 16, 8])
BASE = np.array([[6, 8, 4], [8, 6, 5], [10, 10, 6]], float); SCALE = [1, 2, 4]
CLIP = math.log(1000.0 / 16); SOGLIA = 0.05; TOPK = 1000; NMS = 0.22; MAXDET = 100

def leggi(cart):
    r = sitk.ImageSeriesReader(); f = r.GetGDCMSeriesFileNames(cart); r.SetFileNames(f); return r.Execute()

def ricampiona(img):
    # griglia RAS: asse0 verso R (x LPS decrescente), asse1 verso A (y decrescente), asse2 verso S
    sz = np.array(img.GetSize()); ang = []
    for i in (0, sz[0]-1):
        for j in (0, sz[1]-1):
            for k in (0, sz[2]-1):
                ang.append(img.TransformIndexToPhysicalPoint((int(i), int(j), int(k))))
    ang = np.array(ang); lo, hi = ang.min(0), ang.max(0)
    n = np.floor((hi - lo) / SP).astype(int) + 1
    ref = sitk.Image([int(v) for v in n], sitk.sitkFloat32)
    ref.SetSpacing(tuple(SP)); ref.SetOrigin((hi[0], hi[1], lo[2])); ref.SetDirection((-1, 0, 0, 0, -1, 0, 0, 0, 1))
    out = sitk.Resample(img, ref, sitk.Transform(), sitk.sitkLinear, -1024.0, sitk.sitkFloat32)
    return sitk.GetArrayFromImage(out).transpose(2, 1, 0), np.array([hi[0], hi[1], lo[2]])

def riquadro_polmoni(hu):
    m = hu < -400
    lab, n = ndi.label(m)
    bordo = np.unique(np.concatenate([lab[0].ravel(), lab[-1].ravel(), lab[:, 0].ravel(), lab[:, -1].ravel()]))
    vol = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n+1))
    soglia = 50000 / np.prod(SP)  # 50 mL
    keep = [i+1 for i in range(n) if vol[i] > soglia and (i+1) not in bordo]
    if not keep: return np.zeros(3, int), np.array(hu.shape)
    mm = np.isin(lab, keep); idx = np.array(np.where(mm))
    mg = np.ceil(10 / SP).astype(int)
    return np.maximum(idx.min(1) - mg, 0), np.minimum(idx.max(1) + mg + 1, hu.shape)

def round_even(v): return np.round(v)  # numpy arrotonda come torch (metà al pari)

def ancore(grid, stride, liv):
    forme = BASE * SCALE[liv]; meta = forme / 2.0
    base = round_even(np.concatenate([-meta, meta], 1))  # (3,6)
    cs = [np.arange(grid[d]) * stride[d] + stride[d] // 2 for d in range(3)]
    gx, gy, gz = np.meshgrid(*cs, indexing='ij')
    sh = np.stack([gx.ravel(), gy.ravel(), gz.ravel()] * 2, 1).astype(float)  # (L,6)
    return (sh[:, None, :] + base[None]).reshape(-1, 6)

def iou3(b, bs):
    lo = np.maximum(b[:3], bs[:, :3]); hi = np.minimum(b[3:], bs[:, 3:])
    inter = np.prod(np.clip(hi - lo, 0, None), 1)
    va = np.prod(b[3:] - b[:3]); vb = np.prod(bs[:, 3:] - bs[:, :3], 1)
    return inter / (va + vb - inter + 1e-9)

def main():
    img = leggi(sys.argv[1]); t0 = time.time()
    hu, org = ricampiona(img)
    lo, hi = riquadro_polmoni(hu)
    v = hu[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    orig = np.array(v.shape)
    if os.environ.get('DUMP'):
        np.round(v).astype('<i2').tofile(os.environ['DUMP']); json.dump(dict(d=list(map(int, orig)), lo=list(map(int, lo)), org=list(map(float, org))), open(os.environ['DUMP'] + '.json', 'w')); return
    x = np.clip((v + 1024.0) / 1324.0, 0, 1).astype(np.float32)
    dim = np.maximum(ROI, np.ceil(orig / DIV).astype(int) * DIV)
    xp = np.zeros(dim, np.float32); xp[:orig[0], :orig[1], :orig[2]] = x
    print('volume', hu.shape, 'riquadro', lo, hi, 'pad', dim, f'{time.time()-t0:.1f}s', flush=True)
    so = ort.SessionOptions(); s = ort.InferenceSession(os.path.join(QUI, 'noduli.onnx'), so, providers=['CPUExecutionProvider'])
    strides = [np.array([4, 4, 2]), np.array([8, 8, 4]), np.array([16, 16, 8])]
    somme = [None] * 6; conta = [np.zeros(dim // st) for st in strides]
    inizi = [sorted(set(list(range(0, dim[d] - ROI[d] + 1, PASSO[d])) + [dim[d] - ROI[d]])) for d in range(3)]
    nf = 0; t1 = time.time()
    for a in inizi[0]:
        for b in inizi[1]:
            for c in inizi[2]:
                fin = xp[a:a+192, b:b+192, c:c+80][None, None]
                out = s.run(None, {s.get_inputs()[0].name: fin}); nf += 1
                for k in range(6):
                    st = strides[k % 3]; o = out[k][0]
                    if somme[k] is None: somme[k] = np.zeros((o.shape[0],) + tuple(dim // st), np.float32)
                    sl = (slice(None), slice(a // st[0], a // st[0] + o.shape[1]), slice(b // st[1], b // st[1] + o.shape[2]), slice(c // st[2], c // st[2] + o.shape[3]))
                    somme[k][sl] += o
                    if k < 3: conta[k][sl[1:]] += 1
    print(f'finestre {nf}, {time.time()-t1:.1f}s ({(time.time()-t1)/nf:.2f}s/finestra)', flush=True)
    tutte_b, tutte_s = [], []
    for l in range(3):
        cls = somme[l] / conta[l]; reg = somme[l + 3] / conta[l]
        grid = cls.shape[1:]
        logit = cls.reshape(3, -1).T.ravel()  # (X,Y,Z,A)
        d = reg.reshape(3, 6, -1).transpose(2, 0, 1).reshape(-1, 6)
        sc = 1 / (1 + np.exp(-logit)); idx = np.where(sc > SOGLIA)[0]
        idx = idx[np.argsort(-sc[idx])][:TOPK]
        an = ancore(grid, strides[l], l)[idx]; dd = d[idx]
        w = an[:, 3:] - an[:, :3]; ctr = an[:, :3] + w / 2
        pc = dd[:, :3] * w + ctr; ps = np.exp(np.minimum(dd[:, 3:], CLIP)) * w
        bx = np.concatenate([pc - ps / 2, pc + ps / 2], 1)
        bx[:, :3] = np.clip(bx[:, :3], 0, orig); bx[:, 3:] = np.clip(bx[:, 3:], 0, orig)
        ok = np.all(bx[:, 3:] > bx[:, :3], 1)
        tutte_b.append(bx[ok]); tutte_s.append(sc[idx][ok])
    B = np.concatenate(tutte_b); S = np.concatenate(tutte_s); o = np.argsort(-S); B, S = B[o], S[o]
    tenuti = []; vivi = np.ones(len(B), bool)
    for i in range(len(B)):
        if not vivi[i]: continue
        tenuti.append(i)
        if len(tenuti) >= MAXDET: break
        vivi[i+1:] &= iou3(B[i], B[i+1:]) <= NMS
    ris = []
    for i in tenuti:
        c = (B[i, :3] + B[i, 3:]) / 2 + lo
        lps = org + np.array([-1, -1, 1]) * c * SP
        ris.append(dict(lps=[round(float(t), 1) for t in lps], d=round(float(np.mean((B[i, 3:] - B[i, :3]) * SP)), 1), s=round(float(S[i]), 3)))
    print(f'totale {time.time()-t0:.1f}s, {len(ris)} candidati')
    attesi = []
    if len(sys.argv) > 2:
        attesi = json.load(open(sys.argv[2]))['analisi']['noduli']
    for r in ris[:15]:
        dm = min([np.linalg.norm(np.array(r['lps']) - np.array(n['centro_lps'])) for n in attesi] or [0])
        print(r, f'dist. dal nodulo noto più vicino {dm:.1f} mm')
    json.dump(ris, open(os.path.join(QUI, 'riferimento_out.json'), 'w'))
main()
