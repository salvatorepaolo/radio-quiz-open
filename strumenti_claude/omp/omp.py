#!/usr/bin/env python3
"""omp.py: prototipo del piano orbito-meatale (OMP) da punti di repere, per il visualizzatore.
1) piano medio-sagittale per simmetria; 2) globi oculari (sfere di liquido, simmetriche, davanti); 3) meati acustici esterni
(«fossa» d'aria che entra di lato nella testa, dietro e un po' sotto le orbite); 4) OMP = piano che contiene l'asse
destra-sinistra e la retta dal punto medio dei meati al punto medio dei globi (canto esterno ≈ altezza del centro del globo).
Uso: omp.py <cartella_serie> <uscita.png>"""
import sys, json, math, numpy as np, SimpleITK as sitk
from scipy import ndimage as ndi
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt

def leggi(c):
    r = sitk.ImageSeriesReader(); r.SetFileNames(r.GetGDCMSeriesFileNames(c)); return r.Execute()

def iso(img, s=1.0):
    sz = np.array(img.GetSize()); pts = np.array([img.TransformIndexToPhysicalPoint((int(i), int(j), int(k))) for i in (0, sz[0]-1) for j in (0, sz[1]-1) for k in (0, sz[2]-1)])
    lo, hi = pts.min(0), pts.max(0); n = np.floor((hi - lo) / s).astype(int) + 1
    ref = sitk.Image([int(v) for v in n], sitk.sitkFloat32); ref.SetSpacing((s, s, s)); ref.SetOrigin(tuple(lo))
    out = sitk.Resample(sitk.Cast(img, sitk.sitkFloat32), ref, sitk.Transform(), sitk.sitkLinear, -2000.0)
    return sitk.GetArrayFromImage(out).transpose(2, 1, 0), lo   # a[x,y,z] LPS, 1 mm

