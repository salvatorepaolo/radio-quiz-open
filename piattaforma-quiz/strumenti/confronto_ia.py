#!/usr/bin/env python3
"""Confronto con l'esame precedente guidato dalla segmentazione IA (noduli polmonari).

uso: RQ_CASI=…/casi-free python strumenti/confronto_ia.py caso-tcia-110 [--verifica]

Per un caso con due esami TC del torace (Studio 1 = precedente, Studio 2 = attuale) segmentati da segmenta_ia.py
e con la seconda lettura dei noduli (noduli_ia.py):
  1. allineamento: trasformazione affine stimata dai baricentri delle strutture anatomiche presenti in entrambi
     gli esami (vertebre, coste, trachea, lobi, cuore, aorta…), con esclusione iterativa dei punti incoerenti;
  2. abbinamento dei noduli: centro del nodulo del precedente portato nello spazio dell'attuale, coppia se la distanza
     è sotto max(10 mm, diametro); ogni nodulo si abbina una sola volta (prima le coppie più vicine);
  3. per ogni coppia: volume e diametro prima/dopo, variazione %, tempo di raddoppio del volume (VDT),
     crescita secondo Lung-RADS v2022 (> 1,5 mm di diametro medio); noduli nuovi e scomparsi;
  4. RECIST 1.1 sui noduli bersaglio (≥ 10 mm al basale, al massimo 2 nel polmone): somma dei diametri maggiori e risposta.
Scrive casi/<id>/ia/confronto.json. Solo numeri: nessun dato del paziente. Stime automatiche da verificare.
"""
import argparse, glob, gzip, json, math, os, re, sys
from datetime import date
import numpy as np

