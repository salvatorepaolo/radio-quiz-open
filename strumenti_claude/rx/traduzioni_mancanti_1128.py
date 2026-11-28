# 28/11: testi dei casi senza inglese trovati dal controllo trasversale (quesiti e sezioni dei casi 166-174)
import json, glob, os
B = '/Volumes/Caloggero/piattaforma-quiz/'; W = B + 'cloud/web/lingua/casi/'
EN = {'Pancreas': 'Pancreas', 'interstiziopatia': 'interstitial lung disease', 'controllo neurinoma': 'schwannoma follow-up', 'L1': 'L1',
      'nodulo epatico da caratterizzare': 'liver nodule to be characterised', 'LI-RADS': 'LI-RADS', 'lombalgia': 'low back pain',
      'nodulo mammario': 'breast nodule', 'datazione della gravidanza': 'pregnancy dating', 'crescita fetale': 'fetal growth', 'massa mammaria': 'breast mass',
      'Reperti': 'Findings', 'Conclusioni': 'Conclusions', 'Che cosa vedi?': 'What do you see?', 'Qual è la conclusione e che cosa fai?': 'What is the conclusion and what do you do?'}
n = 0
for f in glob.glob(B + 'casi-free/caso-*/caso.json'):
    c = os.path.basename(os.path.dirname(f)); d = json.load(open(f)); tf = W + c + '.json'
    if not os.path.exists(tf): continue
    T = json.load(open(tf)); s = json.dumps(d, ensure_ascii=False); agg = {k: v for k, v in EN.items() if k not in T and json.dumps(k, ensure_ascii=False) in s}
    if agg: T.update(agg); json.dump(T, open(tf, 'w'), ensure_ascii=False); n += len(agg)
print(n, 'traduzioni aggiunte')
