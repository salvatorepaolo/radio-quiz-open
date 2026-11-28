import os, json, glob, numpy as np, pydicom, SimpleITK as sitk
S='/Volumes/Caloggero/_tcia_grezzi/remind/sede'; O='/tmp/remind_vol'; os.makedirs(O,exist_ok=True)
ris=json.load(open(S+'/risultati.json'))
for r in ris:
    if 'errore' in r: continue
    p=r['p']; cart=S+'/'+p+'/t1'; fs=sorted(glob.glob(cart+'/*.dcm')); ds=[pydicom.dcmread(f,stop_before_pixels=True) for f in fs]
    io=np.array(ds[0].ImageOrientationPatient,float); n=np.cross(io[:3],io[3:])
    o=sorted(zip([np.dot(n,np.array(d.ImagePositionPatient,float)) for d in ds],fs,ds),key=lambda t:t[0])
    img=sitk.ReadImage([f for _,f,_ in o],sitk.sitkFloat32); a=sitk.GetArrayFromImage(img).astype(np.float32)
    d0=o[0][2]; sp=[float(d0.PixelSpacing[1]),float(d0.PixelSpacing[0]),(o[-1][0]-o[0][0])/(len(o)-1)]
    a.tofile(f'{O}/{p}.f32')
    # punti del tumore
    seg=glob.glob(S+'/'+p+'/seg/*.dcm')[0]; d=pydicom.dcmread(seg); px=d.pixel_array; px=px[None] if px.ndim==2 else px
    sh=d.SharedFunctionalGroupsSequence[0]; iop=np.array(sh.PlaneOrientationSequence[0].ImageOrientationPatient,float); ps=[float(x) for x in sh.PixelMeasuresSequence[0].PixelSpacing]; P=[]
    for k,fr in enumerate(d.PerFrameFunctionalGroupsSequence):
        ipp=np.array(fr.PlanePositionSequence[0].ImagePositionPatient,float); ys,xs=np.nonzero(px[k])
        if len(xs): P.append(ipp+np.outer(xs*ps[1],iop[:3])+np.outer(ys*ps[0],iop[3:]))
    P=np.vstack(P); P=P[::max(1,len(P)//4000)]
    json.dump({'W':a.shape[2],'H':a.shape[1],'N':a.shape[0],'sp':sp,'origine':[float(x) for x in d0.ImagePositionPatient],'assi':[io[:3].tolist(),io[3:].tolist(),n.tolist()],'taglio':[0,0,0],'tumore':P.round(1).tolist(),'sede':r['sede'],'lato':r['lato'],'snap':r['lobi']},open(f'{O}/{p}.json','w'))
    print(p, a.shape, flush=True)
