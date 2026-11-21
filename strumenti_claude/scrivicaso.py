# scrivi(cid, dict, descr={indice_serie: nuova descrizione}) : crea caso.json in bozza; _opz = liste per sezione di tuple (P|S|x, testo, nota)
import json,os,datetime
CF='/Volumes/Caloggero/piattaforma-quiz/casi-free/'
def scrivi(cid,d,descr={}):
    d=dict(d); opz=d.pop('_opz'); O=[]
    for si,lista in enumerate(opz):
        for t,testo,nota in lista:
            o={'testo':testo,'corretta':t in 'PS','tipo':{'P':'principale','S':'secondario','x':'distrattore'}[t],'sezione':si}
            if nota: o['nota']=nota
            O.append(o)
    d['id']=cid; d['visibile']=False; d['opzioni']=O
    p=CF+cid+'/caso.json'; json.dump(d,open(p,'w'),ensure_ascii=False,indent=1)
    if descr:
        sp=CF+cid+'/serie.json'; S=json.load(open(sp))
        for k,v in descr.items(): S[k]['descrizione']=v
        json.dump(S,open(sp,'w'),ensure_ascii=False,indent=1)
    print('scritto',cid,len(O),'opzioni')
