"""Prove: trasforma una serie DICOM classica (dati pubblici) in un unico file «enhanced» multi-frame, come esportano
spesso le RM Philips. Uso: multiframe_dicom.py <cartella serie> <uscita.dcm> [inverti]  (inverti: fotogrammi in ordine opposto)"""
import sys, glob, os, copy, numpy as np, pydicom
from pydicom.dataset import Dataset
from pydicom.sequence import Sequence
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
cart, out = sys.argv[1], sys.argv[2]; inverti = 'inverti' in sys.argv[3:]
ds = [pydicom.dcmread(f) for f in glob.glob(os.path.join(cart, '*.dcm'))]
ds = [d for d in ds if 'ImagePositionPatient' in d]
iop = np.array(ds[0].ImageOrientationPatient, float); n = np.cross(iop[:3], iop[3:])
ds.sort(key=lambda d: np.dot(n, np.array(d.ImagePositionPatient, float)), reverse=inverti)
a = ds[0]; m = Dataset(); m.file_meta = copy.deepcopy(a.file_meta)
for el in a:
    if el.tag.group in (0x0008, 0x0010, 0x0018, 0x0020, 0x0028) and el.keyword not in ('ImagePositionPatient', 'ImageOrientationPatient', 'PixelSpacing', 'SliceThickness', 'InstanceNumber', 'SliceLocation', 'SOPInstanceUID', 'RescaleSlope', 'RescaleIntercept', 'WindowCenter', 'WindowWidth'):
        m.add(copy.deepcopy(el))
m.SOPClassUID = '1.2.840.10008.5.1.4.1.1.4.1'; m.SOPInstanceUID = generate_uid(); m.SeriesInstanceUID = generate_uid()
m.file_meta.MediaStorageSOPClassUID = m.SOPClassUID; m.file_meta.MediaStorageSOPInstanceUID = m.SOPInstanceUID; m.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
m.SeriesDescription = a.SeriesDescription + (' multiframe inverso' if inverti else ' multiframe'); m.Manufacturer = 'Philips Medical Systems (prova)'
m.NumberOfFrames = len(ds); m.InstanceNumber = 1
sh = Dataset(); pm = Dataset(); pm.PixelSpacing = a.PixelSpacing; pm.SliceThickness = a.SliceThickness; sh.PixelMeasuresSequence = Sequence([pm])
po = Dataset(); po.ImageOrientationPatient = a.ImageOrientationPatient; sh.PlaneOrientationSequence = Sequence([po])
pt = Dataset(); pt.RescaleSlope = getattr(a, 'RescaleSlope', 1); pt.RescaleIntercept = getattr(a, 'RescaleIntercept', 0); pt.RescaleType = 'US'; sh.PixelValueTransformationSequence = Sequence([pt])
m.SharedFunctionalGroupsSequence = Sequence([sh])
per = []
for k, d in enumerate(ds):
    f = Dataset(); pp = Dataset(); pp.ImagePositionPatient = d.ImagePositionPatient; f.PlanePositionSequence = Sequence([pp])
    fc = Dataset(); fc.InStackPositionNumber = k + 1; f.FrameContentSequence = Sequence([fc]); per.append(f)
m.PerFrameFunctionalGroupsSequence = Sequence(per)
m.PixelData = b''.join(d.pixel_array.astype(d.pixel_array.dtype).tobytes() for d in ds)
m.save_as(out, enforce_file_format=True); print(out, len(ds), 'fotogrammi')
