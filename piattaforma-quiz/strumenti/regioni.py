# Distretto di ogni serie (es. «RX torace», «RX ginocchio», «TC encefalo») in serie.json, campo «regione»:
# serve a raggruppare i pregressi per distretto. Si scrive solo se il caso ha distretti diversi.
import json,sys,re,pydicom,glob,os
MOD={'CR':'RX','DX':'RX','CT':'TC','MR':'RM','US':'Eco','MG':'Mammografia','PT':'PET','NM':'Scintigrafia'}
ZONE=[(r'ginocch|knee','ginocchio'),(r'torac|thorax|chest|polmon','torace'),(r'colonna dors|dorsal','rachide dorsale'),(r'lombar|lspine','rachide lombare'),
      (r'cervical|neck|collo','collo'),(r'orbit','orbite'),(r'encefal|capo|cerebral|cranio|head|brain','encefalo'),(r'addom|abdom','addome'),(r'bacino|pelvi','bacino'),
      (r'ecocardio|cardiac','cuore'),(r'mammell|breast|mammogr','mammella'),(r'spalla|shoulder','spalla'),(r'piede|calcagno|foot','piede'),(r'anca|hip','anca')]
BP={'CHEST':'torace','LOW_EXM':None,'PELVIS':'bacino','HEAD':'encefalo','ABDOMEN':'addome','KNEE':'ginocchio'}
def zona(t):
    for r,z in ZONE:
        if re.search(r,t or '',re.I): return z
    return None
from collections import Counter
for c in sys.argv[1:]:
    p=f'{c}/serie.json'; s=json.load(open(p)); info=[]
    for x in s:
        d=pydicom.dcmread(f"{c}/{x['files'][0]}",stop_before_pixels=True)
        m=MOD.get(str(d.get('Modality','')),str(d.get('Modality','')))
        z=BP.get(str(d.get('BodyPartExamined','')).upper()) if m=='RX' else None
        z=z or ('mammella' if m=='Mammografia' else None) or zona(str(d.get('StudyDescription',''))) or zona(x['descrizione']) or ''
        n=re.match(r'Studio (\d+)',x['descrizione']); info.append((n.group(1) if n else '1',m,z))
    # radiografie: distretto per serie; altre metodiche: un distretto per studio
    per={}
    for st,m,z in info:
        if m!='RX': per.setdefault(st,[]).append((m,z))
    lab={}
    for st,l in per.items():
        mods={m for m,_ in l}; m='PET-TC' if 'PET' in mods else Counter(m for m,_ in l).most_common(1)[0][0]
        z=Counter(z for _,z in l if z).most_common(1); lab[st]=f"{m} {z[0][0] if z else ''}".strip()
    reg=[f'{m} {z}'.strip() if m=='RX' else lab[st] for st,m,z in info]
    studi=len({st for st,_,_ in info})
    for x,r in zip(s,reg):
        if len(set(reg))>1 and studi>1: x['regione']=r
        else: x.pop('regione',None)
    json.dump(s,open(p,'w'),indent=1,ensure_ascii=False)
    if len(set(reg))>1 and studi>1: print(c,sorted(set(reg)))
