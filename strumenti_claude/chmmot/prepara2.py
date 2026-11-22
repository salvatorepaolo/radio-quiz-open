# prepara2.py paziente : come prepara.py (una serie per fetta, echi in ordine di TE, cine), con più esami (controlli)
import sys,os,glob,pydicom
from pydicom.uid import generate_uid
B='/Volumes/Caloggero/_tcia_grezzi/chmmot/'; E=B+'estr/CHMMOTv1_Images/'
# per paziente: elenco di esami (prefisso della descrizione, base del numero di serie, cuore, fegato, cine)
P={'1023':[('Esame iniziale',0,['1023_2/SR_9'],['1023_1/SR_3'],'1023_2/SR_6'),
           ('Controllo',10,['1023_3/SR_12','1023_3/SR_14'],['1023_4/SR_3'],None)],
   '2014':[('',0,['2014_1/SR_9'],['2014_2/SR_3'],'2014_1/SR_6')],
   '2003':[('',0,['2003_1/SR_9'],['2003_2/SR_3'],'2003_1/SR_6')]}
paz=sys.argv[1]; out=B+'stage/'+paz; os.makedirs(out,exist_ok=True)
fmt=lambda x: f"{x:.1f}".replace('.',',')
def scrivi(ds,num,descr,inst,cart):
    os.makedirs(f"{out}/{cart}",exist_ok=True); ds.SeriesNumber=num; ds.SeriesDescription=descr; ds.InstanceNumber=inst; ds.save_as(f"{out}/{cart}/i{inst:03d}.dcm")
for pref,dn,cuore,fegato,cine in P[paz]:
    pre=(pref+' - ') if pref else ''
    for org,base,nome,dirs in (('cuore',100,'Cuore T2* asse corto',cuore),('fegato',300,'Fegato T2* assiale',fegato)):
        ds=[pydicom.dcmread(f) for d in dirs for f in glob.glob(E+d+'/*')]
        locs=sorted({round(float(d.SliceLocation),1) for d in ds})
        for k,loc in enumerate(locs,1):
            L=sorted([d for d in ds if abs(float(d.SliceLocation)-loc)<0.2],key=lambda d:float(d.EchoTime))
            uid=generate_uid(); descr=f"{pre}{nome} - fetta {k}/{len(locs)} - {len(L)} echi, TE {fmt(float(L[0].EchoTime))}-{fmt(float(L[-1].EchoTime))} ms"
            for i,d in enumerate(L,1): d.SeriesInstanceUID=uid; scrivi(d,base+dn+k,descr,i,f"{org}{dn}_{k}")
        print(pref,org,len(locs),'fette',len(ds),'immagini')
    if cine:
        ds=sorted([pydicom.dcmread(f) for f in glob.glob(E+cine+'/*')],key=lambda d:int(d.InstanceNumber)); uid=generate_uid()
        for i,d in enumerate(ds,1): d.SeriesInstanceUID=uid; scrivi(d,201+dn,f"{pre}Cine bSSFP - {len(ds)} fasi",i,f"cine{dn}")
        print(pref,'cine',len(ds))
