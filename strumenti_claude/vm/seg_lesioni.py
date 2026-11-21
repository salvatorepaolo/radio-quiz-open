# seg_lesioni.py serie_dir seg_lesioni.dcm seg_vertebre.dcm : lesioni -> indice immagine nella serie, riga/colonna, vertebra, volume, diametro
import sys,glob,pydicom,numpy as np,collections
sd,sl,sv=sys.argv[1:4]
hs=[pydicom.dcmread(f,stop_before_pixels=True) for f in glob.glob(sd+'/*.dcm')]
hs.sort(key=lambda h:int(h.InstanceNumber)); zs=np.array([float(h.ImagePositionPatient[2]) for h in hs])
o=np.array(hs[0].ImagePositionPatient,float); ps=[float(x) for x in hs[0].PixelSpacing]
def frames(path):
    d=pydicom.dcmread(path); a=d.pixel_array
    if a.ndim==2: a=a[None]
    out=[]
    for i,fr in enumerate(d.PerFrameFunctionalGroupsSequence):
        out.append((fr.SegmentIdentificationSequence[0].ReferencedSegmentNumber,np.array(fr.PlanePositionSequence[0].ImagePositionPatient,float),i))
    lab={s.SegmentNumber:s.SegmentLabel for s in d.SegmentSequence}
    px=d.SharedFunctionalGroupsSequence[0].PixelMeasuresSequence[0]
    return a,out,lab,[float(x) for x in px.PixelSpacing],float(px.SliceThickness)
A,F,L,sps,th=frames(sl)
V,FV,LV,_,_=frames(sv)
vidx=collections.defaultdict(list)
for s,p,i in FV: vidx[round(p[2],1)].append((s,i))
les=collections.defaultdict(list)
for s,p,i in F:
    rr,cc=np.nonzero(A[i])
    for r,c in zip(rr,cc): les[s].append((p[2],p[1]+r*sps[0],p[0]+c*sps[1],i,r,c))
res=[]
for s,v in les.items():
    v=np.array(v); vol=len(v)*sps[0]*sps[1]*th/1000
    zc,yc,xc=v[:,0].mean(),v[:,1].mean(),v[:,2].mean()
    ext=[v[:,k].max()-v[:,k].min() for k in (0,1,2)]
    # vertebra: conta i voxel della lesione dentro ogni vertebra
    cnt=collections.Counter()
    for z,y,x,i,r,c in v[::7]:
        for sv_,iv in vidx.get(round(z,1),[]):
            if V[iv][int(r),int(c)]: cnt[LV[sv_]]+=1
    vert=cnt.most_common(1)[0][0].replace('vertebrae_','') if cnt else '?'
    k=int(np.argmin(abs(zs-zc)))
    res.append((vol,L[s],vert,k,int((yc-o[1])/ps[1]),int((xc-o[0])/ps[0]),[round(e) for e in ext]))
for r in sorted(res,reverse=True)[:25]: print('%.1f mL'%r[0],*r[1:])
print('totale lesioni',len(res),'vertebre',collections.Counter(r[2] for r in res).most_common())
