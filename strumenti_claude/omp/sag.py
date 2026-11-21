import sys, numpy as np, SimpleITK as sitk
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig, ax = plt.subplots(2, len(sys.argv) - 2, figsize=(4 * (len(sys.argv) - 2), 8))
for n, c in enumerate(sys.argv[2:]):
    r = sitk.ImageSeriesReader(); r.SetFileNames(r.GetGDCMSeriesFileNames(c)); im = r.Execute()
    ref = sitk.Image([256, 256, 256], sitk.sitkFloat32); ref.SetSpacing((1, 1, 1)); sz = np.array(im.GetSize())
    cen = np.array(im.TransformContinuousIndexToPhysicalPoint((sz - 1) / 2)); ref.SetOrigin(tuple(cen - 128))
    a = sitk.GetArrayFromImage(sitk.Resample(sitk.Cast(im, sitk.sitkFloat32), ref, sitk.Transform(), sitk.sitkLinear, 0))  # z,y,x
    ax[0, n].imshow(a[:, :, 128], origin='lower', cmap='gray', vmax=np.percentile(a, 99.5)); ax[0, n].set_title(c.split('/')[-3][-3:] + ' sag')
    ax[1, n].imshow(a[:, :, 128 + 55], origin='lower', cmap='gray', vmax=np.percentile(a, 99.5)); ax[1, n].set_title('laterale 55 mm')
plt.tight_layout(); plt.savefig(sys.argv[1], dpi=60)
