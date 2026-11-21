# File DICOM di prova per il visualizzatore client: compressioni, multi-frame, DICOMDIR, testo impresso.
# Uso (sul Mac): /tmp/cvenv/bin/python genera_dicom_prova.py
import os, io, glob, copy, shutil
import numpy as np, pydicom
from pydicom.uid import (JPEG2000Lossless, JPEGLSLossless, RLELossless, JPEGBaseline8Bit, ExplicitVRLittleEndian, generate_uid)
from pydicom.encaps import encapsulate
from pydicom.dataset import Dataset
from PIL import Image, ImageDraw
BASE = '/Volumes/Caloggero/piattaforma-quiz/casi-free'
OUT = '/Volumes/Caloggero/_viste/dicom_prova'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
ct = sorted(glob.glob(BASE + '/caso-tcia-119/serie/0001_AngioTC_aorta/*.dcm'))[200:230]
def leggi(f):
    ds = pydicom.dcmread(f); ds.decompress() if ds.file_meta.TransferSyntaxUID.is_compressed else None; return ds
def nuova_serie(dss, desc):
    su = generate_uid()
    for i, ds in enumerate(dss):
        ds.SeriesInstanceUID = su; ds.SeriesDescription = desc; ds.SOPInstanceUID = generate_uid(); ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
        ds.SeriesNumber = abs(hash(desc)) % 900 + 10
    return dss
for nome, ts in [('ct_j2k', JPEG2000Lossless), ('ct_jls', JPEGLSLossless), ('ct_rle', RLELossless)]:
    os.makedirs(f'{OUT}/{nome}')
    dss = nuova_serie([leggi(f) for f in ct], 'Prova ' + nome)
    for i, ds in enumerate(dss):
        ds.compress(ts); ds.save_as(f'{OUT}/{nome}/IM{i:04d}')      # senza estensione, come sui CD
    print(nome, 'ok')
# JPEG baseline 8 bit (finestra addome già applicata)
os.makedirs(f'{OUT}/ct_jpeg8')
dss = nuova_serie([leggi(f) for f in ct], 'Prova ct_jpeg8')
for i, ds in enumerate(dss):
    a = ds.pixel_array.astype(np.float32) * float(ds.get('RescaleSlope', 1)) + float(ds.get('RescaleIntercept', 0))
    a8 = np.clip((a - (40 - 200)) / 400 * 255, 0, 255).astype(np.uint8)
    b = io.BytesIO(); Image.fromarray(a8).save(b, format='JPEG', quality=92)
    ds.BitsAllocated = 8; ds.BitsStored = 8; ds.HighBit = 7; ds.PixelRepresentation = 0; ds.RescaleSlope = 1; ds.RescaleIntercept = 0
    ds.WindowCenter = 128; ds.WindowWidth = 256
    ds.PixelData = encapsulate([b.getvalue()]); ds['PixelData'].VR = 'OB'; ds.file_meta.TransferSyntaxUID = JPEGBaseline8Bit
    ds.save_as(f'{OUT}/ct_jpeg8/IM{i:04d}.dcm', enforce_file_format=True)
print('jpeg8 ok')
# Enhanced CT multi-frame (30 fotogrammi, posizioni per fotogramma)
dss = [leggi(f) for f in ct]; d0 = dss[0]
mf = Dataset(); mf.file_meta = copy.deepcopy(d0.file_meta); mf.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
mf.file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.2.1'; mf.SOPClassUID = '1.2.840.10008.5.1.4.1.1.2.1'
mf.SOPInstanceUID = generate_uid(); mf.file_meta.MediaStorageSOPInstanceUID = mf.SOPInstanceUID
for t in ['StudyInstanceUID', 'Modality', 'Rows', 'Columns', 'BitsAllocated', 'BitsStored', 'HighBit', 'PixelRepresentation', 'SamplesPerPixel', 'PhotometricInterpretation', 'FrameOfReferenceUID']:
    setattr(mf, t, getattr(d0, t))
mf.SeriesInstanceUID = generate_uid(); mf.SeriesDescription = 'Prova enhanced CT multi-frame'; mf.SeriesNumber = 77; mf.InstanceNumber = 1
mf.ImageType = ['ORIGINAL', 'PRIMARY', 'AXIAL']; mf.NumberOfFrames = len(dss)
sh = Dataset(); pm = Dataset(); pm.PixelSpacing = d0.PixelSpacing; pm.SliceThickness = d0.get('SliceThickness', 1.5); sh.PixelMeasuresSequence = [pm]
po = Dataset(); po.ImageOrientationPatient = d0.ImageOrientationPatient; sh.PlaneOrientationSequence = [po]
pt = Dataset(); pt.RescaleSlope = d0.get('RescaleSlope', 1); pt.RescaleIntercept = d0.get('RescaleIntercept', 0); pt.RescaleType = 'HU'; sh.PixelValueTransformationSequence = [pt]
vo = Dataset(); vo.WindowCenter = 40; vo.WindowWidth = 400; sh.FrameVOILUTSequence = [vo]
mf.SharedFunctionalGroupsSequence = [sh]
per = []
for ds in dss:
    it = Dataset(); pp = Dataset(); pp.ImagePositionPatient = ds.ImagePositionPatient; it.PlanePositionSequence = [pp]; per.append(it)
