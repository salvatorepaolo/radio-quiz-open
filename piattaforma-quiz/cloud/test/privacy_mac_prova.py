"""Test dei controlli di privacy sul Mac (strumenti/anonimato_intestazioni.py e anonimato_ocr.py), con dati INVENTATI.
Gli script si copiano in una cartella temporanea: i loro risultati (intestazioni.json, ocr.json) non toccano quelli veri."""
import json, os, shutil, subprocess, sys, tempfile, unittest
import numpy as np
from PIL import Image, ImageDraw, ImageFont
QUI = os.path.dirname(os.path.abspath(__file__)); STRUMENTI = os.path.join(QUI, "..", "..", "strumenti")
sys.path.insert(0, QUI); sys.path.insert(0, os.path.join(QUI, "..", ".."))
import anonimizza as A
from anonimizza_py_prova import finto, VIETATE, CASO, SALE


def scrivi(ds, percorso):
    os.makedirs(os.path.dirname(percorso), exist_ok=True); ds.save_as(percorso, enforce_file_format=True)


def lancia(script, *argomenti):
    d = tempfile.mkdtemp(); shutil.copy(os.path.join(STRUMENTI, script), d)
    r = subprocess.run([sys.executable, os.path.join(d, script), *argomenti], capture_output=True, text=True, timeout=600)
    return d, r


class Intestazioni(unittest.TestCase):
    def test_trova_i_dati_solo_nel_caso_non_anonimo_e_non_li_scrive(self):
        casi = tempfile.mkdtemp()
        scrivi(A.anonimizza_dataset(finto(), CASO, SALE), os.path.join(casi, "caso-ok", "serie", "a.dcm"))
        scrivi(finto(), os.path.join(casi, "caso-ko", "serie", "b.dcm"))
        d, r = lancia("anonimato_intestazioni.py", casi)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        with open(os.path.join(d, "intestazioni.json")) as f: testo = f.read()
        j = json.loads(testo)
        self.assertEqual(j["file"], 2)
        self.assertNotIn("caso-ok", j["problemi"], j["problemi"].get("caso-ok"))
        ko = " | ".join(j["problemi"].get("caso-ko", {}))
        for atteso in ["PatientName non anonimo", "PatientID non del caso", "InstitutionName presente", "PatientBirthDate presente", "data in StudyDate"]:
            self.assertIn(atteso, ko)
        self.assertEqual(j["privati"].get("caso-ko"), 1); self.assertNotIn("caso-ok", j["privati"])
        for p in VIETATE:
            self.assertNotIn(p, testo + r.stdout, f"il rapporto riporta il valore {p}")


def radiografia(testo=None):
    """DX 600×400 con, se richiesto, una scritta impressa nei pixel (bianco su fondo grigio)."""
    im = Image.new("L", (600, 400), 60); dr = ImageDraw.Draw(im)
    dr.ellipse((150, 80, 450, 360), fill=140)
    if testo:
        try: f = ImageFont.load_default(size=36)
        except TypeError: f = ImageFont.load_default()
        dr.text((20, 15), testo, fill=255, font=f)
    a = np.asarray(im).astype(np.uint16) * 16
    ds = A.anonimizza_dataset(finto(), CASO, SALE)
    ds.Modality = "DX"; ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.1.1"; ds.Rows, ds.Columns = a.shape; ds.BitsStored = 12; ds.HighBit = 11
    ds.PixelData = a.tobytes(); return ds


@unittest.skipUnless(shutil.which("tesseract") or os.path.exists("/opt/homebrew/bin/tesseract"), "manca tesseract")
class TestoImpresso(unittest.TestCase):
    def test_scritta_con_nome_e_ospedale_trovata_e_mascherata(self):
        casi = tempfile.mkdtemp()
        for caso, testo in (("caso-scritta", "OSPEDALE SANTACROCE  Rossignoli Marcello"), ("caso-pulito", None)):
            scrivi(radiografia(testo), os.path.join(casi, caso, "serie", "x.dcm"))
            with open(os.path.join(casi, caso, "serie.json"), "w") as f: json.dump([{"descrizione": "torace", "files": ["serie/x.dcm"]}], f)
        d, r = lancia("anonimato_ocr.py", casi)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        with open(os.path.join(d, "ocr.json")) as f: testo = f.read()
        j = json.loads(testo)
        self.assertEqual(j["conti"]["immagini"], 2)
        self.assertTrue(any(x["sospetto"] for x in j["testi"].get("caso-scritta", [])), j["testi"])
        self.assertFalse(any(x["sospetto"] for x in j["testi"].get("caso-pulito", [])), j["testi"].get("caso-pulito"))
        for p in ("SANTACROCE", "Rossignoli", "ROSSIGNOLI", "Marcello"):
            self.assertNotIn(p, testo, "il rapporto deve contenere solo la forma mascherata, non il testo letto")


if __name__ == "__main__":
    unittest.main(verbosity=2)
