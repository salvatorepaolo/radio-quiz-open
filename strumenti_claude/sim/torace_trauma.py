# torace_trauma.py (v2): fratture costali sinistre 6-8 (arco laterale), piccolo ematoma extrapleurico,
# contusione polmonare, pneumotorace anteriore sinistro, enfisema sottocutaneo. Base LIDC-IDRI-0441 (/tmp/l441.npy int16)
import numpy as np, sys, json; sys.path.insert(0,'.')
from scipy import ndimage as ndi
rng=np.random.default_rng(441)
V=np.load('/tmp/l441.npy',mmap_mode='r')
Z0,Z1,Y0,Y1,X0,X1=230,600,90,430,256,512
a=np.array(V[Z0:Z1,Y0:Y1,X0:X1],dtype=np.float32)
sp=np.array([0.5,0.537109375,0.537109375],np.float32)
s=ndi.gaussian_filter(a,(0.8,0.8,0.8)); r=(a-s).astype(np.float32)
out=a.copy(); info={'fratture':[]}
def cl(c,h,n): return slice(max(0,int(c-h)),min(n,int(c+h)))
def sig(x): return 1/(1+np.exp(-x))
lung=ndi.binary_opening(s<-500,iterations=2); lab,n=ndi.label(lung); sz=ndi.sum(lung,lab,range(1,n+1)); lung=lab==(np.argmax(sz)+1)
lungf=ndi.binary_closing(lung,iterations=3)
for k in range(lungf.shape[0]): lungf[k]=ndi.binary_fill_holes(lungf[k])
siti=[(352,0.0,'6',2.0),(418,0.4,'7',3.0),(503,-0.3,'8',1.5)]   # z, inclinazione del piano, costa, spostamento mm
fr=[]
for zc,tilt,nome,disp in siti:
    z=zc-Z0; yl=260-Y0
    row=s[z,yl-3:yl+4,:].mean(0); edge=np.nonzero(row>-500)[0].max()
    cand=np.nonzero(row[:edge+1]>200)[0]; cand=cand[cand>edge-70]; xc=int(cand.mean())
    R=int(12/0.537); sl=(cl(z,30,a.shape[0]),cl(yl,R,a.shape[1]),cl(xc,R,a.shape[2]))
    lb,nb=ndi.label(s[sl]>180); loc=tuple(np.array([z,yl,xc])-np.array([q.start for q in sl]))
    k=lb[loc] if lb[loc]>0 else np.bincount(lb[lb>0]).argmax()
    pm=(np.argwhere(lb==k)+np.array([q.start for q in sl]))*sp; cm=pm.mean(0)
    ax=np.linalg.svd(pm-cm,full_matrices=False)[2][0]; ax=ax if ax[0]>0 else -ax; c=cm/sp
    inw=np.array([0,0.15,-1.0]); inw-=ax*np.dot(inw,ax); inw/=np.linalg.norm(inw)
    nrm=ax+tilt*np.cross(ax,inw); nrm/=np.linalg.norm(nrm)
    box=(cl(c[0],60,a.shape[0]),cl(c[1],40,a.shape[1]),cl(c[2],40,a.shape[2]))
    g=np.stack(np.meshgrid(*[np.arange(q.start,q.stop,dtype=np.float32) for q in box],indexing='ij'),-1)
    dv=(g-c)*sp; sd=dv@nrm.astype(np.float32); al=dv@ax.astype(np.float32)
    radial=np.linalg.norm(dv-al[...,None]*ax,axis=-1)
    soft=np.clip(1-(radial-7)/5,0,1)                                    # sfuma tra 7 e 12 mm dall'asse
    w=sig(sd/0.5)*np.exp(-np.clip(sd,0,None)/20.0)*soft
    dmm=(inw*disp+nrm*0.8).astype(np.float32)
    src=g-(w[...,None]*dmm/sp)
    warped=ndi.map_coordinates(a,[src[...,0],src[...,1],src[...,2]],order=1,mode='nearest')
    blk=out[box]; blk=blk*(1-np.clip(w*3,0,1))+warped*np.clip(w*3,0,1)
    # rima di frattura: banda sottile irregolare dove c'era osso
    rough=ndi.gaussian_filter(rng.normal(size=sd.shape).astype(np.float32),2)*0.6
    line=np.exp(-((sd-0.4+rough)/0.55)**2)*(radial<7.5)
    isbone=np.clip((ndi.map_coordinates(s,[src[...,0],src[...,1],src[...,2]],order=1)-120)/150,0,1)
    blk=blk*(1-line*isbone)+(40+r[box])*line*isbone
    out[box]=blk
    # ematoma extrapleurico (solo costa 7): lente liscia di tessuto che sporge nel polmone, max 4 mm
    if nome=='7':
        L=lungf[box]; din=ndi.distance_transform_edt(L,sampling=sp).astype(np.float32)
        th=4.0*np.clip(1-(al/16)**2,0,1)*np.clip(1-(np.abs(dv@inw.astype(np.float32)+0)/60),0,1)
        lensw=np.clip((th-din)/0.8,0,1)*L*(radial<22)
        lensw=ndi.gaussian_filter(lensw.astype(np.float32),0.8)
        out[box]=out[box]*(1-lensw)+(42+r[box])*lensw
    fr.append(c); info['fratture'].append({'costa':nome,'z':int(c[0]+Z0),'y':int(c[1]+Y0),'x':int(c[2]+X0),'spost_mm':disp})
