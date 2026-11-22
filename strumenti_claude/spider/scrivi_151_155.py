#!/usr/bin/env python3
"""Scrive caso.json e traduzione inglese dei casi 151-155 (RM lombari SPIDER, convertite da MHA).
Ogni testo ha la sua traduzione: le coppie (italiano, inglese) sono qui sotto; il file inglese è {italiano: inglese}."""
import json, os, datetime
R = '/Volumes/Caloggero/piattaforma-quiz/'
ORA = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
EN = {}
def t(it, en): EN[it] = en; return it

CITAZIONE = ("van der Graaf J.W., van Hooff M.L., Buckens C.F.M., Rutten M., van Susante J.L.C., Kroeze R.J., de Kleuver M., van Ginneken B., Lessmann N. (2024). "
             "Lumbar spine segmentation in MR images: a dataset and a public benchmark. Scientific Data 11, 264. https://doi.org/10.1038/s41597-024-03090-w. "
             "Dati: SPIDER, Zenodo, doi:10.5281/zenodo.10159290.")
def fonte(paz):
    return {"archivio": "Zenodo (Scientific Data), non TCIA", "collezione": "SPIDER – Lumbar spine segmentation in MR images",
            "soggetto": f"paziente {paz} (file {paz}_t1 e {paz}_t2)", "doi": "10.5281/zenodo.10159290", "licenza": "CC BY 4.0",
            "licenza_url": "https://creativecommons.org/licenses/by/4.0/", "citazione": CITAZIONE, "url": "https://zenodo.org/records/10159290",
            "nota": ("Immagini convertite da MHA in DICOM da radio-quiz.it: non sono DICOM originali. Pixel e spaziatura invariati; in molte serie "
                     "le intensità sono già normalizzate nella collezione. Risposte di riferimento: gradazioni per livello di un radiologo "
                     "muscoloscheletrico della collezione (26 anni di esperienza). Età e dati clinici oltre alla lombalgia non disponibili.")}

ANAM_M = t("Uomo con storia di lombalgia. RM del rachide lombare senza mezzo di contrasto: T1 e T2 sagittali. Età e altri dati clinici non disponibili nella collezione.",
           "Man with a history of low back pain. Lumbar spine MRI without contrast: sagittal T1 and T2. Age and other clinical data are not available in the collection.")
NOTA_COMUNE = ("Caso creato da Claude il 22/11/2026 dalla collezione SPIDER (Zenodo 10159290, CC BY 4.0), convertita da MHA in DICOM con "
               "strumenti_claude/spider/spider2dcm.py (orientamento dalla matrice di direzione, pixel invariati); testi da "
               "strumenti_claude/spider/scrivi_151_155.py. Livelli contati dal sacro (le etichette della collezione sono posizionali: disco 1 = "
               "sotto la vertebra lombare più bassa). Reperti controllati sulle immagini con le maschere della collezione sovrapposte. "
               "NON ancora rivisto dal medico.")
SEZ_LIVELLO = [t("Livello", "Level"), t("Come si individua il livello?", "How do you identify the level?")]
OPZ_LIVELLO = lambda giusto_it, giusto_en: [
    {"testo": t(giusto_it, giusto_en), "corretta": True, "tipo": "secondario",
     "nota": t("Nelle sagittali lombari si parte dal sacro (S1, prima vertebra fusa) e si sale. Con una vertebra di transizione lombosacrale il conteggio va confermato con le coste o con le immagini del rachide dorsale: le sole sagittali lombari non bastano.",
               "On lumbar sagittal images you start from the sacrum (S1, the first fused vertebra) and count upwards. With a lumbosacral transitional vertebra the count must be confirmed with the ribs or with thoracic spine images: lumbar sagittals alone are not enough.")},
    {"testo": t("Si contano i dischi dall'alto partendo dal primo disco visibile nell'immagine",
                "Count the discs from the top, starting from the first disc visible in the image"), "corretta": False, "tipo": "distrattore",
     "nota": t("Il primo disco in alto dipende da dove è centrato il campo di vista: può essere D11-D12 o D12-L1. Il riferimento sicuro è il sacro.",
               "The top disc depends on where the field of view is centred: it may be T11-T12 or T12-L1. The reliable landmark is the sacrum.")}]

casi = {}

