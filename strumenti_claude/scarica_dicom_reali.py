# File DICOM reali di vari produttori e compressioni (dati di test pubblici di pydicom) per provare il visualizzatore client
import os, shutil, glob, pydicom
from pydicom.data import get_testdata_file, get_testdata_files
OUT = '/Volumes/Caloggero/_viste/dicom_reali'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
nomi = ['CT_small.dcm', 'MR_small.dcm', 'JPEG2000.dcm', 'MR_small_jp2klossless.dcm', 'US1_J2KR.dcm', 'US1_UNCR.dcm', 'emri_small_jpeg_2k_lossless.dcm',
        'MR_small_jpeg_ls_lossless.dcm', 'emri_small_jpeg_ls_lossless.dcm', 'SC_rgb_rle.dcm', 'MR_small_RLE.dcm', 'emri_small_RLE.dcm', 'color3d_jpeg_baseline.dcm',
        'SC_rgb_jpeg_dcmtk.dcm', 'SC_rgb_jpeg_gdcm.dcm', 'JPEG-lossy.dcm', 'JPGLosslessP14SV1_1s_1f_8b.dcm', 'eCT_Supplemental.dcm', 'MR-SIEMENS-DICOM-WithOverlays.dcm',
        'GDCMJ2K_TextGBR.dcm', 'SC_ybr_full_uncompressed.dcm', 'SC_rgb_small_odd_jpeg.dcm', 'RG1_J2KR.dcm', 'RG3_J2KR.dcm', 'MR2_J2KR.dcm', 'CT1_J2KR.dcm', 'SC_jpeg_no_color_transform.dcm',
        'HTJ2KLossless_08_RGB.dcm', 'HTJ2K_08_RGB.dcm', 'JLSN_RGB_ILV0.dcm', 'examples_ybr_color.dcm', 'examples_rgb_color.dcm', 'liver.dcm', 'emri_small.dcm']
for n in nomi:
    try:
        f = get_testdata_file(n)
        if not f: print('manca', n); continue
        shutil.copy(f, os.path.join(OUT, n))
        d = pydicom.dcmread(f, stop_before_pixels=True)
        print('ok', n, d.file_meta.TransferSyntaxUID, d.get('Modality'), d.get('NumberOfFrames', 1), d.get('PhotometricInterpretation'), d.get('BitsStored'))
    except Exception as e: print('errore', n, e)
# CD vero con DICOMDIR (dicomdirtests di pydicom)
dd = get_testdata_file('DICOMDIR')
if dd:
    base = os.path.dirname(dd); shutil.copytree(base, os.path.join(OUT, 'cd'), dirs_exist_ok=True); print('cd', base, len(glob.glob(os.path.join(OUT, 'cd', '**'), recursive=True)))
