# myel_les.py : statistiche delle lesioni nelle SEG di Spinal-Multiple-Myeloma-SEG
import pydicom,glob,os,numpy as np,collections,sys
R=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/cmb/myel')
for p in sorted(os.listdir(R)):
    for f in glob.glob(f"{R}/{p}/*/*.dcm"):
        d=pydicom.dcmread(f)
        if not d.SegmentSequence[0].SegmentLabel.startswith('Lesion'): continue
        px=d.SharedFunctionalGroupsSequence[0].PixelMeasuresSequence[0]
        vox=float(px.PixelSpacing[0])*float(px.PixelSpacing[1])*float(px.SliceThickness)
        a=d.pixel_array
        if a.ndim==2: a=a[None]
        cnt=collections.Counter(); z=collections.defaultdict(list)
        for i,fr in enumerate(d.PerFrameFunctionalGroupsSequence):
            s=fr.SegmentIdentificationSequence[0].ReferencedSegmentNumber
            n=int(a[i].sum()); cnt[s]+=n
            if n: z[s].append(float(fr.PlanePositionSequence[0].ImagePositionPatient[2]))
        v=sorted(((cnt[s]*vox/1000,s,min(z[s]),max(z[s])) for s in cnt if cnt[s]),reverse=True)
        print(p,f.split('/')[-2][-17:],'lesioni',len(v),'tot mL %.1f'%sum(x[0] for x in v),'maggiori',[('%.1f'%x[0],x[1],'z%.0f..%.0f'%(x[2],x[3])) for x in v[:3]],'vox',round(vox,3),flush=True)
