"""Caso 171 a tappe (26/11/2026): stessa paziente del NIH ChestX-ray14 (28861) prima con il drenaggio (controllo n. 9) e poi
dopo la rimozione (controllo n. 12). La seconda radiografia resta chiusa finché lo studente non arriva alla terza domanda.
Da lanciare DOPO scrivi_166_171.py. Uso: ~/.radioquiz-ia/venv/bin/python scrivi_171_tappe.py
"""
import csv, json, os
import numpy as np
from PIL import Image
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free'; ID = 'caso-tcia-171'
NIH = '/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/nih_cxr14'
DX = '1.2.840.10008.5.1.4.1.1.1.1'
de = {r['Image Index']: r for r in csv.DictReader(open(os.path.join(NIH, 'Data_Entry_2017_v2020.csv')))}


def dicom(png, cartella, desc, numero):
    d = de[png]; a = np.asarray(Image.open(os.path.join(NIH, 'png', png)).convert('L'), dtype=np.uint8)
    assert abs(int(d['OriginalImage[Width']) / int(d['Height]']) - 1) < 0.01, png
    sp = round(float(d['OriginalImagePixelSpacing[x']) * int(d['OriginalImage[Width']) / a.shape[1], 4)
    os.makedirs(os.path.join(CASI, ID, 'serie', cartella), exist_ok=True)
    fm = FileMetaDataset(); fm.MediaStorageSOPClassUID = DX; fm.MediaStorageSOPInstanceUID = generate_uid(); fm.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = Dataset(); ds.file_meta = fm
    ds.ImageType = ['DERIVED', 'SECONDARY']; ds.SOPClassUID = DX; ds.SOPInstanceUID = fm.MediaStorageSOPInstanceUID
    ds.Modality = 'DX'; ds.PresentationIntentType = 'FOR PRESENTATION'; ds.SeriesDescription = desc
    ds.DerivationDescription = 'Convertita da PNG a 8 bit della collezione NIH ChestX-ray14: non e un DICOM originale'
    ds.PatientName = 'ANONIMO^' + ID; ds.PatientID = ID; ds.PatientSex = d['Patient Gender']; ds.PatientAge = '%03dY' % int(d['Patient Age'])
    ds.PatientIdentityRemoved = 'YES'; ds.DeidentificationMethod = 'NIH ChestX-ray14 anonimizzata alla fonte'
    ds.BodyPartExamined = 'CHEST'; ds.ViewPosition = 'PA'
    ds.StudyInstanceUID = generate_uid(); ds.SeriesInstanceUID = generate_uid(); ds.SeriesNumber = numero; ds.InstanceNumber = 1
    ds.PixelSpacing = [sp, sp]; ds.ImagerPixelSpacing = [sp, sp]
    ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'; ds.Rows, ds.Columns = a.shape
    ds.BitsAllocated = 8; ds.BitsStored = 8; ds.HighBit = 7; ds.PixelRepresentation = 0; ds.BurnedInAnnotation = 'NO'
    lo, hi = np.percentile(a, [1, 99.5]); ds.WindowCenter = round((lo + hi) / 2); ds.WindowWidth = round(hi - lo)
    ds.RescaleIntercept = 0; ds.RescaleSlope = 1; ds.RescaleType = 'US'; ds.ImageComments = 'NIH ChestX-ray14 ' + png
    ds.PixelData = a.tobytes()
    rel = 'serie/%s/img_00001.dcm' % cartella
    ds.save_as(os.path.join(CASI, ID, rel), enforce_file_format=True)
    return {'descrizione': desc, 'numero': numero, 'files': [rel]}


# la prima serie è quella scritta da scrivi_166_171.py: si rinomina solo la descrizione
cart0 = os.path.join(CASI, ID, 'serie')
s0 = json.load(open(os.path.join(CASI, ID, 'serie.json')))[0]
s0['descrizione'] = 'Controllo 1 · RX torace PA con il drenaggio'
s1 = dicom('00028861_012.png', '0002_RX_torace_PA_controllo_2', 'Controllo 2 · RX torace PA dopo la rimozione del drenaggio', 2)
json.dump([s0, s1], open(os.path.join(CASI, ID, 'serie.json'), 'w'), ensure_ascii=False, indent=1)

