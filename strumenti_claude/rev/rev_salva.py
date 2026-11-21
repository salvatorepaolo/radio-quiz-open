# rev_salva.py NNN nuovo.json "esito in una frase"
# Scrive il caso rivisto: parte dal JSON dato (copia del caso ONLINE modificata), aggiunge alla nota_docente la riga
# «[revisione indipendente 05/11/2026] Controllato il 05/11/2026: <esito>», aggiorna la data, salva una copia di
# sicurezza del caso.json locale e crea il file AGGIORNA (così la pubblicazione lo carica online).
import sys,json,os,shutil,datetime
H=os.path.expanduser('~/mnt/Volumes--Caloggero'); CF=H+'/piattaforma-quiz/casi-free/'
c,nuovo,esito=sys.argv[1],sys.argv[2],sys.argv[3]; cid=f'caso-tcia-{c}'
d=json.load(open(nuovo)); po=f'{H}/piattaforma-quiz/i18n/casi-it/{cid}.json'
base=json.load(open(po if os.path.exists(po) else CF+cid+'/caso.json'))   # casi nuovi: la base è la bozza locale
assert d.get('id')==cid, 'id diverso'
err=[]
op=d.get('opzioni') or []; sez=d.get('sezioni') or []
if len(op)<2: err.append('meno di 2 opzioni')
for i in range(max(1,len(sez))):
    oo=[o for o in op if (o.get('sezione',0) if sez else 0)==i]
    if sez and not any(o.get('corretta') for o in oo): err.append(f'sezione {i} senza risposta corretta')
if sum(1 for o in op if o.get('tipo')=='principale')!=1: err.append('serve esattamente un reperto principale')
for o in op:
    if not o.get('testo'): err.append('opzione senza testo')
    if o.get('corretta') and o.get('tipo')=='distrattore': err.append('distrattore marcato corretto: '+o['testo'][:40])
if 'confermat' in json.dumps(d,ensure_ascii=False).lower() and 'dal docente' in d.get('nota_docente','').lower() and 'confermato dal docente' not in base.get('nota_docente','').lower(): err.append('non scrivere «confermato dal docente»')
if err: print('ERRORI, non salvato:\n- '+'\n- '.join(err)); sys.exit(1)
oggi=datetime.datetime.now()
riga=f"[revisione indipendente {oggi:%d/%m/%Y}] Controllato il {oggi:%d/%m/%Y}: {esito.strip()}"
d['nota_docente']=(riga+'\n'+d.get('nota_docente','')).strip()
d['aggiornato']=oggi.strftime('%Y-%m-%d %H:%M')
p=CF+cid+'/caso.json'; bk=f'{H}/piattaforma-quiz/_backup_rev_{oggi:%Y%m%d}'; os.makedirs(bk,exist_ok=True)
if os.path.exists(p): shutil.copy(p,f'{bk}/{cid}.json')
t=p+'.tmp'; json.dump(d,open(t,'w'),ensure_ascii=False,indent=1); os.replace(t,p)
open(CF+cid+'/AGGIORNA','w').close()
diff=[k for k in set(d)|set(base) if k not in ('nota_docente','aggiornato') and d.get(k)!=base.get(k)]
print('salvato',cid,'· campi cambiati:',', '.join(sorted(diff)) or 'nessuno (solo nota)')
