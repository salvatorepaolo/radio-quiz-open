# Sposta in un nuovo caso le serie di un distretto (campo «regione» di serie.json).
# uso: python3 dividi.py casi/caso-027 "RX ginocchio" casi/caso-082
import json,os,sys,shutil
src,regione,dst=sys.argv[1],sys.argv[2],sys.argv[3]
s=json.load(open(f'{src}/serie.json')); c=json.load(open(f'{src}/caso.json'))
via=[i for i,x in enumerate(s) if x.get('regione')==regione]; resta=[i for i in range(len(s)) if i not in via]
assert via and resta, 'niente da dividere'
os.makedirs(f'{dst}/serie',exist_ok=True)
for i in via:
    for f in s[i]['files']:
        os.makedirs(os.path.dirname(f'{dst}/{f}'),exist_ok=True); shutil.move(f'{src}/{f}',f'{dst}/{f}')
for i in via:   # cartelle rimaste vuote
    d=os.path.dirname(f"{src}/{s[i]['files'][0]}")
    if os.path.isdir(d) and not os.listdir(d): os.rmdir(d)
nuovo=lambda idx: {o:n for n,o in enumerate(idx)}
def rimappa(caso,idx):
    m=nuovo(idx)
    for k in ('disposizione','serie_nascoste'):
        if caso.get(k): caso[k]=[m[i] for i in caso[k] if i in m]
    if isinstance(caso.get('serie_iniziale'),int): caso['serie_iniziale']=m.get(caso['serie_iniziale'])
def pulisci(lista):   # un solo distretto rimasto: il campo regione non serve più
    if len({x.get('regione') for x in lista})<=1:
        for x in lista: x.pop('regione',None)
    return lista
json.dump(pulisci([s[i] for i in via]),open(f'{dst}/serie.json','w'),indent=1,ensure_ascii=False)
json.dump(pulisci([s[i] for i in resta]),open(f'{src}/serie.json','w'),indent=1,ensure_ascii=False)
c2={k:v for k,v in c.items() if k not in ('disposizione','serie_nascoste','serie_iniziale')}
rimappa(c,resta); c2.update(id=os.path.basename(dst),visibile=False,riquadri=0)
json.dump(c,open(f'{src}/caso.json','w'),indent=2,ensure_ascii=False)
if not os.path.exists(f'{dst}/caso.json'): json.dump(c2,open(f'{dst}/caso.json','w'),indent=2,ensure_ascii=False)
for d in (src,dst): open(f'{d}/AGGIORNA','w').close()
print(f'{len(via)} serie da {src} a {dst}; restano {len(resta)}')