CASI = os.environ.get('RQ_CASI') or '/Volumes/Caloggero/piattaforma-quiz/casi-free'
MESI = {'gen': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mag': 5, 'giu': 6, 'lug': 7, 'ago': 8, 'set': 9, 'ott': 10, 'nov': 11, 'dic': 12}
# strutture utili come punti di riferimento (rigide o quasi, presenti nelle TC del torace)
RIF = ('vertebrae_', 'rib_', 'trachea', 'sternum', 'clavicula', 'scapula', 'humerus', 'lung_', 'heart', 'aorta', 'esophagus',
       'pulmonary_vein', 'brachiocephalic', 'subclavian', 'common_carotid', 'superior_vena_cava', 'atrial_appendage', 'spinal_cord', 'thyroid')


def leggi_serie(caso):
    s = json.load(open(os.path.join(CASI, caso, 'serie.json')))
    return s if isinstance(s, list) else s.get('serie', [])


def data_esame(caso, s):
    """Data dello studio: dal DICOM (StudyDate, anche se spostata nell'anonimizzazione gli intervalli restano veri), altrimenti «gen 1999»."""
    try:
        import pydicom
        d = pydicom.dcmread(os.path.join(CASI, caso, s['files'][0]), stop_before_pixels=True)
        v = str(getattr(d, 'StudyDate', '') or getattr(d, 'SeriesDate', '') or '')
        if len(v) == 8: return date(int(v[:4]), int(v[4:6]), int(v[6:])), 'DICOM'
    except Exception:
        pass
    m = (s.get('data') or '').split()
    if len(m) == 2 and m[0][:3].lower() in MESI and m[1].isdigit(): return date(int(m[1]), MESI[m[0][:3].lower()], 15), 'mese'
    return None, None


def baricentri(dia, geo):
    lab = np.frombuffer(gzip.open(os.path.join(dia, geo['serie'] + '.lab.gz')).read(), np.uint8)
    W, H, D = geo['dim']; lab = lab.reshape(D, H, W)        # x più veloce
    o, A, sp = np.array(geo['origine']), np.array(geo['assi']), np.array(geo['sp'])
    out = {}
    for k, nome in geo['etichette'].items():
        if not any(str(nome).startswith(r) for r in RIF): continue
        z, y, x = np.nonzero(lab == int(k))
        if len(x) < 50: continue
        # strutture tagliate dal bordo dell'esame: il baricentro si sposta, meglio non usarle
        if z.min() == 0 or z.max() == D - 1: continue
        v = np.array([x.mean(), y.mean(), z.mean()]) * sp
        out[nome] = o + A[0] * v[0] + A[1] * v[1] + A[2] * v[2]
    return out


def affine(p, q):
    """q ≈ M·p + t, minimi quadrati, con esclusione iterativa dei punti oltre 2,5 × la mediana dei residui."""
    nomi = list(p); P = np.array([p[n] for n in nomi]); Q = np.array([q[n] for n in nomi]); usa = np.ones(len(nomi), bool)
    for _ in range(5):
        if usa.sum() < 8: break
        X = np.c_[P[usa], np.ones(usa.sum())]
        T, *_ = np.linalg.lstsq(X, Q[usa], rcond=None)
        res = np.linalg.norm(np.c_[P, np.ones(len(P))] @ T - Q, axis=1)
        nuovo = res <= max(2.5 * np.median(res[usa]), 3.0)
        if (nuovo == usa).all(): break
        usa = nuovo
    if usa.sum() < 8:        # pochi punti: solo traslazione
        t = np.median(Q - P, axis=0); T = np.r_[np.eye(3), [t]]
        res = np.linalg.norm(P + t - Q, axis=1)
    return T, res, usa, nomi


def porta(T, x):
    return np.r_[np.asarray(x, float), 1.0] @ T


def cat_crescita(n0, n1, mesi):
    """Lung-RADS v2022 al controllo (semplificato: noduli solidi e parzialmente solidi; proposta da verificare)."""
    d0, d1 = n0['diametro_medio_mm'], n1['diametro_medio_mm']
    cresce = d1 - d0 > 1.5
    if not cresce: return None, False
    if n1.get('tipo') == 'vetro smerigliato': return ('2' if d1 < 30 else '3'), True
    return ('4A' if d1 < 8 else '4B'), True


def cat_nuovo(n):
    d = n['diametro_medio_mm']
    if n.get('tipo') == 'vetro smerigliato': return '2' if d < 30 else '3'
    return '2' if d < 4 else '3' if d < 6 else '4A' if d < 8 else '4B'


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('caso'); ap.add_argument('--verifica', action='store_true')
    a = ap.parse_args()
    dia = os.path.join(CASI, a.caso, 'ia'); serie = leggi_serie(a.caso)
    # solo TC del torace (screening e controlli polmonari): nelle PET-TC e negli esami total body Lung-RADS non ha senso
    caso = json.load(open(os.path.join(CASI, a.caso, 'caso.json')))
    if not re.search(r'torac|polmon|chest|lung|nodul', f"{caso.get('distretto', '')} {caso.get('titolo', '')}", re.I) or re.search(r'PET|total body', f"{caso.get('distretto', '')} {caso.get('titolo', '')}", re.I):
        sys.exit(f"{a.caso}: non è una TC del torace, confronto dei noduli non calcolato")
    geos = {}
    for f in glob.glob(os.path.join(dia, '*.json')):
        if f.endswith('confronto.json'): continue
        g = json.load(open(f))
        if g.get('serie') and (g.get('analisi') or {}).get('noduli_metodo'): geos[g['serie']] = g
    esami = []
    for i, s in enumerate(serie):
        cart = os.path.basename(os.path.dirname(s['files'][0])) if s.get('files') else ''
        if cart in geos: esami.append((i, s, geos[cart]))
    if len(esami) < 2: sys.exit(f'{a.caso}: servono due esami con segmentazione IA e noduli (trovati {len(esami)})')
    # precedente = il primo in ordine di data (o di elenco), attuale = l'ultimo
    datati = [(data_esame(a.caso, s)[0] or date(1900, 1, 1 + k), k) for k, (_, s, _) in enumerate(esami)]
    ordine = [k for _, k in sorted(datati)]
    (i0, s0, g0), (i1, s1, g1) = esami[ordine[0]], esami[ordine[-1]]
    (d0, fonte0), (d1, fonte1) = data_esame(a.caso, s0), data_esame(a.caso, s1)
    giorni = (d1 - d0).days if d0 and d1 else None; mesi = giorni / 30.44 if giorni else 12.0

    b0, b1 = baricentri(dia, g0), baricentri(dia, g1)
    comuni = {n: b0[n] for n in b0 if n in b1}
    T, res, usa, nomi = affine(comuni, {n: b1[n] for n in comuni})
    errore = float(np.median(res[usa])) if usa.any() else None

    N0, N1 = g0['analisi']['noduli'], g1['analisi']['noduli']
    # correzione locale per lobo: il polmone (soprattutto i lobi inferiori) si sposta con il respiro più delle ossa;
    # lo spostamento residuo del baricentro del lobo, dopo l'affine, si aggiunge ai noduli di quel lobo
    LOBI = {'superiore destro': 'lung_upper_lobe_right', 'medio': 'lung_middle_lobe_right', 'inferiore destro': 'lung_lower_lobe_right',
            'superiore sinistro': 'lung_upper_lobe_left', 'inferiore sinistro': 'lung_lower_lobe_left'}
    def locale(n):
        k = LOBI.get(n.get('lobo') or '')
        return (b1[k] - porta(T, b0[k])) if k in b0 and k in b1 else np.zeros(3)
    cand = []
    for i, n0 in enumerate(N0):
        p = porta(T, n0['centro_lps']) + locale(n0)
        for j, n1 in enumerate(N1):
            dd = float(np.linalg.norm(p - np.array(n1['centro_lps'])))
            if dd <= max(10.0, n0['diametro_medio_mm'], n1['diametro_medio_mm']): cand.append((dd, i, j))
    # abbinamento ottimo (non il più vicino uno alla volta): costo = distanza + 2 × differenza di diametro
    from scipy.optimize import linear_sum_assignment
    GRANDE = 1e6; C = np.full((len(N0), len(N1)), GRANDE); DD = {}
    for dd, i, j in cand: C[i, j] = dd + 2 * abs(N0[i]['diametro_medio_mm'] - N1[j]['diametro_medio_mm']); DD[i, j] = dd
    presi0, presi1, coppie = set(), set(), []
    righe, col = linear_sum_assignment(C) if len(N0) and len(N1) else ([], [])
    for i, j in sorted(zip(righe, col), key=lambda x: C[x]):
        if C[i, j] >= GRANDE: continue
        i, j = int(i), int(j); dd = DD[i, j]
        presi0.add(i); presi1.add(j)
        n0, n1 = N0[i], N1[j]
        v0, v1 = n0['volume_mm3'], n1['volume_mm3']
        rap = v1 / v0 if v0 else None
        # VDT solo per i noduli che crescono (oltre il 5% di volume); in riduzione o stabili non ha senso
        vdt = round(giorni * math.log(2) / math.log(rap)) if giorni and rap and rap > 1.05 else None
        lr, cresce = cat_crescita(n0, n1, mesi)
        coppie.append({'prima': i, 'dopo': j, 'distanza_mm': round(dd, 1),
                       'volume_mm3': [v0, v1], 'variazione_volume_pct': round((rap - 1) * 100) if rap else None,
                       'diametro_mm': [n0['diametro_medio_mm'], n1['diametro_medio_mm']], 'variazione_diametro_mm': round(n1['diametro_medio_mm'] - n0['diametro_medio_mm'], 1),
                       'vdt_giorni': vdt, 'crescita_lungrads': cresce,
                       # stabile o ridotto: la categoria al controllo dipende dalla storia (Lung-RADS v2022), la sceglie il radiologo
                       'lung_rads_controllo': lr, 'andamento': 'crescita' if cresce else 'riduzione' if rap and rap < 0.75 else 'stabile',
                       'lobo': n1.get('lobo') or n0.get('lobo'), 'tipo': [n0.get('tipo'), n1.get('tipo')], 'immagine': [n0.get('immagine'), n1.get('immagine')]})
    nuovi = [{'dopo': j, 'diametro_mm': n['diametro_medio_mm'], 'volume_mm3': n['volume_mm3'], 'lobo': n.get('lobo'), 'tipo': n.get('tipo'), 'immagine': n.get('immagine'),
              'lung_rads_controllo': cat_nuovo(n)} for j, n in enumerate(N1) if j not in presi1]
    scomparsi = [{'prima': i, 'diametro_mm': n['diametro_medio_mm'], 'lobo': n.get('lobo'), 'immagine': n.get('immagine')} for i, n in enumerate(N0) if i not in presi0]

    # RECIST 1.1: bersagli = noduli ≥ 10 mm (diametro maggiore) al basale, al massimo 2 (stesso organo)
    lungo = lambda n: max(x for x in (n.get('A'), n.get('B'), n.get('C'), n.get('diametro_medio_mm')) if x)
    bers = sorted([c for c in coppie if lungo(N0[c['prima']]) >= 10], key=lambda c: -lungo(N0[c['prima']]))[:2]
    recist = None
    if bers:
        s_0 = round(sum(lungo(N0[c['prima']]) for c in bers), 1); s_1 = round(sum(lungo(N1[c['dopo']]) for c in bers), 1)
        var = (s_1 - s_0) / s_0 * 100
        nuovi_grandi = [n for n in nuovi if n['diametro_mm'] >= 5]
        risp = 'PD' if (var >= 20 and s_1 - s_0 >= 5) or nuovi_grandi else 'CR' if s_1 == 0 else 'PR' if var <= -30 else 'SD'
        recist = {'bersagli': [c['prima'] for c in bers], 'somma_mm': [s_0, s_1], 'variazione_pct': round(var), 'risposta': risp,
                  'nota': 'RECIST 1.1 sui noduli polmonari ≥ 10 mm (al massimo 2 bersagli per organo); una lesione nuova fa PD. '
                          'Nello screening vale Lung-RADS: RECIST è per i pazienti oncologici in trattamento.'}

    peggiore = max([c['lung_rads_controllo'] for c in coppie if c['lung_rads_controllo']] + [n['lung_rads_controllo'] for n in nuovi] + ['1'],
                   key=lambda x: ['1', '2', '3', '4A', '4B', '4X'].index(x) if x in ['1', '2', '3', '4A', '4B', '4X'] else 0)
    out = {'precedente': {'serie': g0['serie'], 'indice': i0, 'data': d0.isoformat() if d0 else None, 'fonte_data': fonte0},
           'attuale': {'serie': g1['serie'], 'indice': i1, 'data': d1.isoformat() if d1 else None, 'fonte_data': fonte1},
           'intervallo_giorni': giorni,
           'allineamento': {'metodo': 'affine dai baricentri delle strutture IA', 'punti': int(usa.sum()), 'punti_totali': len(nomi),
                            'errore_mediano_mm': round(errore, 1) if errore is not None else None,
                            'matrice': [[round(float(x), 5) for x in r] for r in T]},
           'coppie': coppie, 'nuovi': nuovi, 'scomparsi': scomparsi, 'recist': recist,
           'lung_rads_controllo': peggiore,
           'nota': 'Stime automatiche (segmentazione TotalSegmentator, noduli TotalSegmentator + MONAI): da verificare sulle immagini. '
                   'Crescita Lung-RADS v2022: aumento del diametro medio > 1,5 mm entro 12 mesi. VDT = intervallo × ln2 / ln(V2/V1).',
           'data_calcolo': date.today().strftime('%Y-%m')}
    json.dump(out, open(os.path.join(dia, 'confronto.json'), 'w'), ensure_ascii=False, indent=1)
    print(f"{a.caso}: {d0} → {d1} ({giorni} giorni) · allineamento su {usa.sum()}/{len(nomi)} punti, errore mediano {out['allineamento']['errore_mediano_mm']} mm")
    for c in coppie:
        print(f"  coppia {c['prima']}→{c['dopo']} ({c['lobo']}): {c['diametro_mm'][0]} → {c['diametro_mm'][1]} mm, volume {c['variazione_volume_pct']:+d}%"
              f", VDT {c['vdt_giorni']} gg, distanza {c['distanza_mm']} mm, {c['andamento']}, LR {c['lung_rads_controllo']}")
    for n in nuovi: print(f"  nuovo {n['dopo']} ({n['lobo']}): {n['diametro_mm']} mm, LR {n['lung_rads_controllo']}")
    for n in scomparsi: print(f"  scomparso {n['prima']} ({n['lobo']}): {n['diametro_mm']} mm")
    if recist: print(f"  RECIST: somma {recist['somma_mm'][0]} → {recist['somma_mm'][1]} mm ({recist['variazione_pct']:+d}%) → {recist['risposta']}")
    print(f"  Lung-RADS al controllo (proposta): {peggiore}")
    if a.verifica:   # errore dell'allineamento sui singoli punti
        for n, r, u in sorted(zip(nomi, res, usa), key=lambda x: -x[1])[:8]: print(f"    {n}: {r:.1f} mm{'' if u else ' (escluso)'}")


if __name__ == '__main__':
    main()