mf.PerFrameFunctionalGroupsSequence = per
mf.PixelData = np.stack([ds.pixel_array for ds in dss]).astype(dss[0].pixel_array.dtype).tobytes()
mf.save_as(f'{OUT}/ct_enhanced_mf.dcm', enforce_file_format=True)
print('enhanced ok')
# Clip ecografica multi-frame RGB, JPEG baseline YBR_FULL_422, 12 fotogrammi
us = pydicom.dcmread(sorted(glob.glob(BASE + '/caso-tcia-105/serie/*/*.dcm'))[0]); us.decompress() if us.file_meta.TransferSyntaxUID.is_compressed else None
a = us.pixel_array
if a.ndim == 2: a = np.stack([a] * 3, -1)
a = a.astype(np.uint8); H, W = a.shape[:2]; fr = []
for k in range(12):
    im = Image.fromarray(np.roll(a, k * 6, axis=1)); d = ImageDraw.Draw(im); d.ellipse([W // 2 - 20 + k * 4, H // 2 - 20, W // 2 + 20 + k * 4, H // 2 + 20], outline=(255, 200, 0), width=3)
    b = io.BytesIO(); im.save(b, format='JPEG', quality=90); fr.append(b.getvalue())
us.NumberOfFrames = 12; us.FrameTime = 40; us.SamplesPerPixel = 3; us.PhotometricInterpretation = 'YBR_FULL_422'; us.PlanarConfiguration = 0
us.BitsAllocated = 8; us.BitsStored = 8; us.HighBit = 7; us.PixelRepresentation = 0; us.Rows = H; us.Columns = W
us.PixelData = encapsulate(fr); us['PixelData'].VR = 'OB'; us.file_meta.TransferSyntaxUID = JPEGBaseline8Bit
us.SeriesInstanceUID = generate_uid(); us.SOPInstanceUID = generate_uid(); us.file_meta.MediaStorageSOPInstanceUID = us.SOPInstanceUID; us.SeriesDescription = 'Prova clip eco multi-frame'
us.save_as(f'{OUT}/us_clip_mf.dcm', enforce_file_format=True)
print('us ok')
# RX con testo impresso nei pixel (BurnedInAnnotation YES)
rx = pydicom.dcmread(sorted(glob.glob(BASE + '/caso-tcia-094/serie/*/*.dcm'))[0]); rx.decompress() if rx.file_meta.TransferSyntaxUID.is_compressed else None
p = rx.pixel_array.copy(); mx = int(p.max())
im = Image.fromarray((p.astype(np.float32) / max(1, mx) * 255).astype(np.uint8)); d = ImageDraw.Draw(im)
from PIL import ImageFont; fnt = ImageFont.load_default(size=56)
d.rectangle([20, 20, 1500, 110], fill=0); d.text((40, 35), 'ROSSI MARIO 12/03/1950 OSPEDALE PROVA', fill=255, font=fnt)
q = (np.asarray(im).astype(np.float32) / 255 * mx).astype(p.dtype); rx.PixelData = q.tobytes(); rx.BurnedInAnnotation = 'YES'
rx.SeriesInstanceUID = generate_uid(); rx.SOPInstanceUID = generate_uid(); rx.file_meta.MediaStorageSOPInstanceUID = rx.SOPInstanceUID; rx.SeriesDescription = 'Prova RX testo impresso'
rx.PatientName = 'ROSSI^MARIO'; rx.save_as(f'{OUT}/rx_testo.dcm', enforce_file_format=True)
print('rx ok')
# CD con DICOMDIR: la serie JPEG 2000 + l'enhanced, con nomi senza estensione in sottocartelle
from pydicom.fileset import FileSet
fs = FileSet()
for f in sorted(glob.glob(f'{OUT}/ct_j2k/*')) + [f'{OUT}/ct_enhanced_mf.dcm', f'{OUT}/rx_testo.dcm']:
    d = pydicom.dcmread(f)
    for t, v in [('PatientID', 'PROVA01'), ('PatientName', 'PROVA^PAZIENTE'), ('StudyDate', '20260115' if 'rx' in f else '20260301'), ('StudyTime', '101500'), ('StudyID', '1'), ('AccessionNumber', ''), ('InstanceNumber', 1), ('SeriesNumber', 1)]:
        if t not in d or d.get(t) in (None, ''): setattr(d, t, v)
    fs.add(d)
fs.write(f'{OUT}/cd')
print('cd ok', len(glob.glob(f'{OUT}/cd/**', recursive=True)))
