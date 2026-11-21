#!/usr/bin/env python3
"""
Anonimizza una cartella di immagini DICOM e la trasforma in un caso del quiz.

Uso:
    python3 anonimizza.py <cartella_dicom_originale> <id_caso>
Esempio:
    python3 anonimizza.py "/cartella/esame" caso-002
Solo alcune serie (numeri di serie):
    SERIE="201,501,601" python3 anonimizza.py "/cartella/esame" caso-003
Esame grande, una cartella alla volta (stesso SALE casuale per tutte, AGGIUNGI=1 dalla seconda):
    SALE=<esadecimale casuale> AGGIUNGI=1 python3 anonimizza.py "/cartella/esame/serie2" caso-003

- L'originale NON viene modificato: viene creata una copia in casi/<id_caso>/serie/
- Rimossi/sostituiti: nome, ID, data di nascita, indirizzo, numeri di accettazione,
  istituto, reparto, medici, operatori, stazione, numeri di serie apparecchio,
  tutte le date e gli orari, tutti i tag privati, commenti liberi.
- Tutti gli UID vengono rigenerati in modo coerente (le serie restano collegate).
- Approccio a LISTA BIANCA: ogni campo di testo non esplicitamente tecnico viene
  eliminato. Nessun dato del paziente (neanche sesso ed eta') ne' della struttura.
  Se servono eta'/sesso, scriverli nell'anamnesi del caso (caso.json).
- Escluse TUTTE le secondary capture (riepiloghi, dose report, screenshot), le immagini
  a colori e quelle con BurnedInAnnotation=YES: possono avere dati scritti nei pixel.
- Rimossi overlay (gruppi 60xx) e curve (50xx).
"""
import hashlib, json, os, re, sys
import pydicom
from pydicom.uid import UID

ROOT_UID = "2.25."  # radice UUID-derivata (standard DICOM)

# Tag da svuotare / sostituire (keyword pydicom)
DA_RIMUOVERE = [
    "PatientBirthDate", "PatientBirthTime", "PatientAddress", "PatientTelephoneNumbers",
    "OtherPatientIDs", "OtherPatientNames", "OtherPatientIDsSequence", "PatientMotherBirthName",
    "MilitaryRank", "EthnicGroup", "Occupation", "AdditionalPatientHistory", "PatientComments",
    "MedicalRecordLocator", "PatientWeight", "PatientSize", "PatientInsurancePlanCodeSequence",
    "AccessionNumber", "InstitutionName", "InstitutionAddress", "InstitutionCodeSequence",
    "InstitutionalDepartmentName", "ReferringPhysicianName", "ReferringPhysicianAddress",
    "ReferringPhysicianTelephoneNumbers", "PerformingPhysicianName", "NameOfPhysiciansReadingStudy",
    "PhysiciansOfRecord", "OperatorsName", "RequestingPhysician", "StationName",
    "DeviceSerialNumber", "StudyID", "RequestedProcedureID", "ScheduledProcedureStepID",
    "PerformedProcedureStepID", "PerformedProcedureStepDescription", "AdmittingDiagnosesDescription",
    "RequestAttributesSequence", "ImageComments", "StudyComments", "AdmissionID",
    "IssuerOfPatientID", "PerformedLocation", "ScheduledPerformingPhysicianName",
    "RequestedProcedureDescription", "ReasonForTheRequestedProcedure", "ContentCreatorName",
    "PersonName", "VerifyingObserverName", "ResponsiblePerson", "ResponsibleOrganization",
]


def nuovo_uid(vecchio, sale):
    h = hashlib.sha256((sale + vecchio).encode()).hexdigest()
    return ROOT_UID + str(int(h[:32], 16))


def e_secondary_capture(ds):
    """True per immagini che possono avere testo 'bruciato' nei pixel:
    Secondary Capture (riepiloghi, dose report, screenshot), immagini a colori,
    tipi immagine da schermata. Le ricostruzioni MPR (CT Image Storage) restano."""
    sop = str(ds.get("SOPClassUID", ""))
    tipo = {t.upper() for t in ds.get("ImageType", [])}
    sospetti = {"SCREEN SAVE", "RESULTS", "EXECUTED_SURVIEW", "DOSE_INFO", "DOSE_REPORT",
                "SCREENSHOT", "PROTOCOL", "SUMMARY", "VXTL STATE"}
    return (sop.startswith("1.2.840.10008.5.1.4.1.1.7")          # Secondary Capture
            or sop.startswith("1.2.840.10008.5.1.4.1.1.88")       # Structured Report
            or bool(tipo & sospetti)
            or ds.get("PhotometricInterpretation", "") not in ("MONOCHROME1", "MONOCHROME2"))


