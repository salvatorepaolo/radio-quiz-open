# zidx.py caso z : indice più vicino a z in ogni serie
import sys,json,pydicom,numpy as np
CF=f'/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-{sys.argv[1]}/'; z=float(sys.argv[2])
for k,s in enumerate(json.load(open(CF+'serie.json'))):
    zs=[float(pydicom.dcmread(CF+f,stop_before_pixels=True).ImagePositionPatient[2]) for f in s['files']]
    i=int(np.argmin([abs(a-z) for a in zs])); print(k,s['descrizione'],len(zs),'idx',i,'z',round(zs[i],1))
