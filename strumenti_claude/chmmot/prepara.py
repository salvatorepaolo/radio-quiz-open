# prepara.py paziente : crea _tcia_grezzi/chmmot/stage/<paz>/ con una serie per fetta (multi-eco ordinate per TE) + una cine
import sys,os,glob,pydicom
from pydicom.uid import generate_uid
B=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/chmmot/')
paz=sys.argv[1]; E=B+'estr/CHMMOTv1_Images/'
SCELTA={'2028':{'cuore':'2028_1/SR_10','cine':'2028_1/SR_6','fegato':'2028_2/SR_3'},
        '2013':{'cuore':'2013_1/SR_12','cine':'2013_1/SR_7','fegato':'2013_2/SR_3'}}[paz]
out=B+'stage/'+paz; os.makedirs(out,exist_ok=True)
def fmt(x): return f"{x:.1f}".replace('.',',')
def scrivi(ds,num,descr,inst,cart):
    os.makedirs(out+'/'+cart,exist_ok=True)
    ds.SeriesNumber=num; ds.SeriesDescription=descr; ds.InstanceNumber=inst
    ds.save_as(f"{out}/{cart}/i{inst:03d}.dcm")
for org,base,nome in (('cuore',100,'Cuore T2* asse corto'),('fegato',300,'Fegato T2* assiale')):
    ds=[pydicom.dcmread(f) for f in glob.glob(E+SCELTA[org]+'/*.dcm')]
    locs=sorted({round(float(d.SliceLocation),1) for d in ds})
    for k,loc in enumerate(locs,1):
        L=sorted([d for d in ds if abs(float(d.SliceLocation)-loc)<0.2],key=lambda d:float(d.EchoTime))
        uid=generate_uid()
        descr=f"{nome} - fetta {k}/{len(locs)} - {len(L)} echi, TE {fmt(float(L[0].EchoTime))}-{fmt(float(L[-1].EchoTime))} ms"
        for i,d in enumerate(L,1):
            d.SeriesInstanceUID=uid; scrivi(d,base+k,descr,i,f"{org}{k}")
    print(org,len(locs),'fette',len(ds),'immagini')
ds=sorted([pydicom.dcmread(f) for f in glob.glob(E+SCELTA['cine']+'/*.dcm')],key=lambda d:int(d.InstanceNumber))
for i,d in enumerate(ds,1): scrivi(d,201,f"Cine bSSFP - {len(ds)} fasi",i,"cine")
print('cine',len(ds))