def main():
    img = leggi(sys.argv[1]); mod = sitk.ImageFileReader(); fs = sitk.ImageSeriesReader().GetGDCMSeriesFileNames(sys.argv[1]); mod.SetFileName(fs[0]); mod.ReadImageInformation()
    ct = mod.GetMetaData('0008|0060').strip() == 'CT' if mod.HasMetaDataKey('0008|0060') else True
    a, o = iso(img)
    fuori = a <= -1999
    if ct: tess = a > -300; lo_, hi_ = -100, 120
    else:
        v = a[~fuori]; p99 = np.percentile(v, 99); a = a / p99 * 1000; a[fuori] = -2000
        thr = 150; tess = a > thr; lo_, hi_ = 0, 1000
    print('ct', ct, 'forma', a.shape)
    idx = np.array(np.nonzero(tess)); cm = idx.mean(1)
    P = lambda q: q   # coordinate in voxel = mm (origine o)
    def val(q):
        return ndi.map_coordinates(a, q.T, order=1, cval=-2000)
    # ---- simmetria
    pts = idx[:, ::max(1, idx.shape[1] // 6000)].T.astype(float); vp = np.clip(a[tuple(pts.T.astype(int))], lo_, hi_)
    def corr(yaw, roll, d):
        A, B = math.radians(yaw), math.radians(roll); nrm = np.array([math.cos(A) * math.cos(B), math.sin(A) * math.cos(B), -math.sin(B)])
        e = (pts - cm) @ nrm - d; r = pts - 2 * e[:, None] * nrm; v = val(r); ok = v > -1999; vv = np.clip(v[ok], lo_, hi_); pp = vp[ok]
        if ok.mean() < 0.5: return -1
        return np.corrcoef(pp, np.where(vv > (-300 if ct else thr), vv, lo_))[0, 1]
    best = max(((corr(y, r, 0), y, r, 0) for y in range(-20, 21, 4) for r in range(-20, 21, 4)))
    for pa in (2, 1, 0.5):
        migliora = True
        while migliora:
            migliora = False
            for dy, dr, dd in ((pa, 0, 0), (-pa, 0, 0), (0, pa, 0), (0, -pa, 0), (0, 0, 2 * pa), (0, 0, -2 * pa)):
                t = (corr(best[1] + dy, best[2] + dr, best[3] + dd), best[1] + dy, best[2] + dr, best[3] + dd)
                if t[0] > best[0] + 1e-4: best = t; migliora = True
    r, yaw, roll, d = best; A, B = math.radians(yaw), math.radians(roll)
    X = np.array([math.cos(A) * math.cos(B), math.sin(A) * math.cos(B), -math.sin(B)]); X = X if X[0] > 0 else -X   # verso sinistra (LPS +x)
    c0 = cm + d * X
    Y = np.array([0, -1.0, 0]); Y = Y - (Y @ X) * X; Y /= np.linalg.norm(Y)    # anteriore
    Z = np.cross(Y, X)                                                     # superiore? (anteriore × sinistra) = ...
    if Z[2] < 0: Z = -Z
    print(f'simmetria r={r:.2f} yaw={yaw} roll={roll}')
    # ---- volume nel sistema della testa, 1 mm: x' sinistra, y' anteriore, z' superiore
    xs, ys, zs = np.arange(-100, 101), np.arange(-130, 131), np.arange(-140, 111)
    gx, gy, gz = np.meshgrid(xs, ys, zs, indexing='ij')
    q = c0 + gx[..., None] * X + gy[..., None] * Y + gz[..., None] * Z
    G = ndi.map_coordinates(a, q.reshape(-1, 3).T, order=1, cval=-2000).reshape(gx.shape)
    del q, gx, gy, gz
    T = G > (-300 if ct else thr)
    # ---- globi: cubi (come nel JS): dentro semilato 5, guscio tra semilato 8 e 11
    def media_cubo(V, h): return ndi.uniform_filter(V, 2 * h + 1, mode='constant')
    Gc = np.where(G < -1999, (-1000 if ct else 0), G).astype(np.float32)
    m5, q5 = media_cubo(Gc, 5), media_cubo(Gc * Gc, 5); sd5 = np.sqrt(np.maximum(0, q5 - m5 * m5))
    m8, m11 = media_cubo(Gc, 8), media_cubo(Gc, 11); guscio = (m11 * 23 ** 3 - m8 * 17 ** 3) / (23 ** 3 - 17 ** 3)
    scala = 1 if ct else np.median(Gc[T])
    if ct: s = np.where((m5 > -15) & (m5 < 45) & (sd5 < 30) & (guscio < m5 - 25), (m5 - guscio) / (sd5 + 5), 0)
    else: s = np.abs(m5 - guscio) / (sd5 + 0.05 * scala) * (sd5 < 0.25 * scala)
    # zona: davanti (y' > 10), laterale 18-45 mm, z' tra -100 e +30; coppia simmetrica
    ix = lambda x: x + 100; iy = lambda y: y + 130; iz = lambda z: z + 140
    fov = media_cubo((G < -1999).astype(np.float32), 11) == 0     # cubo tutto dentro il campo di vista
    s = s * fov
    S = np.zeros_like(s); S[ix(18):ix(46), iy(10):iy(130), iz(-100):iz(31)] = s[ix(18):ix(46), iy(10):iy(130), iz(-100):iz(31)]
    Sm = S + S[::-1, :, :]            # x' → −x' (stessa y', z')
    i, j, k = np.unravel_index(np.argmax(Sm), Sm.shape); gl = np.array([xs[i], ys[j], zs[k]]).astype(float)
    # affinamento per lato
    glob = []
    for lato in (1, -1):
        x0 = lato * abs(gl[0]); sub = s[ix(int(x0) - 5):ix(int(x0) + 6), iy(int(gl[1]) - 5):iy(int(gl[1]) + 6), iz(int(gl[2]) - 5):iz(int(gl[2]) + 6)]
        a1, b1, c1 = np.unravel_index(np.argmax(sub), sub.shape); glob.append(np.array([x0 - 5 + a1, gl[1] - 5 + b1, gl[2] - 5 + c1]))
    print('globi', glob, 'punteggio', Sm[i, j, k])
    gm = (glob[0] + glob[1]) / 2
    # ---- meati: profondità d'ingresso da fuori lungo x' (primo tratto di tessuto di almeno 3 mm)
    eam = []
    for lato in (1, -1):
        yr = np.arange(int(gm[1]) - 115, int(gm[1]) - 45); zr = np.arange(int(gm[2]) - 50, int(gm[2]) + 21)
        prof = np.zeros((len(yr), len(zr)))
        for a_, y in enumerate(yr):
            for b_, z in enumerate(zr):
                riga = T[:, iy(y), iz(z)]
                if (G[:, iy(y), iz(z)][ix(15 if lato > 0 else -100):ix(100 if lato > 0 else -15)] < -1999).any(): prof[a_, b_] = np.nan; continue
                xx = range(100, 15, -1) if lato > 0 else range(-100, -15)
                run = 0; ent = 15
                for x in xx:
                    if riga[ix(x)]: run += 1
                    else: run = 0
                    if run >= 3: ent = abs(x) + 2; break
                prof[a_, b_] = 100 - ent
        pf = np.where(np.isnan(prof), np.nanmedian(prof), prof)
        fossa = ndi.gaussian_filter(pf, 1.5) - ndi.median_filter(pf, size=21); fossa[np.isnan(prof)] = -99
        a_, b_ = np.unravel_index(np.argmax(fossa), fossa.shape)
        eam.append(np.array([lato * (100 - prof[a_, b_] + 0), yr[a_], zr[b_]], float)); print('meato', lato, eam[-1], 'fossa', fossa[a_, b_], 'prof', prof[a_, b_])
    em = (eam[0] + eam[1]) / 2
    dvec = gm - em; ang = math.degrees(math.atan2(dvec[2], dvec[1]))
    print(f'OMP: globi {gm.round(1)}, meati {em.round(1)}, inclinazione {ang:.1f}° rispetto all\'asse y della testa')
    # ---- figure: sagittale mediana con i punti proiettati, e lo strato sul piano OMP
    fig, ax = plt.subplots(1, 3, figsize=(18, 6))
    w = (-300, 1500) if ct else (0, 1200)
    sag = G[ix(0)].T
    ax[0].imshow(sag, cmap='gray', origin='lower', vmin=w[0], vmax=w[1], extent=[ys[0], ys[-1], zs[0], zs[-1]])
    for p_, c_ in ((gm, 'lime'), (em, 'red')): ax[0].plot(p_[1], p_[2], 'o', color=c_)
    ax[0].plot([em[1], gm[1]], [em[2], gm[2]], '-', color='yellow'); ax[0].set_title('sagittale mediana: OMP (giallo)')
    lat = G[ix(int(round(glob[0][0])))].T
    ax[1].imshow(G[ix(int(round(eam[0][0] * 0.85)))].T, cmap='gray', origin='lower', vmin=w[0], vmax=w[1], extent=[ys[0], ys[-1], zs[0], zs[-1]])
    ax[1].plot(eam[0][1], eam[0][2], 'ro'); ax[1].plot(glob[0][1], glob[0][2], 'go'); ax[1].set_title('sagittale laterale (sinistra)')
    # strato OMP: piano per em e gm, contiene X
    u = np.array([0, dvec[1], dvec[2]]); u /= np.linalg.norm(u)
    yy, xx2 = np.meshgrid(np.arange(-130, 131), np.arange(-100, 101), indexing='ij')
    qq = c0 + (xx2[..., None]) * X + (em[1] + yy[..., None] * u[1]) * Y + (em[2] + yy[..., None] * u[2]) * Z
    sl = ndi.map_coordinates(a, qq.reshape(-1, 3).T, order=1, cval=-2000).reshape(yy.shape)
    ax[2].imshow(sl, cmap='gray', origin='lower', vmin=w[0], vmax=w[1]); ax[2].set_title('strato sul piano OMP (orbite e meati)')
    plt.tight_layout(); plt.savefig(sys.argv[2], dpi=70)
    json.dump(dict(globi=[g.tolist() for g in glob], meati=[e.tolist() for e in eam], ang=ang, r=r), open(sys.argv[2] + '.json', 'w'))
main()
