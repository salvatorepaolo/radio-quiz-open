# grid.py npy out.png i1,i2,... [wc,ww] [x0,y0,x1,y1]: assiali con griglia ogni 32 px
import sys,numpy as np; sys.path.insert(0,__import__('os').path.dirname(__file__)); from vol import *
from PIL import Image,ImageDraw
v=np.load(sys.argv[1]) if sys.argv[1].endswith('.npy') else carica(sys.argv[1])[0]
out=sys.argv[2]; idx=[int(x) for x in sys.argv[3].split(',')]
wc,ww=map(float,(sys.argv[4] if len(sys.argv)>4 else '50,400').split(','))
x0,y0,x1,y1=map(int,(sys.argv[5] if len(sys.argv)>5 else '0,0,512,512').split(','))
ims=[]
for i in idx:
    im=Image.fromarray(win(v[i],wc,ww)).convert('RGB').crop((x0,y0,x1,y1)); s=512/max(x1-x0,y1-y0); im=im.resize((int((x1-x0)*s),int((y1-y0)*s)))
    d=ImageDraw.Draw(im)
    for g in range(0,512,32):
        if x0<=g<=x1: X=(g-x0)*s; d.line([(X,0),(X,im.size[1])],fill=(70,70,0)); d.text((X+2,2),str(g),fill=(255,60,60))
        if y0<=g<=y1: Y=(g-y0)*s; d.line([(0,Y),(im.size[0],Y)],fill=(70,70,0)); d.text((2,Y+2),str(g),fill=(255,60,60))
    d.text((im.size[0]-50,4),f'i{i}',fill=(255,255,0)); ims.append(im)
c=3; W=Image.new('RGB',(ims[0].size[0]*c,ims[0].size[1]*((len(ims)+c-1)//c)))
for k,im in enumerate(ims): W.paste(im,((k%c)*im.size[0],(k//c)*im.size[1]))
W.save(out)
