# sistema.py caso-tcia-NNN : serie per proiezione (RCC, LCC, RMLO, LMLO), ViewPosition, finestra dai percentili della mammella
import sys,os,json,glob,pydicom,numpy as np
C=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')+sys.argv[1]
S=json.load(open(C+'/serie.json')); eta=S[0].get('eta')
viste={}
for rel in S[0]['files']:
    d=pydicom.dcmread(C+'/'+rel)
    lat=d.ImageLaterality; v='MLO' if 'F' in ''.join(d.PatientOrientation) else 'CC'
    a=d.pixel_array.astype(float); m=a[a>12]
    lo,hi=np.percentile(m,[1,99.95]); lo=max(0,lo-5)
    d.WindowCenter=str(round((lo+hi)/2)); d.WindowWidth=str(round(hi-lo)); d.ViewPosition=v
    d.save_as(C+'/'+rel)
    viste[lat+v]=rel; print(rel,lat,v,'finestra',d.WindowCenter,d.WindowWidth)
nomi={'RCC':'RCC (destra)','LCC':'LCC (sinistra)','RMLO':'RMLO (destra)','LMLO':'LMLO (sinistra)'}
out=[]
for k in ['RCC','LCC','RMLO','LMLO']:
    if k in viste: out.append({'descrizione':nomi[k],'numero':len(out)+1,'files':[viste[k]],'eta':eta})
json.dump(out,open(C+'/serie.json','w'),ensure_ascii=False,indent=1)
print([s['descrizione'] for s in out])