# ---------------------------------------------------------------- 151: paziente 12, ernia L4-L5
casi['151'] = dict(
    titolo=t("Lombalgia in RM (1/5): uomo, T1 e T2 sagittali", "Low back pain on MRI (1/5): man, sagittal T1 and T2"),
    titolo_interno=t("Discopatia L4-L5 con ernia discale posteriore, disco disidratato e ridotto in altezza (Pfirrmann 4); altri dischi conservati (SPIDER 12)",
                     "L4-L5 disc disease with posterior disc herniation, desiccated and narrowed disc (Pfirrmann 4); other discs preserved (SPIDER 12)"),
    distretto="Rachide", quesito="lombalgia", modalita="RM", difficolta="Base", anamnesi=ANAM_M,
    domanda=t("Guarda i dischi lombari: quale livello è patologico e come lo descrivi?", "Look at the lumbar discs: which level is abnormal and how do you describe it?"),
    sezioni=[{"nome": t("Reperti", "Findings"), "domanda": t("Che cosa vedi?", "What do you see?")},
             {"nome": SEZ_LIVELLO[0], "domanda": SEZ_LIVELLO[1], "singola": True},
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la conclusione più adatta?", "What is the most appropriate conclusion?"), "singola": True}],
    opzioni=[
        {"testo": t("Disco L4-L5 disidratato (scuro in T2) e ridotto in altezza, con ernia posteriore che impronta il sacco durale",
                    "Desiccated L4-L5 disc (dark on T2) with loss of height and a posterior herniation indenting the thecal sac"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Serie 1 (T2), immagini centrali 7-9: il disco L4-L5 ha perso il segnale chiaro del nucleo, è più basso degli altri e il margine posteriore sporge nel canale. Gradazione della collezione: ernia, riduzione di altezza, Pfirrmann 4.",
                   "Series 1 (T2), central images 7-9: the L4-L5 disc has lost the bright nuclear signal, is lower than the others and its posterior margin bulges into the canal. Collection grading: herniation, disc narrowing, Pfirrmann 4.")},
        {"testo": t("Gli altri dischi lombari conservano altezza e segnale del nucleo in T2", "The other lumbar discs keep their height and nuclear T2 signal"),
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": t("Pfirrmann 2 negli altri livelli; a L5-S1 la collezione segnala solo una lieve protrusione diffusa (bulging).",
                   "Pfirrmann 2 at the other levels; at L5-S1 the collection reports only a mild diffuse bulge.")},
        {"testo": t("Frattura da compressione del corpo di L4 con edema del midollo osseo", "Compression fracture of the L4 body with bone marrow oedema"),
         "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("I corpi vertebrali hanno altezza e segnale conservati; il reperto è nel disco.", "The vertebral bodies have normal height and signal; the finding is in the disc.")},
        {"testo": t("Ernia L5-S1 con disco L4-L5 normale", "L5-S1 herniation with a normal L4-L5 disc"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("È il livello sopra: contando dal sacro il disco patologico è il secondo, L4-L5.", "It is the level above: counting from the sacrum the abnormal disc is the second one, L4-L5.")},
        *[dict(o, sezione=1) for o in OPZ_LIVELLO("Si contano i dischi dal sacro verso l'alto: il disco patologico è il secondo, L4-L5",
                                                  "Count the discs from the sacrum upwards: the abnormal disc is the second one, L4-L5")],
        {"testo": t("Discopatia degenerativa L4-L5 con ernia discale posteriore; gli altri livelli sono conservati",
                    "Degenerative L4-L5 disc disease with a posterior disc herniation; the other levels are preserved"),
         "corretta": True, "tipo": "secondario", "sezione": 2},
        {"testo": t("Spondilodiscite L4-L5: serve un esame con mezzo di contrasto urgente", "L4-L5 spondylodiscitis: an urgent contrast-enhanced study is needed"),
         "corretta": False, "tipo": "distrattore", "sezione": 2,
         "nota": t("Nella spondilodiscite i piatti vertebrali sono erosi e i corpi vicini hanno edema (scuri in T1, chiari in T2); qui i piatti sono netti e il segnale osseo è normale.",
                   "In spondylodiscitis the endplates are eroded and the adjacent bodies show oedema (dark on T1, bright on T2); here the endplates are sharp and the bone signal is normal.")},
        {"testo": t("Esame negativo", "Normal study"), "corretta": False, "tipo": "distrattore", "sezione": 2},
    ],
    spiegazione=t(
        "Nella RM lombare si legge un livello alla volta: altezza del disco, segnale del nucleo in T2, margine posteriore, piatti vertebrali e midollo osseo vicino, canale e forami.\n"
        "Un disco sano ha il nucleo chiaro in T2. Con la degenerazione perde acqua e diventa scuro e più basso: la scala di Pfirrmann va da 1 (normale) a 5 (disco collassato, nero).\n"
        "Protrusione diffusa (bulging) e ernia non sono la stessa cosa: il bulging coinvolge più del 25% della circonferenza del disco, l'ernia è uno spostamento localizzato del materiale discale (protrusione o estrusione). Il lato dell'ernia e il rapporto con le radici si vedono nelle immagini assiali, che questa collezione non ha.\n"
        "Le ernie sono frequenti anche nelle persone senza dolore: il reperto conta se corrisponde ai sintomi (per esempio una sciatica nel territorio della radice compressa).",
        "On lumbar MRI you read one level at a time: disc height, nuclear signal on T2, posterior margin, endplates and the adjacent bone marrow, canal and foramina.\n"
        "A healthy disc has a bright nucleus on T2. With degeneration it loses water and becomes dark and lower: the Pfirrmann scale goes from 1 (normal) to 5 (collapsed, black disc).\n"
        "A diffuse bulge and a herniation are not the same thing: a bulge involves more than 25% of the disc circumference, a herniation is a localised displacement of disc material (protrusion or extrusion). The side of the herniation and its relation to the nerve roots are seen on axial images, which this collection does not include.\n"
        "Herniations are common in people without pain too: the finding matters if it matches the symptoms (for example sciatica in the territory of the compressed root)."),
    regola=t("Conta i livelli dal sacro, poi guarda ogni disco: altezza, segnale in T2, margine posteriore.",
             "Count the levels from the sacrum, then check each disc: height, T2 signal, posterior margin."),
    esito_clinico={"tipo": "altro", "testo": t(
        "Gradazioni del radiologo muscoloscheletrico della collezione SPIDER: L4-L5 ernia, riduzione di altezza, Pfirrmann 4; L5-S1 lieve protrusione diffusa, Pfirrmann 2; livelli superiori Pfirrmann 2, senza alterazioni.",
        "Grading by the SPIDER collection musculoskeletal radiologist: L4-L5 herniation, disc narrowing, Pfirrmann 4; L5-S1 mild diffuse bulge, Pfirrmann 2; upper levels Pfirrmann 2, no changes.")},
    fonte=fonte(12), serie_iniziale=1, riquadri=2,
    vista={"serie": 1, "idx": 8, "zoom": 1, "panX": 0, "panY": 0, "nota": t("T2 sagittale mediana: disco L4-L5 scuro e basso, con ernia posteriore",
                                                                              "Midline sagittal T2: dark, narrowed L4-L5 disc with a posterior herniation")},
    nota_docente=NOTA_COMUNE + " Paziente SPIDER 12 (M, Siemens 1,5 T); la serie T1 e la T2 avevano origini destra-sinistra fuori scala nella collezione: ricentrate.")

# ---------------------------------------------------------------- 152: paziente 95, ernia L5-S1
casi['152'] = dict(
    titolo=t("Lombalgia in RM (2/5): uomo, T1 e T2 sagittali a 3 T", "Low back pain on MRI (2/5): man, sagittal T1 and T2 at 3 T"),
    titolo_interno=t("Ernia discale posteriore L5-S1 con disco meno idratato (Pfirrmann 3); gli altri dischi normali (Pfirrmann 1) (SPIDER 95)",
                     "Posterior L5-S1 disc herniation with a less hydrated disc (Pfirrmann 3); other discs normal (Pfirrmann 1) (SPIDER 95)"),
    distretto="Rachide", quesito="lombalgia", modalita="RM", difficolta="Base", anamnesi=ANAM_M,
    domanda=t("Descrivi i dischi e indica il livello del reperto principale.", "Describe the discs and give the level of the main finding."),
    sezioni=[{"nome": t("Reperti", "Findings"), "domanda": t("Che cosa vedi?", "What do you see?")},
             {"nome": SEZ_LIVELLO[0], "domanda": SEZ_LIVELLO[1], "singola": True},
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la conclusione più adatta?", "What is the most appropriate conclusion?"), "singola": True}],
    opzioni=[
        {"testo": t("Ernia discale posteriore L5-S1 che impronta il sacco durale, con disco meno chiaro in T2 degli altri",
                    "Posterior L5-S1 disc herniation indenting the thecal sac, with the disc less bright on T2 than the others"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Serie 1 (T2), immagini 10-12: il margine posteriore del disco L5-S1 sporge nel canale e il segnale del nucleo è ridotto. Gradazione della collezione: ernia, Pfirrmann 3 (anche alterazioni dei piatti di tipo Modic 2, poco evidenti in queste immagini).",
                   "Series 1 (T2), images 10-12: the posterior margin of the L5-S1 disc bulges into the canal and the nuclear signal is reduced. Collection grading: herniation, Pfirrmann 3 (also Modic type 2 endplate changes, hardly visible on these images).")},
        {"testo": t("Dischi da L1-L2 a L4-L5 normali: nucleo chiaro in T2 e altezza conservata", "Discs from L1-L2 to L4-L5 normal: bright nucleus on T2 and preserved height"),
         "corretta": True, "tipo": "secondario", "sezione": 0, "nota": t("Pfirrmann 1 in tutti i livelli superiori.", "Pfirrmann 1 at all upper levels.")},
        {"testo": t("Stenosi del canale su più livelli con ipertrofia dei legamenti gialli", "Multilevel canal stenosis with ligamentum flavum hypertrophy"),
         "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Il canale è ampio ai livelli superiori; il reperto è limitato a L5-S1.", "The canal is wide at the upper levels; the finding is limited to L5-S1.")},
        {"testo": t("Anterolistesi di L5 su S1", "Anterolisthesis of L5 on S1"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("I muri posteriori di L5 e di S1 sono allineati.", "The posterior walls of L5 and S1 are aligned.")},
        *[dict(o, sezione=1) for o in OPZ_LIVELLO("Si contano i dischi dal sacro: il disco patologico è il primo, tra L5 e S1",
                                                  "Count the discs from the sacrum: the abnormal disc is the first one, between L5 and S1")],
        {"testo": t("Ernia discale posteriore L5-S1; gli altri dischi lombari sono normali", "Posterior L5-S1 disc herniation; the other lumbar discs are normal"),
         "corretta": True, "tipo": "secondario", "sezione": 2},
        {"testo": t("Discopatia degenerativa diffusa su tutti i livelli", "Diffuse degenerative disc disease at all levels"), "corretta": False, "tipo": "distrattore", "sezione": 2,
         "nota": t("Solo L5-S1 è alterato: gli altri dischi sono normali.", "Only L5-S1 is abnormal: the other discs are normal.")},
        {"testo": t("Esame negativo", "Normal study"), "corretta": False, "tipo": "distrattore", "sezione": 2},
    ],
    spiegazione=t(
        "L5-S1 e L4-L5 sono i livelli più colpiti dalle ernie lombari. Un'ernia L5-S1 posterolaterale comprime di solito la radice S1 (dolore e alterazioni della sensibilità nella parte posteriore della gamba e sul bordo laterale del piede, riflesso achilleo ridotto); un'ernia foraminale dello stesso livello comprime invece L5.\n"
        "Per dire il lato e quale radice è compressa servono le immagini assiali: nelle sole sagittali si vede che il disco sporge nel canale, non da che parte.\n"
        "Un disco che perde segnale in T2 a un solo livello, con gli altri normali, indica una degenerazione localizzata, spesso proprio nel livello dell'ernia.",
        "L5-S1 and L4-L5 are the levels most often affected by lumbar herniations. A posterolateral L5-S1 herniation usually compresses the S1 root (pain and sensory changes in the back of the leg and the lateral edge of the foot, reduced ankle reflex); a foraminal herniation at the same level compresses L5 instead.\n"
        "To tell the side and which root is compressed you need axial images: on sagittal images alone you see that the disc bulges into the canal, not to which side.\n"
        "A disc losing T2 signal at a single level, with the others normal, indicates localised degeneration, often at the level of the herniation."),
    regola=t("Sagittali: livello e sporgenza; assiali: lato e radice.", "Sagittals: level and protrusion; axials: side and root."),
    esito_clinico={"tipo": "altro", "testo": t(
        "Gradazioni del radiologo muscoloscheletrico della collezione SPIDER: L5-S1 ernia, alterazioni dei piatti di tipo Modic 2, Pfirrmann 3; livelli superiori Pfirrmann 1, senza alterazioni.",
        "Grading by the SPIDER collection musculoskeletal radiologist: L5-S1 herniation, Modic type 2 endplate changes, Pfirrmann 3; upper levels Pfirrmann 1, no changes.")},
    fonte=fonte(95), serie_iniziale=1, riquadri=2,
    vista={"serie": 1, "idx": 11, "zoom": 1, "panX": 0, "panY": 0, "nota": t("T2 sagittale: ernia posteriore L5-S1", "Sagittal T2: posterior L5-S1 herniation")},
    nota_docente=NOTA_COMUNE + " Paziente SPIDER 95 (M, Philips 3 T). Il Modic 2 di L5-S1 della gradazione non si vede chiaramente su queste immagini normalizzate: citato solo nella nota e nell'esito, non come risposta.")

# ---------------------------------------------------------------- 153: paziente 7, anterolistesi L5-S1
casi['153'] = dict(
    titolo=t("Lombalgia in RM (3/5): uomo, guarda l'allineamento", "Low back pain on MRI (3/5): man, check the alignment"),
    titolo_interno=t("Anterolistesi di L5 su S1 di grado I con disco L5-S1 collassato (Pfirrmann 5); degenerazione L4-L5 con Modic 2 (SPIDER 7)",
                     "Grade I anterolisthesis of L5 on S1 with a collapsed L5-S1 disc (Pfirrmann 5); L4-L5 degeneration with Modic 2 (SPIDER 7)"),
    distretto="Rachide", quesito="lombalgia", modalita="RM", difficolta="Intermedio", anamnesi=ANAM_M,
    domanda=t("Valuta l'allineamento dei muri posteriori e i dischi lombari bassi.", "Assess the alignment of the posterior walls and the lower lumbar discs."),
    sezioni=[{"nome": t("Reperti", "Findings"), "domanda": t("Che cosa vedi?", "What do you see?")},
             {"nome": t("Grado", "Grade"), "domanda": t("Come si gradua lo scivolamento?", "How is the slip graded?"), "singola": True},
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la conclusione più adatta?", "What is the most appropriate conclusion?"), "singola": True}],
    opzioni=[
        {"testo": t("L5 scivolata in avanti rispetto a S1 (anterolistesi), con il disco L5-S1 assottigliato e scuro",
                    "L5 slipped forward relative to S1 (anterolisthesis), with a thin, dark L5-S1 disc"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Serie 1 (T2), immagini 7-10: il muro posteriore di L5 è davanti a quello di S1 di circa 5-7 mm; il disco L5-S1 è molto basso e nero (Pfirrmann 5 nella gradazione della collezione).",
                   "Series 1 (T2), images 7-10: the posterior wall of L5 lies about 5-7 mm in front of that of S1; the L5-S1 disc is very low and black (Pfirrmann 5 in the collection grading).")},
        {"testo": t("Disco L4-L5 degenerato con alterazioni dei piatti vicini (chiari in T1: Modic 2)", "Degenerated L4-L5 disc with changes of the adjacent endplates (bright on T1: Modic 2)"),
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": t("Serie 0 (T1), immagini 6-8: banda chiara sotto il piatto inferiore di L4. Modic 2 = sostituzione adiposa del midollo osseo vicino al piatto (chiaro in T1 e in T2); Modic 1 = edema (scuro in T1, chiaro in T2); Modic 3 = sclerosi (scuro in entrambe).",
                   "Series 0 (T1), images 6-8: bright band below the inferior endplate of L4. Modic 2 = fatty replacement of the marrow next to the endplate (bright on T1 and T2); Modic 1 = oedema (dark on T1, bright on T2); Modic 3 = sclerosis (dark on both).")},
        {"testo": t("Frattura da compressione di L5", "Compression fracture of L5"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("L5 ha altezza conservata: è spostata in avanti, non schiacciata.", "L5 has preserved height: it is displaced forwards, not compressed.")},
        {"testo": t("Retrolistesi di L4 su L5", "Retrolisthesis of L4 on L5"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Lo scivolamento è a L5-S1 ed è in avanti.", "The slip is at L5-S1 and it is forwards.")},
        {"testo": t("Grado I di Meyerding: scivolamento fino al 25% del piatto superiore di S1", "Meyerding grade I: slip up to 25% of the S1 superior endplate"),
         "corretta": True, "tipo": "secondario", "sezione": 1,
         "nota": t("Si misura quanto il muro posteriore di L5 è avanzato rispetto a quello di S1, in percentuale della lunghezza del piatto di S1: I fino al 25%, II 25-50%, III 50-75%, IV 75-100%, V oltre (spondiloptosi). Qui circa 15-20%.",
                   "Measure how far the posterior wall of L5 has moved forward relative to that of S1, as a percentage of the S1 endplate length: I up to 25%, II 25-50%, III 50-75%, IV 75-100%, V beyond (spondyloptosis). Here about 15-20%.")},
        {"testo": t("Grado III di Meyerding: oltre metà del piatto", "Meyerding grade III: more than half of the endplate"), "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": t("Lo spostamento è di pochi millimetri, ben sotto metà del piatto.", "The displacement is a few millimetres, well under half of the endplate.")},
        {"testo": t("Anterolistesi di L5 su S1 di grado I con disco L5-S1 collassato; degenerazione L4-L5. Per l'istmo (spondilolisi) servono sagittali paramediane o una TC",
                    "Grade I anterolisthesis of L5 on S1 with a collapsed L5-S1 disc; L4-L5 degeneration. The pars (spondylolysis) needs parasagittal images or CT"),
         "corretta": True, "tipo": "secondario", "sezione": 2},
        {"testo": t("Esame negativo: l'allineamento è normale", "Normal study: alignment is normal"), "corretta": False, "tipo": "distrattore", "sezione": 2},
    ],
    spiegazione=t(
        "La spondilolistesi è lo scivolamento di una vertebra sulla sottostante. Si guarda la linea dei muri posteriori: deve essere continua. Il grado si misura con Meyerding (da I a V, a quarti del piatto della vertebra sotto).\n"
        "Le cause principali sono due: degenerativa (artrosi delle faccette, più spesso a L4-L5, istmo integro) e istmica (spondilolisi, interruzione della pars interarticularis, più spesso a L5-S1). Nella forma istmica l'arco posteriore resta indietro e il canale si allarga; nella degenerativa il canale si restringe.\n"
        "L'istmo si valuta nelle sagittali paramediane e, meglio, in TC; qui la collezione dà solo la presenza della listesi e la RM non permette di concludere sulla causa.\n"
        "Le alterazioni dei piatti di Modic accompagnano la degenerazione del disco: il tipo 1 (edema) è quello più spesso associato a dolore.",
        "Spondylolisthesis is the slip of one vertebra over the one below. Look at the posterior wall line: it should be continuous. The grade is measured with Meyerding (I to V, by quarters of the endplate of the vertebra below).\n"
        "There are two main causes: degenerative (facet arthropathy, most often at L4-L5, intact pars) and isthmic (spondylolysis, a defect of the pars interarticularis, most often at L5-S1). In the isthmic form the posterior arch stays behind and the canal widens; in the degenerative form the canal narrows.\n"
        "The pars is assessed on parasagittal images and, better, on CT; here the collection only gives the presence of the listhesis and the MRI does not allow a conclusion on the cause.\n"
        "Modic endplate changes accompany disc degeneration: type 1 (oedema) is the one most often associated with pain."),
    regola=t("Muri posteriori in fila: se uno scalino c'è, misura il grado e cerca la causa.", "Posterior walls in line: if there is a step, measure the grade and look for the cause."),
    esito_clinico={"tipo": "altro", "testo": t(
        "Gradazioni del radiologo muscoloscheletrico della collezione SPIDER: L5-S1 spondilolistesi, alterazione del piatto inferiore, riduzione di altezza, protrusione, Pfirrmann 5; L4-L5 Modic 2, alterazione del piatto, riduzione di altezza, protrusione, Pfirrmann 5; L3-L4 riduzione di altezza e protrusione, Pfirrmann 3; livelli superiori Pfirrmann 2.",
        "Grading by the SPIDER collection musculoskeletal radiologist: L5-S1 spondylolisthesis, lower endplate change, disc narrowing, bulge, Pfirrmann 5; L4-L5 Modic 2, endplate change, disc narrowing, bulge, Pfirrmann 5; L3-L4 disc narrowing and bulge, Pfirrmann 3; upper levels Pfirrmann 2.")},
    fonte=fonte(7), serie_iniziale=1, riquadri=2,
    vista={"serie": 1, "idx": 8, "zoom": 1, "panX": 0, "panY": 0, "nota": t("T2 sagittale mediana: scalino tra i muri posteriori di L5 e di S1",
                                                                              "Midline sagittal T2: step between the posterior walls of L5 and S1")},
    nota_docente=NOTA_COMUNE + " Paziente SPIDER 7 (M, Siemens 1,5 T): la T2 ha intensità grezze, la T1 normalizzate dalla collezione. Spostamento misurato sulla T2 sagittale mediana (circa 5-7 mm). Istmo non valutato.")

# ---------------------------------------------------------------- 154: paziente 59, degenerazione multilivello con Modic 2
casi['154'] = dict(
    titolo=t("Lombalgia in RM (4/5): uomo, T1 e T2 sagittali a 3 T", "Low back pain on MRI (4/5): man, sagittal T1 and T2 at 3 T"),
    titolo_interno=t("Discopatia degenerativa su tutti i livelli lombari con Modic 2 dei piatti, osteofiti ed ernia L5-S1 (SPIDER 59)",
                     "Degenerative disc disease at all lumbar levels with Modic 2 endplate changes, osteophytes and L5-S1 herniation (SPIDER 59)"),
    distretto="Rachide", quesito="lombalgia", modalita="RM", difficolta="Intermedio", anamnesi=ANAM_M,
    domanda=t("Descrivi dischi, piatti vertebrali e midollo osseo vicino; confronta T1 e T2.", "Describe discs, endplates and the adjacent marrow; compare T1 and T2."),
    sezioni=[{"nome": t("Reperti", "Findings"), "domanda": t("Che cosa vedi?", "What do you see?")},
             {"nome": t("Piatti vertebrali", "Endplates"), "domanda": t("Che tipo di alterazione dei piatti è?", "What type of endplate change is it?"), "singola": True},
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la conclusione più adatta?", "What is the most appropriate conclusion?"), "singola": True}],
    opzioni=[
        {"testo": t("Dischi lombari scuri in T2 e ridotti in altezza a tutti i livelli, con osteofiti marginali", "Lumbar discs dark on T2 and narrowed at all levels, with marginal osteophytes"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Serie 1 (T2), immagini 9-13: nessun disco conserva il nucleo chiaro (Pfirrmann 4 a tutti i livelli nella gradazione della collezione).",
                   "Series 1 (T2), images 9-13: no disc keeps a bright nucleus (Pfirrmann 4 at all levels in the collection grading).")},
        {"testo": t("Bande chiare in T1 lungo i piatti vertebrali di più livelli", "Bright bands on T1 along the endplates at several levels"),
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": t("Serie 0 (T1), immagini 9-13: il midollo osseo sotto e sopra i dischi è più chiaro del resto del corpo vertebrale.",
                   "Series 0 (T1), images 9-13: the marrow above and below the discs is brighter than the rest of the vertebral body.")},
        {"testo": t("Ernia discale posteriore L5-S1", "Posterior L5-S1 disc herniation"), "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": t("Gradazione della collezione: ernia solo a L5-S1.", "Collection grading: herniation only at L5-S1.")},
        {"testo": t("Metastasi vertebrali multiple", "Multiple vertebral metastases"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Le alterazioni seguono i piatti, a banda e in modo simmetrico ai due lati del disco; le metastasi sono focali, scure in T1 e non rispettano questa distribuzione.",
                   "The changes follow the endplates, band-like and symmetric on both sides of the disc; metastases are focal, dark on T1 and do not follow this distribution.")},
        {"testo": t("Modic 2: midollo chiaro in T1 e in T2, sostituzione adiposa", "Modic 2: marrow bright on T1 and T2, fatty replacement"),
         "corretta": True, "tipo": "secondario", "sezione": 1,
         "nota": t("È il tipo più frequente e il più stabile nel tempo.", "It is the most common and the most stable type over time.")},
        {"testo": t("Modic 1: midollo scuro in T1 e chiaro in T2, edema", "Modic 1: marrow dark on T1 and bright on T2, oedema"), "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": t("Qui le bande sono chiare in T1, non scure.", "Here the bands are bright on T1, not dark.")},
        {"testo": t("Modic 3: sclerosi, scuro in T1 e in T2", "Modic 3: sclerosis, dark on T1 and T2"), "corretta": False, "tipo": "distrattore", "sezione": 1},
        {"testo": t("Discopatia degenerativa lombare su tutti i livelli con alterazioni dei piatti di tipo Modic 2 ed ernia L5-S1",
                    "Lumbar degenerative disc disease at all levels with Modic type 2 endplate changes and L5-S1 herniation"),
         "corretta": True, "tipo": "secondario", "sezione": 2},
        {"testo": t("Spondilodiscite su più livelli", "Multilevel spondylodiscitis"), "corretta": False, "tipo": "distrattore", "sezione": 2,
         "nota": t("Nella spondilodiscite il midollo vicino al disco è scuro in T1 (edema) e i piatti sono erosi; qui è chiaro in T1 e i piatti sono netti.",
                   "In spondylodiscitis the marrow next to the disc is dark on T1 (oedema) and the endplates are eroded; here it is bright on T1 and the endplates are sharp.")},
    ],
    spiegazione=t(
        "Le alterazioni di Modic sono cambi del midollo osseo vicino ai piatti vertebrali che accompagnano la degenerazione del disco:\n"
        "tipo 1, edema e infiammazione: scuro in T1, chiaro in T2 (il più associato a dolore, può evolvere);\n"
        "tipo 2, sostituzione adiposa: chiaro in T1 e in T2 (il più frequente, stabile);\n"
        "tipo 3, sclerosi: scuro in T1 e in T2.\n"
        "Il confronto T1-T2 è il punto chiave. Il Modic 1 va distinto dalla spondilodiscite: in entrambi il midollo è scuro in T1, ma nell'infezione i piatti sono erosi, il disco è chiaro in T2 e spesso ci sono raccolte paravertebrali.\n"
        "In un rachide degenerato su tutti i livelli bisogna comunque cercare il livello che può spiegare i sintomi (qui l'ernia L5-S1).",
        "Modic changes are changes of the bone marrow next to the endplates that accompany disc degeneration:\n"
        "type 1, oedema and inflammation: dark on T1, bright on T2 (the most associated with pain, may evolve);\n"
        "type 2, fatty replacement: bright on T1 and T2 (the most common, stable);\n"
        "type 3, sclerosis: dark on T1 and T2.\n"
        "Comparing T1 and T2 is the key. Modic 1 must be told apart from spondylodiscitis: in both the marrow is dark on T1, but in infection the endplates are eroded, the disc is bright on T2 and there are often paravertebral collections.\n"
        "In a spine degenerated at all levels you still need to look for the level that may explain the symptoms (here the L5-S1 herniation)."),
    regola=t("Modic: confronta sempre T1 e T2; chiaro-chiaro = grasso (tipo 2).", "Modic: always compare T1 and T2; bright-bright = fat (type 2)."),
    esito_clinico={"tipo": "altro", "testo": t(
        "Gradazioni del radiologo muscoloscheletrico della collezione SPIDER: tutti e sei i livelli con Modic 2, alterazioni dei piatti superiore e inferiore, riduzione di altezza, protrusione e Pfirrmann 4; ernia a L5-S1.",
        "Grading by the SPIDER collection musculoskeletal radiologist: all six levels with Modic 2, upper and lower endplate changes, disc narrowing, bulge and Pfirrmann 4; herniation at L5-S1.")},
    fonte=fonte(59), serie_iniziale=0, riquadri=2,
    vista={"serie": 0, "idx": 11, "zoom": 1, "panX": 0, "panY": 0, "nota": t("T1 sagittale: bande chiare lungo i piatti (Modic 2) e dischi assottigliati",
                                                                              "Sagittal T1: bright bands along the endplates (Modic 2) and narrowed discs")},
    nota_docente=NOTA_COMUNE + " Paziente SPIDER 59 (M, Philips 3 T). Scelto al posto dei pazienti 154 (Modic 1) e 78 (Modic 3): su quelle immagini normalizzate i Modic 1 e 3 non si riconoscevano con sicurezza. Scartato anche il 186 (volume ricampionato in modo anomalo).")

# ---------------------------------------------------------------- 155: paziente 237, RM normale
casi['155'] = dict(
    titolo=t("Lombalgia in RM (5/5): donna, T1 e T2 sagittali", "Low back pain on MRI (5/5): woman, sagittal T1 and T2"),
    titolo_interno=t("RM lombare normale: dischi idratati a tutti i livelli (Pfirrmann 1), nessuna ernia né alterazione dei piatti (SPIDER 237)",
                     "Normal lumbar MRI: hydrated discs at all levels (Pfirrmann 1), no herniation or endplate changes (SPIDER 237)"),
    distretto="Rachide", quesito="lombalgia", modalita="RM", difficolta="Base",
    anamnesi=t("Donna con storia di lombalgia. RM del rachide lombare senza mezzo di contrasto: T1 sagittale e T2 sagittale con soppressione del grasso. Età e altri dati clinici non disponibili nella collezione.",
               "Woman with a history of low back pain. Lumbar spine MRI without contrast: sagittal T1 and fat-suppressed sagittal T2. Age and other clinical data are not available in the collection."),
    domanda=t("Descrivi dischi, corpi vertebrali e canale; poi dì quando la RM è indicata nella lombalgia.", "Describe discs, vertebral bodies and canal; then say when MRI is indicated in low back pain."),
    sezioni=[{"nome": t("Reperti", "Findings"), "domanda": t("Che cosa vedi?", "What do you see?")},
             {"nome": t("Indicazione", "Indication"), "domanda": t("Quando serve la RM nella lombalgia?", "When is MRI needed in low back pain?"), "singola": True},
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la conclusione più adatta?", "What is the most appropriate conclusion?"), "singola": True}],
    opzioni=[
        {"testo": t("Dischi lombari con nucleo chiaro in T2 e altezza conservata a tutti i livelli", "Lumbar discs with a bright nucleus on T2 and preserved height at all levels"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Serie 1 (T2 con soppressione del grasso), immagini 7-10: tutti i dischi sono chiari e alti (Pfirrmann 1 nella gradazione della collezione).",
                   "Series 1 (fat-suppressed T2), images 7-10: all discs are bright and tall (Pfirrmann 1 in the collection grading).")},
        {"testo": t("Nella T2 con soppressione del grasso il grasso e il midollo osseo sono scuri: un edema dell'osso spiccherebbe come area chiara",
                    "On the fat-suppressed T2 fat and bone marrow are dark: bone oedema would stand out as a bright area"),
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": t("Per questo la T2 con soppressione del grasso (o STIR) è la sequenza da guardare per edema, fratture recenti e Modic 1.",
                   "That is why fat-suppressed T2 (or STIR) is the sequence to check for oedema, recent fractures and Modic 1.")},
        {"testo": t("Ernia discale L5-S1", "L5-S1 disc herniation"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Il margine posteriore dei dischi non sporge nel canale.", "The posterior disc margins do not protrude into the canal.")},
        {"testo": t("Alterazioni dei piatti di tipo Modic 1 a L4-L5", "Modic type 1 endplate changes at L4-L5"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Nessuna area chiara nel midollo vicino ai piatti nella T2 con soppressione del grasso.", "No bright area in the marrow next to the endplates on the fat-suppressed T2.")},
        {"testo": t("Nella lombalgia aspecifica senza segnali d'allarme non serve nelle prime settimane; serve con segnali d'allarme (deficit neurologici, sindrome della cauda equina, febbre, tumore noto, trauma, calo di peso) o se si valuta un intervento",
                    "In non-specific low back pain without red flags it is not needed in the first weeks; it is needed with red flags (neurological deficits, cauda equina syndrome, fever, known cancer, trauma, weight loss) or when surgery is being considered"),
         "corretta": True, "tipo": "secondario", "sezione": 1,
         "nota": t("È l'indicazione delle principali linee guida (per esempio ACR Appropriateness Criteria e NICE): una RM precoce senza segnali d'allarme non migliora l'esito e trova spesso reperti senza importanza clinica.",
                   "This is the recommendation of the main guidelines (for example ACR Appropriateness Criteria and NICE): early MRI without red flags does not improve outcome and often finds clinically irrelevant findings.")},
        {"testo": t("Va fatta subito a ogni episodio di lombalgia, per escludere un'ernia", "It should be done immediately for every episode of low back pain, to rule out a herniation"),
         "corretta": False, "tipo": "distrattore", "sezione": 1},
        {"testo": t("RM del rachide lombare nella norma", "Normal lumbar spine MRI"), "corretta": True, "tipo": "secondario", "sezione": 2},
        {"testo": t("Discopatia degenerativa L4-L5 e L5-S1", "Degenerative disc disease at L4-L5 and L5-S1"), "corretta": False, "tipo": "distrattore", "sezione": 2},
    ],
    spiegazione=t(
        "Sapere com'è una RM lombare normale serve a riconoscere il patologico: dischi alti con nucleo chiaro in T2, muri posteriori allineati, corpi vertebrali con segnale omogeneo, canale ampio con il liquor chiaro in T2.\n"
        "La T2 con soppressione del grasso (o la STIR) rende scuri grasso e midollo osseo normale: così edema, fratture recenti, infezioni e Modic 1 spiccano.\n"
        "Nella maggior parte delle lombalgie la RM non è il primo passo. Le linee guida la riservano ai pazienti con segnali d'allarme o con sintomi che durano nonostante la terapia, quando l'esito può cambiare la gestione. Molte persone senza dolore hanno dischi degenerati o protrusioni: una RM «a tappeto» porta a diagnosi e trattamenti inutili.",
        "Knowing what a normal lumbar MRI looks like helps you recognise disease: tall discs with a bright nucleus on T2, aligned posterior walls, vertebral bodies with homogeneous signal, a wide canal with bright CSF on T2.\n"
        "Fat-suppressed T2 (or STIR) makes fat and normal marrow dark, so that oedema, recent fractures, infection and Modic 1 stand out.\n"
        "In most cases of low back pain MRI is not the first step. Guidelines reserve it for patients with red flags or with symptoms persisting despite treatment, when the result may change management. Many people without pain have degenerated discs or bulges: routine MRI leads to unnecessary diagnoses and treatments."),
    regola=t("Lombalgia senza segnali d'allarme: prima la clinica, la RM solo se cambia la gestione.", "Low back pain without red flags: clinical assessment first, MRI only if it changes management."),
    esito_clinico={"tipo": "altro", "testo": t(
        "Gradazioni del radiologo muscoloscheletrico della collezione SPIDER: tutti i livelli Pfirrmann 1, senza ernie, protrusioni, alterazioni dei piatti o listesi.",
        "Grading by the SPIDER collection musculoskeletal radiologist: all levels Pfirrmann 1, with no herniation, bulge, endplate changes or listhesis.")},
    fonte=fonte(237), serie_iniziale=1, riquadri=2,
    vista={"serie": 1, "idx": 8, "zoom": 1, "panX": 0, "panY": 0, "nota": t("T2 sagittale con soppressione del grasso: dischi chiari a tutti i livelli",
                                                                              "Fat-suppressed sagittal T2: bright discs at all levels")},
    nota_docente=NOTA_COMUNE + " Paziente SPIDER 237 (F, Philips 1,5 T). La T2 della collezione è con soppressione del grasso (grasso sottocutaneo scuro).")

# ---------------------------------------------------------------- scrittura
ordine = ['id', 'visibile', 'aggiornato', 'titolo', 'titolo_interno', 'distretto', 'quesito', 'modalita', 'difficolta', 'anamnesi', 'domanda',
          'sezioni', 'opzioni', 'spiegazione', 'regola', 'esito_clinico', 'fonte', 'serie_iniziale', 'riquadri', 'vista', 'nota_docente']
titoli = {}
for n, c in casi.items():
    cid = f'caso-tcia-{n}'
    assert os.path.exists(R + f'casi-free/{cid}/serie.json'), cid
    c = dict(c, id=cid, visibile=True, aggiornato=ORA)
    # traduzione: tutti i testi usati nel caso
    testi = [c['titolo'], c['titolo_interno'], c['anamnesi'], c['domanda'], c['spiegazione'], c['regola'], c['esito_clinico']['testo'], c['vista']['nota']]
    testi += [x for s in c['sezioni'] for x in (s['nome'], s['domanda'])]
    testi += [x for o in c['opzioni'] for x in (o['testo'], o.get('nota')) if x]
    tr = {}
    for x in testi:
        assert x in EN, f'{cid}: manca la traduzione di «{x[:60]}»'
        tr[x] = EN[x]
    json.dump({k: c[k] for k in ordine}, open(R + f'casi-free/{cid}/caso.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(tr, open(R + f'cloud/web/lingua/casi/{cid}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(', ', ': '))
    titoli[c['titolo']] = EN[c['titolo']]
    print(cid, len(c['opzioni']), 'opzioni,', len(tr), 'testi tradotti')
# titoli inglesi nell'elenco dei casi
f = R + 'cloud/web/lingua/casi/_titoli.json'; s = open(f, encoding='utf-8').read(); d = json.loads(s)
fm = None
for ind in (None, 1, 2):
    for sep in (None, (', ', ': '), (',', ':')):
        if json.dumps(d, ensure_ascii=False, indent=ind, separators=sep) + ('\n' if s.endswith('\n') else '') == s: fm = (ind, sep)
assert fm, 'formato _titoli.json'
d.update(titoli)
open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=fm[0], separators=fm[1]) + ('\n' if s.endswith('\n') else ''))
print('titoli aggiunti', len(titoli))
