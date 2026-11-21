"""Test di unità di anonimizza.py (anonimizzazione dei casi sul Mac): dati del paziente INVENTATI.
Si lancia da anonimizza-py.test.mjs con il Python che ha pydicom (~/.radioquiz-ia/venv)."""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
import pydicom
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.sequence import Sequence
import anonimizza as A

SALE, CASO = "sale-di-prova", "caso-prova-001"


def finto(**extra):
    ds = Dataset()
    fm = FileMetaDataset(); fm.TransferSyntaxUID = "1.2.840.10008.1.2.1"; fm.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
    fm.MediaStorageSOPInstanceUID = "1.2.3.4.5.6.7.1"; fm.SourceApplicationEntityTitle = "PACS_OSPEDALE"; ds.file_meta = fm
    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"; ds.SOPInstanceUID = "1.2.3.4.5.6.7.1"; ds.StudyInstanceUID = "1.2.3.4.5.6.7.2"
    ds.SeriesInstanceUID = "1.2.3.4.5.6.7.3"; ds.FrameOfReferenceUID = "1.2.3.4.5.6.7.4"; ds.Modality = "CT"; ds.SeriesDescription = "TORACE 1.25"
    ds.ImageType = ["ORIGINAL", "PRIMARY", "AXIAL"]; ds.PhotometricInterpretation = "MONOCHROME2"; ds.Rows = 4; ds.Columns = 4
    ds.BitsAllocated = 16; ds.BitsStored = 12; ds.HighBit = 11; ds.PixelRepresentation = 0; ds.SamplesPerPixel = 1; ds.PixelData = bytes(range(32))
    ds.ImagePositionPatient = [-100, -100, -50]; ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]; ds.PixelSpacing = [0.7, 0.7]
    # dati inventati che devono sparire
    ds.PatientName = "ROSSIGNOLI^MARCELLO"; ds.PatientID = "RSSMRC80A01H501Z"; ds.PatientBirthDate = "19800101"; ds.PatientAddress = "VIA GARIBALDI 12"
    ds.PatientSex = "M"; ds.PatientAge = "044Y"; ds.StudyDate = "20240311"; ds.StudyTime = "101500"; ds.AccessionNumber = "ACC9988776"
    ds.InstitutionName = "OSPEDALE SANTACROCE"; ds.ReferringPhysicianName = "BIANCHERI^LUIGINO"; ds.OperatorsName = "VERDOLINI^ANSELMO"
    ds.StationName = "TCSTAZIONE7"; ds.DeviceSerialNumber = "SN12345"; ds.ImageComments = "commento con ROSSIGNOLI"; ds.StudyDescription = "TC TORACE ROSSIGNOLI"
    ds.add_new(0x00091010, "LO", "PRIVATOCOSTRUTTORE"); ds.add_new(0x60003000, "OW", bytes(8))   # tag privato e overlay
    rich = Dataset(); rich.RequestingPhysician = "MEDICORICHIEDENTE^X"; ds.RequestAttributesSequence = Sequence([rich])
    rif = Dataset(); rif.ReferencedSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"; rif.ReferencedSOPInstanceUID = "1.2.3.4.5.6.7.9"
    ds.ReferencedImageSequence = Sequence([rif])
    for k, v in extra.items(): setattr(ds, k, v)
    return ds


VIETATE = ["ROSSIGNOLI", "MARCELLO", "RSSMRC80", "GARIBALDI", "19800101", "20240311", "ACC9988776", "SANTACROCE", "BIANCHERI",
           "VERDOLINI", "TCSTAZIONE7", "SN12345", "PRIVATOCOSTRUTTORE", "MEDICORICHIEDENTE", "PACS_OSPEDALE"]


def testo_intero(ds):
    import io
    b = io.BytesIO(); ds.save_as(b, enforce_file_format=True); return b.getvalue().decode("latin1")


