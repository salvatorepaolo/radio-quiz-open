"""Mosaico di controllo: 8 strati assiali con giri (sopra) e territori (sotto). Uso: mosaico.py <caso> <uscita.png>"""
import gzip, json, glob, sys
import numpy as np, pydicom
from PIL import Image, ImageDraw
sys.path.insert(0, "/Volumes/Caloggero/piattaforma-quiz/strumenti")
caso, out = sys.argv[1], sys.argv[2]
D = f"/Volumes/Caloggero/piattaforma-quiz/casi-free/{caso}"
fj = sorted(glob.glob(D + "/ia/*.json"))[0]; g = json.load(open(fj)); W, H, N = g["dim"]
lab = np.frombuffer(gzip.open(fj[:-5] + ".lab.gz").read(), np.uint8).reshape(N, H, W)
art = np.frombuffer(gzip.open(fj[:-5] + ".art.gz").read(), np.uint8).reshape(N, H, W)
S = [s for s in json.load(open(D + "/serie.json")) if s["files"][0].split("/")[1] == g["serie"]][0]
fet = []
for f in S["files"]:
    d = pydicom.dcmread(D + "/" + f); n = np.cross([float(x) for x in d.ImageOrientationPatient[:3]], [float(x) for x in d.ImageOrientationPatient[3:]])
    fet.append((float(np.dot(n, [float(x) for x in d.ImagePositionPatient])), d.pixel_array.astype(float)))
fet.sort(key=lambda x: x[0]); vol = np.stack([p for _, p in fet])
rng = np.random.default_rng(5); cg = rng.integers(60, 255, (256, 3)); cg[0] = 0
ca = np.zeros((256, 3), int)
for v, c in {1: (70, 130, 240), 3: (130, 180, 250), 5: (250, 170, 120), 7: (230, 70, 60), 9: (245, 130, 50), 11: (240, 200, 60), 13: (250, 150, 150), 15: (220, 100, 160),
             17: (90, 200, 110), 19: (40, 150, 80), 21: (110, 220, 200), 23: (160, 220, 120), 25: (160, 90, 210), 27: (200, 150, 240), 29: (140, 120, 200)}.items():
    ca[v] = ca[v + 1] = c
liv = np.linspace(0.18, 0.85, 8).astype(float)
tiles = []
for riga, (vl, col) in enumerate([(lab, cg), (art, ca)]):
    for f in liv:
        k = int(f * (N - 1)); im = vol[k]; lo, hi = np.percentile(im, [1, 99.5]); gch = np.clip((im - lo) / (hi - lo), 0, 1) * 255
        rgb = np.repeat(gch[..., None], 3, -1); m = vl[k] > 0; rgb[m] = rgb[m] * 0.55 + col[vl[k][m]] * 0.45
        t = Image.fromarray(rgb.astype(np.uint8)).resize((200, int(200 * H / W))); ImageDraw.Draw(t).text((4, 4), f"{k}", fill=(255, 255, 0)); tiles.append(t)
th = tiles[0].height; img = Image.new("RGB", (200 * 8, th * 2))
for i, t in enumerate(tiles): img.paste(t, ((i % 8) * 200, (i // 8) * th))
img.save(out); print(out, vol.shape)
