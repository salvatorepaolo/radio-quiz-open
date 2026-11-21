# milza_trauma.py: simula lacerazione splenica AAST III + ematoma sottocapsulare + coagulo sentinella + emoperitoneo
# lavora per sottovolumi (memoria VM ~4 GB). input /tmp/k191*.npy; output /tmp/k191_sim.npy e /tmp/k191_m_*.npz
import numpy as np, sys, json; sys.path.insert(0,'.'); from vol import *
from scipy import ndimage as ndi
rng=np.random.default_rng(191)
v=np.load('/tmp/k191.npy',mmap_mode='r'); out=np.array(v,dtype=np.float32)
sp_full=np.load('/tmp/k191_milza.npy'); L_full=np.load('/tmp/k191_fegato.npy'); K_full=np.load('/tmp/k191_reni.npy'); B_full=np.load('/tmp/k191_vescica.npy')
dz,py=1.25,0.742188; mm=1/py
for i in range(v.shape[0]):
    if i<52 or i>124: sp_full[i]=0; continue
    lab,n=ndi.label(sp_full[i])
    if n>1: sz=ndi.sum(sp_full[i],lab,range(1,n+1)); sp_full[i]=lab==(np.argmax(sz)+1)
info={}; allm={}
def roi(z0,z1,y0,y1,x0,x1): return (slice(z0,z1),slice(y0,y1),slice(x0,x1))
def applica(R,masks,lev):
    a=np.array(v[R],dtype=np.float32); s=ndi.gaussian_filter(a,(0.7,1.2,1.2)); r=a-s
    lowf=ndi.gaussian_filter(rng.normal(size=a.shape).astype(np.float32),(2,4,4)); lowf/=lowf.std()
    o=out[R]
    for k,M in masks:
        w=np.clip(ndi.gaussian_filter(M.astype(np.float32),(0.5,0.7,0.7))*1.25,0,1)
        o=o*(1-w)+(lev[k]+5*lowf+r)*w
    out[R]=o
def fatm(a): return (ndi.gaussian_filter(a,(0.7,1.5,1.5))<-25)&(a>-400)
lev={'lac':42,'sub':52,'clot':62,'free':41}
# ---------- milza
R=roi(40,140,150,450,250,512); a=np.array(v[R],np.float32); sp=sp_full[R]; K=K_full[R]
Z,Y,X=a.shape; yy,xx=np.mgrid[0:Y,0:X]
lac=np.zeros(a.shape,bool); sub=np.zeros(a.shape,bool)
zc,half=88-40,13.0
def sn(n,scale,amp):
    q=ndi.gaussian_filter(rng.normal(size=n),scale); return q/(q.std()+1e-6)*amp
