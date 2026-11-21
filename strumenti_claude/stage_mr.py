# stage_mr.py PAZ STAGE spec.json : [["prefisso cartella","descrizione",tp|"acq:N+M"|null],...]
import sys,glob,os,json,pydicom
from pydicom.uid import generate_uid
G='/Volumes/Caloggero/_tcia_grezzi/'
p,st,spec=sys.argv[1],sys.argv[2],json.load(open(sys.argv[3]))
out=G+st; os.makedirs(out,exist_ok=True)
for k,(pre,desc,tp) in enumerate(spec,1):
    ds=[d for d in sorted(glob.glob(G+p+'/'+pre+'*')) if os.path.isdir(d)]
    assert len(ds)==1,(pre,ds)
    uid=generate_uid(); n=0; os.makedirs(f"{out}/s{k:02d}",exist_ok=True)
    for f in glob.glob(ds[0]+'/*.dcm'):
        d=pydicom.dcmread(f)
        if tp is not None:
            if str(tp).startswith('acq:'):
                if str(d.get('AcquisitionNumber')) not in str(tp)[4:].split('+'): continue
            elif str(d.get('TemporalPositionIdentifier'))!=str(tp): continue
        d.SeriesNumber=k; d.SeriesDescription=desc; d.SeriesInstanceUID=uid
        d.save_as(f'{out}/s{k:02d}/{n:04d}.dcm'); n+=1
    print(k,desc,n)
