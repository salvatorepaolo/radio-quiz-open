import json, sys
righe = []
for f in sys.argv[1:]:
    for l in open(f):
        try: righe.append(json.loads(l))
        except Exception: pass
print(f"{'caso':14} {'dv':>4} {'calc':>6} {'calcV':>6} {'lume':>6} {'lumeV':>6} {'+cm3':>6} {'-cm3':>5} {'lont':>6} pezzi_lontani | t_vecchio t_nuovo t_mip t_ao t_osso  errori")
for r in righe:
    d = r.get('diag') or {}; c = r.get('confronto') or {}
    f = lambda x: '' if x is None else x
    print(f"{r['caso'][5:]:14} {f(d.get('dv')):>4} {f(d.get('calcificazioni')):>6} {f(d.get('calcioNeiVasi')):>6} {f(d.get('lumeVicino')):>6} {f(d.get('lumeVicinoNeiVasi')):>6} "
          f"{f(c.get('aggiunti')):>6} {f(c.get('tolti')):>5} {f(c.get('lontani')):>6} {','.join(c.get('pezziLontani') or [])[:40]:40} | "
          f"{r.get('tVecchio')} {r.get('tNuovo')} {r.get('tMip')} {r.get('tAngioOssa')} {r.get('tSenzaOsso')} {r.get('errori') or ''} {r.get('eccezione','')} {('INFO:'+r['info']) if r.get('info') else ''}")
