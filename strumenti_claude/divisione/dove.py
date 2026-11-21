import re,sys
html=open('/Volumes/Caloggero/piattaforma-quiz/cloud/web/index.html',encoding='utf-8').read()
mod=open(sys.argv[1],encoding='utf-8').read()
av=mod[mod.index('export function avvio()'):]
ids=sorted(set(re.findall(r"#([a-zA-Z][\w-]*)",av)))
# sezioni/dialog di primo livello: posizione degli id
cont=[(m.start(),m.group(1)) for m in re.finditer(r'<[a-z]+[^>]*\bid="((?:vista|dlg)-[\w-]+)"',html)]
for i in ids:
    m=re.search(r'\bid="%s"'%re.escape(i),html)
    if not m: print(i,'NON IN index.html'); continue
    c=[n for p,n in cont if p<m.start()]
    print(i,'→',c[-1] if c else '?')
