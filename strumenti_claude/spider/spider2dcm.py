#!/usr/bin/env python3
"""spider2dcm.py PAZIENTE caso-tcia-NNN
Converte le RM sagittali T1 e T2 (MHA) della collezione SPIDER (Zenodo 10159290, CC BY 4.0) in serie DICOM MR.
- orientamento dalla matrice di direzione di ogni file (DICOMOrient 'PIL': colonne → posteriore, righe → in basso, fette → sinistra);
- pixel e spaziatura invariati (interi a 16 bit come nella collezione, che in molti file ha intensità già normalizzate -1000…3096);
- dove l'origine destra-sinistra della collezione è fuori scala (|x| > 300 mm) la serie viene ricentrata su x = 0 (dichiarato);
- T1 e T2 dello stesso paziente nello stesso sistema di riferimento; UID nuovi; nessun dato personale (solo sesso dalla collezione).
"""
import sys, os, json, csv
import numpy as np, SimpleITK as sitk, pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian

R = '/Volumes/Caloggero/piattaforma-quiz/'
S = R + '_tcia_grezzi/spider/'
paz, caso = sys.argv[1], sys.argv[2]
ov = {r['new_file_name']: r for r in csv.DictReader(open(S + 'overview.csv'))}
DESCR = {'t1': 'T1 sagittale', 't2': 'T2 sagittale'}
if len(sys.argv) > 3: DESCR['t2'] = sys.argv[3]      # es. «T2 sagittale con soppressione del grasso»
base = R + f'casi-free/{caso}/'
os.makedirs(base + 'serie', exist_ok=True)
study, frame = generate_uid(prefix=None), generate_uid(prefix=None)
serie_json, rapporto = [], []
for n_serie, s in enumerate(('t1', 't2'), 1):
    im = sitk.ReadImage(S + f'mha/images/{paz}_{s}.mha')
    o = sitk.DICOMOrient(im, 'PIL')
    a = sitk.GetArrayFromImage(o)                      # [k (sinistra), riga (in basso), colonna (posteriore)]
    d = o.GetDirection(); col = (d[0], d[3], d[6]); riga = (d[1], d[4], d[7])
    assert np.allclose(col, (0, 1, 0)) and np.allclose(riga, (0, 0, -1)), (s, d)
    sp = o.GetSpacing()                                # (colonna, riga, fetta)
    centro = o.TransformContinuousIndexToPhysicalPoint([(n - 1) / 2 for n in o.GetSize()])
    dx = -centro[0] if abs(centro[0]) > 300 else 0.0
    vmin, vmax = int(a.min()), int(a.max())
    segnato = vmin < 0
    px_all = a.astype(np.int16 if segnato else np.uint16)
    lo, hi = np.percentile(a[a > vmin], (1, 99.5)) if (a > vmin).any() else (vmin, vmax)
    wc, ww = float((lo + hi) / 2), float(max(hi - lo, 1))
    meta = ov.get(f'{paz}_{s}', {})
    cartella = f'{n_serie:04d}_{DESCR[s].replace(" ", "_")}'
    os.makedirs(base + 'serie/' + cartella, exist_ok=True)
    series = generate_uid(prefix=None); files = []
    for k in range(a.shape[0]):
        p = o.TransformIndexToPhysicalPoint((0, 0, k)); p = (p[0] + dx, p[1], p[2])
        fm = FileMetaDataset(); fm.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.4'
        sop = generate_uid(prefix=None); fm.MediaStorageSOPInstanceUID = sop; fm.TransferSyntaxUID = ExplicitVRLittleEndian
        fm.ImplementationClassUID = generate_uid(prefix=None)
        ds = FileDataset(None, {}, file_meta=fm, preamble=b'\0' * 128)
        ds.SpecificCharacterSet = 'ISO_IR 100'
        ds.ImageType = ['DERIVED', 'SECONDARY']; ds.SOPClassUID = fm.MediaStorageSOPClassUID; ds.SOPInstanceUID = sop
        ds.Modality = 'MR'; ds.StudyDescription = 'RM rachide lombare'; ds.SeriesDescription = DESCR[s]
        ds.BodyPartExamined = 'LSPINE'
        ds.DerivationDescription = ('Convertita da MHA della collezione SPIDER (van der Graaf et al., Zenodo 10.5281/zenodo.10159290, CC BY 4.0): '
                                    'non e un DICOM originale; pixel e spaziatura invariati' + ('; posizione destra-sinistra ricentrata' if dx else ''))
        ds.ImageComments = 'Immagine convertita da MHA in DICOM (collezione SPIDER, CC BY 4.0)'
        ds.PatientName = f'ANONIMO^{caso}'; ds.PatientID = caso; ds.PatientIdentityRemoved = 'YES'
        ds.DeidentificationMethod = 'Collezione pubblica SPIDER, nessun dato personale'
        sex = (meta.get('sex') or '').strip()
        if sex in ('M', 'F'): ds.PatientSex = sex
        ds.PatientPosition = 'HFS'
        if meta.get('MagneticFieldStrength'): ds.MagneticFieldStrength = meta['MagneticFieldStrength']
        if meta.get('Manufacturer'): ds.Manufacturer = meta['Manufacturer']
        for kk, tag in (('EchoTime', 'EchoTime'), ('RepetitionTime', 'RepetitionTime')):
            try: setattr(ds, tag, f'{float(meta[kk]):.3f}')
            except Exception: pass
        ds.SliceThickness = f'{sp[2]:.3f}'; ds.SpacingBetweenSlices = f'{sp[2]:.3f}'
        ds.StudyInstanceUID = study; ds.SeriesInstanceUID = series; ds.FrameOfReferenceUID = frame
        ds.SeriesNumber = n_serie; ds.InstanceNumber = k + 1
        ds.ImagePositionPatient = [f'{p[0]:.4f}', f'{p[1]:.4f}', f'{p[2]:.4f}']
        ds.ImageOrientationPatient = [0, 1, 0, 0, 0, -1]; ds.SliceLocation = f'{p[0]:.4f}'
        ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'
        px = px_all[k]; ds.Rows, ds.Columns = px.shape
        ds.PixelSpacing = [f'{sp[1]:.6f}', f'{sp[0]:.6f}']   # riga, colonna
        ds.BitsAllocated = 16; ds.BitsStored = 16; ds.HighBit = 15; ds.PixelRepresentation = 1 if segnato else 0
        ds.WindowCenter = f'{wc:.0f}'; ds.WindowWidth = f'{ww:.0f}'
        ds.PixelData = px.tobytes()
        fn = f'img_{k + 1:05d}.dcm'; ds.save_as(base + 'serie/' + cartella + '/' + fn, enforce_file_format=True)
        files.append(f'serie/{cartella}/{fn}')
    serie_json.append({'descrizione': DESCR[s] + ' (convertita da MHA)', 'numero': n_serie, 'files': files})
    rapporto.append(f'{s}: {a.shape[0]} fette, {a.shape[1]}×{a.shape[2]}, spaziatura {sp[0]:.2f}×{sp[1]:.2f}×{sp[2]:.2f} mm, valori {vmin}…{vmax}, WC/WW {wc:.0f}/{ww:.0f}, ricentrata {dx:+.0f} mm')
json.dump(serie_json, open(base + 'serie.json', 'w'), ensure_ascii=False, indent=1)
print(caso, f'paziente SPIDER {paz}'); [print('  ' + r) for r in rapporto]