SINTASSI_OK = {"1.2.840.10008.1.2", "1.2.840.10008.1.2.1", "1.2.840.10008.1.2.4.70", "1.2.840.10008.1.2.4.57"}


def non_visualizzabile(ds):
    """Motivo per cui il visualizzatore non può mostrare l'immagine (o None)."""
    if int(ds.get("NumberOfFrames", 1) or 1) > 1:
        return "multi-frame (cine)"
    if str(ds.file_meta.get("TransferSyntaxUID", "")) not in SINTASSI_OK:
        return "compressione non supportata"
    if str(ds.get("SOPClassUID", "")).startswith("1.2.840.10008.5.1.4.1.1.7"):
        return "secondary capture"
    # immagini grezze del detettore (DX/MG/intraorale «For Processing»): non sono fatte per la lettura
    if str(ds.get("SOPClassUID", "")) in ("1.2.840.10008.5.1.4.1.1.1.1.1", "1.2.840.10008.5.1.4.1.1.1.2.1", "1.2.840.10008.5.1.4.1.1.1.3.1") \
            or str(ds.get("PresentationIntentType", "")).upper() == "FOR PROCESSING":
        return "immagine grezza (for processing)"
    return None


def frame_singoli(ds):
    """Multi-frame «enhanced» (tomosintesi, CT/MR enhanced): un dataset per frame, senza ricomprimere.
    Porta al livello principale posizione, orientamento, dimensione pixel, finestra e rescale
    dei Functional Groups. I filmati ecografici sono divisi da frame_cine; gli altri multi-frame vengono esclusi."""
    import copy
    from pydicom.encaps import generate_frames, encapsulate
    n = int(ds.get("NumberOfFrames", 1) or 1)
    if n <= 1 or "PerFrameFunctionalGroupsSequence" not in ds or "PixelData" not in ds \
            or str(ds.file_meta.get("TransferSyntaxUID", "")) not in SINTASSI_OK \
            or ds.get("PhotometricInterpretation", "") not in ("MONOCHROME1", "MONOCHROME2"):
        yield ds
        return
    compresso = ds.file_meta.TransferSyntaxUID.is_compressed
    if compresso:
        frames = list(generate_frames(ds.PixelData, number_of_frames=n))
    else:
        dim = int(ds.Rows) * int(ds.Columns) * int(ds.get("SamplesPerPixel", 1)) * int(ds.BitsAllocated) // 8
        frames = [ds.PixelData[i * dim:(i + 1) * dim] for i in range(n)]
    per_frame = list(ds.PerFrameFunctionalGroupsSequence)
    comune = ds.SharedFunctionalGroupsSequence[0] if "SharedFunctionalGroupsSequence" in ds else pydicom.Dataset()
    base = copy.copy(ds)
    del base.PixelData
    del base.PerFrameFunctionalGroupsSequence
    if "SharedFunctionalGroupsSequence" in base:
        del base.SharedFunctionalGroupsSequence
    del base.NumberOfFrames
    for k in ("FrameIncrementPointer",):
        if k in base:
            delattr(base, k)

    def gruppo(pf, nome):
        for g in (pf, comune):
            if nome in g and len(g[nome].value):
                return g[nome].value[0]
        return None

    sop = str(ds.SOPInstanceUID)
    for i in range(n):
        f = copy.deepcopy(base)
        f.file_meta = copy.deepcopy(ds.file_meta)
        pf = per_frame[i] if i < len(per_frame) else pydicom.Dataset()
        for seq, campi in (("PlanePositionSequence", ("ImagePositionPatient",)),
                           ("PlaneOrientationSequence", ("ImageOrientationPatient",)),
                           ("PixelMeasuresSequence", ("PixelSpacing", "SliceThickness")),
                           ("FrameVOILUTSequence", ("WindowCenter", "WindowWidth")),
                           ("PixelValueTransformationSequence", ("RescaleIntercept", "RescaleSlope"))):
            g = gruppo(pf, seq)
            for c in campi:
                if g is not None and c in g:
                    setattr(f, c, g[c].value)
        a = gruppo(pf, "FrameAnatomySequence")
        if a is not None and "FrameLaterality" in a and "ImageLaterality" not in f:
            f.ImageLaterality = a.FrameLaterality
        f.InstanceNumber = i + 1
        f.SOPInstanceUID = f"{sop}.{i + 1}"[:64]
        f.PixelData = encapsulate([frames[i]]) if compresso else frames[i]
        if compresso:
            f["PixelData"].VR = "OB"
        yield f


