#!/usr/bin/env python3
"""png2us.py: converte ecografie 2D in PNG (collezioni aperte BUS-BRA e HC18) in DICOM US (Ultrasound Image Storage).
Uso da codice: converti(caso, immagini=[(png, descrizione)], serie_descr, studio_descr, sesso, spaziatura_mm|None, fonte_breve, collezione)
- pixel invariati (8 bit, scala di grigi), nessun ricampionamento;
- spaziatura dei pixel solo dove la collezione la fornisce (HC18); BUS-BRA non la dà: le misure si leggono sulle scritte dell'ecografo;
- nessun dato personale; conversione dichiarata in DerivationDescription e ImageComments."""
import os, json
import numpy as np
from PIL import Image
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
R = '/Volumes/Caloggero/piattaforma-quiz/'
US = '1.2.840.10008.5.1.4.1.1.6.1'

def converti(caso, immagini, serie_descr, studio_descr, sesso, spaziatura, fonte_breve, parte='BREAST', lateralita=None):
    base = R + f'casi-free/{caso}/'
    cart = f'0001_{serie_descr.replace(" ", "_")}'
    os.makedirs(base + 'serie/' + cart, exist_ok=True)
    study, series = generate_uid(prefix=None), generate_uid(prefix=None)
    files, rapporto = [], []
    for k, (png, descr) in enumerate(immagini):
        a = np.array(Image.open(png).convert('L'))
        fm = FileMetaDataset(); fm.MediaStorageSOPClassUID = US
        sop = generate_uid(prefix=None); fm.MediaStorageSOPInstanceUID = sop; fm.TransferSyntaxUID = ExplicitVRLittleEndian
        fm.ImplementationClassUID = generate_uid(prefix=None)
        ds = FileDataset(None, {}, file_meta=fm, preamble=b'\0' * 128)
        ds.SpecificCharacterSet = 'ISO_IR 100'
        ds.ImageType = ['DERIVED', 'SECONDARY']; ds.SOPClassUID = US; ds.SOPInstanceUID = sop
        ds.Modality = 'US'; ds.StudyDescription = studio_descr; ds.SeriesDescription = serie_descr
        ds.BodyPartExamined = parte
        if lateralita: ds.Laterality = lateralita
        ds.DerivationDescription = f'Convertita da PNG della collezione {fonte_breve}: non e un DICOM originale; pixel invariati'
        ds.ImageComments = (descr + ' - ' if descr else '') + f'immagine convertita da PNG in DICOM ({fonte_breve})'
        ds.PatientName = f'ANONIMO^{caso}'; ds.PatientID = caso; ds.PatientIdentityRemoved = 'YES'
        ds.DeidentificationMethod = f'Collezione pubblica {fonte_breve}, nessun dato personale'
        if sesso: ds.PatientSex = sesso
        ds.StudyInstanceUID = study; ds.SeriesInstanceUID = series
        ds.SeriesNumber = 1; ds.InstanceNumber = k + 1
        ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'
        ds.Rows, ds.Columns = a.shape
        if spaziatura: ds.PixelSpacing = [f'{spaziatura:.10f}', f'{spaziatura:.10f}']
        ds.BitsAllocated = 8; ds.BitsStored = 8; ds.HighBit = 7; ds.PixelRepresentation = 0
        ds.WindowCenter = '128'; ds.WindowWidth = '256'
        ds.PixelData = a.astype(np.uint8).tobytes()
        fn = f'img_{k + 1:05d}.dcm'; ds.save_as(base + 'serie/' + cart + '/' + fn, enforce_file_format=True)
        files.append(f'serie/{cart}/{fn}'); rapporto.append(f'{os.path.basename(png)} {a.shape[1]}x{a.shape[0]}')
    json.dump([{'descrizione': serie_descr + ' (convertita da PNG)', 'numero': 1, 'files': files}], open(base + 'serie.json', 'w'), ensure_ascii=False, indent=1)
    print(caso, ', '.join(rapporto))

if __name__ == '__main__':
    B = R + '_tcia_grezzi/busbra/BUSBRA/Images/'
    H = R + '_tcia_grezzi/hc18/training_set/'
    import csv
    px = {r['filename']: float(r['pixel size(mm)']) for r in csv.DictReader(open(R + '_tcia_grezzi/hc18/training_set_pixel_size_and_HC.csv'))}
    # BUS-BRA: due immagini per caso (le due proiezioni della stessa lesione)
    for caso, n, lat in (('caso-tcia-156', 580, 'L'), ('caso-tcia-157', 558, 'L'), ('caso-tcia-158', 451, 'R'), ('caso-tcia-159', 566, 'L'), ('caso-tcia-160', 623, 'R')):
        converti(caso, [(B + f'bus_{n:04d}-l.png', 'proiezione 1'), (B + f'bus_{n:04d}-r.png', 'proiezione 2')],
                 'Ecografia mammaria', 'Ecografia mammaria', 'F', None, 'BUS-BRA, Zenodo 10.5281/zenodo.8231412', 'BREAST', lat)
    for caso, n in (('caso-tcia-162', 135), ('caso-tcia-163', 218), ('caso-tcia-164', 693)):
        converti(caso, [(H + f'{n:03d}_HC.png', 'piano della circonferenza cranica')], 'Ecografia ostetrica', 'Ecografia ostetrica',
                 'F', px[f'{n:03d}_HC.png'], 'HC18, Zenodo 10.5281/zenodo.1327317, CC BY 4.0', 'ABDOMEN')