c = json.load(open(os.path.join(CASI, ID, 'caso.json')))
c['titolo'] = 'RX torace (6/6): donna di 24 anni con drenaggio toracico, due controlli'
c['titolo_interno'] = 'Pneumotorace sinistro residuo con drenaggio, poi polmone riespanso dopo la rimozione (NIH 00028861_009 e _012)'
c['anamnesi'] = ('Donna di 24 anni con un drenaggio toracico sinistro. Due RX del torace in PA della stessa paziente: la prima con il drenaggio, '
                 'la seconda di controllo dopo la rimozione (la collezione non dà le date né il motivo del drenaggio). La seconda radiografia si apre alla terza domanda.')
c['domanda'] = 'Leggi il primo controllo, decidi che cosa fare, poi confrontalo con il secondo.'
c['sezioni'] = [
    {'nome': 'Controllo con il drenaggio', 'domanda': 'C\'è ancora aria nel cavo pleurico? Indicala sull\'immagine.', 'serie': 0},
    {'nome': 'Conclusioni', 'domanda': 'Qual è la conclusione e che cosa fai?', 'singola': True, 'serie': 0},
    {'nome': 'Controllo dopo la rimozione', 'domanda': 'Il drenaggio è stato tolto: com\'è la radiografia di controllo rispetto alla prima?', 'serie': 1, 'scopri': True}]
nuove = [
    {'testo': 'Polmone sinistro riespanso: la linea pleurica non si vede più e la trama polmonare arriva fino alla parete', 'corretta': True, 'tipo': 'secondario', 'sezione': 2,
     'nota': 'Confronta l\'apice sinistro nelle due radiografie, con la stessa finestra.'},
    {'testo': 'Drenaggio toracico rimosso', 'corretta': True, 'tipo': 'secondario', 'sezione': 2},
    {'testo': 'Pneumotorace sinistro aumentato rispetto al primo controllo', 'corretta': False, 'tipo': 'distrattore', 'sezione': 2},
    {'testo': 'Versamento pleurico sinistro comparso dopo la rimozione', 'corretta': False, 'tipo': 'distrattore', 'sezione': 2},
    {'testo': 'Enfisema sottocutaneo esteso della parete sinistra', 'corretta': False, 'tipo': 'distrattore', 'sezione': 2}]
c['opzioni'] = [o for o in c['opzioni'] if o.get('sezione') != 2] + nuove
c['spiegazione'] += (' Il confronto con l\'esame precedente è il cuore di questi controlli: stessa proiezione, stessa finestra, si guarda prima la zona '
                     'del problema (qui l\'apice sinistro) e poi tutto il resto. Dopo la rimozione del drenaggio la RX serve a escludere la recidiva '
                     'del pneumotorace e le complicanze del foro (enfisema sottocutaneo, versamento).')
c['regola'] = 'Nei controlli confronta sempre con il precedente: stessa proiezione, stessa finestra, prima la zona del problema.'
c['esito_clinico']['testo'] = ('Primo controllo: riquadro della lesione disegnato dai radiologi del NIH (BBox_List_2017: «Pneumothorax»). '
                               'Secondo controllo (n. 12 della paziente): etichetta della collezione «No Finding», estratta dai referti con un programma. '
                               'Nessun dato clinico.')
c['fonte']['soggetto'] = '00028861_009.png e 00028861_012.png (paziente 28861, controlli n. 9 e 12; F, 24 anni)'
c['nota_docente'] += (' [tappe 26/11/2026] Aggiunto il controllo n. 12 della stessa paziente (etichetta NLP «No Finding»): drenaggio rimosso, '
                      'apice sinistro riespanso alla lettura di Claude. Nella collezione non c\'è una radiografia della paziente prima del drenaggio '
                      '(già il controllo n. 7 ha il tubo), per questo il «prima e dopo» è con il drenaggio e dopo la rimozione.')
json.dump(c, open(os.path.join(CASI, ID, 'caso.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(c['opzioni']), 'opzioni')