# contusione
patch=ndi.gaussian_filter(rng.normal(size=a.shape).astype(np.float32),(4,4,4)); patch/=patch.std()
dl_in=ndi.distance_transform_edt(lungf,sampling=sp).astype(np.float32)
for c in fr[:2]:
    bx=(cl(c[0],70,a.shape[0]),cl(c[1],65,a.shape[1]),cl(c[2],65,a.shape[2]))
    z_,y_,x_=np.ogrid[bx[0],bx[1],bx[2]]
    d=np.sqrt(((z_-c[0])*sp[0])**2+((y_-c[1])*sp[1])**2+((x_-c[2])*sp[2])**2).astype(np.float32)
    wc=np.clip(1-(d-18)/14,0,1)*np.clip(1-(dl_in[bx]-8)/10,0,1)*lungf[bx]
    wc=ndi.gaussian_filter(wc,2)*np.clip(0.5+0.5*patch[bx],0,1)
    out[bx]=np.where(lungf[bx]&(wc>0.03),np.maximum(out[bx],-860+420*wc+r[bx]),out[bx])
# pneumotorace anteriore, spessore variabile (max ~9 mm), solo davanti alla linea ascellare media
yc_l=np.argwhere(lungf)[:,1]; ya,yp=np.percentile(yc_l,2),np.percentile(yc_l,45)
var=ndi.gaussian_filter(rng.normal(size=(a.shape[0],a.shape[1])).astype(np.float32),(25,25)); var/=var.std()
ptxn=0
for k in range(a.shape[0]):
    zf=max(0.0,1-abs((k+Z0)-455)/140.0)
    if zf<=0: continue
    yf=np.clip((yp-np.arange(a.shape[1]))/(yp-ya),0,1)
    t=(9.0*zf**0.7*yf**1.6*(1+0.25*var[k]))[:,None].astype(np.float32)
    dl=dl_in[k]; L=lungf[k]
    wp=np.clip((t-dl)/0.6,0,1)*L                                  # bordo sfumato
    out[k]=out[k]*(1-wp)+(-995+r[k]*0.7)*wp
    pl=np.exp(-((dl-t-0.35)/0.35)**2)*L*(t>1.0)                   # pleura viscerale sottile
    out[k]=np.maximum(out[k],out[k]*(1-pl)+(-620+r[k])*pl)
    ptxn+=wp.sum()
info['ptx_mL']=float(ptxn*sp.prod()/1000)
# enfisema sottocutaneo: bolle irregolari lungo i piani muscolo-adiposi, 5-30 mm all'esterno delle fratture
nb=0
for c in fr[:2]:
    bx=(cl(c[0],70,a.shape[0]),cl(c[1],60,a.shape[1]),cl(c[2],70,a.shape[2]))
    z_,y_,x_=np.ogrid[bx[0],bx[1],bx[2]]
    d=np.sqrt(((z_-c[0])*sp[0])**2+((y_-c[1])*sp[1])**2+((x_-c[2])*sp[2])**2).astype(np.float32)
    tess=(s[bx]>-180)&(s[bx]<100)&~lungf[bx]
    outside=(x_-c[2])>8                                               # verso la cute (lato laterale)
    field=ndi.gaussian_filter(rng.normal(size=d.shape).astype(np.float32),(3.0,1.6,1.2)); field/=field.std()
    pr=np.clip(1-d/35,0,1)
    m=(field>2.35-0.6*pr)&tess&outside&(d<35)
    m=ndi.binary_opening(m,iterations=1)
    wb=ndi.gaussian_filter(m.astype(np.float32),0.7)
    out[bx]=out[bx]*(1-wb)+(-880+r[bx]*0.6)*wb
    lb,nn=ndi.label(m); nb+=nn
info['bolle']=int(nb)
full=np.lib.format.open_memmap('/tmp/l441_sim.npy',mode='w+',dtype=np.int16,shape=V.shape)
full[:]=V[:]
full[Z0:Z1,Y0:Y1,X0:X1]=np.clip(np.round(out),-1024,3071).astype(np.int16); full.flush()
print(json.dumps(info))
