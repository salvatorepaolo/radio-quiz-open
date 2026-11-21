# comprimi_cartella.py CARTELLA : JPEG Lossless (verificato) di tutti i .dcm non compressi della cartella
import sys,os; sys.path.insert(0,'/Volumes/Caloggero/piattaforma-quiz/strumenti'); import comprimi
d=sys.argv[1]; n=0; t0=0; t1=0
for rad,_,fs in os.walk(d):
    for f in fs:
        if f.endswith('.dcm'):
            p=os.path.join(rad,f); a=os.path.getsize(p); x=comprimi.comprimi(p); b=os.path.getsize(p); t0+=a; t1+=b; n+=1
print('file',n,'MB',round(t0/1e6),'->',round(t1/1e6))
