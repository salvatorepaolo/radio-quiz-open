import json
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
L = W + 'lingua/casi/'

def agg(n, togli, metti):
    p = L + 'caso-tcia-%d.json' % n; t = json.load(open(p))
    for k in togli: t.pop(k, None)
    t.update(metti); json.dump(t, open(p, 'w'), ensure_ascii=False)

agg(168, ["Il rapporto cardio-toracico (RCT) si misura solo in PA in buona inspirazione: diametro trasverso massimo del cuore (dalla linea mediana al bordo destro più quella al bordo sinistro) diviso per il diametro interno massimo del torace. Oltre 0,5 è cardiomegalia. In AP, in espirazione o con il paziente sdraiato il cuore appare più grande e il valore non è affidabile. La RX non distingue camere dilatate, ipertrofia e versamento pericardico: per questo si fa l'ecocardiogramma. Cerca anche i segni di scompenso: ridistribuzione vascolare, linee B di Kerley, versamenti."], {
 "Il rapporto cardio-toracico (RCT) si misura solo in PA in buona inspirazione: diametro trasverso massimo del cuore (dalla linea mediana al bordo destro più quella al bordo sinistro) diviso per il diametro interno massimo del torace. Oltre 0,5 è cardiomegalia. In AP, in espirazione o con il paziente sdraiato il cuore appare più grande e il valore non è affidabile. La RX non distingue camere dilatate, ipertrofia e versamento pericardico: per questo si fa l'ecocardiogramma. Cerca anche i segni di scompenso (ridistribuzione vascolare, linee B di Kerley, versamenti) e quelli di interventi precedenti: fili di sternotomia, clip, protesi valvolari, pacemaker.":
 "The cardiothoracic ratio (CTR) is measured only on a well-inspired PA: maximum transverse diameter of the heart (from the midline to the right border plus to the left border) divided by the maximum internal diameter of the thorax. Above 0.5 is cardiomegaly. On AP, in expiration or with the patient supine the heart looks larger and the value is not reliable. The X-ray cannot distinguish dilated chambers, hypertrophy and pericardial effusion: that is why echocardiography is done. Also look for signs of heart failure (vascular redistribution, Kerley B lines, effusions) and of previous procedures: sternotomy wires, clips, valve prostheses, pacemakers.",
 "Fili metallici di sternotomia e clip chirurgiche nel mediastino: pregresso intervento cardiochirurgico": "Sternotomy wires and surgical clips in the mediastinum: previous cardiac surgery",
 "Un reperto da riportare sempre: dopo un intervento sul cuore (bypass, valvole) l'ombra cardiaca è spesso grande.": "A finding to always report: after heart surgery (bypass, valves) the cardiac silhouette is often large."})