class Anonimizza(unittest.TestCase):
    def test_niente_dati_del_paziente_nel_file(self):
        out = testo_intero(A.anonimizza_dataset(finto(), CASO, SALE))
        for p in VIETATE:
            self.assertNotIn(p, out, p)

    def test_campi_sostituiti_e_tolti(self):
        ds = A.anonimizza_dataset(finto(), CASO, SALE)
        self.assertEqual(str(ds.PatientName), f"ANONIMO^{CASO}"); self.assertEqual(ds.PatientID, CASO); self.assertEqual(ds.PatientIdentityRemoved, "YES")
        for kw in ["PatientBirthDate", "PatientAddress", "AccessionNumber", "InstitutionName", "ReferringPhysicianName", "OperatorsName",
                   "StationName", "DeviceSerialNumber", "ImageComments", "StudyDescription", "RequestAttributesSequence", "PatientSex", "PatientAge"]:
            self.assertFalse(kw in ds and str(ds.get(kw) or ""), kw)
        self.assertFalse(any(t.is_private for t in ds.keys()), "tag privati rimasti")
        self.assertFalse(any(0x6000 <= t.group <= 0x60FF for t in ds.keys()), "overlay rimasti")
        for el in ds.iterall():
            if el.VR in ("DA", "DT", "TM"): self.assertFalse(el.value, el.keyword)
            if el.VR == "PN" and el.keyword != "PatientName": self.assertFalse(el.value, el.keyword)
        self.assertNotIn("SourceApplicationEntityTitle", ds.file_meta)

    def test_tecnici_e_pixel_invariati(self):
        a, b = finto(), A.anonimizza_dataset(finto(), CASO, SALE)
        for kw in ["Modality", "SeriesDescription", "ImageType", "Rows", "Columns", "ImagePositionPatient", "ImageOrientationPatient", "PixelSpacing", "SOPClassUID"]:
            self.assertEqual(str(a.get(kw)), str(b.get(kw)), kw)
        self.assertEqual(a.PixelData, b.PixelData)

    def test_uid_rigenerati_coerenti(self):
        a, b, c = (A.anonimizza_dataset(finto(), CASO, s) for s in (SALE, SALE, "altra"))
        for kw in ["SOPInstanceUID", "StudyInstanceUID", "SeriesInstanceUID", "FrameOfReferenceUID"]:
            u = str(a.get(kw))
            self.assertTrue(u.startswith("2.25.") and len(u) <= 64, kw); self.assertEqual(u, str(b.get(kw))); self.assertNotEqual(u, str(c.get(kw)))
        self.assertEqual(str(a.ReferencedImageSequence[0].ReferencedSOPInstanceUID), A.nuovo_uid("1.2.3.4.5.6.7.9", SALE))
        self.assertEqual(a.file_meta.MediaStorageSOPInstanceUID, a.SOPInstanceUID)
        self.assertEqual(str(a.SOPClassUID), "1.2.840.10008.5.1.4.1.1.2")

    def test_esclusioni(self):
        self.assertTrue(A.e_secondary_capture(finto(SOPClassUID="1.2.840.10008.5.1.4.1.1.7")))
        self.assertTrue(A.e_secondary_capture(finto(ImageType=["DERIVED", "SECONDARY", "SCREEN SAVE"])))
        self.assertTrue(A.e_secondary_capture(finto(PhotometricInterpretation="RGB")))
        self.assertFalse(A.e_secondary_capture(finto()))
        self.assertIsNone(A.non_visualizzabile(finto()))
        self.assertEqual(A.non_visualizzabile(finto(NumberOfFrames=10)), "multi-frame (cine)")
        self.assertEqual(A.non_visualizzabile(finto(PresentationIntentType="FOR PROCESSING")), "immagine grezza (for processing)")

    def test_nome_della_cartella(self):
        self.assertEqual(A.pulisci_nome("T1 dinamica — tempo 2/5"), "T1_dinamica_tempo_2_5")
        self.assertEqual(A.pulisci_nome(""), "serie"); self.assertEqual(len(A.pulisci_nome("x" * 99)), 40)

    def test_uid_stessi_del_browser(self):
        # stesso algoritmo di web/anonimizza.js (SHA-256 di sale + uid, primi 128 bit): un caso può avere serie
        # anonimizzate sul Mac e nel browser del docente senza separarsi. Il valore atteso è confrontato con il JS.
        print("UID_PY", A.nuovo_uid("1.2.3.4.5.6.7.3", SALE))



class FileMalformati(unittest.TestCase):
    """1.256: trovati dal test «a caso» (anonimizza-fuzz.test.mjs), stessa regola del browser."""
    def test_campo_tenuto_che_inghiotte_il_nome_esclude_il_file(self):
        import io
        buf = io.BytesIO(); finto().save_as(buf, enforce_file_format=True); b = bytearray(buf.getvalue())
        i = b.index(b"\x08\x00\x60\x00CS\x02\x00CT")                 # Modality, lunghezza 2
        # lunghezza sbagliata che finisce esattamente dopo i due campi seguenti: li «inghiotte» (come nel caso trovato a caso)
        j = i + 10
        for _ in range(2):
            j += 8 + int.from_bytes(b[j + 6:j + 8], "little")
        b[i + 6:i + 8] = (j - (i + 8)).to_bytes(2, "little")
        ds = pydicom.dcmread(io.BytesIO(bytes(b)), force=True)
        self.assertIn("\x00", str(ds.Modality), "il campo deve aver inghiottito altri campi")
        with self.assertRaises(A.NonConforme):
            A.anonimizza_dataset(ds, CASO, SALE)

    def test_commenti_liberi_nel_gruppo_0028_tolti(self):
        ds = finto(); ds.add_new(0x00284000, "LT", "COMMENTO CON ROSSIGNOLI")   # Image Presentation Comments
        A.anonimizza_dataset(ds, CASO, SALE)
        self.assertNotIn(0x00284000, ds)
        self.assertEqual(ds.RescaleType if "RescaleType" in ds else "", "")

if __name__ == "__main__":
    unittest.main(verbosity=2)
