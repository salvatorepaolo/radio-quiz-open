# pneumoperitoneo.py: simula pneumoperitoneo da perforazione (aria libera anteriore a lente, legamento falciforme,
# bolle extraluminali vicino all'antro-piloro, liquido perihepatico/Morison, imbibizione del grasso) su /tmp/k123.npy
import numpy as np,json
from scipy import ndimage as ndi
rng=np.random.default_rng(123)
v=np.load('/tmp/k123.npy',mmap_mode='r'); out=np.array(v,dtype=np.float32)
Z,Y,X=v.shape; px=0.869141; dz=1.25; mm=1/px
ZA,ZB=36,176
yw=np.full((Z,X),np.nan,np.float32); ysk=np.full((Z,X),np.nan,np.float32)
for z in range(ZA,ZB):
    a=ndi.gaussian_filter(np.asarray(v[z],np.float32),1.0)
    for x in range(60,460):
        p=a[:,x]; ys=np.nonzero(p>-300)[0]
        if len(ys)==0: continue
        y=ys[0]+2; ysk[z,x]=ys[0]
        while y<Y-1 and p[y]>-60: y+=1          # cute
        while y<Y-1 and p[y]<-20: y+=1          # grasso sottocutaneo
        y0=y
        while y<Y-4:
            if p[y]<-40: break                                   # grasso intraperitoneale
            if all(70<p[y+k]<145 for k in range(4)) and y>y0+2: break  # fegato
            y+=1
        if y-y0<2 or y-y0>40: continue
        yw[z,x]=y
# pulizia: lo spessore della parete (cute -> fine parete) non può cambiare di colpo (linea alba, anse)
th=yw-ysk
for z in range(ZA,ZB):
    t=th[z]; ok=~np.isnan(t)
    if ok.sum()<20: continue
    ti=np.interp(np.arange(X),np.nonzero(ok)[0],t[ok]); med=ndi.median_filter(ti,41)
    bad=ok&(np.abs(t-med)>5); t=np.where(bad|~ok,np.nan,t); ok=~np.isnan(t)
    ti=np.interp(np.arange(X),np.nonzero(ok)[0],t[ok]); ti=ndi.median_filter(ti,9)
    rng_x=np.nonzero(~np.isnan(ysk[z]))[0]
    yw[z]=np.nan; yw[z,rng_x]=ysk[z,rng_x]+ti[rng_x]
ywz=yw.copy()
for x in range(X):
    c=yw[ZA:ZB,x]; ok=~np.isnan(c)
    if ok.sum()>5:
        cc=np.interp(np.arange(len(c)),np.nonzero(ok)[0],c[ok]); ywz[ZA:ZB,x]=np.where(ok,ndi.gaussian_filter1d(cc,1.5),np.nan)
D0=lambda z: np.interp(z,[36,44,56,100,130,160,176],[0,5,12,13,7,3,0])*mm   # spessore massimo (pixel)
lowT=ndi.gaussian_filter(rng.normal(size=(Z,X)).astype(np.float32),(3,10)); lowT/=lowT.std()
# smussatura forte del profilo della parete in x
for z in range(ZA,ZB):
    r=ywz[z]; ok=~np.isnan(r)
    if ok.sum()<20: continue
    rr=np.interp(np.arange(X),np.nonzero(ok)[0],r[ok]); rr=ndi.gaussian_filter1d(rr,4); ywz[z]=np.where(ok,rr,np.nan)
air=np.zeros((Z,Y,X),np.float32); info={}
for z in range(ZA,ZB):
    r=ywz[z]; ok=~np.isnan(r)
    if ok.sum()<20: continue
    xs=np.nonzero(ok)[0]; xmid=0.5*(xs.min()+xs.max())
    xc=xmid-np.interp(z,[36,100,176],[45,15,0])*mm   # centro della lente: verso destra del paziente (fegato) in alto
    Wl=np.interp(z,[36,100,176],[85,75,55])*mm
    a=np.asarray(v[z],np.float32); s_=ndi.gaussian_filter(a,0.8)
    ymin=np.nanmin(r)
    Tx=np.zeros(X); Al=np.zeros(X)
    for x in xs:
        if abs(x-xc)>1.8*Wl or r[x]>ymin+30*mm: continue        # solo la parete anteriore, mai quella laterale
        g=np.exp(-0.5*((x-xc)/Wl)**2); Tx[x]=D0(z)*g*(1+0.25*lowT[z,x])
        y0=int(np.floor(r[x]))+2; k=0
        t0=s_[min(y0,Y-1),x]
        if not (t0<-30 or 68<t0<150): continue
        while y0+k<Y and k<Tx[x]+2:
            t=s_[y0+k,x]
            if t>150 or (-25<t<68): break
            k+=1
        Al[x]=k
    Ts=ndi.grey_opening(np.minimum(Tx,Al),size=9); Ts=ndi.gaussian_filter1d(Ts,2.0); Ts=np.minimum(Ts,Al+0.5)
    for x in xs:
        T=Ts[x]
        if T<0.6: continue
        y0=int(np.floor(r[x]))+2; y1=r[x]+2+T
        for y in range(y0,min(int(np.ceil(y1))+1,Y)):
            air[z,y,x]=max(air[z,y,x],np.clip(y1-y,0,1))
