# scrivi_178_181.py (28/11/2026): tre RM dell'encefalo dalla collezione ReMIND (TCIA, CC BY 4.0) e una TC simulata
# (infarto della cerebrale media sinistra su TotalSegmentator s0103, CC BY 4.0). Immagini già in casi-free (anonimizza.py,
# specchia_radiologica.py, strumenti_claude/sim/ischemia). Scrive caso.json, la traduzione inglese, i titoli e i percorsi.
import json
B = '/Volumes/Caloggero/piattaforma-quiz/'
AGG = '2026-11-28 12:30'


def nuovo():
    T = {}

    def t(it, en):
        T[it] = en
        return it

    def opz(it, en, corretta, tipo, sezione, nota=None, nota_en=None):
        o = {'testo': t(it, en), 'corretta': corretta, 'tipo': tipo, 'sezione': sezione}
        if nota:
            o['nota'] = t(nota, nota_en)
        return o
    return T, t, opz


SEZ = lambda t: [{'nome': t('Reperti', 'Findings'), 'domanda': t('Che cosa vedi?', 'What do you see?')},
                 {'nome': t('Conclusioni', 'Conclusions'), 'domanda': t('Qual è la conclusione?', 'What is the conclusion?'), 'singola': True}]
REMIND = lambda sogg: {
    'archivio': 'The Cancer Imaging Archive (TCIA)', 'collezione': 'ReMIND (Brain Resection Multimodal Imaging Database)',
    'doi': '10.7937/3RAG-D070', 'licenza': 'CC BY 4.0', 'licenza_url': 'https://creativecommons.org/licenses/by/4.0/',
    'citazione': 'Juvekar P., Dorent R., Kögl F., et al. (2023). The Brain Resection Multimodal Imaging Database (ReMIND) (Version 1) [Data set]. The Cancer Imaging Archive. https://doi.org/10.7937/3RAG-D070',
    'url': 'https://www.cancerimagingarchive.net/collection/remind/', 'soggetto': sogg}
casi = []

