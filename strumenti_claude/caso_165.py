# caso_165.py: caso 165, vetrino SVS originale (non DICOM) del GDC, TCGA-BRCA TCGA-E2-A1L7 (stessa paziente del caso 147)
import json, os, sys
R = sys.argv[1]
C = os.path.join(R, 'casi-free', 'caso-tcia-165')
IT_EN = {}
def t(it, en): IT_EN[it] = en; return it

sez = [{"nome": t("Reperti", "Findings"), "domanda": t("Sfoglia il vetrino a piccolo e a forte ingrandimento: cosa osservi?", "Browse the slide at low and high magnification: what do you see?")},
       {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la diagnosi istologica più probabile?", "What is the most likely histological diagnosis?"), "singola": True}]
op = [
 {"testo": t("Nidi solidi e cordoni di cellule epiteliali atipiche, con nuclei grandi e nucleoli evidenti, che infiltrano uno stroma fibroso",
             "Solid nests and cords of atypical epithelial cells, with large nuclei and prominent nucleoli, infiltrating a fibrous stroma"),
  "corretta": True, "tipo": "secondario", "sezione": 0,
  "nota": t("Le cellule tumorali non stanno dentro dotti e lobuli con il loro strato mioepiteliale: invadono lo stroma, che reagisce con collagene (desmoplasia).",
            "The tumour cells are not confined to ducts and lobules with their myoepithelial layer: they invade the stroma, which reacts with collagen (desmoplasia).")},
 {"testo": t("Linfociti nello stroma tra i nidi tumorali", "Lymphocytes in the stroma between the tumour nests"),
  "corretta": True, "tipo": "secondario", "sezione": 0,
  "nota": t("I linfociti infiltranti il tumore (TIL) sono frequenti nei carcinomi tripli negativi e hanno valore prognostico.",
            "Tumour-infiltrating lymphocytes (TILs) are common in triple-negative carcinomas and have prognostic value.")},
 {"testo": t("Tessuto adiposo mammario senza tumore nella parte inferiore del preparato", "Breast adipose tissue without tumour in the lower part of the section"),
  "corretta": True, "tipo": "secondario", "sezione": 0},
 {"testo": t("Dotti e lobuli normali con doppio strato di cellule (epiteliali e mioepiteliali) in tutto il preparato, senza neoplasia",
             "Normal ducts and lobules with a double cell layer (epithelial and myoepithelial) throughout the section, no neoplasm"),
  "corretta": False, "tipo": "distrattore", "sezione": 0},
 {"testo": t("Cellule piccole, uniformi e poco coese, in fila indiana, senza formare nidi", "Small, uniform, discohesive cells in single files, not forming nests"),
  "corretta": False, "tipo": "distrattore", "sezione": 0,
  "nota": t("È l'aspetto del carcinoma lobulare (perdita della E-caderina); qui le cellule sono grandi, coese e formano nidi solidi.",
            "That is the appearance of lobular carcinoma (loss of E-cadherin); here the cells are large, cohesive and form solid nests.")},
 {"testo": t("Proliferazione di stroma ipercellulare a forma di foglia attorno a spazi epiteliali", "Leaf-like proliferation of hypercellular stroma around epithelial spaces"),
  "corretta": False, "tipo": "distrattore", "sezione": 0,
  "nota": t("È il tumore fillode; qui la componente che prolifera è epiteliale.", "That is a phyllodes tumour; here the proliferating component is epithelial.")},
 {"testo": t("Carcinoma mammario infiltrante di tipo non speciale (duttale infiltrante)", "Invasive breast carcinoma of no special type (invasive ductal)"),
  "corretta": True, "tipo": "principale", "sezione": 1},
 {"testo": t("Carcinoma lobulare infiltrante", "Invasive lobular carcinoma"), "corretta": False, "tipo": "distrattore", "sezione": 1},
 {"testo": t("Carcinoma duttale in situ senza invasione", "Ductal carcinoma in situ without invasion"), "corretta": False, "tipo": "distrattore", "sezione": 1,
  "nota": t("Le cellule escono dai dotti e infiltrano lo stroma: è un carcinoma infiltrante.", "The cells leave the ducts and infiltrate the stroma: it is an invasive carcinoma.")},
 {"testo": t("Fibroadenoma", "Fibroadenoma"), "corretta": False, "tipo": "distrattore", "sezione": 1,
  "nota": t("Il fibroadenoma è una lesione benigna ben delimitata con stroma e dotti compressi, senza atipie.", "A fibroadenoma is a well-circumscribed benign lesion with stroma and compressed ducts, without atypia.")},
]
spieg = t(
 "Il carcinoma infiltrante di tipo non speciale (NST, un tempo «duttale infiltrante») è il tumore maligno della mammella più frequente. "
 "Le cellule neoplastiche formano nidi, cordoni o ghiandole che infiltrano lo stroma, spesso con reazione fibrosa. "
 "Il grado istologico (Nottingham) somma tre punteggi: formazione di tubuli, pleomorfismo nucleare e mitosi. "
 "Il sottotipo biologico non si vede in ematossilina-eosina: servono l'immunoistochimica per i recettori di estrogeni e progesterone e per HER2. "
 "In questa paziente il tumore era triplo negativo (ER−, PR−, HER2−): un sottotipo spesso di alto grado, a crescita solida con margini «spingenti», con infiltrato linfocitario e a volte necrosi centrale. "
 "Correlazione con la RM della stessa paziente (caso 147): la massa irregolare con impregnazione ad anello e centro non impregnato corrisponde a un tumore solido, cellulato alla periferia, con un centro meno vascolarizzato.\n"
 "Questo vetrino è nel formato originale dello scanner (Aperio SVS), non in DICOM: il visualizzatore lo legge allo stesso modo, scaricando solo le parti guardate.",
 "Invasive carcinoma of no special type (NST, formerly «invasive ductal») is the most common malignant tumour of the breast. "
 "The neoplastic cells form nests, cords or glands that infiltrate the stroma, often with a fibrous reaction. "
 "The histological grade (Nottingham) adds three scores: tubule formation, nuclear pleomorphism and mitoses. "
 "The biological subtype cannot be seen on haematoxylin-eosin: immunohistochemistry for oestrogen and progesterone receptors and for HER2 is needed. "
 "In this patient the tumour was triple negative (ER−, PR−, HER2−): a subtype that is often high grade, with solid growth and «pushing» margins, a lymphocytic infiltrate and sometimes central necrosis. "
 "Correlation with the MRI of the same patient (case 147): the irregular mass with rim enhancement and a non-enhancing centre corresponds to a solid tumour, cellular at the periphery, with a less vascularised centre.\n"
 "This slide is in the scanner's original format (Aperio SVS), not DICOM: the viewer reads it the same way, downloading only the parts you look at.")
caso = {
 "titolo": t("Vetrino: massa della mammella", "Slide: breast mass"),
 "titolo_interno": t("Carcinoma infiltrante di tipo non speciale (duttale) triplo negativo, pT2 N2: stessa paziente del caso 147 (RM). Vetrino SVS originale del GDC",
                     "Triple-negative invasive carcinoma of no special type (ductal), pT2 N2: same patient as case 147 (MRI). Original SVS slide from the GDC"),
 "distretto": "Mammella", "quesito": "massa mammaria", "modalita": "Vetrini", "difficolta": "Intermedio",
 "anamnesi": t("Donna di 40 anni con massa della mammella destra, operata. Vetrino in ematossilina-eosina del tumore, scansione a 40×.",
               "40-year-old woman with a right breast mass, operated on. Haematoxylin-eosin slide of the tumour, scanned at 40×."),
 "domanda": t("Sfoglia il vetrino: cosa osservi e qual è la diagnosi?", "Browse the slide: what do you see and what is the diagnosis?"),
 "sezioni": sez, "opzioni": op, "spiegazione": spieg,
 "regola": t("Carcinoma infiltrante: cellule atipiche fuori da dotti e lobuli, nello stroma; il sottotipo (ER, PR, HER2) richiede l'immunoistochimica.",
             "Invasive carcinoma: atypical cells outside ducts and lobules, in the stroma; the subtype (ER, PR, HER2) requires immunohistochemistry."),
 "esito_clinico": {"tipo": "istologia", "testo": t("Carcinoma duttale infiltrante (GDC: Infiltrating duct carcinoma, NOS), triplo negativo (ER−, PR−, HER2−), pT2 N2 M0, stadio IIIA, mammella destra.",
                                                    "Invasive ductal carcinoma (GDC: Infiltrating duct carcinoma, NOS), triple negative (ER−, PR−, HER2−), pT2 N2 M0, stage IIIA, right breast.")},
 "fonte": {"archivio": "NCI Genomic Data Commons (GDC), vetrini diagnostici TCGA (file Aperio SVS originale)", "collezione": "TCGA-BRCA", "soggetto": "TCGA-E2-A1L7",
           "licenza": "CC BY 3.0", "licenza_url": "https://creativecommons.org/licenses/by/3.0/",
           "citazione": "The Cancer Genome Atlas Research Network, TCGA-BRCA. Vetrino diagnostico TCGA-E2-A1L7-01Z-00-DX1, NCI Genomic Data Commons (accesso aperto), https://portal.gdc.cancer.gov/. Le stesse scansioni sono distribuite in DICOM da NCI Imaging Data Commons con licenza CC BY 3.0. Etichetta e metadati di scansione tolti da radio-quiz.it (prepara_vetrino.py); tessere non modificate.",
           "url": "https://portal.gdc.cancer.gov/files/966c7061-a5e0-4340-8e51-2d5dd509c663"},
 "rassegna": [{"caso": "caso-tcia-147", "testo": t("RM della STESSA paziente: massa irregolare con impregnazione ad anello e centro non impregnato",
                                                   "MRI of the SAME patient: irregular mass with rim enhancement and a non-enhancing centre")}],
 "zona_vetrino": {"i": 0, "r": [33500, 4000, 70500, 23000], "domanda": True,
                  "nota": t("Carcinoma infiltrante: nidi solidi di cellule atipiche nello stroma fibroso, con linfociti (sotto, tessuto adiposo senza tumore)",
                            "Invasive carcinoma: solid nests of atypical cells in the fibrous stroma, with lymphocytes (below, adipose tissue without tumour)")},
 "localizza": True,
 "nota_docente": "Caso di anatomia patologica creato il 24/11/2026: primo caso con un vetrino NON DICOM (Aperio SVS originale, 354 MB, 81871×46773 px a 0,248 µm, JPEG). Scaricato dal GDC (file 966c7061-a5e0-4340-8e51-2d5dd509c663, accesso aperto) e preparato con strumenti/prepara_vetrino.py: nessun codice né testo su etichetta/panoramica (il file del GDC non ha l'etichetta), metadati di scansione azzerati (data, ora, utente, nome del file, ID dello scanner); resta il titolo TCGA-E2-A1L7-01Z-00-DX1, codice pubblico come la fonte. Diagnosi ed esito dai dati GDC già usati nel caso 147 (stessa paziente). Reperti controllati da Claude sulle immagini (nidi solidi di cellule grandi con nucleoli, stroma fibroso con linfociti, tessuto adiposo libero in basso): da confermare da un patologo. Il grado istologico non è dichiarato perché non è nei dati della fonte. Zona del reperto: carcinoma nella banda superiore (x 33500-70500, y 4000-23000 in pixel della scansione), domanda sul vetrino.",
 "id": "caso-tcia-165", "visibile": True, "aggiornato": "2026-11-24 21:00",
}
json.dump(caso, open(os.path.join(C, 'caso.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# il caso 147 rimanda al vetrino
p147 = os.path.join(R, 'casi-free', 'caso-tcia-147', 'caso.json'); d = json.load(open(p147, encoding='utf-8'))
testo147 = t("Vetrino della STESSA paziente: carcinoma infiltrante di tipo non speciale, triplo negativo", "Slide of the SAME patient: triple-negative invasive carcinoma of no special type")
if not any(x.get('caso') == 'caso-tcia-165' for x in (d.get('rassegna') or [])):
    d['rassegna'] = (d.get('rassegna') or []) + [{"caso": "caso-tcia-165", "testo": testo147}]
    json.dump(d, open(p147, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
L = os.path.join(R, 'cloud/web/lingua/casi')
json.dump({k: v for k, v in IT_EN.items() if k != testo147}, open(os.path.join(L, 'caso-tcia-165.json'), 'w', encoding='utf-8'), ensure_ascii=False)
q = os.path.join(L, 'caso-tcia-147.json'); tr = json.load(open(q, encoding='utf-8')); tr[testo147] = IT_EN[testo147]
json.dump(tr, open(q, 'w', encoding='utf-8'), ensure_ascii=False)
ti = os.path.join(L, '_titoli.json'); tt = json.load(open(ti, encoding='utf-8')); tt[caso['titolo']] = IT_EN[caso['titolo']]
json.dump(tt, open(ti, 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', len(IT_EN), 'testi')