off=sn(400,6,3.0); wj=sn(400,4,0.8)
for z in range(int(zc-half),int(zc+half)+1):
    m=sp[z]
    if m.sum()<200: continue
    din=ndi.distance_transform_edt(m); gy,gx=np.gradient(ndi.gaussian_filter(din,2.0))
    cy,cx=np.argwhere(m).mean(0)
    e=m^ndi.binary_erosion(m); by,bx=np.nonzero(e)
    d=np.array([0.45,0.89]); k=np.argmax((by-cy)*d[0]+(bx-cx)*d[1]); P=np.array([by[k],bx[k]],float)
    t=(z-zc)/half; depth=42*mm*np.sqrt(max(0,1-t*t))
    c=P.copy(); st=0.0
    path=[]
    while st<depth:
        iy,ix=int(round(c[0])),int(round(c[1]))
        if not (0<=iy<Y and 0<=ix<X): break
        if st>3 and not m[iy,ix]: break
        g=np.array([gy[iy,ix],gx[iy,ix]]); 
        if np.linalg.norm(g)<1e-3: break
        g/=np.linalg.norm(g)
        # dopo il centro dello spessore prosegui in linea retta (non seguire il gradiente che si inverte)
        if st>0 and din[iy,ix]<din_prev-0.3: g=dirp
        din_prev=din[iy,ix]; dirp=g
        nrm=np.array([-g[1],g[0]]); jit=off[int(st)+(z*3)%50]*0.35
        path.append((c+nrm*jit, st))
        c=c+g*0.7; st+=0.7
    din_prev=0
    for (q,stq) in path:
        w=(5.0-3.5*stq/max(depth,1))*mm*(1+0.15*wj[int(stq)])
        lac[z]|=((yy-q[0])**2+(xx-q[1])**2)<(w/2)**2
    if abs(z-zc)<6 and len(path)>10:
        q0,_=path[len(path)//2]; q1,_=path[len(path)//2+3]; dd=q1-q0; dd/=np.linalg.norm(dd)+1e-6; ub=dd*0.5+np.array([-dd[1],dd[0]])*0.85
        for stb in np.linspace(0,14*mm*(1-abs(z-zc)/6),25):
            q=q0+ub*stb; lac[z]|=((yy-q[0])**2+(xx-q[1])**2)<(0.9*mm)**2
    lac[z]&=ndi.binary_erosion(m,iterations=0)|m
    lac[z]&=m
    if z==zc: info['P_glob']=[float(P[0]+150),float(P[1]+250)]; info['prof_mm']=round(len(path)*0.7/mm,1)
din_prev=0
for z in range(26,70):
    if sp[z].sum()<100: continue
    din=ndi.distance_transform_edt(sp[z])/mm; cy,cx=np.argwhere(sp[z]).mean(0)
    da=np.angle(np.exp(1j*(np.arctan2(yy-cy,xx-cx)-np.arctan2(0.25,0.97))))
    t=(z-48)/20.0; tmax=12.0*max(0,1-t*t)*np.clip(np.cos(da*1.6),0,1)**0.7
    sub[z]=sp[z]&(din<tmax)
fat=fatm(a)
dso=ndi.distance_transform_edt(~sp,sampling=(dz,py,py)); dk=ndi.distance_transform_edt(~K,sampling=(dz,py,py))
clot=fat&(dso<11)&(dk>9); clot[:18]=0; clot[88:]=0; clot[:,395-150:]=0
cxm=np.argwhere(sp)[:,2].mean(); clot[:,:,:int(cxm)-20]=0
clot=ndi.binary_opening(clot,iterations=1)&~sp
applica(R,[('clot',clot),('sub',sub),('lac',lac)],lev)
allm['milza']=(R,{'lac':lac,'sub':sub,'clot':clot})
del a,dso,dk,fat
# ---------- fegato: perihepatico + Morison
R=roi(55,145,100,420,0,280); a=np.array(v[R],np.float32); L=L_full[R]; K=K_full[R]
fat=fatm(a); dl=ndi.distance_transform_edt(~L,sampling=(dz,py,py)); dk=ndi.distance_transform_edt(~K,sampling=(dz,py,py))
peri=fat&(dl<5.5); peri[:5]=0; peri[85:]=0; peri[:,365-100:]=0; peri[:,:,200:]=0
morr=fat&(dl<9)&(dk<11); morr[:45]=0; morr[:,370-100:]=0
free1=ndi.binary_opening(peri|morr,iterations=1)
applica(R,[('free',free1)],lev); allm['fegato']=(R,{'free':free1}); del a,dl,dk,fat
# ---------- pelvi
R=roi(250,305,150,400,150,380); a=np.array(v[R],np.float32); B=B_full[R]
fat=fatm(a); db=ndi.distance_transform_edt(~B,sampling=(dz,py,py)); byc=np.argwhere(B)[:,1].mean()
bz=np.nonzero(B.any((1,2)))[0]; bt=bz.min()
bx=np.argwhere(B)[:,2]; bxl,bxr=np.percentile(bx,15),np.percentile(bx,85)
pel=fat&(db<14)&(db>2.6)
zz=np.arange(a.shape[0])[:,None,None]; yy3=np.arange(a.shape[1])[None,:,None]; xx3=np.arange(a.shape[2])[None,None,:]
cupola=(zz<bt+6)                                  # sopra la cupola
retro=(zz>=bt+4)&(zz<bt+28)&(yy3>byc+12)&(xx3>bxl)&(xx3<bxr)   # dietro la vescica, sulla linea mediana
pel&=retro
pel=ndi.binary_opening(pel,iterations=1)
applica(R,[('free',pel)],lev); allm['pelvi']=(R,{'free':pel}); del a,db,fat
# ---------- doccia parietocolica sinistra
R=roi(120,255,220,340,300,512); a=np.array(v[R],np.float32); gut=np.zeros(a.shape,bool)
for z in range(a.shape[0]):
    sl=ndi.gaussian_filter(a[z],1.5); zg=z+120
    lim=int(9*mm*np.clip(1-abs(zg-180)/80,0.25,1))
    for y in range(5,a.shape[1]-5):
        row=sl[y]; x=211
        while x>0 and row[x]<-500: x-=1
        stt=0; run=0
        while x>0:
            f=row[x]<-25
            if stt==0 and f: stt=1
            elif stt==1 and not f and row[x]>0: stt=2
            elif stt==2 and f: stt=3; run=0
            if stt==3:
                if not f: break
                run+=1
                if run<=lim: gut[z,y,x]=True
            x-=1
gut=ndi.binary_opening(gut,iterations=1)
applica(R,[('free',gut)],lev); allm['doccia']=(R,{'free':gut})
np.save('/tmp/k191_sim.npy',out)
import pickle; pickle.dump(allm,open('/tmp/k191_masks.pkl','wb'))
for nm,(R,ms) in allm.items():
    for k,M in ms.items():
        zz=np.nonzero(M.any((1,2)))[0]
        info[nm+'_'+k]={'mL':round(float(M.sum()*dz*py*py/1000),1),'fette':[int(zz.min()+R[0].start),int(zz.max()+R[0].start)] if len(zz) else None}
print(json.dumps(info))