# ---------------------------------------------------------------- 178: oligodendroglioma temporale sinistro (ReMIND-109)
T, t, opz = nuovo()
c = {
    'id': 'caso-tcia-178', 'visibile': True, 'aggiornato': AGG,
    'titolo': t('RM encefalo: lesione temporale sinistra in uomo di 51 anni', 'Brain MRI: left temporal lesion in a 51-year-old man'),
    'titolo_interno': t('Oligodendroglioma IDH-mutato con codelezione 1p/19q, grado 2 OMS, del giro temporale medio sinistro (ReMIND-109)',
                        'IDH-mutant, 1p/19q-codeleted oligodendroglioma, WHO grade 2, of the left middle temporal gyrus (ReMIND-109)'),
    'distretto': 'Encefalo', 'modalita': 'RM', 'difficolta': 'Intermedio',
    'quesito': t('caratterizzazione di lesione encefalica', 'characterisation of a brain lesion'),
    'anamnesi': t("Uomo di 51 anni. RM dell'encefalo con mezzo di contrasto a 3 T prima dell'intervento (T1 3D dopo mdc, FLAIR 3D, T2 3D). Nessun intervento precedente sull'encefalo.",
                  'A 51-year-old man. Contrast-enhanced 3 T brain MRI before surgery (post-contrast 3D T1, 3D FLAIR, 3D T2). No previous brain surgery.'),
    'domanda': t("Descrivi la lesione e indica l'ipotesi più probabile.", 'Describe the lesion and give the most likely diagnosis.'),
    'sezioni': SEZ(t),
    'opzioni': [
        opz("Lesione cortico-sottocorticale del lobo temporale sinistro, nel giro temporale medio, circa 6 × 3 × 3 cm (circa 23 mL), iperintensa in T2 e FLAIR",
            'Cortical-subcortical lesion of the left temporal lobe, in the middle temporal gyrus, about 6 × 3 × 3 cm (about 23 mL), hyperintense on T2 and FLAIR',
            True, 'principale', 0, 'Segmentazione degli esperti della collezione: 23,3 mL, circa 57 × 29 mm sul piano assiale.', 'Expert segmentation from the collection: 23.3 mL, about 57 × 29 mm in the axial plane.'),
        opz('Componenti cistiche nella lesione, ben visibili in T2', 'Cystic components within the lesion, well seen on T2', True, 'secondario', 0),
        opz('Impregnazione dopo contrasto presente ma modesta e disomogenea', 'Contrast enhancement present but mild and heterogeneous', True, 'secondario', 0,
            'Negli oligodendrogliomi l\'impregnazione è frequente anche nel grado 2: da sola non indica un grado alto.', 'In oligodendrogliomas enhancement is common even in grade 2: on its own it does not indicate a high grade.'),
        opz('Lieve effetto massa, senza edema perilesionale esteso né spostamento della linea mediana', 'Mild mass effect, without extensive perilesional oedema or midline shift', True, 'secondario', 0),
        opz('Lesione extra-assiale a base durale con coda durale', 'Extra-axial dural-based lesion with a dural tail', False, 'distrattore', 0),
        opz('Lesioni multiple alla giunzione tra grigia e bianca con ampio edema vasogenico', 'Multiple lesions at the grey-white junction with extensive vasogenic oedema', False, 'distrattore', 0),
        opz('Area triangolare a base corticale nel territorio della cerebrale media, senza effetto massa', 'Wedge-shaped cortical-based area in the middle cerebral artery territory, without mass effect', False, 'distrattore', 0),
        opz("Glioma a crescita lenta con coinvolgimento corticale: sospetto oligodendroglioma; servono istologia e profilo molecolare (IDH, 1p/19q)",
            'Slow-growing glioma with cortical involvement: suspected oligodendroglioma; histology and molecular profile (IDH, 1p/19q) are needed',
            True, 'secondario', 1),
        opz('Ascesso cerebrale', 'Brain abscess', False, 'distrattore', 1),
        opz('Metastasi singola', 'Single metastasis', False, 'distrattore', 1),
        opz('Infarto ischemico subacuto', 'Subacute ischaemic infarct', False, 'distrattore', 1),
    ],
    'spiegazione': t("Lesione intra-assiale che coinvolge la corteccia e la sostanza bianca sottostante del giro temporale medio sinistro, con cisti e impregnazione modesta, in un adulto di mezza età: il quadro tipico dell'oligodendroglioma. Dal 2021 (classificazione OMS dei tumori del sistema nervoso centrale, 5ª edizione) la diagnosi è molecolare: IDH mutato e codelezione 1p/19q. Le calcificazioni sono frequenti: si cercano alla TC o nelle sequenze di suscettibilità.\nNel referto: sede precisa (giro e lobo: usa l'atlante dell'encefalo dopo la risposta), rapporto con le aree del linguaggio dell'emisfero sinistro, dimensioni, impregnazione, effetto massa.",
                     'Intra-axial lesion involving the cortex and underlying white matter of the left middle temporal gyrus, with cysts and mild enhancement, in a middle-aged adult: the typical picture of oligodendroglioma. Since 2021 (WHO classification of CNS tumours, 5th edition) the diagnosis is molecular: IDH-mutant and 1p/19q-codeleted. Calcifications are common: look for them on CT or susceptibility sequences.\nIn the report: precise site (gyrus and lobe: use the brain atlas after answering), relation to the language areas of the left hemisphere, size, enhancement, mass effect.'),
    'regola': t('Glioma che arriva alla corteccia, con cisti o calcificazioni, in un adulto: pensa all\'oligodendroglioma.', 'A glioma reaching the cortex, with cysts or calcifications, in an adult: think of oligodendroglioma.'),
    'esito_clinico': {'tipo': 'istologia', 'testo': t('Oligodendroglioma, IDH-mutato e con codelezione 1p/19q, grado 2 OMS (dati della collezione ReMIND). Resezione con RM intraoperatoria.',
                                                      'Oligodendroglioma, IDH-mutant and 1p/19q-codeleted, WHO grade 2 (ReMIND collection data). Resection with intraoperative MRI.')},
    'fonte': REMIND('ReMIND-109'), 'serie_iniziale': 1, 'riquadri': 2, 'disposizione': [1, 0], 'checklist': 'obbligatoria',
    'vista': {'serie': 1, 'idx': 149, 'zoom': 1, 'panX': 0, 'panY': 0, 'nota': t('Lesione del giro temporale medio sinistro', 'Lesion of the left middle temporal gyrus')},
    'comunicazione': {'livello': 'differita', 'accettabili': ['nessuna'], 'destinatari': ['richiedente'], 'parole': ['glioma'],
                      'motivo': t('Lesione nota in valutazione prima dell\'intervento, senza segni di urgenza: referto nei tempi normali.', 'Known lesion assessed before surgery, without urgent signs: report in the normal time frame.')},
    'nota_docente': "Caso creato da Claude il 28/11/2026. ReMIND-109 (TCIA, CC BY 4.0), studio preoperatorio: T1 3D dopo mdc, FLAIR 3D, T2 3D (RM Philips Achieva 3 T secondo la tabella clinica). Specchiate in convenzione radiologica. Clinica della collezione: M51, Left Middle Temporal Gyrus, oligodendroglioma IDH+ 1p/19q codeleto MGMT metilato, OMS 2, enhancement sì, eloquente, gyral e subgyral, 23,3 mL. Segmentazione esperta: 57 × 29 mm assiale, 32 mm cranio-caudale; massima nella T1 all'immagine 157, nella FLAIR all'immagine 149. Lettura di Claude: cisti in T2, impregnazione modesta e disomogenea, nessun edema esteso. Serie usata anche per le prove dell'atlante su RM Philips (segnalazione del 28/11). NON ancora rivisto dal medico.",
}
casi.append((c, T, ['neuro', 'oncologia']))

