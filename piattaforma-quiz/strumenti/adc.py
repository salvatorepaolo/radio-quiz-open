# mappa ADC da due gruppi DWI (b basso, b alto): ADC = ln(S_basso/S_alto)/(b_alto-b_basso), in 10^-6 mm²/s
import sys,json,os,hashlib,numpy as np,pydicom,copy
from pydicom.uid import ExplicitVRLittleEndian
c,ib,ia,bb,ba=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),float(sys.argv[4]),float(sys.argv[5])
s=json.load(open(f'{c}/serie.json')); B,A=s[ib],s[ia]
def leggi(x):
    out={}
    for f in x['files']:
        d=pydicom.dcmread(f'{c}/{f}'); k=tuple(round(float(v),1) for v in d.ImagePositionPatient)
        out[k]=(d,d.pixel_array.astype(np.float64)*float(d.get('RescaleSlope',1) or 1)+float(d.get('RescaleIntercept',0) or 0))
    return out
LB,LA=leggi(B),leggi(A)
# il gruppo a b basso è il più intenso: se i due gruppi sono invertiti, si scambiano
mb=np.mean([v[1].mean() for v in LB.values()]); ma=np.mean([v[1].mean() for v in LA.values()])
if mb<ma: LB,LA,B,A=LA,LB,A,B
uid=lambda t:'2.25.'+str(int(hashlib.sha256(t.encode()).hexdigest()[:30],16))
ser=uid(B['files'][0]+'adc'); nome=f"ADC calcolata (b{int(bb)}-b{int(ba)}, ×10⁻⁶ mm²/s)"
cart=os.path.dirname(B['files'][0]).split('/')[-1][:20]+'_ADC'; os.makedirs(f'{c}/serie/{cart}',exist_ok=True)
files=[]; vals=[]
for i,k in enumerate(sorted(LB, key=lambda k: LB[k][0].get('InstanceNumber',0) or 0)):
    if k not in LA: continue
    d,s0=LB[k]; sb=LA[k][1]
    soglia=np.percentile(s0,70)*0.15
    with np.errstate(divide='ignore',invalid='ignore'):
        adc=np.log(np.maximum(s0,1e-3)/np.maximum(sb,1e-3))/(ba-bb)*1e6
    adc[(s0<soglia)|~np.isfinite(adc)]=0; adc=np.clip(adc,0,4000).astype(np.uint16); vals.append(adc[adc>0])
    n=copy.deepcopy(d); n.file_meta.TransferSyntaxUID=ExplicitVRLittleEndian
    n.SeriesInstanceUID=ser; n.SOPInstanceUID=uid(B['files'][0]+f'adc{i}'); n.file_meta.MediaStorageSOPInstanceUID=n.SOPInstanceUID
    n.SeriesDescription=nome; n.ImageType=['DERIVED','SECONDARY','ADC']; n.SeriesNumber=int(n.get('SeriesNumber',0) or 0)+90
    n.BitsAllocated=16; n.BitsStored=16; n.HighBit=15; n.PixelRepresentation=0; n.SamplesPerPixel=1; n.PhotometricInterpretation='MONOCHROME2'
    n.RescaleSlope=1; n.RescaleIntercept=0; n.WindowCenter=1200; n.WindowWidth=2400; n.InstanceNumber=i+1
    for t in ('DiffusionBValue',): 
        if t in n: delattr(n,t)
    n.PixelData=adc.tobytes(); n['PixelData'].VR='OW'
    f=f'serie/{cart}/adc_{i+1:04d}.dcm'; n.save_as(f'{c}/{f}',enforce_file_format=True); files.append(f)
v=np.concatenate(vals); print(c,nome,len(files),'img; ADC mediana',int(np.median(v)),'p5-p95',int(np.percentile(v,5)),int(np.percentile(v,95)))
voce={k:B[k] for k in ('data','eta') if k in B}; voce.update(descrizione=(B['descrizione'].split(' — ')[0].rsplit('·',1)[0]+'· ' if B['descrizione'].startswith('Studio') else '')+nome, numero=B.get('numero',0), files=files)
s=[x for x in s if x['descrizione']!=voce['descrizione']]
s.append(voce);   # in fondo: gli indici usati da disposizione e serie nascoste non cambiano
json.dump(s,open(f'{c}/serie.json','w'),indent=1,ensure_ascii=False)
