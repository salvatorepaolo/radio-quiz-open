import json, glob, numpy as np
A = json.load(open('/tmp/val_fp32.json')); B = json.load(open('/tmp/val_int8.json'))
C = '/Volumes/Caloggero/piattaforma-quiz/casi-free/'
def sel(l, s=0.5): return [x for x in l if x['s'] >= s and x['d'] is not None and 4 <= x['d'] <= 30 and not x['tocca']]
def match(p, q):
    usati = set(); out = []
    for x in p:
        best = None
        for j, y in enumerate(q):
            if j in usati: continue
            dd = np.linalg.norm(np.array(x['lps']) - np.array(y['lps']))
            if dd <= max(5, (x['d'] or 0) / 2) and (best is None or dd < best[1]): best = (j, dd)
        if best: usati.add(best[0]); out.append((x, q[best[0]], best[1]))
        else: out.append((x, None, None))
    return out, [y for j, y in enumerate(q) if j not in usati]
tot = dict(f=0, i=0, both=0, ref=0, ref_f=0, ref_i=0)
for c in A:
    if c not in B: continue
    caso, serie = c.split('_', 1)
    rif = [n for n in json.load(open(f'{C}{caso}/ia/{serie}.json'))['analisi']['noduli'] if 'MONAI' in n['modelli'] or n['modelli'] == 'entrambi']
    fa, ib = sel(A[c]['l']), sel(B[c]['l'])
    m, extra = match(fa, ib)
    print(f'\n{c}: fp32 {len(fa)} ({A[c]["t"]:.0f}s), int8 {len(ib)} ({B[c]["t"]:.0f}s), in comune {sum(1 for x in m if x[1])}')
    for x, y, d in m:
        if not y: print(f'   solo fp32: s={x["s"]} d={x["d"]} {x["lps"]} (int8 score: ' + str(max([z["s"] for z in B[c]["l"] if np.linalg.norm(np.array(z["lps"])-np.array(x["lps"]))<5] or [0])) + ')')
        else: print(f'   ok {d:.1f} mm  d {x["d"]}→{y["d"]}  LR {x["lr"]}→{y["lr"]}  s {x["s"]}→{y["s"]}')
    for y in extra: print(f'   solo int8: s={y["s"]} d={y["d"]} {y["lps"]} (fp32 score: ' + str(max([z["s"] for z in A[c]["l"] if np.linalg.norm(np.array(z["lps"])-np.array(y["lps"]))<5] or [0])) + ')')
    for nome, l, k in (('fp32', fa, 'ref_f'), ('int8', ib, 'ref_i')):
        tr = sum(1 for n in rif if any(np.linalg.norm(np.array(n['centro_lps']) - np.array(x['lps'])) <= max(5, n['diametro_medio_mm'] / 2) for x in l)); tot[k] += tr
    tot['ref'] += len(rif); tot['f'] += len(fa); tot['i'] += len(ib); tot['both'] += sum(1 for x in m if x[1])
print('\nTOTALE', tot)
