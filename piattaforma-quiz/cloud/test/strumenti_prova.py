"""Test degli strumenti di preparazione dei casi (strumenti/controlla.py e strumenti/anteprime.py) su casi INVENTATI
costruiti in una cartella temporanea: nessun caso vero viene letto o modificato."""
import gzip, io, json, os, shutil, struct, subprocess, sys, tempfile, unittest
import numpy as np, pydicom
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian

QUI = os.path.dirname(os.path.abspath(__file__)); STRUMENTI = os.path.join(QUI, "..", "..", "strumenti")


def scrivi(percorso, testo):
    with open(percorso, "w") as f: f.write(testo)


def dicom(percorso, lato=8, valore=0, nome="ANONIMO^caso-prova", modalita="CT", z=0.0, **extra):
    ds = Dataset(); fm = FileMetaDataset(); fm.TransferSyntaxUID = ExplicitVRLittleEndian
    fm.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"; fm.MediaStorageSOPInstanceUID = f"2.25.{abs(hash((percorso, z))) % 10**30}"; ds.file_meta = fm
    ds.SOPClassUID = fm.MediaStorageSOPClassUID; ds.SOPInstanceUID = fm.MediaStorageSOPInstanceUID; ds.Modality = modalita; ds.PatientName = nome
    ds.Rows = ds.Columns = lato; ds.BitsAllocated = 16; ds.BitsStored = 16; ds.HighBit = 15; ds.PixelRepresentation = 1; ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"; ds.RescaleSlope = 1; ds.RescaleIntercept = -1024; ds.PixelSpacing = [0.5, 0.5]
    ds.ImagePositionPatient = [0, 0, z]; ds.WindowCenter = 40; ds.WindowWidth = 400
    a = np.full((lato, lato), valore, np.int16) if np.isscalar(valore) else valore.astype(np.int16)
    ds.PixelData = a.tobytes()
    for k, v in extra.items(): setattr(ds, k, v)
    os.makedirs(os.path.dirname(percorso), exist_ok=True); ds.save_as(percorso, enforce_file_format=True)


def caso(base, cartella, files=1, visibile=True, opzioni=None, modalita="TC", **kw):
    d = os.path.join(base, cartella); elenco = []
    for i in range(files):
        f = f"serie/s1/img_{i:05d}.dcm"; dicom(os.path.join(d, f), valore=1024 + i, z=float(i), **kw); elenco.append(f)
    scrivi(os.path.join(d, "serie.json"), json.dumps([{"descrizione": "TORACE", "files": elenco, "regione": "TC torace"}]))
    scrivi(os.path.join(d, "caso.json"), json.dumps({"titolo": "Caso inventato", "modalita": modalita, "visibile": visibile, "anamnesi": "Tosse da due settimane.",
               "opzioni": opzioni if opzioni is not None else [{"testo": "Polmonite", "corretta": True}, {"testo": "Normale"}]}))
    return d


def controlla(base):
    r = subprocess.run([sys.executable, os.path.join(STRUMENTI, "controlla.py"), base], capture_output=True, text=True, timeout=120)
    return r.returncode, r.stdout


class Controlla(unittest.TestCase):
    def setUp(self): self.base = tempfile.mkdtemp()
    def tearDown(self): shutil.rmtree(self.base, ignore_errors=True)

    def test_caso_pulito_passa(self):
        caso(self.base, "caso-ok")
        codice, out = controlla(self.base)
        self.assertEqual(codice, 0, out); self.assertIn("0 errori", out)

    def test_dati_del_paziente_bloccano_senza_scriverli_nel_rapporto(self):
        caso(self.base, "caso-ko", nome="ROSSIGNOLI^MARCELLO", InstitutionName="OSPEDALE SANTACROCE", StudyDate="20240311")
        codice, out = controlla(self.base)
        self.assertEqual(codice, 2)
        self.assertIn("nome paziente non anonimo", out); self.assertIn("InstitutionName presente", out); self.assertIn("StudyDate presente", out)
        for valore in ("ROSSIGNOLI", "SANTACROCE", "20240311"): self.assertNotIn(valore, out, "il rapporto non deve ripetere i dati")

    def test_file_mancante_e_json_rotto(self):
        d = caso(self.base, "caso-manca"); os.remove(os.path.join(d, "serie/s1/img_00000.dcm"))
        d2 = caso(self.base, "caso-rotto"); scrivi(os.path.join(d2, "caso.json"), "{ non è json")
        codice, out = controlla(self.base)
        self.assertEqual(codice, 2); self.assertIn("caso-manca: file mancante", out); self.assertIn("caso-rotto: JSON non leggibile", out)

    def test_testi_da_compilare_e_risposte_mancanti_bloccano_solo_i_casi_visibili(self):
        caso(self.base, "caso-bozza", visibile=False, opzioni=[{"testo": "DA COMPILARE"}])
        codice, out = controlla(self.base)
        self.assertEqual(codice, 0, out); self.assertIn("Avvisi", out); self.assertIn("caso-bozza: testi segnaposto", out)
        caso(self.base, "caso-visibile", visibile=True, opzioni=[{"testo": "da compilare", "corretta": True}])
        caso(self.base, "caso-una-opzione", visibile=True, opzioni=[{"testo": "Polmonite", "corretta": True}])
        codice, out = controlla(self.base)
        self.assertEqual(codice, 2); self.assertIn("in un caso VISIBILE", out); self.assertIn("caso-una-opzione: servono almeno 2 opzioni", out)

    def test_avvisi_metodica_immagini_doppie_e_copie_della_sincronizzazione(self):
        d = caso(self.base, "caso-avvisi", files=2, modalita="RM")
        shutil.copy(os.path.join(d, "serie/s1/img_00000.dcm"), os.path.join(d, "serie/s1/img_00001.dcm"))   # immagine identica ripetuta
        shutil.copy(os.path.join(d, "caso.json"), os.path.join(d, "caso 2.json"))                            # copia di iCloud/Dropbox
        codice, out = controlla(self.base)
        self.assertEqual(codice, 0, out)
        self.assertIn("metodica «RM» ma le serie sono TC", out); self.assertIn("immagini identiche ripetute", out); self.assertIn("copie doppie della sincronizzazione", out)


