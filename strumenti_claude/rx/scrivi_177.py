# scrivi_177.py: caso simulato di emorragia intraparenchimale del putamen destro su TC encefalo normale
# (TotalSegmentator v2 s0103, CC BY 4.0). Immagini già in casi-free/caso-tcia-177 (strumenti_claude/sim/emorragia).
# Scrive caso.json, la traduzione inglese e aggiunge il caso ai percorsi urgenze, neuro e simulati.
import json
B = '/Volumes/Caloggero/piattaforma-quiz/'
C = B + 'casi-free/caso-tcia-177/'
T = {}  # italiano -> inglese


def t(it, en):
    T[it] = en
    return it


def opz(it, en, corretta, tipo, sezione, nota=None, nota_en=None):
    o = {'testo': t(it, en), 'corretta': corretta, 'tipo': tipo, 'sezione': sezione}
    if nota:
        o['nota'] = t(nota, nota_en)
    return o


c = {
    'id': 'caso-tcia-177',
    'visibile': True,
    'aggiornato': '2026-11-26 21:40',
    'titolo': t('🧪 SIMULATO – TC encefalo senza mdc: deficit improvviso di forza a sinistra in uomo iperteso',
                '🧪 SIMULATED – Non-contrast head CT: sudden left-sided weakness in a hypertensive man'),
    'titolo_interno': t('Caso simulato: ematoma intraparenchimale acuto del putamen destro (circa 6 ml) con lieve edema perilesionale, senza spostamento della linea mediana né sangue nei ventricoli (TotalSegmentator s0103, immagini modificate)',
                        'Simulated case: acute intraparenchymal haematoma of the right putamen (about 6 ml) with mild perilesional oedema, without midline shift or intraventricular blood (TotalSegmentator s0103, modified images)'),
    'distretto': 'Encefalo',
    'quesito': t('sospetto ictus', 'suspected stroke'),
    'modalita': 'TC',
    'difficolta': 'Base',
    'anamnesi': t("CASO SIMULATO: la TC è vera (archivio pubblico, encefalo normale), l'emorragia è stata aggiunta al computer; storia clinica di fantasia. Uomo di 41 anni, iperteso, non segue la terapia. Da circa un'ora debolezza improvvisa del braccio e della gamba di sinistra, bocca storta e parola impastata. In Pronto soccorso: PA 215/120 mmHg, glicemia normale, nessun trauma. Attivato il percorso ictus: TC dell'encefalo senza mezzo di contrasto prima di decidere la terapia.",
                  "SIMULATED CASE: the CT is real (public archive, normal brain), the haemorrhage was added by computer; the clinical history is fictional. 41-year-old man, hypertensive, not taking his treatment. For about an hour, sudden weakness of the left arm and leg, facial droop and slurred speech. In the Emergency department: BP 215/120 mmHg, normal blood glucose, no trauma. Stroke pathway activated: non-contrast head CT before deciding on treatment."),
    'domanda': t("C'è sangue? Se sì, dove, quanto e che cosa cambia per la terapia?",
                 'Is there blood? If so, where, how much, and what does it change for treatment?'),
    'sezioni': [
        {'nome': t('Reperti', 'Findings'), 'domanda': t('Che cosa vedi?', 'What do you see?')},
        {'nome': t('Conclusioni', 'Conclusions'), 'domanda': t('Qual è la conclusione?', 'What is the conclusion?'), 'singola': True},
    ],
    'opzioni': [
        opz("Area spontaneamente iperdensa (circa 60-65 HU) nel putamen destro, ovalare, circa 3 × 2 cm sul piano assiale e 2,4 cm in altezza: ematoma intraparenchimale acuto di circa 6 ml",
            'Spontaneously hyperdense area (about 60-65 HU) in the right putamen, oval, about 3 × 2 cm in the axial plane and 2.4 cm high: acute intraparenchymal haematoma of about 6 ml',
            True, 'principale', 0,
            "Immagini circa 52-67 (vista a 60). Volume con la formula A×B×C/2: 3 × 2 × 2,4 / 2 ≈ 7 ml; quello della maschera simulata è 6,2 ml.",
            'Images about 52-67 (view at 60). Volume with the A×B×C/2 formula: 3 × 2 × 2.4 / 2 ≈ 7 ml; the simulated mask is 6.2 ml.'),
        opz("Sottile alone ipodenso attorno all'ematoma (edema); linea mediana in asse, nessun sangue nei ventricoli, cisterne libere",
            'Thin hypodense rim around the haematoma (oedema); midline central, no blood in the ventricles, cisterns clear',
            True, 'secondario', 0),
        opz("Ipodensità estesa del territorio della cerebrale media con perdita del nastro insulare",
            'Extensive hypodensity of the middle cerebral artery territory with loss of the insular ribbon',
            False, 'distrattore', 0),
        opz("Raccolta a semiluna sulla convessità, sotto la teca", 'Crescent-shaped collection over the convexity, under the skull',
            False, 'distrattore', 0),
        opz("Iperdensità lineari nei solchi e nelle cisterne della base (subaracnoidea)",
            'Linear hyperdensities in the sulci and basal cisterns (subarachnoid)',
            False, 'distrattore', 0),
        opz("Calcificazioni simmetriche dei nuclei della base, di nessun significato in acuto",
            'Symmetric calcifications of the basal ganglia, of no significance in the acute setting',
            False, 'distrattore', 0),
        opz("Emorragia intraparenchimale acuta del putamen destro (circa 6 ml), sede tipica dell'origine ipertensiva: trombolisi controindicata; comunicare subito al medico del Pronto soccorso e al neurologo",
            'Acute intraparenchymal haemorrhage of the right putamen (about 6 ml), typical site of hypertensive origin: thrombolysis contraindicated; report immediately to the Emergency physician and the neurologist',
            True, 'secondario', 1),
        opz("Ictus ischemico senza segni precoci: avviare la trombolisi endovenosa",
            'Ischaemic stroke without early signs: start intravenous thrombolysis',
            False, 'distrattore', 1),
        opz("Esame negativo: ripetere fra 24 ore", 'Negative scan: repeat in 24 hours', False, 'distrattore', 1),
        opz("Tumore cerebrale: RM con gadolinio programmata", 'Brain tumour: scheduled gadolinium MRI', False, 'distrattore', 1),
    ],
    'spiegazione': t("Nel sospetto ictus la prima domanda alla TC senza contrasto è: c'è sangue? Il sangue acuto è iperdenso (circa 50-80 HU) rispetto al parenchima (30-40 HU) e si vede meglio con una finestra stretta (centro 35-40, ampiezza 40-80). Se c'è un'emorragia la trombolisi è controindicata e cambia tutto il percorso: controllo rapido della pressione, correzione di eventuali anticoagulanti, valutazione neurochirurgica. Nel referto servono sede, volume (formula A×B×C/2: i tre diametri massimi in cm moltiplicati e divisi per due), estensione nei ventricoli, effetto massa e spostamento della linea mediana, idrocefalo. Putamen, talamo, ponte e cervelletto sono le sedi tipiche dell'emorragia ipertensiva; una sede lobare in un giovane o un aspetto atipico fanno cercare altre cause (malformazioni vascolari, trombosi venosa, tumore) con angio-TC o RM. Qui l'ematoma è piccolo, senza sangue nei ventricoli né spostamento: prognosi relativamente buona, ma va comunicato subito.",
                     "In suspected stroke, the first question on non-contrast CT is: is there blood? Acute blood is hyperdense (about 50-80 HU) compared with brain parenchyma (30-40 HU) and is best seen with a narrow window (centre 35-40, width 40-80). If there is haemorrhage, thrombolysis is contraindicated and the whole pathway changes: rapid blood pressure control, reversal of any anticoagulants, neurosurgical assessment. The report must give the site, volume (A×B×C/2 formula: the three largest diameters in cm multiplied and divided by two), ventricular extension, mass effect and midline shift, hydrocephalus. Putamen, thalamus, pons and cerebellum are the typical sites of hypertensive haemorrhage; a lobar site in a young patient or an atypical appearance prompts a search for other causes (vascular malformations, venous thrombosis, tumour) with CT angiography or MRI. Here the haematoma is small, with no intraventricular blood or shift: relatively good prognosis, but it must be reported immediately."),
    'regola': t("Sospetto ictus: prima di tutto escludi il sangue (finestra stretta); se c'è, misura il volume con A×B×C/2 e cerca ventricoli, effetto massa e linea mediana.",
                'Suspected stroke: first exclude blood (narrow window); if present, measure the volume with A×B×C/2 and check ventricles, mass effect and midline.'),
    'esito_clinico': {'tipo': 'altro', 'testo': t("Caso simulato: ematoma del putamen destro aggiunto al computer su una TC dell'encefalo senza patologia (TotalSegmentator s0103, uomo di 41 anni, TC per politrauma).",
                                                  'Simulated case: right putaminal haematoma added by computer to a head CT without disease (TotalSegmentator s0103, 41-year-old man, polytrauma CT).')},
    'fonte': {
        'archivio': 'Zenodo (TotalSegmentator v2), non TCIA',
        'collezione': 'TotalSegmentator dataset v2.0.1',
        'soggetto': 's0103 (immagini modificate)',
        'doi': '10.5281/zenodo.10047292',
        'licenza': 'CC BY 4.0',
        'licenza_url': 'https://creativecommons.org/licenses/by/4.0/',
        'citazione': 'Wasserthal J. et al. (2023). TotalSegmentator: Robust Segmentation of 104 Anatomic Structures in CT Images. Radiology: Artificial Intelligence 5(5):e230024. Dataset v2.0.1, Zenodo, https://doi.org/10.5281/zenodo.10047292. Immagini modificate per la didattica: ematoma intraparenchimale aggiunto al computer (caso simulato).',
        'url': 'https://zenodo.org/records/10047292',
        'nota': "Volume NIfTI della collezione (ricampionato a 1,5 mm) convertito in DICOM da radio-quiz.it: non è un DICOM originale.",
    },
    'serie_iniziale': 0,
    'riquadri': 1,
    'checklist': 'obbligatoria',
    'vista': {'serie': 0, 'idx': 60, 'wc': 40, 'ww': 80, 'zoom': 1, 'panX': 0, 'panY': 0,
              'segno': {'a': {'x': 68, 'y': 77}, 'b': {'x': 73, 'y': 94}},
              'nota': t('Ematoma iperdenso nel putamen destro, circa 2,7 cm in questa sezione', 'Hyperdense haematoma in the right putamen, about 2.7 cm on this slice')},
    'comunicazione': {
        'livello': 'immediata', 'accettabili': ['urgente'], 'destinatari': ['ps', 'richiedente'],
        'parole': ['emorragia', 'ematoma', 'trombolisi'],
        'motivo': t("Emorragia cerebrale in un paziente nel percorso ictus: va detta subito a voce al medico del Pronto soccorso (e al neurologo) perché esclude la trombolisi e richiede il controllo immediato della pressione; poi va scritta nel referto.",
                    'Brain haemorrhage in a patient on the stroke pathway: it must be told immediately by voice to the Emergency physician (and the neurologist) because it rules out thrombolysis and requires immediate blood pressure control; then it is written in the report.'),
    },
    'richiesta': {'reparto': t('Pronto soccorso', 'Emergency department'), 'priorita': 'PS',
                  'lab': [[t('Glicemia', 'Blood glucose'), t('112 mg/dL (dato di fantasia)', '112 mg/dL (fictional value)')],
                          [t('INR', 'INR'), t('1,0 (dato di fantasia)', '1.0 (fictional value)')]],
                  'allergie': '', 'farmaci': t('Amlodipina, assunta in modo irregolare', 'Amlodipine, taken irregularly'),
                  'dispositivi': '', 'gravidanza': ''},
    'nota_docente': "CASO SIMULATO creato da Claude il 26/11/2026. Base: TotalSegmentator v2.0.1 s0103 (Zenodo 10047292, CC BY 4.0; meta.csv: uomo di 41 anni, «ct polytrauma head», nessuna patologia), volume 178×178×117 a 1,5 mm isotropi, convertito in DICOM con strumenti_claude/sim/emorragia (prepara.py, simula.py, scrivi_dicom.py) e anonimizza.py. Simulazione: ellissoide irregolare nel putamen destro centrato a colonna 71, riga 86, immagine 60 (dall'alto), semiassi circa 15 × 9 × 10,5 mm ruotato di 12°, 63 HU ± 4 con il rumore originale; edema perilesionale -7 HU solo nel parenchima; nessun effetto massa simulato (piccolo volume). Diametri della maschera: AP 31,5 mm, LL 21 mm, CC 24 mm, 6,2 ml. Limiti: risoluzione 1,5 mm (immagini meno nitide di una TC clinica). NON ancora rivisto dal medico.",
}

json.dump(c, open(C + 'caso.json', 'w'), ensure_ascii=False, indent=1)
json.dump(T, open(B + 'cloud/web/lingua/casi/caso-tcia-177.json', 'w'), ensure_ascii=False)
Ti = json.load(open(B + 'cloud/web/lingua/casi/_titoli.json'))
Ti[c['titolo']] = T[c['titolo']]
Ti[c['quesito']] = T[c['quesito']]
json.dump(Ti, open(B + 'cloud/web/lingua/casi/_titoli.json', 'w'), ensure_ascii=False)
for f, ind in (('cloud/web/percorsi.json', 1), ('cloud/web/lingua/en/percorsi.json', None)):
    p = json.load(open(B + f))
    for x in p:
        if x['id'] in ('urgenze', 'neuro', 'simulati') and 'caso-tcia-177' not in x['casi']:
            x['casi'].append('caso-tcia-177')
    json.dump(p, open(B + f, 'w'), ensure_ascii=False, indent=ind)
print('ok', len(T))