# ---------------------------------------------------------------- 179: astrocitoma insulare destro già operato (ReMIND-048)
T, t, opz = nuovo()
c = {
    'id': 'caso-tcia-179', 'visibile': True, 'aggiornato': AGG,
    'titolo': t('RM encefalo: controllo dopo intervento per glioma insulare destro in uomo di 38 anni', 'Brain MRI: follow-up after surgery for a right insular glioma in a 38-year-old man'),
    'titolo_interno': t('Astrocitoma IDH-mutato, grado 2 OMS, residuo o recidiva attorno alla cavità chirurgica insulare destra (ReMIND-048)',
                        'IDH-mutant astrocytoma, WHO grade 2, residual or recurrent tumour around the right insular surgical cavity (ReMIND-048)'),
    'distretto': 'Encefalo', 'modalita': 'RM', 'difficolta': 'Intermedio',
    'quesito': t('controllo dopo intervento per glioma', 'follow-up after glioma surgery'),
    'anamnesi': t("Uomo di 38 anni, già operato (craniotomia) per un glioma insulare destro. RM dell'encefalo con mezzo di contrasto a 3 T prima di un nuovo intervento (T2 e FLAIR assiali, T1 3D dopo mdc).",
                  'A 38-year-old man, previously operated on (craniotomy) for a right insular glioma. Contrast-enhanced 3 T brain MRI before a new operation (axial T2 and FLAIR, post-contrast 3D T1).'),
    'domanda': t('Che cosa vedi attorno alla zona operata? È tumore?', 'What do you see around the operated area? Is it tumour?'),
    'sezioni': SEZ(t),
    'opzioni': [
        opz("Area iperintensa in T2 e FLAIR a margini sfumati nell'insula e nell'opercolo destri, circa 4 × 4 cm, attorno alla cavità chirurgica",
            'Ill-defined T2 and FLAIR hyperintense area in the right insula and operculum, about 4 × 4 cm, around the surgical cavity',
            True, 'principale', 0, 'Segmentazione degli esperti: 13,3 mL, circa 4,4 × 4 cm sul piano assiale.', 'Expert segmentation: 13.3 mL, about 4.4 × 4 cm in the axial plane.'),
        opz('Piccola cavità di resezione con liquor (circa 2,5 mL)', 'Small resection cavity filled with CSF (about 2.5 mL)', True, 'secondario', 0),
        opz('Nessuna impregnazione patologica dopo mezzo di contrasto', 'No abnormal contrast enhancement', True, 'secondario', 0),
        opz('Raccolta ematica acuta nella cavità chirurgica', 'Acute blood collection in the surgical cavity', False, 'distrattore', 0),
        opz('Impregnazione nodulare spessa con necrosi centrale', 'Thick nodular enhancement with central necrosis', False, 'distrattore', 0),
        opz('Raccolta con impregnazione ad anello e contenuto denso', 'Ring-enhancing collection with dense content', False, 'distrattore', 0),
        opz("Residuo o recidiva di glioma a basso grado non captante attorno alla cavità chirurgica", 'Non-enhancing low-grade glioma residue or recurrence around the surgical cavity', True, 'secondario', 1),
        opz('Solo esiti chirurgici (gliosi), nessun tumore', 'Post-surgical changes only (gliosis), no tumour', False, 'distrattore', 1),
        opz('Ascesso postoperatorio', 'Postoperative abscess', False, 'distrattore', 1),
        opz('Trasformazione in glioblastoma', 'Transformation into glioblastoma', False, 'distrattore', 1),
    ],
    'spiegazione': t("Dopo l'intervento per un glioma a basso grado non captante, il tumore residuo o recidivo si vede come iperintensità in T2 e FLAIR, a margini sfumati, attorno alla cavità: confronta sempre con l'esame precedente. La gliosi è più sottile e regolare lungo i margini della cavità e non cresce nel tempo. Una nuova impregnazione nodulare o la crescita rapida suggeriscono la trasformazione verso un grado più alto: qui non c'è impregnazione.\nNel referto: estensione rispetto alla cavità, sedi funzionali vicine (insula, opercolo, capsula interna), impregnazione, confronto con il controllo precedente.",
                     'After surgery for a non-enhancing low-grade glioma, residual or recurrent tumour appears as ill-defined T2 and FLAIR hyperintensity around the cavity: always compare with the previous scan. Gliosis is thinner and more regular along the cavity margins and does not grow over time. New nodular enhancement or rapid growth suggests transformation towards a higher grade: here there is no enhancement.\nIn the report: extent relative to the cavity, nearby functional sites (insula, operculum, internal capsule), enhancement, comparison with the previous follow-up.'),
    'regola': t('Glioma a basso grado operato: segui la FLAIR attorno alla cavità e cerca nuove impregnazioni.', 'Operated low-grade glioma: follow the FLAIR around the cavity and look for new enhancement.'),
    'esito_clinico': {'tipo': 'istologia', 'testo': t('Astrocitoma IDH-mutato, grado 2 OMS (dati della collezione ReMIND). Nuova resezione con RM intraoperatoria.',
                                                      'IDH-mutant astrocytoma, WHO grade 2 (ReMIND collection data). Repeat resection with intraoperative MRI.')},
    'fonte': REMIND('ReMIND-048'), 'serie_iniziale': 1, 'riquadri': 2, 'disposizione': [1, 2], 'checklist': 'obbligatoria',
    'vista': {'serie': 1, 'idx': 19, 'zoom': 1, 'panX': 0, 'panY': 0, 'nota': t('Iperintensità FLAIR insulare destra attorno alla cavità', 'Right insular FLAIR hyperintensity around the cavity')},
    'comunicazione': {'livello': 'differita', 'accettabili': ['nessuna'], 'destinatari': ['richiedente'], 'parole': ['recidiva', 'residuo', 'glioma'],
                      'motivo': t('Controllo programmato prima dell\'intervento, senza segni di urgenza.', 'Scheduled pre-operative follow-up, without urgent signs.')},
    'nota_docente': "Caso creato da Claude il 28/11/2026. ReMIND-048 (TCIA, CC BY 4.0), studio preoperatorio: T2 e FLAIR 2D assiali, T1 3D dopo mdc (RM Philips Ingenia 3 T secondo la tabella clinica). Specchiate in convenzione radiologica. Clinica della collezione: M38, Right Insular, craniotomia precedente, astrocitoma IDH+ OMS 2, enhancement no, 13,3 mL. Segmentazioni esperte: tumore 13,3 mL (44 × 40 mm assiale, massimo nella FLAIR all'immagine 19); cavità di resezione precedente 2,5 mL, adiacente (FLAIR immagine 17). La conclusione «residuo o recidiva» è di Claude: la collezione non dice se è residuo o recidiva. NON ancora rivisto dal medico.",
}
casi.append((c, T, ['neuro', 'oncologia']))