class Anteprime(unittest.TestCase):
    def setUp(self):
        self.base = tempfile.mkdtemp(); self.env = {**os.environ, "RQ_CASI": self.base}
    def tearDown(self): shutil.rmtree(self.base, ignore_errors=True)

    def lancia(self, *a):
        return subprocess.run([sys.executable, os.path.join(STRUMENTI, "anteprime.py"), *a], capture_output=True, text=True, env=self.env, timeout=300)

    def leggi(self, percorso):
        with gzip.open(percorso) as g: b = g.read(); self.assertEqual(b[:4], b"RQA1")
        n = struct.unpack("<I", b[4:8])[0]; testa = json.loads(b[8:8 + n]); px = np.frombuffer(b[8 + n:], "<i2")
        return testa, px.reshape(testa["n"], testa["h"], testa["w"]), b

    def test_serie_lunga_ridotta_a_blocchi_in_HU_con_posizioni_e_senza_dati(self):
        d = os.path.join(self.base, "caso-x"); files = []
        for i in range(90):
            a = np.zeros((64, 64)); a[:, 32:] = 1000; a[0, 0] = 1024 + i          # metà sinistra -1024 HU, destra -24 HU; un pixel che cambia
            f = f"serie/s1/img_{i:05d}.dcm"; dicom(os.path.join(d, f), lato=64, valore=a, z=float(i) * 1.25, nome="ROSSIGNOLI^MARCELLO"); files.append(f)
        scrivi(os.path.join(d, "serie.json"), json.dumps([{"descrizione": "TORACE", "files": files}]))
        r = self.lancia("caso-x"); self.assertEqual(r.returncode, 0, r.stderr)
        with open(os.path.join(d, "serie.json")) as f: sj = json.load(f); self.assertEqual(sj[0]["anteprima"], "serie/s1/anteprima.rqa.gz")
        testa, px, grezzo = self.leggi(os.path.join(d, sj[0]["anteprima"]))
        self.assertEqual((testa["n"], testa["f"], testa["w"], testa["h"], testa["cols"], testa["rows"]), (90, 2, 32, 32, 64, 64))
        self.assertEqual(testa["ipp"][10], [0.0, 0.0, 12.5]); self.assertEqual((testa["wc"], testa["ww"], testa["mono1"]), (40.0, 400.0, False))
        self.assertTrue((px[:, 1:, :16] == -1024).all() and (px[:, :, 16:] == -24).all(), "media a blocchi in HU")
        self.assertEqual(px[5, 0, 0], round((5 + 3 * -1024) / 4), "il pixel che vale 5 HU si media con 3 pixel a -1024")
        self.assertNotIn(b"ROSSIGNOLI", grezzo, "nell'anteprima solo numeri e posizioni")
        self.assertIn("già fatta", self.lancia("caso-x").stdout); self.assertIn("90 fette", self.lancia("caso-x", "--rifai").stdout)

    def test_serie_corte_saltate_e_fette_di_dimensioni_diverse_rifiutate(self):
        d = os.path.join(self.base, "caso-y"); corte = [f"s1/i{i}.dcm" for i in range(5)]; miste = [f"s2/i{i}.dcm" for i in range(85)]
        for i, f in enumerate(corte): dicom(os.path.join(d, f), z=float(i))
        for i, f in enumerate(miste): dicom(os.path.join(d, f), lato=16 if i == 40 else 8, z=float(i))
        scrivi(os.path.join(d, "serie.json"), json.dumps([{"files": corte}, {"files": miste}]))
        out = self.lancia("caso-y").stdout
        self.assertIn("fette di dimensioni diverse", out); self.assertNotIn("serie 0", out, "serie corta: niente anteprima")
        with open(os.path.join(d, "serie.json")) as f: self.assertTrue(all("anteprima" not in s for s in json.load(f)))


if __name__ == "__main__":
    unittest.main()
