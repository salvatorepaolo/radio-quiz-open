"""Tre proposte di caso INVENTATE per prova_proposte.mjs, nella cartella indicata: prop-pulita01, prop-datipaz1, prop-scritta1
(nome e ospedale scritti nei pixel della prima immagine). I file escono CON i dati inventati del paziente: li anonimizza poi
prova_proposte.mjs con web/anonimizza.js, come fa il browser dell'iscritto (lasciandone uno com'è in prop-datipaz1)."""
import json, os, sys
sys.path.insert(0, "/Volumes/Caloggero/piattaforma-quiz/cloud/test"); sys.path.insert(0, "/Volumes/Caloggero/piattaforma-quiz")
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from anonimizza_py_prova import finto

def immagine(ds, testo=None):
    im = Image.new("L", (600, 400), 60); dr = ImageDraw.Draw(im); dr.ellipse((150, 80, 450, 360), fill=140)
    if testo:
        try: f = ImageFont.load_default(size=36)
        except TypeError: f = ImageFont.load_default()
        dr.text((20, 15), testo, fill=255, font=f)
    a = np.asarray(im).astype(np.uint16) * 16
    ds.Modality = "DX"; ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.1.1"; ds.file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
    ds.Rows, ds.Columns = a.shape; ds.BitsStored = 12; ds.HighBit = 11; ds.PixelData = a.tobytes(); return ds

base = sys.argv[1]
for pid, _anonimo, testo in (("prop-pulita01", (True, True), None), ("prop-datipaz1", (True, False), None), ("prop-scritta1", (True, True), "OSPEDALE SANTACROCE  Rossignoli Marcello")):
    d = os.path.join(base, pid); os.makedirs(os.path.join(d, "serie", "s1"), exist_ok=True); files = []
    for k in range(2):
        ds = finto(); ds.SOPInstanceUID = f"1.2.3.4.5.6.7.{10 + k}"; ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
        ds = immagine(ds, testo if k == 0 else None)
        f = f"serie/s1/img{k}.dcm"; ds.save_as(os.path.join(d, f), enforce_file_format=True); files.append(f)
    with open(os.path.join(d, "serie.json"), "w") as fh: json.dump([{"descrizione": "Torace", "files": files, "regione": "RX torace"}], fh)
    with open(os.path.join(d, "caso.json"), "w") as fh:
        json.dump({"titolo": f"Proposta di prova {pid}", "modalita": "RX", "distretto": "Torace", "visibile": False, "opzioni": [],
                   "proposta": {"da": "iscritto-prova", "nome": "Iscritto di prova", "data": "2026-11-15 10:00", "stato": "in attesa",
                                "descrizione": "Radiografia del torace proposta per la prova automatica."}}, fh)
print("proposte create in", base)