# ---------------------------------------------------------------- 180: astrocitoma insulare destro voluminoso (ReMIND-026)
T, t, opz = nuovo()
c = {
    'id': 'caso-tcia-180', 'visibile': True, 'aggiornato': AGG,
    'titolo': t('RM encefalo: grande lesione fronto-insulare destra in uomo di 27 anni', 'Brain MRI: large right fronto-insular lesion in a 27-year-old man'),
    'titolo_interno': t('Astrocitoma IDH-mutato, grado 2 OMS, insulare destro di circa 68 mL (ReMIND-026)', 'IDH-mutant astrocytoma, WHO grade 2, right insular, about 68 mL (ReMIND-026)'),
    'distretto': 'Encefalo', 'modalita': 'RM', 'difficolta': 'Base',
    'quesito': t('caratterizzazione di lesione encefalica', 'characterisation of a brain lesion'),
    'anamnesi': t("Uomo di 27 anni. RM dell'encefalo con mezzo di contrasto a 1,5 T prima dell'intervento (T1 3D dopo mdc, FLAIR 3D sagittale). Nessun intervento precedente sull'encefalo.",
                  'A 27-year-old man. Contrast-enhanced 1.5 T brain MRI before surgery (post-contrast 3D T1, sagittal 3D FLAIR). No previous brain surgery.'),
    'domanda': t("Descrivi la lesione e indica l'ipotesi più probabile.", 'Describe the lesion and give the most likely diagnosis.'),
    'sezioni': SEZ(t),
    'opzioni': [
        opz("Voluminosa lesione dell'insula e dell'opercolo frontale destri, circa 7 × 5 × 6 cm (circa 68 mL), omogeneamente iperintensa in FLAIR e ipointensa in T1",
            'Large lesion of the right insula and frontal operculum, about 7 × 5 × 6 cm (about 68 mL), homogeneously hyperintense on FLAIR and hypointense on T1',
            True, 'principale', 0, 'Segmentazione degli esperti: 68,3 mL, circa 73 × 47 × 64 mm.', 'Expert segmentation: 68.3 mL, about 73 × 47 × 64 mm.'),
        opz('Nessuna impregnazione dopo mezzo di contrasto', 'No contrast enhancement', True, 'secondario', 0),
        opz('Effetto massa sul ventricolo laterale destro', 'Mass effect on the right lateral ventricle', True, 'secondario', 0),
        opz('Impregnazione ad anello con necrosi centrale ed edema vasogenico', 'Ring enhancement with central necrosis and vasogenic oedema', False, 'distrattore', 0),
        opz('Lesione extra-assiale con coda durale', 'Extra-axial lesion with a dural tail', False, 'distrattore', 0),
        opz('Sangue acuto nella lesione', 'Acute blood within the lesion', False, 'distrattore', 0),
        opz("Voluminosa lesione dell'insula destra non captante: glioma diffuso a basso grado, sospetto astrocitoma IDH-mutato; servono istologia e profilo molecolare", 'Large non-enhancing lesion of the right insula: diffuse low-grade glioma, suspected IDH-mutant astrocytoma; histology and molecular profile are needed', True, 'secondario', 1),
        opz('Glioblastoma', 'Glioblastoma', False, 'distrattore', 1),
        opz('Linfoma primitivo del sistema nervoso centrale', 'Primary central nervous system lymphoma', False, 'distrattore', 1),
        opz('Infarto subacuto della cerebrale media destra', 'Subacute right middle cerebral artery infarct', False, 'distrattore', 1),
    ],
    'spiegazione': t("Massa omogenea, non captante, ipointensa in T1 e iperintensa in FLAIR, che espande l'insula e l'opercolo in un giovane adulto: il quadro tipico del glioma diffuso a basso grado, spesso IDH-mutato. L'insula è una sede frequente. Non è un infarto: c'è effetto massa e la forma non segue un territorio arterioso (prova l'atlante dei territori dopo la risposta). Il glioblastoma ha di solito impregnazione ad anello e necrosi; il linfoma è captante in modo omogeneo e periventricolare.\nNel referto: sede e volume, rapporto con capsula interna, nuclei della base e vasi lenticolostriati, effetto massa.",
                     "A homogeneous, non-enhancing mass, hypointense on T1 and hyperintense on FLAIR, expanding the insula and operculum in a young adult: the typical picture of diffuse low-grade glioma, often IDH-mutant. The insula is a common site. It is not an infarct: there is mass effect and the shape does not follow an arterial territory (try the territories atlas after answering). Glioblastoma usually shows ring enhancement and necrosis; lymphoma enhances homogeneously and lies periventricularly.\nIn the report: site and volume, relation to the internal capsule, basal ganglia and lenticulostriate vessels, mass effect."),
    'regola': t('Massa non captante in FLAIR in un giovane adulto: glioma a basso grado finché non si dimostra il contrario.', 'Non-enhancing FLAIR mass in a young adult: low-grade glioma until proven otherwise.'),
    'esito_clinico': {'tipo': 'istologia', 'testo': t('Astrocitoma IDH-mutato, grado 2 OMS (dati della collezione ReMIND). Resezione con RM intraoperatoria.',
                                                      'IDH-mutant astrocytoma, WHO grade 2 (ReMIND collection data). Resection with intraoperative MRI.')},
    'fonte': REMIND('ReMIND-026'), 'serie_iniziale': 1, 'riquadri': 2, 'disposizione': [1, 0], 'checklist': 'obbligatoria',
    'vista': {'serie': 1, 'idx': 118, 'zoom': 1, 'panX': 0, 'panY': 0, 'nota': t('Massa insulare destra iperintensa in FLAIR', 'Right insular FLAIR-hyperintense mass')},
    'comunicazione': {'livello': 'differita', 'accettabili': ['urgente'], 'destinatari': ['richiedente'], 'parole': ['glioma'],
                      'motivo': t('Lesione voluminosa senza erniazione: comunicazione nei tempi brevi.', 'Large lesion without herniation: report promptly.')},
    'nota_docente': "Caso creato da Claude il 28/11/2026. ReMIND-026 (TCIA, CC BY 4.0), studio preoperatorio: T1 3D dopo mdc (specchiata in convenzione radiologica) e FLAIR 3D sagittale (RM Siemens Avanto 1,5 T secondo la tabella clinica). Clinica della collezione: M27, Right Insular, astrocitoma IDH+ OMS 2, enhancement no, 68,3 mL. Segmentazione esperta: 73 × 47 × 64 mm; massima nella T1 all'immagine 65, nella FLAIR sagittale all'immagine 118. È la stessa situazione della segnalazione del 28/11 (FLAIR 3D sagittale a 1,5 T): serve anche come prova dell'atlante. NON ancora rivisto dal medico.",
}
casi.append((c, T, ['neuro', 'oncologia']))