CINE_MAX = int(os.environ.get("CINE_MAX", "80"))     # fotogrammi massimi per filmato ecografico


def frame_cine(ds):
    """Filmato ecografico (US multi-frame, anche JPEG): un dataset non compresso per fotogramma,
    al massimo CINE_MAX (se sono di più se ne prende uno ogni k). Nel dataset restano
    FrameTime / CineRate per la velocità di riproduzione. Il testo fuori dalle regioni
    d'immagine viene poi annerito fotogramma per fotogramma da prepara_ecografia."""
    import copy
    import numpy as np
    n = int(ds.get("NumberOfFrames", 1) or 1)
    if n <= 1 or str(ds.get("Modality", "")) != "US" or "PixelData" not in ds or "PerFrameFunctionalGroupsSequence" in ds:
        yield ds
        return
    from pydicom.uid import ExplicitVRLittleEndian
    try:
        a = ds.pixel_array                       # (n, righe, colonne[, 3]); YBR convertito in RGB
    except Exception:
        yield ds                                 # non decodificabile: resta multi-frame e viene escluso
        return
    colore = a.ndim == 4
    if colore:
        c = a[::max(1, n // 10)].astype(np.int16)  # B-mode salvato in RGB: un solo canale (3 volte più leggero)
        if np.abs(c[..., 0] - c[..., 1]).max() <= 4 and np.abs(c[..., 0] - c[..., 2]).max() <= 4:
            a, colore = a[..., 0], False
    passo = max(1, -(-n // CINE_MAX))
    ms = None
    if ds.get("FrameTime"):
        ms = float(ds.FrameTime)
    elif ds.get("CineRate"):
        ms = 1000.0 / float(ds.CineRate)
    elif ds.get("RecommendedDisplayFrameRate"):
        ms = 1000.0 / float(ds.RecommendedDisplayFrameRate)
    base = copy.copy(ds)
    del base.PixelData
    for k in ("NumberOfFrames", "FrameIncrementPointer", "FrameTimeVector", "PlanarConfiguration"):
        if k in base:
            delattr(base, k)
    for j, i in enumerate(range(0, n, passo)):
        f = copy.deepcopy(base)
        f.file_meta = copy.deepcopy(ds.file_meta)
        f.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        f.PhotometricInterpretation = "RGB" if colore else "MONOCHROME2"
        f.SamplesPerPixel = 3 if colore else 1
        if colore:
            f.PlanarConfiguration = 0
        f.BitsAllocated, f.BitsStored, f.HighBit, f.PixelRepresentation = 8, 8, 7, 0
        fr = np.ascontiguousarray(a[i]).astype(np.uint8)
        f.Rows, f.Columns = fr.shape[0], fr.shape[1]
        f.PixelData = fr.tobytes()
        f["PixelData"].VR = "OB"
        f.InstanceNumber = j + 1
        if ms:
            f.FrameTime = round(ms * passo, 3)
        f._cine = (str(ds.SOPInstanceUID), round(ms * passo, 1) if ms else 40.0)
        yield f


def prepara_ecografia(ds):
    """Ecografia: tiene solo le regioni d'immagine dichiarate dall'ecografo (SequenceOfUltrasoundRegions)
    e annerisce tutto il resto, dove stanno nome, struttura, data e ora. Imposta la dimensione del pixel
    dalla regione 2D (cm -> mm). Restituisce False se le regioni non ci sono."""
    import numpy as np
    from pydicom.uid import ExplicitVRLittleEndian
    regioni = ds.get("SequenceOfUltrasoundRegions")
    if not regioni:
        return False
    a = ds.pixel_array
    maschera = np.zeros(a.shape[:2], dtype=bool)
    for r in regioni:
        y0, y1 = int(r.RegionLocationMinY0), int(r.RegionLocationMaxY1)
        x0, x1 = int(r.RegionLocationMinX0), int(r.RegionLocationMaxX1)
        maschera[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = True
    if not maschera.any():
        return False
    a = a.copy()
    a[~maschera] = 0
    for r in regioni:
        if int(r.get("RegionSpatialFormat", 0) or 0) == 1 and int(r.get("PhysicalUnitsXDirection", 0) or 0) == 3 \
                and int(r.get("PhysicalUnitsYDirection", 0) or 0) == 3:
            ds.PixelSpacing = [round(float(r.PhysicalDeltaY) * 10, 6), round(float(r.PhysicalDeltaX) * 10, 6)]
            break
    colore = a.ndim == 3
    ds.PixelData = np.ascontiguousarray(a).astype(np.uint8 if a.dtype.itemsize == 1 else a.dtype).tobytes()
    ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds.PhotometricInterpretation = "RGB" if colore else ds.get("PhotometricInterpretation", "MONOCHROME2")
    if colore:
        ds.SamplesPerPixel = 3
        ds.PlanarConfiguration = 0
    ds.BurnedInAnnotation = "NO"
    return True


# LISTA BIANCA: gli unici campi di testo che restano (solo tecnici, mai identificativi).
# Qualsiasi altro campo testuale (LO, SH, LT, ST, UT, AE, UC, UN, AS, CS non elencati)
# viene eliminato.
TESTO_CONSENTITO = {
    "SpecificCharacterSet", "ImageType", "Modality", "SeriesDescription", "StudyDescription",
    "BodyPartExamined", "ScanOptions", "PatientPosition", "AcquisitionType", "ConvolutionKernel",
    "FilterType", "PhotometricInterpretation", "RescaleType", "WindowCenterWidthExplanation",
    "ExposureModulationType", "ContrastBolusAgent", "ContrastBolusRoute", "RotationDirection",
    "ReconstructionAlgorithm", "LossyImageCompression", "LossyImageCompressionMethod",
    "PixelPresentation", "VolumetricProperties", "VolumeBasedCalculationTechnique",
    "PresentationLUTShape", "BurnedInAnnotation", "ConversionType", "PatientOrientation",
    "AnatomicalOrientationType", "FrameOfReferenceUID", "PositionReferenceIndicator",
    "ImageOrientationPatient", "ImagePositionPatient", "VOILUTFunction", "PresentationIntentType",
    "ViewPosition", "ImageLaterality", "Laterality",
}
TESTO_VR = {"LO", "SH", "LT", "ST", "UT", "AE", "UC", "UN", "AS", "CS", "UR", "OB_TEXT"}


class NonConforme(ValueError):
    """Campo tenuto malformato: il file si esclude per prudenza (stessa regola di web/anonimizza.js)."""


CONTROLLO_OK = {"\t", "\n", "\r", "\f", "\x1b"}
VR_BINARI = {"OB", "OD", "OF", "OL", "OV", "OW", "US", "SS", "UL", "SL", "FL", "FD", "AT", "SV", "UV", "UN"}


def controlla_conformi(dset):
    """Un file con una lunghezza sbagliata può far «inghiottire» a un campo tenuto (es. la modalità) i campi che lo
    seguono, nome del paziente compreso. Dopo il testo di un campo testuale non ci possono essere caratteri di controllo
    (salvo spazi e zeri di riempimento in fondo); un campo binario tenuto non può contenere parole leggibili."""
    for elem in dset:
        if elem.tag == 0x7FE00010 or elem.VR == "SQ":
            if elem.VR == "SQ":
                for item in elem.value:
                    controlla_conformi(item)
            continue
        if elem.VR in VR_BINARI:
            b = elem.value if isinstance(elem.value, (bytes, bytearray)) else b""
            lettere = 0
            for c in b:
                if 65 <= c <= 90 or 97 <= c <= 122:
                    lettere += 1
                    if lettere >= 6:
                        raise NonConforme(f"campo {elem.tag} non conforme (contenuto): file escluso per prudenza")
                elif c not in (0x5E, 0x20):
                    lettere = 0
            continue
        valori = elem.value if isinstance(elem.value, (list, tuple)) or type(elem.value).__name__ == "MultiValue" else [elem.value]
        for v in valori:
            t = str(v if v is not None else "").rstrip("\x00 ")
            if any(ord(c) < 0x20 and c not in CONTROLLO_OK for c in t):
                raise NonConforme(f"campo {elem.tag} non conforme (lunghezza o contenuto): file escluso per prudenza")


def anonimizza_dataset(ds, id_caso, sale):
    ds.remove_private_tags()
    for kw in DA_RIMUOVERE:
        if kw in ds:
            delattr(ds, kw)
    # overlay (gruppi 60xx) e curve (50xx): possono contenere testo/annotazioni
    for tag in [t for t in ds.keys() if 0x6000 <= t.group <= 0x60FF or 0x5000 <= t.group <= 0x50FF]:
        del ds[tag]

    def pulisci(dset):
        for elem in list(dset):
            if elem.VR == "SQ":
                if elem.keyword in ("ReferencedImageSequence", "SourceImageSequence",
                                    "ReferencedSeriesSequence", "ReferencedStudySequence",
                                    "ReferencedPerformedProcedureStepSequence"):
                    for item in elem.value:
                        pulisci(item)
                else:
                    del dset[elem.tag]  # sequenze non necessarie: via
            elif elem.VR in TESTO_VR and elem.keyword not in TESTO_CONSENTITO:
                del dset[elem.tag]
            elif elem.VR in ("DA", "DT", "TM", "PN"):
                del dset[elem.tag]
    pulisci(ds)

    def walker(dset, elem):
        if elem.VR in ("DA", "DT", "TM", "PN"):
            elem.value = ""
        elif elem.VR == "UI" and elem.value:
            kw = elem.keyword
            if kw in ("SOPClassUID", "ReferencedSOPClassUID", "TransferSyntaxUID",
                      "MediaStorageSOPClassUID", "CodingSchemeUID"):
                return
            v = str(elem.value)
            if v.startswith("1.2.840.10008."):  # UID standard DICOM, non identificativi
                return
            elem.value = nuovo_uid(v, sale)

    ds.walk(walker)
    controlla_conformi(ds)
    ds.PatientName = f"ANONIMO^{id_caso}"
    ds.PatientID = id_caso
    ds.PatientIdentityRemoved = "YES"
    ds.DeidentificationMethod = "PS3.15 Basic Profile - whitelist"
    # meta-informazioni del file
    fm = ds.file_meta
    fm.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
    fm.ImplementationVersionName = "QUIZ_ANON"
    if "SourceApplicationEntityTitle" in fm:
        del fm.SourceApplicationEntityTitle
    return ds


def pulisci_nome(s):
    s = re.sub(r"[^A-Za-z0-9]+", "_", s or "serie").strip("_")
    return s[:40] or "serie"


def _tempo(ds):
    tp = ds.get("TemporalPositionIdentifier")
    if tp not in (None, ""):
        return float(tp) * 1e6
    t = str(ds.get("AcquisitionTime", "") or ds.get("ContentTime", "") or "")
    if len(t) >= 6:
        try:
            return (int(t[:2]) * 3600 + int(t[2:4]) * 60 + float(t[4:])) * 1000
        except ValueError:
            pass
    tr = ds.get("TriggerTime")
    return float(tr) if tr not in (None, "") else None


def piano_di(iop):
    r, c = iop[:3], iop[3:]
    n = [r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0]]
    k = max(range(3), key=lambda i: abs(n[i]))
    if abs(n[k]) < 0.9:
        return "obliqua", n
    return ("sagittale", "coronale", "assiale")[k], n


def trova_fasi(sorgente):
    """Divide le serie miste:
    - piani diversi nella stessa serie (es. pacchetto di ricostruzioni multiplanari) → una serie per piano;
    - più immagini nella stessa posizione, con lo stesso numero per posizione (es. RM dinamica) → una serie per fase.
    Restituisce {percorso: {"chiave", "descr", "cartella", "numero"}}; le serie semplici non compaiono."""
    per_serie = {}
    for cartella, _, files in os.walk(sorgente):
        for nome in files:
            p = os.path.join(cartella, nome)
            try:
                ds = pydicom.dcmread(p, stop_before_pixels=True)
                ipp = [float(v) for v in ds.ImagePositionPatient]
                iop = [float(v) for v in ds.ImageOrientationPatient]
                uid = str(ds.SeriesInstanceUID)
            except Exception:
                continue
            piano, n = piano_di(iop)
            per_serie.setdefault(uid, []).append({"p": p, "ipp": ipp, "iop": "/".join(f"{v:.2f}" for v in iop),
                "piano": piano, "d": sum(ipp[i] * n[i] for i in range(3)), "t": _tempo(ds),
                "ist": int(ds.get("InstanceNumber", 0) or 0)})
    esito = {}
    ordine_piani = {"assiale": 1, "coronale": 2, "sagittale": 3, "obliqua": 4}
    for voci in per_serie.values():
        per_or = {}
        for v in voci:
            per_or.setdefault(v["iop"], []).append(v)
        multipiano = len({v["piano"] for v in voci}) > 1
        # orientamenti diversi ma stesso piano (es. due oblique): restano insieme solo se è un solo piano
        gruppi = {}
        for v in voci:
            gruppi.setdefault(v["piano"] if multipiano else "", []).append(v)
        for piano, g in gruppi.items():
            per_pos = {}
            for v in g:
                per_pos.setdefault("/".join(f"{x:.1f}" for x in v["ipp"]), []).append(v)
            k = len(g) / len(per_pos)
            dinamica = len(per_pos) >= 2 and k >= 2 and k == int(k) and all(len(x) == k for x in per_pos.values())
            if not dinamica and not multipiano:
                continue
            k = int(k) if dinamica else 1
            temporale = dinamica and len({v["t"] for v in g}) > 1 and any(v["t"] is not None for v in g)
            for pos in per_pos.values():
                pos.sort(key=lambda v: (v["t"] if v["t"] is not None else 0, v["ist"]))
                for j, v in enumerate(pos):
                    fase = j + 1 if dinamica else 0
                    parti, cart, num = [], "", 0
                    if piano:
                        parti.append(piano); cart += "_" + piano[:3]; num += ordine_piani[piano] / 10
                    if fase:
                        parti.append(f"{'fase' if temporale else 'gruppo'} {fase}/{k}"); cart += f"_f{fase:02d}"; num += fase / 1000
                    esito[v["p"]] = {"chiave": f"#{piano}#{fase}", "descr": " — " + ", ".join(parti),
                                     "cartella": cart, "numero": num, "ordine": v["d"]}
    return esito


def studi_di(sorgente):
    """Più studi nella stessa cartella (es. esame attuale e precedente): {percorso: "Studio N"},
    numerati in ordine di data. Della data resta solo mese e anno, nel nome della serie."""
    studi = {}
    for cartella, _, files in os.walk(sorgente):
        for nome in files:
            p = os.path.join(cartella, nome)
            try:
                ds = pydicom.dcmread(p, stop_before_pixels=True)
                uid = str(ds.StudyInstanceUID)
            except Exception:
                continue
            s = studi.setdefault(uid, {"data": str(ds.get("StudyDate", "") or "") + str(ds.get("StudyTime", "") or ""), "file": []})
            s["file"].append(p)
    if len(studi) < 2:
        return {}
    ordine = sorted(studi.values(), key=lambda s: s["data"])
    mesi = "gen feb mar apr mag giu lug ago set ott nov dic".split()

    def mese_anno(d):   # solo mese e anno (non il giorno): cronologia dei controlli, poco identificativa
        return f"{mesi[int(d[4:6]) - 1]} {d[:4]}" if len(d) >= 6 and d[4:6].isdigit() and 1 <= int(d[4:6]) <= 12 else ""
    return {p: (n + 1, len(ordine), mese_anno(s["data"])) for n, s in enumerate(ordine) for p in s["file"]}


MESI = "gen feb mar apr mag giu lug ago set ott nov dic".split()


def dati_studio(ds):
    """Dai dati originali, prima di anonimizzare: mese e anno dell'esame, età all'esame e,
    per la PET, il fattore SUV (peso corporeo). Peso, dose, orari e date non vengono conservati."""
    from datetime import datetime
    d = str(ds.get("StudyDate", "") or "")
    data = f"{MESI[int(d[4:6]) - 1]} {d[:4]}" if len(d) >= 6 and d[4:6].isdigit() and 1 <= int(d[4:6]) <= 12 else ""
    eta = None
    m = re.match(r"(\d{3})([YMWD])", str(ds.get("PatientAge", "") or ""))
    if m:
        eta = int(m.group(1)) if m.group(2) == "Y" else 0
    else:
        b = str(ds.get("PatientBirthDate", "") or "")
        try:
            B, D = datetime.strptime(b, "%Y%m%d"), datetime.strptime(d[:8], "%Y%m%d")
            eta = D.year - B.year - ((D.month, D.day) < (B.month, B.day))
        except ValueError:
            pass
    return data, (min(eta, 90) if eta is not None else None), fattore_suv(ds)   # oltre 89 anni: «90+»


def fattore_suv(ds):
    def sec(t):
        t = str(t or "")
        try:
            return int(t[:2]) * 3600 + int(t[2:4]) * 60 + float(t[4:] or 0)
        except ValueError:
            return None
    if str(ds.get("Modality", "")) != "PT":
        return None
    try:
        unita = str(ds.get("Units", "")).upper()
        if unita == "CNTS":                       # Philips: fattore SUV nel campo privato
            v = ds.get((0x7053, 0x1000))
            return float(v.value) if v is not None else None
        if unita != "BQML":
            return None
        peso = float(ds.PatientWeight) * 1000
        r = ds.RadiopharmaceuticalInformationSequence[0]
        dose, emivita = float(r.RadionuclideTotalDose), float(r.RadionuclideHalfLife)
        t0 = sec(r.get("RadiopharmaceuticalStartTime") or str(r.get("RadiopharmaceuticalStartDateTime", ""))[8:])
        ts = sec(ds.get("SeriesTime")) if str(ds.get("DecayCorrection", "START")).upper() == "START" else sec(ds.get("AcquisitionTime"))
        if t0 is None or ts is None or dose <= 0 or peso <= 0:
            return None
        dt = ts - t0 + (86400 if ts < t0 else 0)
        return peso / (dose * 2 ** (-dt / emivita))
    except Exception:
        return None


SOLO_SERIE = {int(x) for x in os.environ.get("SERIE", "").replace(" ", "").split(",") if x}


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    sorgente, id_caso = sys.argv[1], sys.argv[2]
    base = os.path.dirname(os.path.abspath(__file__))
    # casi del Polime in casi/, casi da archivi pubblici (TCIA) in casi-free/: CARTELLA_CASI=casi-free
    dest_caso = os.path.join(base, os.environ.get("CARTELLA_CASI", "casi-free"), id_caso)
    dest_serie = os.path.join(dest_caso, "serie")
    os.makedirs(dest_serie, exist_ok=True)
    # sale non salvato: impossibile risalire agli UID originali. Per un esame caricato a pezzi
    # (una serie alla volta) si passa lo stesso sale con la variabile SALE, poi lo si dimentica.
    sale = os.environ.get("SALE") or os.urandom(16).hex()

    fasi = trova_fasi(sorgente)
    studi = studi_di(sorgente)
    serie = {}
    esclusi = 0
    motivi = {}
    cine_n = {}
    for cartella, _, files in os.walk(sorgente):
        for nome in sorted(files):
            p = os.path.join(cartella, nome)
            try:
                ds0 = pydicom.dcmread(p)
            except Exception:
                continue
            for ds in (x for d1 in frame_singoli(ds0) for x in frame_cine(d1)):
                if SOLO_SERIE and int(ds.get("SeriesNumber", -1) or -1) not in SOLO_SERIE:
                    continue                  # serie non scelta (variabile SERIE="201,501,...")
                if "PixelData" not in ds:
                    esclusi += 1
                    continue
                if str(ds.file_meta.get("TransferSyntaxUID", "")) == "1.2.840.10008.1.2.5":
                    try:                                    # RLE (alcuni ecografi): pydicom lo decomprime da solo
                        ds.decompress()
                    except Exception:
                        pass
                motivo = non_visualizzabile(ds)
                if motivo:
                    esclusi += 1; motivi[motivo] = motivi.get(motivo, 0) + 1
                    continue
                eco = str(ds.get("Modality", "")) == "US"
                if eco:
                    if not prepara_ecografia(ds):          # senza regioni di immagine note non si può pulire
                        esclusi += 1; motivi["ecografia senza regioni"] = motivi.get("ecografia senza regioni", 0) + 1
                        continue
                elif e_secondary_capture(ds):
                    esclusi += 1; motivi["secondary capture / colore"] = motivi.get("secondary capture / colore", 0) + 1
                    continue
                num = int(ds.get("SeriesNumber", 0) or 0)
                descr = str(ds.get("SeriesDescription", "") or f"Serie {num}")
                key = str(ds.SeriesInstanceUID)
                studio = studi.get(p)
                if studio:                    # più studi: «Studio 1» è il più vecchio
                    key += f"@{studio[0]}"
                    descr = f"Studio {studio[0]} · {studio[2] + ' · ' if studio[2] else ''}{descr}"
                extra = fasi.get(p)
                if extra:                     # serie divisa per piano e/o per fase
                    key += extra["chiave"]
                    descr += extra["descr"]
                cine = getattr(ds, "_cine", None)
                if cine:                      # filmato ecografico: una serie per filmato
                    if cine[0] not in cine_n:
                        cine_n[cine[0]] = len(cine_n) + 1
                    key += f"#cine{cine_n[cine[0]]}"
                    descr += f" · filmato {cine_n[cine[0]]}"
                if str(ds.get("BurnedInAnnotation", "")).upper() == "YES":
                    esclusi += 1
                    continue
                info = dati_studio(ds) if key not in serie else None
                try:
                    anonimizza_dataset(ds, id_caso, sale)
                except NonConforme as e:
                    esclusi += 1
                    print(f"  escluso {os.path.basename(str(getattr(ds, 'filename', '') or ''))}: {e}")
                    continue
                if key not in serie:
                    cartella_s = f"{f's{studio[0]}_' if studio else ''}{num:04d}{extra['cartella'] if extra else ''}_{pulisci_nome(descr)}"
                    serie[key] = {"numero": (studio[0] * 100000 if studio else 0) + num + (extra["numero"] if extra else 0), "descrizione": descr, "cartella": cartella_s, "immagini": [],
                                  "data": info[0], "eta": info[1], "suv": info[2], "cine_ms": cine[1] if cine else None}
                    os.makedirs(os.path.join(dest_serie, cartella_s), exist_ok=True)
                s = serie[key]
                inst = int(ds.get("InstanceNumber", 0) or 0)
                out_nome = f"img_{inst:05d}_{len(s['immagini']):05d}.dcm"
                for t in [t for t in ds.keys() if t.group == 0]: del ds[t]   # gruppo 0000 (comandi DIMSE, es. AE di chi ha inviato)
                ds.save_as(os.path.join(dest_serie, s["cartella"], out_nome), enforce_file_format=True)
                s["immagini"].append({"file": out_nome, "istanza": inst, "ordine": extra["ordine"] if extra else None})

    elenco = []
    for s in sorted(serie.values(), key=lambda x: x["numero"]):
        if all(i["ordine"] is not None for i in s["immagini"]):
            s["immagini"].sort(key=lambda x: (x["ordine"], x["istanza"]))   # serie divise: in ordine di posizione
        else:
            s["immagini"].sort(key=lambda x: x["istanza"])
        voce = {
            "descrizione": s["descrizione"], "numero": int(s["numero"]) % 100000,
            "files": [f"serie/{s['cartella']}/{i['file']}" for i in s["immagini"]],
        }
        for k in ("data", "eta", "suv", "cine_ms"):       # mese/anno dell'esame, età all'esame, fattore SUV (PET)
            if s.get(k) not in (None, ""):
                voce[k] = s[k]
        elenco.append(voce)
    # con AGGIUNGI=1 le serie si aggiungono a quelle già presenti nel caso (caricamento a pezzi)
    percorso_elenco = os.path.join(dest_caso, "serie.json")
    if os.environ.get("AGGIUNGI") == "1" and os.path.exists(percorso_elenco):
        nuove = {s["files"][0].split("/")[1] for s in elenco if s["files"]}
        vecchie = [s for s in json.load(open(percorso_elenco)) if not s["files"] or s["files"][0].split("/")[1] not in nuove]
        elenco = sorted(vecchie + elenco, key=lambda s: s.get("numero", 0))
    with open(percorso_elenco, "w") as f:
        json.dump(elenco, f, indent=1, ensure_ascii=False)

    caso_json = os.path.join(dest_caso, "caso.json")
    if not os.path.exists(caso_json):
        with open(caso_json, "w") as f:
            json.dump({
                "id": id_caso,
                "visibile": False,   # bozza: diventa visibile solo dopo la revisione
                "titolo": f"Caso {id_caso}",
                "anamnesi": "DA COMPILARE: storia clinica, sintomi, esami di laboratorio...",
                "domanda": "Quali sono le diagnosi/reperti corretti? (una o piu' risposte)",
                "opzioni": [
                    {"testo": "Opzione A - da compilare", "corretta": True},
                    {"testo": "Opzione B - da compilare", "corretta": False},
                    {"testo": "Opzione C - da compilare", "corretta": False},
                    {"testo": "Opzione D - da compilare", "corretta": False},
                ],
                "spiegazione": "DA COMPILARE: discussione del caso, reperti chiave, serie/immagini da guardare.",
            }, f, indent=2, ensure_ascii=False)

    # compressione senza perdita (JPEG Lossless) delle immagini non compresse, se GDCM è disponibile
    try:
        sys.path.insert(0, os.path.join(base, "strumenti"))
        import comprimi
        risparmio = [0, 0]
        for rad, _, files in os.walk(dest_serie):
            for f in files:
                if f.endswith(".dcm"):
                    x = comprimi.comprimi(os.path.join(rad, f))
                    if isinstance(x, tuple):
                        risparmio[0] += x[0]; risparmio[1] += x[1]
        if risparmio[0]:
            print(f"Compressione senza perdita: {risparmio[0] / 1e6:.0f} → {risparmio[1] / 1e6:.0f} MB")
    except ImportError:
        pass

    tot = sum(len(s["files"]) for s in elenco)
    print(f"Caso '{id_caso}': {len(elenco)} serie, {tot} immagini anonimizzate, {esclusi} file esclusi.")
    if motivi:
        print("  esclusi per:", ", ".join(f"{k} {v}" for k, v in motivi.items()))
    for s in elenco:
        print(f"  - {int(s['numero']):>4}  {s['descrizione']}  ({len(s['files'])} img)")


if __name__ == "__main__":
    main()
