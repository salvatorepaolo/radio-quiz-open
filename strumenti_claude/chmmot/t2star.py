# t2star.py serie z x0,y0,x1,y1 [mappa.png] : T2* (ms) per fit esponenziale (log-lineare, echi con segnale > 2x rumore) nella ROI; con mappa.png salva la mappa T2* della fetta
import sys,glob,pydicom,numpy as np
from PIL import Image
s,z=sys.argv[1],float(sys.argv[2]); x0,y0,x1,y1=map(int,sys.argv[3].split(','))
ds=[pydicom.dcmread(f) for f in glob.glob(s+'/*.dcm')]
L=sorted([d for d in ds if abs(float(d.SliceLocation)-z)<0.2],key=lambda d:float(d.EchoTime))
te=np.array([float(d.EchoTime) for d in L]); v=np.stack([d.pixel_array.astype(float) for d in L])
noise=np.median(v[:, :10, :10])+1
def fit(sig,te,soglia):
    m=sig>soglia
    if m.sum()<3: return np.nan,m.sum()
    # troncamento: usa solo gli echi finché il segnale è > soglia (metodo «truncation»)
    k=np.argmin(m) if not m.all() else len(m)
    if k<3: k=3
    b=np.polyfit(te[:k],np.log(np.maximum(sig[:k],1)),1); return -1/b[0] if b[0]<0 else np.nan,k
roi=v[:,y0:y1,x0:x1].reshape(len(te),-1).mean(1)
t,k=fit(roi,te,2*noise)
print("TE",np.round(te,2)); print("ROI media",np.round(roi,1)); print(f"rumore~{noise:.1f}  T2* ROI = {t:.1f} ms (echi usati {k})  R2* = {1000/t:.0f} s-1")
if len(sys.argv)>4:
    H,W=v.shape[1:]; M=np.zeros((H,W))
    for y in range(H):
        for x in range(W):
            M[y,x]=fit(v[:,y,x],te,2*noise)[0]
    M=np.nan_to_num(M); im=Image.fromarray(np.clip(M/40*255,0,255).astype(np.uint8)).resize((W*3,H*3),Image.NEAREST); im.save(sys.argv[4])