# ---------------------------------------------------------------- 181: infarto della cerebrale media sinistra (simulato)
T, t, opz = nuovo()
c = {
    'id': 'caso-tcia-181', 'visibile': True, 'aggiornato': AGG,
    'titolo': t('🧪 SIMULATO – TC encefalo senza mdc: al risveglio non riesce a parlare e muove male la mano destra',
                '🧪 SIMULATED – Non-contrast head CT: on waking he cannot speak and his right hand is weak'),
    'titolo_interno': t('Caso simulato: infarto acuto della divisione superiore della cerebrale media sinistra (insula, opercolo frontale e convessità frontale anteriore), ASPECTS circa 7, senza emorragia (TotalSegmentator s0103, immagini modificate)',
                        'Simulated case: acute infarct of the superior division of the left middle cerebral artery (insula, frontal operculum and anterior frontal convexity), ASPECTS about 7, without haemorrhage (TotalSegmentator s0103, modified images)'),
    'distretto': 'Encefalo', 'modalita': 'TC', 'difficolta': 'Intermedio',
    'quesito': t('sospetto ictus', 'suspected stroke'),
    'anamnesi': t("CASO SIMULATO: la TC è vera (archivio pubblico, encefalo normale), l'infarto è stato aggiunto al computer; storia clinica di fantasia. Uomo di 41 anni. Si è svegliato alle 8 senza riuscire a parlare, con la bocca storta e la mano destra debole; stava bene alle 23 della sera prima, quando è andato a dormire. TC dell'encefalo senza contrasto alle 8:40.",
                  "SIMULATED CASE: the CT is real (public archive, normal brain), the infarct was added by computer; the clinical history is fictional. A 41-year-old man. He woke at 8 am unable to speak, with a drooping mouth and a weak right hand; he was well at 11 pm the evening before, when he went to sleep. Non-contrast head CT at 8:40 am."),
    'domanda': t("Che cosa vedi? Calcola l'ASPECTS e di' che cosa serve adesso.", 'What do you see? Calculate the ASPECTS and say what is needed now.'),
    'sezioni': SEZ(t),
    'opzioni': [
        opz("Ipodensità con perdita della differenziazione tra grigia e bianca nell'insula e nell'opercolo frontale sinistri (scomparsa del nastro insulare)",
            'Hypodensity with loss of grey-white differentiation in the left insula and frontal operculum (loss of the insular ribbon)', True, 'principale', 0,
            "Immagini circa 46-60 con finestra stretta (centro 35, ampiezza 40). Nell'esame originale i due lati erano uguali.", 'Images about 46-60 with a narrow window (centre 35, width 40). In the original scan both sides were the same.'),
        opz('Ipodensità corticale e sottocorticale della parte anteriore della convessità frontale sinistra, sopra i nuclei della base, con solchi meno visibili',
            'Cortical and subcortical hypodensity of the anterior left frontal convexity, above the basal ganglia, with less visible sulci', True, 'secondario', 0),
        opz('Nuclei della base, capsula interna, lobi temporale e parietale risparmiati; nessuna emorragia', 'Basal ganglia, internal capsule, temporal and parietal lobes spared; no haemorrhage', True, 'secondario', 0),
        opz("Ematoma iperdenso nei nuclei della base", 'Hyperdense haematoma in the basal ganglia', False, 'distrattore', 0),
        opz('Ipodensità della faccia mediale del lobo frontale (territorio della cerebrale anteriore)', 'Hypodensity of the medial surface of the frontal lobe (anterior cerebral artery territory)', False, 'distrattore', 0),
        opz('Ipodensità del lobo occipitale (territorio della cerebrale posteriore)', 'Hypodensity of the occipital lobe (posterior cerebral artery territory)', False, 'distrattore', 0),
        opz("Infarto acuto della divisione superiore della cerebrale media sinistra, ASPECTS circa 7 (insula, M1, M4), senza sangue: subito angio-TC (e perfusione) per cercare un'occlusione di un grosso vaso e decidere sulla trombectomia; comunicare subito al neurologo",
            'Acute infarct of the superior division of the left middle cerebral artery, ASPECTS about 7 (insula, M1, M4), no blood: immediate CT angiography (and perfusion) to look for a large-vessel occlusion and decide on thrombectomy; report immediately to the neurologist',
            True, 'secondario', 1),
        opz('Esame negativo, siamo nelle 4 ore e mezza: trombolisi subito senza altri esami', 'Negative scan, within 4.5 hours: thrombolysis now without further imaging', False, 'distrattore', 1),
        opz('Emorragia cerebrale: trombolisi controindicata', 'Brain haemorrhage: thrombolysis contraindicated', False, 'distrattore', 1),
        opz('Tumore cerebrale: RM con gadolinio programmata', 'Brain tumour: scheduled gadolinium MRI', False, 'distrattore', 1),
    ],
    'spiegazione': t("Nell'ictus al risveglio l'ora di esordio è sconosciuta: conta l'ultima volta in cui il paziente era visto bene (qui 9 ore e mezza prima). La TC senza contrasto esclude il sangue e cerca i segni precoci di ischemia: perdita del nastro insulare, sfumatura dei nuclei della base, ipodensità della corteccia e solchi meno visibili. L'ASPECTS divide il territorio della cerebrale media in 10 regioni (caudato, lenticolare, capsula interna, insula, M1-M3 al livello dei nuclei della base, M4-M6 sopra) e toglie un punto per ognuna colpita: qui insula, M1 e M4, quindi circa 7. Con ASPECTS di 6 o più e un'occlusione di un grosso vaso all'angio-TC la trombectomia è possibile anche oltre le 6 ore (fino a 24 ore con i criteri di selezione); la trombolisi oltre le 4 ore e mezza richiede la selezione con RM o perfusione.\nUsa l'atlante dei territori arteriosi dopo la risposta: l'ipodensità cade nei territori frontale e insulare della cerebrale media sinistra.",
                     "In wake-up stroke the time of onset is unknown: what counts is the last time the patient was seen well (here 9.5 hours earlier). Non-contrast CT excludes blood and looks for early ischaemic signs: loss of the insular ribbon, blurring of the basal ganglia, cortical hypodensity and less visible sulci. ASPECTS divides the middle cerebral artery territory into 10 regions (caudate, lentiform, internal capsule, insula, M1-M3 at the basal ganglia level, M4-M6 above) and subtracts one point for each affected region: here insula, M1 and M4, so about 7. With ASPECTS 6 or more and a large-vessel occlusion on CT angiography, thrombectomy is possible beyond 6 hours (up to 24 hours with selection criteria); thrombolysis beyond 4.5 hours requires selection with MRI or perfusion.\nUse the arterial territory atlas after answering: the hypodensity falls in the frontal and insular territories of the left middle cerebral artery."),
    'regola': t("Sospetto ictus: escludi il sangue, cerca il nastro insulare e conta l'ASPECTS; poi subito angio-TC.", 'Suspected stroke: exclude blood, check the insular ribbon and count the ASPECTS; then CT angiography straight away.'),
    'esito_clinico': {'tipo': 'altro', 'testo': t("Caso simulato: ipodensità ischemica della divisione superiore della cerebrale media sinistra aggiunta al computer su una TC dell'encefalo senza patologia (TotalSegmentator s0103, uomo di 41 anni, TC per politrauma).",
                                                  'Simulated case: ischaemic hypodensity of the superior division of the left middle cerebral artery added by computer to a head CT without disease (TotalSegmentator s0103, 41-year-old man, polytrauma CT).')},
    'fonte': {'archivio': 'Zenodo (TotalSegmentator v2), non TCIA', 'collezione': 'TotalSegmentator dataset v2.0.1', 'soggetto': 's0103 (immagini modificate)',
              'doi': '10.5281/zenodo.10047292', 'licenza': 'CC BY 4.0', 'licenza_url': 'https://creativecommons.org/licenses/by/4.0/',
              'citazione': 'Wasserthal J. et al. (2023). TotalSegmentator: Robust Segmentation of 104 Anatomic Structures in CT Images. Radiology: Artificial Intelligence 5(5):e230024. Dataset v2.0.1, Zenodo, https://doi.org/10.5281/zenodo.10047292. Immagini modificate per la didattica: infarto ischemico aggiunto al computer (caso simulato).',
              'url': 'https://zenodo.org/records/10047292',
              'nota': 'Volume NIfTI della collezione (ricampionato a 1,5 mm) convertito in DICOM da radio-quiz.it: non è un DICOM originale.'},
    'serie_iniziale': 0, 'riquadri': 1, 'checklist': 'obbligatoria',
    'vista': {'serie': 0, 'idx': 56, 'wc': 35, 'ww': 40, 'zoom': 1, 'panX': 0, 'panY': 0,
              'nota': t('Insula e opercolo frontale sinistri ipodensi, nastro insulare scomparso', 'Hypodense left insula and frontal operculum, insular ribbon lost')},
    'comunicazione': {'livello': 'immediata', 'accettabili': ['urgente'], 'destinatari': ['ps', 'richiedente'], 'parole': ['ischemia', 'infarto', 'ASPECTS', 'angio'],
                      'motivo': t("Ictus acuto: il neurologo deve saperlo subito (niente sangue, segni precoci, ASPECTS) per decidere su angio-TC e trombectomia.",
                                  'Acute stroke: the neurologist must know immediately (no blood, early signs, ASPECTS) to decide on CT angiography and thrombectomy.')},
    'richiesta': {'reparto': t('Pronto soccorso', 'Emergency department'), 'priorita': 'PS',
                  'lab': [[t('Glicemia', 'Blood glucose'), t('104 mg/dL (dato di fantasia)', '104 mg/dL (fictional value)')]],
                  'allergie': '', 'farmaci': t('Nessuno', 'None'), 'dispositivi': '', 'gravidanza': ''},
    'nota_docente': "CASO SIMULATO creato da Claude il 28/11/2026. Base: TotalSegmentator v2.0.1 s0103 (la stessa TC del caso 177, CC BY 4.0), 178×178×117 a 1,5 mm. Simulazione (strumenti_claude/sim/ischemia/simula.py): territori JHU «ACM frontale sin» (solo il 40% anteriore dell'emisfero) e «ACM insulare sin» portati sulla TC dall'atlante del visualizzatore; esclusi nuclei della base e capsula interna (oltre 28 mm dalla linea mediana a quel livello); corteccia -11 HU e bianca -4 HU circa (media 36,5 → 27 HU), solchi +10 HU, bordi sfumati e irregolari, rumore originale conservato; 53 mL. ASPECTS voluto: insula, M1, M4 = 7 (il confine M4/M5 è approssimativo). La conclusione su angio-TC e trombectomia segue le linee guida (ultimo visto bene a 9,5 ore). NON ancora rivisto dal medico.",
}
casi.append((c, T, ['urgenze', 'neuro', 'simulati']))

Ti = json.load(open(B + 'cloud/web/lingua/casi/_titoli.json'))
for c, T, percorsi in casi:
    json.dump(c, open(B + 'casi-free/' + c['id'] + '/caso.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(T, open(B + 'cloud/web/lingua/casi/' + c['id'] + '.json', 'w'), ensure_ascii=False)
    Ti[c['titolo']] = T[c['titolo']]; Ti[c['quesito']] = T[c['quesito']]
    for f, ind in (('cloud/web/percorsi.json', 1), ('cloud/web/lingua/en/percorsi.json', None)):
        p = json.load(open(B + f))
        for x in p:
            if x['id'] in percorsi and c['id'] not in x['casi']:
                x['casi'].append(c['id'])
        json.dump(p, open(B + f, 'w'), ensure_ascii=False, indent=ind)
    print('ok', c['id'], len(T))
json.dump(Ti, open(B + 'cloud/web/lingua/casi/_titoli.json', 'w'), ensure_ascii=False)
