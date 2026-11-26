# patch_concl_166_167.py (26/11): la conclusione riprende il reperto principale (avviso di verifica_casi.mjs)
import json, re
B='/Volumes/Caloggero/piattaforma-quiz/'
M={166:("RX del torace nei limiti della norma","RX del torace nei limiti della norma: polmoni trasparenti, cuore e mediastino regolari","Normal chest X-ray: clear lungs, normal heart and mediastinum"),
   167:("Versamento pleurico destro: ecografia","Versamento pleurico destro con menisco: ecografia",None)}
for n,(da,a,en) in M.items():
    f=B+'casi-free/caso-tcia-%d/caso.json'%n; c=json.load(open(f)); g=B+'cloud/web/lingua/casi/caso-tcia-%d.json'%n; t=json.load(open(g)); k=0
    for o in c['opzioni']:
        if o['corretta'] and o['testo'].startswith(da):
            vecchio=o['testo']; o['testo']=a+vecchio[len(da):]; k+=1
            e=t.pop(vecchio); t[o['testo']]=en or e.replace('Right pleural effusion:','Right pleural effusion with a meniscus:')
    assert k==1,(n,k); json.dump(c,open(f,'w'),ensure_ascii=False,indent=1); json.dump(t,open(g,'w'),ensure_ascii=False)
s=open('scrivi_166_171.py').read()
for n,(da,a,en) in M.items(): assert s.count("op('"+da)==1,(n,s.count(da)); s=s.replace("op('"+da,"op('"+a)
open('scrivi_166_171.py','w').write(s); print('ok')