agg(170, ["Massa del campo superiore destro (NIH 00022192_003, riquadro «Mass»)", "Descrivi la lesione, indicala sull'immagine e scegli il passo successivo.", "Grande opacità (massa) nel campo polmonare superiore destro", "Riquadro dei radiologi del NIH nel campo superiore destro.", "Lesione di diametro superiore a 3 cm: si parla di massa, non di nodulo", "Massa polmonare in un paziente anziano: TC del torace con mezzo di contrasto (e dell'addome superiore) per caratterizzare e stadiare, poi diagnosi istologica", "Un'opacità polmonare oltre i 3 cm è una massa: nell'adulto e nell'anziano fumatore va considerata un tumore finché non si dimostra il contrario. La RX ne dice la sede, ma non basta: la TC con mezzo di contrasto la caratterizza (margini, cavitazione, rapporti con mediastino e parete), cerca linfonodi e metastasi e guida la biopsia. Una polmonite può somigliare a una massa: se si sceglie l'antibiotico, la RX di controllo dopo 6-8 settimane è obbligatoria, perché una «polmonite che non guarisce» può nascondere un tumore. Cerca sempre anche erosioni costali, versamento, sollevamento del diaframma (paralisi del frenico).", "Oltre 3 cm è una massa: TC con mezzo di contrasto e istologia; non fermarti all'antibiotico.", "Massa campo superiore destro"], {
 "Opacità del lobo superiore destro: massa, consolidazione o atelettasia (NIH 00022192_003, etichetta «Mass»)": "Right upper lobe opacity: mass, consolidation or atelectasis (NIH 00022192_003, «Mass» label)",
 "Descrivi l'opacità, indicala sull'immagine e scegli il passo successivo.": "Describe the opacity, mark it on the image and choose the next step.",
 "Un'opacità che riempie il lobo superiore destro e si ferma con un margine netto e orizzontale è delimitata dalla scissura orizzontale. Le cause principali sono tre: consolidazione (polmonite: volume conservato, broncogramma aereo), atelettasia (perdita di volume: scissura che sale, ilo e trachea tirati verso l'alto e verso destra) e massa. Una massa all'ilo che chiude il bronco dà un'atelettasia con il margine a «S» (segno di Golden): è il quadro da non perdere nell'anziano fumatore. Per questo un'opacità del lobo superiore a questa età si studia con la TC con mezzo di contrasto; se si tratta come polmonite, la RX di controllo dopo 6-8 settimane è obbligatoria, perché una «polmonite che non guarisce» può nascondere un tumore.":
 "An opacity that fills the right upper lobe and stops with a sharp horizontal margin is bounded by the horizontal fissure. There are three main causes: consolidation (pneumonia: volume preserved, air bronchogram), atelectasis (volume loss: fissure moves up, hilum and trachea pulled upwards and to the right) and mass. A hilar mass obstructing the bronchus causes atelectasis with an «S»-shaped margin (Golden sign): the picture not to miss in an elderly smoker. That is why an upper lobe opacity at this age is studied with contrast-enhanced CT; if it is treated as pneumonia, a follow-up X-ray after 6-8 weeks is mandatory, because a «pneumonia that does not resolve» may hide a tumour.",
 "Opacità lobare nell'anziano: cerca perdita di volume e massa all'ilo; poi TC, oppure controllo obbligato dopo l'antibiotico.": "Lobar opacity in the elderly: look for volume loss and a hilar mass; then CT, or a mandatory follow-up after antibiotics.",
 "Opacità del campo polmonare superiore destro con margine inferiore netto e orizzontale (sulla scissura orizzontale)": "Opacity of the right upper lung zone with a sharp, horizontal lower margin (along the horizontal fissure)",
 "Dalla sola RX non si distingue tra massa, consolidazione e atelettasia del lobo superiore destro: serve un altro esame": "The X-ray alone cannot distinguish mass, consolidation and atelectasis of the right upper lobe: another test is needed",
 "Opacità del lobo superiore destro in un paziente di 73 anni: TC del torace con mezzo di contrasto per cercare una massa (anche dentro o dietro un'atelettasia) e, se c'è, stadiarla": "Right upper lobe opacity in a 73-year-old patient: contrast-enhanced chest CT to look for a mass (also within or behind an atelectasis) and, if present, stage it",
 "Riquadro dei radiologi del NIH nel campo superiore destro (etichetta «Mass»).": "Box drawn by the NIH radiologists in the right upper zone («Mass» label).",
 "Opacità lobo superiore destro": "Right upper lobe opacity"})

# percorsi: nuovo percorso del primo anno e casi nei percorsi esistenti
NUOVI = {'torace': ['caso-tcia-%d' % n for n in range(166, 172)], 'normale': ['caso-tcia-166', 'caso-tcia-174'], 'msk': ['caso-tcia-172', 'caso-tcia-173', 'caso-tcia-174']}
IT = {'id': 'rx-primo-anno', 'titolo': 'Primo anno: RX del torace e dello scheletro',
      'descrizione': 'Le radiografie che si refertano dal primo giorno: un torace normale e i quadri più comuni, fratture e una radiografia senza fratture. Si legge sempre con lo stesso ordine.',
      'casi': ['caso-tcia-%d' % n for n in range(166, 175)] + ['caso-tcia-098', 'caso-tcia-099']}
EN = dict(IT, titolo='First year: chest and skeletal X-rays',
          descrizione='The X-rays you report from day one: a normal chest and the most common patterns, fractures and an X-ray without fractures. Always read in the same order.')
for f, nuovo in ((W + 'percorsi.json', IT), (W + 'lingua/en/percorsi.json', EN)):
    raw = open(f).read(); p = json.loads(raw)
    if not any(x['id'] == 'rx-primo-anno' for x in p):
        k = next(i for i, x in enumerate(p) if x['id'] == 'base'); p.insert(k + 1, nuovo)
    for x in p:
        for c in NUOVI.get(x['id'], []):
            if c not in x['casi']: x['casi'].append(c)
    open(f, 'w').write(json.dumps(p, ensure_ascii=False, indent=1) + ('\n' if raw.endswith('\n') else ''))
print('ok')
