# zipr.py URL list|get [nomi...] : elenca o estrae file da uno zip remoto con richieste a intervalli
import sys,urllib.request,struct,zlib,json,os
url=sys.argv[1]; cmd=sys.argv[2]
def final(u):
    req=urllib.request.Request(u,method='HEAD'); r=urllib.request.urlopen(req,timeout=30); return r.geturl(),int(r.headers['Content-Length'])
def rng(u,a,b):
    global U
    for t in range(4):
        try:
            req=urllib.request.Request(U if 'U' in globals() else u,headers={'Range':f'bytes={a}-{b}'}); return urllib.request.urlopen(req,timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code!=403: raise
            U=final(url)[0]
    raise SystemExit('403 ripetuto')
u,size=final(url); U=u
tail=rng(u,max(0,size-65536-22),size-1)
i=tail.rfind(b'PK\x06\x06'); 
if i>=0:  # zip64 end record
    cd_size,cd_off=struct.unpack('<QQ',tail[i+40:i+56])
else:
    i=tail.rfind(b'PK\x05\x06'); cd_size,cd_off=struct.unpack('<II',tail[i+12:i+20])
cd=rng(u,cd_off,cd_off+cd_size-1)
ents={}; p=0
while p<len(cd) and cd[p:p+4]==b'PK\x01\x02':
    meth,=struct.unpack('<H',cd[p+10:p+12]); csz,usz=struct.unpack('<II',cd[p+20:p+28])
    nl,el,cl=struct.unpack('<HHH',cd[p+28:p+34]); off,=struct.unpack('<I',cd[p+42:p+46])
    name=cd[p+46:p+46+nl].decode('utf8','replace'); ex=cd[p+46+nl:p+46+nl+el]
    q=0
    while q<len(ex):
        hid,hl=struct.unpack('<HH',ex[q:q+4]); d=ex[q+4:q+4+hl]
        if hid==1:
            vals=[];k=0
            for need in (usz==0xFFFFFFFF,csz==0xFFFFFFFF,off==0xFFFFFFFF):
                if need: vals.append(struct.unpack('<Q',d[k:k+8])[0]); k+=8
                else: vals.append(None)
            usz=vals[0] or usz; csz=vals[1] or csz; off=vals[2] if vals[2] is not None else off
        q+=4+hl
    ents[name]=(meth,csz,usz,off); p+=46+nl+el+cl
if cmd=='list':
    for n in ents: print(n)
else:
    out=sys.argv[3]; os.makedirs(out,exist_ok=True)
    for n in sys.argv[4:]:
        k=[x for x in ents if x.endswith(n)]
        if not k: print('MANCA',n); continue
        meth,csz,usz,off=ents[k[0]]
        h=rng(u,off,off+29); nl,el=struct.unpack('<HH',h[26:30]); s=off+30+nl+el
        data=rng(u,s,s+csz-1)
        if meth==8: data=zlib.decompress(data,-15)
        open(os.path.join(out,os.path.basename(k[0])),'wb').write(data); print('ok',k[0],len(data))