# legamento falciforme: setto sottile nell'aria a destra della linea mediana (fette 50-100)
for z in range(50,100):
    r=ywz[z]
    if np.all(np.isnan(r)): continue
    xm=int(np.nanargmin(r))-int(9*mm)
    for x in range(xm-1,xm+2):
        w=1-0.5*abs(x-xm)
        air[z,:,x]*=1-0.8*w
air=ndi.gaussian_filter(air,(1.1,0.5,0.5)); air=np.clip((air-0.08)*1.3,0,1)
# bolle extraluminali vicino all'antro-piloro (z 96-108, x 175-215, y 170-200) nel grasso
bub=np.zeros_like(air)
cent=[]
for k in range(11):
    for _ in range(200):
        zc=rng.uniform(96,107); yc=rng.uniform(172,198); xc=rng.uniform(176,214)
        if np.asarray(v[int(zc),int(yc),int(xc)])<-50: break
    rad=rng.uniform(1.5,3.5)*mm; cent.append([round(zc),round(yc),round(xc),round(rad/mm,1)])
    zz,yy,xx=np.ogrid[int(zc)-4:int(zc)+5,int(yc)-5:int(yc)+6,int(xc)-5:int(xc)+6]
    d=np.sqrt(((zz-zc)*dz/px)**2+(yy-yc)**2+(xx-xc)**2)
    bub[int(zc)-4:int(zc)+5,int(yc)-5:int(yc)+6,int(xc)-5:int(xc)+6]=np.maximum(bub[int(zc)-4:int(zc)+5,int(yc)-5:int(yc)+6,int(xc)-5:int(xc)+6],np.clip(rad-d+0.5,0,1))
info['bolle']=cent
# imbibizione del grasso attorno al sito presunto (z 102, y 188, x 196), raggio ~25 mm
zz,yy,xx=np.ogrid[0:Z,0:Y,0:X]
R=(slice(80,125),slice(150,240),slice(150,250))
sub=np.asarray(v[R],np.float32); dd=np.sqrt(((zz[R[0]]-102)*dz/px)**2+(yy[:,R[1]]-188)**2+(xx[:,:,R[2]]-196)**2)
wst=np.clip(1-dd/(25*mm),0,1)**1.2
fatm=(ndi.gaussian_filter(sub,1)<-40)&(sub>-300)
mott=ndi.gaussian_filter(rng.normal(size=sub.shape).astype(np.float32),(1,1.5,1.5)); mott/=mott.std()
o=out[R]; o=o+fatm*wst*(60+14*mott)
# liquido periantrale/sottoepatico (declive rispetto al sito): grasso entro 18 mm, metà posteriore
wfl=np.clip(1-dd/(18*mm),0,1)*(yy[:,R[1]]>186)*fatm
wfl=np.clip(ndi.gaussian_filter(wfl.astype(np.float32),(0.8,1,1))*1.6,0,1)
res_=sub-ndi.gaussian_filter(sub,1.0)
o=o*(1-wfl)+(16+res_)*wfl; info['liquido_periantrale_mL']=round(float(wfl.sum()*px*px*dz/1000),1)
out[R]=o
# liquido perihepatico/Morison: grasso entro 5 px dal fegato, lato destro, fette 100-140
fl_tot=0
for z in range(100,142):
    a=np.asarray(v[z],np.float32); s=ndi.gaussian_filter(a,1)
    liv=(s>70)&(s<145); lab,n=ndi.label(liv)
    if n==0: continue
    sz=ndi.sum(liv,lab,range(1,n+1)); L=lab==(np.argmax(sz)+1)
    if L.sum()<1500: continue
    ring=ndi.binary_dilation(L,iterations=int(5*mm))&~L
    fat=(s<-30)&(s>-300)
    xs=np.nonzero(L.any(0))[0]; xl=xs.min()+0.6*(xs.max()-xs.min())
    m=ring&fat; m[:, int(xl):]=False
    w=ndi.gaussian_filter(m.astype(np.float32),0.8)*np.interp(z,[100,108,134,141],[0,1,1,0])
    res=a-ndi.gaussian_filter(a,1.0)
    out[z]=out[z]*(1-w)+(18+res)*w; fl_tot+=w.sum()
info['liquido_mL']=round(float(fl_tot*px*px*dz/1000),1)
# applica aria e bolle (rumore originale conservato)
A=np.clip(air+bub,0,1)
for z in range(ZA,ZB):
    if A[z].max()==0: continue
    a=np.asarray(v[z],np.float32); res=a-ndi.gaussian_filter(a,1.0)
    out[z]=out[z]*(1-A[z])+(-995+0.8*res)*A[z]
info['aria_mL']=round(float(air.sum()*px*px*dz/1000),1)
np.save('/tmp/k123_sim.npy',out); np.save('/tmp/k123_yw.npy',ywz)
json.dump(info,open('/tmp/k123_pp.json','w')); print(info)
