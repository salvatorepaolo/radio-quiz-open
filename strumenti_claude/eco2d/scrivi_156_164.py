#!/usr/bin/env python3
"""Scrive caso.json e traduzione inglese dei casi 156-164:
156-160 ecografia mammaria (BUS-BRA), 161 RM lombare (SPIDER 218), 162-164 ecografia ostetrica, circonferenza cranica (HC18).
Il file inglese è {italiano: inglese}. Stessa struttura di strumenti_claude/spider/scrivi_151_155.py."""
import json, os, datetime
R = '/Volumes/Caloggero/piattaforma-quiz/'
ORA = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
EN = {}
def t(it, en): EN[it] = en; return it
casi = {}
OGGI = '23/11/2026'

# ================================================================ BUS-BRA
CIT_BB = ("Gómez-Flores W., Gregorio-Calas M.J., Coelho de Albuquerque Pereira W. (2024). BUS-BRA: A breast ultrasound dataset for assessing "
          "computer-aided diagnosis systems. Medical Physics 51, 3110-3123. https://doi.org/10.1002/mp.16812. Dati: BUS-BRA, Zenodo, doi:10.5281/zenodo.7730708.")
def fonte_bb(n):
    return {"archivio": "Zenodo (Medical Physics), non TCIA", "collezione": "BUS-BRA – Breast Ultrasound dataset (Brasile)",
            "soggetto": f"caso {n} (file bus_{n:04d}-l e bus_{n:04d}-r)", "doi": "10.5281/zenodo.7730708", "licenza": "CC BY 4.0",
            "licenza_url": "https://creativecommons.org/licenses/by/4.0/", "citazione": CIT_BB, "url": "https://zenodo.org/records/7730708",
            "nota": ("Immagini convertite da PNG in DICOM da radio-quiz.it: non sono DICOM originali, pixel invariati. La collezione dà le immagini "
                     "già ritagliate sulla lesione, senza spaziatura dei pixel: le misure si leggono sulle scritte dell'ecografo (in portoghese: "
                     "MAMA DIREITA/ESQUERDA = mammella destra/sinistra). Risposte di riferimento: categoria BI-RADS assegnata dal radiologo e "
                     "istologia della biopsia, dalla collezione. Età e dati clinici non disponibili.")}
NOTA_BB = ("Caso creato da Claude il " + OGGI + " dalla collezione BUS-BRA (Zenodo 7730708, CC BY 4.0; nel LICENSE.txt dello zip permesso di uso, "
           "modifica e distribuzione con citazione), convertita da PNG in DICOM US con strumenti_claude/eco2d/png2us.py; testi da "
           "strumenti_claude/eco2d/scrivi_156_164.py. Le due immagini sono le due proiezioni della stessa lesione. Scelte immagini senza date o nomi "
           "impressi. NON ancora rivisto dal medico.")
ANAM_BB = t("Donna con nodulo mammario, inviata all'ecografia. Due proiezioni ortogonali della lesione. Età e altri dati clinici non disponibili nella collezione.",
            "Woman with a breast lump referred for ultrasound. Two orthogonal views of the lesion. Age and other clinical data are not available in the collection.")
SEZ_BB = [{"nome": t("Reperti", "Findings"), "domanda": t("Come descrivi la lesione (lessico BI-RADS)?", "How do you describe the lesion (BI-RADS lexicon)?")},
          {"nome": t("BI-RADS", "BI-RADS"), "domanda": t("Quale categoria BI-RADS?", "Which BI-RADS category?"), "singola": True},
          {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Che cosa proponi?", "What do you recommend?"), "singola": True}]
def birads(giusta, note):
    testi = {2: t("BI-RADS 2: benigno", "BI-RADS 2: benign"), 3: t("BI-RADS 3: probabilmente benigno", "BI-RADS 3: probably benign"),
             4: t("BI-RADS 4: sospetto", "BI-RADS 4: suspicious"), 5: t("BI-RADS 5: altamente suggestivo di malignità", "BI-RADS 5: highly suggestive of malignancy")}
    return [{"testo": testi[k], "corretta": k == giusta, "tipo": "secondario" if k == giusta else "distrattore", "sezione": 1,
             **({"nota": note[k]} if k in note else {})} for k in (2, 3, 4, 5)]
COND = {"follow": t("Nessun controllo dedicato: si torna allo screening per l'età", "No dedicated follow-up: return to age-appropriate screening"),
        "breve": t("Controllo ecografico a breve termine (6 mesi), poi a 12 e 24 mesi", "Short-interval ultrasound follow-up (6 months), then at 12 and 24 months"),
        "biopsia": t("Biopsia percutanea con ago tranciante sotto guida ecografica", "Ultrasound-guided percutaneous core needle biopsy"),
        "nulla": t("Nessun accertamento: la lesione è palpabile ma l'ecografia basta", "No further work-up: the lesion is palpable but ultrasound is enough")}
def condotta(giusta, note=None, sintesi=None):
    note = note or {}
    testo = lambda k: (t(sintesi[0] + ": " + COND[k][0].lower() + COND[k][1:], sintesi[1] + ": " + EN[COND[k]][0].lower() + EN[COND[k]][1:]) if sintesi and k == giusta else COND[k])
    return [{"testo": testo(k), "corretta": k == giusta, "tipo": "secondario" if k == giusta else "distrattore", "sezione": 2,
             **({"nota": note[k]} if k in note else {})} for k in ("follow", "breve", "biopsia")]
SPIEG_BB_BASE = ("Il lessico BI-RADS per l'ecografia descrive la massa con poche parole: forma (ovale, rotonda, irregolare), orientamento (parallelo alla cute = "
                 "più larga che alta; non parallelo = più alta che larga), margini (circoscritti oppure indistinti, angolati, microlobulati, spiculati), "
                 "ecostruttura (anecogena, ipoecogena, complessa…) e caratteristiche posteriori (rinforzo, ombra, nessuna).\n")
SPIEG_BB_BASE_EN = ("The BI-RADS ultrasound lexicon describes a mass with a few words: shape (oval, round, irregular), orientation (parallel to the skin = "
                    "wider than tall; not parallel = taller than wide), margins (circumscribed, or indistinct, angular, microlobulated, spiculated), "
                    "echo pattern (anechoic, hypoechoic, complex…) and posterior features (enhancement, shadowing, none).\n")

casi['156'] = dict(
    titolo=t("Ecografia mammaria (1/5): nodulo della mammella sinistra", "Breast ultrasound (1/5): lump in the left breast"),
    titolo_interno=t("Cisti semplice: ovale, anecogena, circoscritta, con rinforzo posteriore; BI-RADS 2 (BUS-BRA 580)",
                     "Simple cyst: oval, anechoic, circumscribed, with posterior enhancement; BI-RADS 2 (BUS-BRA 580)"),
    distretto="Mammella", quesito="nodulo mammario", modalita="Ecografia", difficolta="Base", anamnesi=ANAM_BB,
    domanda=t("Descrivi la lesione e assegna la categoria BI-RADS.", "Describe the lesion and assign the BI-RADS category."),
    sezioni=SEZ_BB,
    opzioni=[
        {"testo": t("Lesione ovale, anecogena (nera), a margini netti, con rinforzo acustico posteriore", "Oval, anechoic (black), well-circumscribed lesion with posterior acoustic enhancement"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagini 0 e 1: contenuto nero omogeneo, parete sottile, tessuto più chiaro dietro la lesione (il liquido non attenua gli ultrasuoni). Diametro maggiore circa 20 mm, dalle scritte dell'ecografo.",
                   "Images 0 and 1: homogeneous black content, thin wall, brighter tissue behind the lesion (fluid does not attenuate ultrasound). Largest diameter about 20 mm, from the scanner annotations.")},
        {"testo": t("Massa solida irregolare con cono d'ombra posteriore", "Irregular solid mass with posterior acoustic shadowing"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Dietro la lesione il segnale aumenta (rinforzo), non si riduce (ombra).", "Behind the lesion the signal increases (enhancement); it does not decrease (shadowing).")},
        {"testo": t("Lesione complessa con componente solida vegetante nella parete", "Complex lesion with a solid mural nodule"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Non ci sono vegetazioni né setti spessi: la parete è liscia.", "There are no solid components or thick septa: the wall is smooth.")},
        *birads(2, {2: t("Cisti semplice: benigna, nessuna sorveglianza dedicata.", "Simple cyst: benign, no dedicated surveillance.")}),
        *condotta("follow", sintesi=("Cisti semplice anecogena della mammella sinistra, BI-RADS 2", "Anechoic simple cyst of the left breast, BI-RADS 2"), note={"follow": t("Se la cisti è grande e dolente si può aspirare per il sintomo, non per la diagnosi.", "If the cyst is large and painful it can be aspirated for symptom relief, not for diagnosis.")}),
    ],
    spiegazione=t(SPIEG_BB_BASE + "La cisti semplice è la lesione mammaria più frequente. Per chiamarla «semplice» servono tutti e quattro i criteri: anecogena, circoscritta, parete sottile, rinforzo posteriore. Allora è BI-RADS 2.\n"
                  "Se mancano (echi interni, setti, parete spessa, componente solida) è una cisti complicata o una massa complessa: la categoria sale (3 o 4).",
                  SPIEG_BB_BASE_EN + "The simple cyst is the most common breast lesion. To call it «simple» all four criteria are needed: anechoic, circumscribed, thin wall, posterior enhancement. Then it is BI-RADS 2.\n"
                  "If they are not all met (internal echoes, septa, thick wall, solid component) it is a complicated cyst or a complex mass: the category goes up (3 or 4)."),
    regola=t("Anecogena, circoscritta, parete sottile, rinforzo posteriore: cisti semplice, BI-RADS 2.", "Anechoic, circumscribed, thin wall, posterior enhancement: simple cyst, BI-RADS 2."),
    esito_clinico={"tipo": "istologia", "testo": t("Collezione BUS-BRA: BI-RADS 2, istologia cisti (benigna).", "BUS-BRA collection: BI-RADS 2, histology cyst (benign).")},
    fonte=fonte_bb(580), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Lesione anecogena ovale con rinforzo posteriore", "Oval anechoic lesion with posterior enhancement")},
    nota_docente=NOTA_BB + " BUS-BRA 580, mammella sinistra (QII), GE Logiq.")

casi['157'] = dict(
    titolo=t("Ecografia mammaria (2/5): nodulo della mammella sinistra", "Breast ultrasound (2/5): lump in the left breast"),
    titolo_interno=t("Fibroadenoma: massa ovale, circoscritta, ipoecogena, orientamento parallelo; BI-RADS 3 (BUS-BRA 558)",
                     "Fibroadenoma: oval, circumscribed, hypoechoic mass with parallel orientation; BI-RADS 3 (BUS-BRA 558)"),
    distretto="Mammella", quesito="nodulo mammario", modalita="Ecografia", difficolta="Base", anamnesi=ANAM_BB,
    domanda=t("Descrivi la lesione e assegna la categoria BI-RADS.", "Describe the lesion and assign the BI-RADS category."),
    sezioni=SEZ_BB,
    opzioni=[
        {"testo": t("Massa solida ovale, ipoecogena, a margini circoscritti, più larga che alta (orientamento parallelo)", "Oval, hypoechoic solid mass with circumscribed margins, wider than tall (parallel orientation)"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagini 0 e 1: la massa ha echi interni (è solida, non liquida), contorno liscio e asse maggiore parallelo alla cute; nessuna ombra posteriore.",
                   "Images 0 and 1: the mass has internal echoes (solid, not fluid), a smooth outline and its long axis parallel to the skin; no posterior shadowing.")},
        {"testo": t("Cisti semplice", "Simple cyst"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Non è anecogena: ha echi interni fini. È solida.", "It is not anechoic: it has fine internal echoes. It is solid.")},
        {"testo": t("Margini spiculati e cono d'ombra", "Spiculated margins and shadowing"), "corretta": False, "tipo": "distrattore", "sezione": 0},
        *birads(3, {3: t("Massa solida ovale, circoscritta, parallela, senza altri segni di sospetto: probabilità di malignità sotto il 2%.", "Oval, circumscribed, parallel solid mass without other suspicious features: likelihood of malignancy below 2%."),
                    4: t("Nessun criterio di sospetto: la biopsia si può fare su richiesta della paziente o se la massa cresce, non è l'indicazione standard.", "No suspicious feature: biopsy may be done at the patient's request or if the mass grows; it is not the standard recommendation.")}),
        *condotta("breve", sintesi=("Massa solida ovale circoscritta della mammella sinistra, probabile fibroadenoma, BI-RADS 3", "Oval circumscribed solid mass of the left breast, probable fibroadenoma, BI-RADS 3"), note={"biopsia": t("Ragionevole se la massa è nuova in età avanzata, se cresce o se la paziente lo preferisce.", "Reasonable if the mass is new at an older age, if it grows, or if the patient prefers it.")}),
    ],
    spiegazione=t(SPIEG_BB_BASE + "La massa solida ovale, circoscritta, a orientamento parallelo e senza ombra è il quadro tipico del fibroadenoma: BI-RADS 3, probabilmente benigna (malignità sotto il 2%).\n"
                  "BI-RADS 3 significa sorveglianza a breve: ecografia a 6 mesi, poi a 12 e 24 mesi. Se resta stabile si declassa a 2; se cresce o cambia aspetto si fa la biopsia.\n"
                  "In questa paziente la biopsia ha confermato un fibroadenoma.",
                  SPIEG_BB_BASE_EN + "An oval, circumscribed, parallel solid mass without shadowing is the typical appearance of a fibroadenoma: BI-RADS 3, probably benign (malignancy below 2%).\n"
                  "BI-RADS 3 means short-interval surveillance: ultrasound at 6 months, then at 12 and 24 months. If stable it is downgraded to 2; if it grows or changes, it is biopsied.\n"
                  "In this patient biopsy confirmed a fibroadenoma."),
    regola=t("Ovale, circoscritta, parallela, senza ombra: BI-RADS 3 e controllo a 6 mesi.", "Oval, circumscribed, parallel, no shadowing: BI-RADS 3 and follow-up at 6 months."),
    esito_clinico={"tipo": "istologia", "testo": t("Collezione BUS-BRA: BI-RADS 3, istologia fibroadenoma (benigno).", "BUS-BRA collection: BI-RADS 3, histology fibroadenoma (benign).")},
    fonte=fonte_bb(558), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Massa ovale ipoecogena circoscritta", "Oval circumscribed hypoechoic mass")},
    nota_docente=NOTA_BB + " BUS-BRA 558, mammella sinistra (QSE), GE Logiq.")

casi['158'] = dict(
    titolo=t("Ecografia mammaria (3/5): nodulo della mammella destra", "Breast ultrasound (3/5): lump in the right breast"),
    titolo_interno=t("Carcinoma duttale invasivo: massa irregolare, spiculata, non parallela, con ombra posteriore; BI-RADS 5 (BUS-BRA 451)",
                     "Invasive ductal carcinoma: irregular, spiculated, non-parallel mass with posterior shadowing; BI-RADS 5 (BUS-BRA 451)"),
    distretto="Mammella", quesito="nodulo mammario", modalita="Ecografia", difficolta="Base", anamnesi=ANAM_BB,
    domanda=t("Descrivi la lesione e assegna la categoria BI-RADS.", "Describe the lesion and assign the BI-RADS category."),
    sezioni=SEZ_BB,
    opzioni=[
        {"testo": t("Massa irregolare, ipoecogena, a margini spiculati, più alta che larga, con cono d'ombra posteriore", "Irregular, hypoechoic mass with spiculated margins, taller than wide, with posterior shadowing"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagini 0 e 1: la massa attraversa i piani del tessuto (asse verticale), ha propaggini a raggiera e dietro di sé una banda scura. Circa 14 × 10 mm dalle scritte dell'ecografo.",
                   "Images 0 and 1: the mass crosses the tissue planes (vertical axis), has radiating extensions and a dark band behind it. About 14 × 10 mm from the scanner annotations.")},
        {"testo": t("Massa ovale circoscritta con rinforzo posteriore", "Oval circumscribed mass with posterior enhancement"), "corretta": False, "tipo": "distrattore", "sezione": 0},
        {"testo": t("Ombra da costa, senza lesione", "Rib shadow, no lesion"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("La costa sta dietro il muscolo pettorale ed è ovale e regolare; qui la massa è nel tessuto ghiandolare.", "The rib lies behind the pectoral muscle and is oval and regular; here the mass is in the glandular tissue.")},
        *birads(5, {5: t("Più segni di sospetto insieme (forma irregolare, spicule, orientamento non parallelo, ombra): probabilità di malignità oltre il 95%.", "Several suspicious features together (irregular shape, spiculation, non-parallel orientation, shadowing): likelihood of malignancy above 95%."),
                    4: t("Il 4 è per un sospetto intermedio (2-95%); qui i segni sono tipici.", "BI-RADS 4 is for intermediate suspicion (2-95%); here the features are classic.")}),
        *condotta("biopsia", sintesi=("Massa irregolare spiculata della mammella destra, BI-RADS 5", "Irregular spiculated mass of the right breast, BI-RADS 5"), note={"biopsia": t("Biopsia con ago tranciante e, se carcinoma, stadiazione locale (ecografia del cavo ascellare, mammografia bilaterale, eventuale RM).", "Core needle biopsy and, if carcinoma, local staging (axillary ultrasound, bilateral mammography, MRI if indicated).")}),
    ],
    spiegazione=t(SPIEG_BB_BASE + "I segni ecografici di malignità sono: forma irregolare, margini non circoscritti (spiculati, angolati, microlobulati, indistinti), orientamento non parallelo (più alta che larga), ombra posteriore. Anche un solo segno porta almeno al BI-RADS 4.\n"
                  "Con più segni tipici insieme la categoria è 5. Con BI-RADS 4 e 5 si fa la biopsia percutanea; un risultato benigno su una lesione BI-RADS 5 non concorda e va rivisto.\n"
                  "Qui la biopsia ha confermato un carcinoma duttale invasivo, il tumore della mammella più frequente.",
                  SPIEG_BB_BASE_EN + "Ultrasound signs of malignancy are: irregular shape, non-circumscribed margins (spiculated, angular, microlobulated, indistinct), non-parallel orientation (taller than wide), posterior shadowing. Even a single sign means at least BI-RADS 4.\n"
                  "With several classic signs together the category is 5. BI-RADS 4 and 5 lesions undergo percutaneous biopsy; a benign result on a BI-RADS 5 lesion is discordant and must be reviewed.\n"
                  "Here biopsy confirmed invasive ductal carcinoma, the most common breast cancer."),
    regola=t("Irregolare, spiculata, più alta che larga, con ombra: BI-RADS 5 e biopsia.", "Irregular, spiculated, taller than wide, shadowing: BI-RADS 5 and biopsy."),
    esito_clinico={"tipo": "istologia", "testo": t("Collezione BUS-BRA: BI-RADS 5, istologia carcinoma duttale invasivo (maligno).", "BUS-BRA collection: BI-RADS 5, histology invasive ductal carcinoma (malignant).")},
    fonte=fonte_bb(451), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Massa spiculata non parallela con ombra posteriore", "Non-parallel spiculated mass with posterior shadowing")},
    nota_docente=NOTA_BB + " BUS-BRA 451, mammella destra, GE Logiq.")

casi['159'] = dict(
    titolo=t("Ecografia mammaria (4/5): nodulo della mammella sinistra", "Breast ultrasound (4/5): lump in the left breast"),
    titolo_interno=t("Carcinoma lobulare invasivo: massa irregolare a margini angolati con ombra posteriore; BI-RADS 4 (BUS-BRA 566)",
                     "Invasive lobular carcinoma: irregular mass with angular margins and posterior shadowing; BI-RADS 4 (BUS-BRA 566)"),
    distretto="Mammella", quesito="nodulo mammario", modalita="Ecografia", difficolta="Intermedio", anamnesi=ANAM_BB,
    domanda=t("Descrivi la lesione e assegna la categoria BI-RADS.", "Describe the lesion and assign the BI-RADS category."),
    sezioni=SEZ_BB,
    opzioni=[
        {"testo": t("Area ipoecogena irregolare a margini angolati e indistinti, con ombra posteriore", "Irregular hypoechoic area with angular, indistinct margins and posterior shadowing"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagini 0 e 1: la lesione ha prolungamenti a punta tra il tessuto ghiandolare e una banda d'ombra dietro di sé; il contorno non è netto in nessun punto.",
                   "Images 0 and 1: the lesion has pointed extensions into the glandular tissue and a shadow band behind it; the outline is not sharp anywhere.")},
        {"testo": t("Tessuto fibroghiandolare normale, nessuna lesione", "Normal fibroglandular tissue, no lesion"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Il carcinoma lobulare può confondersi con il tessuto normale, ma l'ombra posteriore e i margini angolati sono reperti, non tessuto normale.", "Lobular carcinoma may blend with normal tissue, but posterior shadowing and angular margins are findings, not normal tissue.")},
        {"testo": t("Cisti complicata con echi interni", "Complicated cyst with internal echoes"), "corretta": False, "tipo": "distrattore", "sezione": 0},
        *birads(4, {4: t("Sospetto: margini non circoscritti e ombra. La collezione assegna 4; molti radiologi qui sceglierebbero 4C o 5: l'importante è la biopsia.", "Suspicious: non-circumscribed margins and shadowing. The collection assigns 4; many radiologists would choose 4C or 5 here: what matters is the biopsy.")}),
        *condotta("biopsia", sintesi=("Area ipoecogena irregolare con ombra posteriore nella mammella sinistra, BI-RADS 4", "Irregular hypoechoic area with posterior shadowing in the left breast, BI-RADS 4")),
    ],
    spiegazione=t(SPIEG_BB_BASE + "Il carcinoma lobulare invasivo cresce a file di cellule che si infiltrano tra le strutture senza formare una massa netta. Per questo in mammografia è spesso poco visibile (solo una distorsione) e in ecografia appare come un'area ipoecogena irregolare con ombra, a volte sottostimata.\n"
                  "È più spesso multifocale e bilaterale: dopo la diagnosi la RM mammaria è utile per la stadiazione locale.\n"
                  "BI-RADS 4 si divide in 4A (2-10%), 4B (10-50%) e 4C (50-95%); in tutti i casi l'indicazione è la biopsia.",
                  SPIEG_BB_BASE_EN + "Invasive lobular carcinoma grows as single files of cells infiltrating between structures without forming a discrete mass. This is why on mammography it is often subtle (only a distortion) and on ultrasound it appears as an irregular hypoechoic area with shadowing, sometimes underestimated.\n"
                  "It is more often multifocal and bilateral: after diagnosis breast MRI is useful for local staging.\n"
                  "BI-RADS 4 is divided into 4A (2-10%), 4B (10-50%) and 4C (50-95%); in all cases the recommendation is biopsy."),
    regola=t("Margini angolati e ombra bastano per il BI-RADS 4: biopsia.", "Angular margins and shadowing are enough for BI-RADS 4: biopsy."),
    esito_clinico={"tipo": "istologia", "testo": t("Collezione BUS-BRA: BI-RADS 4, istologia carcinoma lobulare invasivo (maligno).", "BUS-BRA collection: BI-RADS 4, histology invasive lobular carcinoma (malignant).")},
    fonte=fonte_bb(566), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Area ipoecogena irregolare con ombra posteriore", "Irregular hypoechoic area with posterior shadowing")},
    nota_docente=NOTA_BB + " BUS-BRA 566, mammella sinistra (QIE), GE Logiq. Nota per il medico: la collezione dà BI-RADS 4; sulle immagini il quadro potrebbe essere letto 4C-5.")

casi['160'] = dict(
    titolo=t("Ecografia mammaria (5/5): nodulo della mammella destra", "Breast ultrasound (5/5): lump in the right breast"),
    titolo_interno=t("Papilloma intraduttale: massa irregolare microlobulata, BI-RADS 4, biopsia benigna (BUS-BRA 623)",
                     "Intraductal papilloma: irregular microlobulated mass, BI-RADS 4, benign biopsy (BUS-BRA 623)"),
    distretto="Mammella", quesito="nodulo mammario", modalita="Ecografia", difficolta="Avanzato", anamnesi=ANAM_BB,
    domanda=t("Descrivi la lesione, assegna la categoria BI-RADS e interpreta l'istologia.", "Describe the lesion, assign the BI-RADS category and interpret the histology."),
    sezioni=[SEZ_BB[0], SEZ_BB[1],
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("La biopsia dice papilloma intraduttale, benigno. E ora?", "The biopsy shows an intraductal papilloma, benign. What now?"), "singola": True}],
    opzioni=[
        {"testo": t("Massa ipoecogena eterogenea, di forma irregolare, a margini microlobulati e non circoscritti", "Heterogeneous hypoechoic mass, irregular in shape, with microlobulated, non-circumscribed margins"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagini 0 e 1: la lesione ha piccole lobulazioni sul contorno e struttura interna disomogenea; non è né una cisti né un nodulo ovale circoscritto.",
                   "Images 0 and 1: the lesion has small lobulations along its outline and a heterogeneous internal structure; it is neither a cyst nor an oval circumscribed nodule.")},
        {"testo": t("Cisti semplice", "Simple cyst"), "corretta": False, "tipo": "distrattore", "sezione": 0},
        {"testo": t("Linfonodo intramammario con ilo adiposo", "Intramammary lymph node with fatty hilum"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Il linfonodo è ovale, circoscritto, con un ilo chiaro centrale: qui non c'è.", "A lymph node is oval and circumscribed with a central bright hilum: not seen here.")},
        *birads(4, {4: t("Margini microlobulati e forma irregolare: sospetto, biopsia.", "Microlobulated margins and irregular shape: suspicious, biopsy.")}),
        {"testo": t("Massa irregolare con biopsia di papilloma intraduttale: la concordanza va discussa; per il papilloma molti centri propongono l'asportazione chirurgica o con biopsia vacuum, per non perdere un'atipia o un carcinoma vicino",
                    "Irregular mass with intraductal papilloma at biopsy: concordance must be discussed; for papilloma many centres recommend surgical or vacuum-assisted excision, so as not to miss atypia or an adjacent carcinoma"),
         "corretta": True, "tipo": "secondario", "sezione": 2,
         "nota": t("Le lesioni papillari sono «a rischio incerto» (B3): l'ago tranciante può sottostimarle. Senza atipie alcune linee guida accettano la sorveglianza se la lesione è piccola e asportata in buona parte; la decisione è multidisciplinare.",
                   "Papillary lesions are of «uncertain malignant potential» (B3): core biopsy may underestimate them. Without atypia some guidelines accept surveillance if the lesion is small and largely removed; the decision is multidisciplinary.")},
        {"testo": t("Benigno: si chiude, nessun controllo", "Benign: case closed, no follow-up"), "corretta": False, "tipo": "distrattore", "sezione": 2,
         "nota": t("Ogni biopsia va valutata per concordanza tra imaging e istologia; il papilloma non si chiude così.", "Every biopsy must be assessed for imaging-pathology concordance; a papilloma is not closed like this.")},
        {"testo": t("Mastectomia", "Mastectomy"), "corretta": False, "tipo": "distrattore", "sezione": 2},
    ],
    spiegazione=t(SPIEG_BB_BASE + "Non tutte le lesioni BI-RADS 4 sono tumori: la categoria indica che serve un prelievo, e molte biopsie BI-RADS 4 risultano benigne.\n"
                  "Dopo ogni biopsia il radiologo verifica la concordanza: il risultato spiega l'aspetto della lesione? Il papilloma intraduttale spiega una massa solida irregolare, ma è una lesione B3 (potenziale incerto): sulla biopsia con ago può mancare un'atipia o un carcinoma papillare. Per questo spesso si asporta.\n"
                  "Il papilloma dà talvolta secrezione dal capezzolo, sierosa o ematica: in quel caso si cerca una lesione nei dotti retroareolari.",
                  SPIEG_BB_BASE_EN + "Not every BI-RADS 4 lesion is a tumour: the category means that tissue sampling is needed, and many BI-RADS 4 biopsies turn out benign.\n"
                  "After every biopsy the radiologist checks concordance: does the result explain the appearance of the lesion? An intraductal papilloma explains an irregular solid mass, but it is a B3 lesion (uncertain potential): a needle biopsy may miss atypia or papillary carcinoma. This is why it is often excised.\n"
                  "Papilloma sometimes causes serous or bloody nipple discharge: in that case look for a lesion in the retroareolar ducts."),
    regola=t("Dopo la biopsia: istologia e immagini devono concordare; le lesioni papillari si discutono.", "After biopsy: pathology and imaging must agree; papillary lesions are discussed."),
    esito_clinico={"tipo": "istologia", "testo": t("Collezione BUS-BRA: BI-RADS 4, istologia papilloma intraduttale (benigno).", "BUS-BRA collection: BI-RADS 4, histology intraductal papilloma (benign).")},
    fonte=fonte_bb(623), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Massa irregolare microlobulata", "Irregular microlobulated mass")},
    nota_docente=NOTA_BB + " BUS-BRA 623, mammella destra (QIE), GE Logiq. La condotta dopo biopsia di papilloma senza atipie varia tra linee guida: da rivedere con il medico.")

# ================================================================ SPIDER 218
CIT_SP = ("van der Graaf J.W., van Hooff M.L., Buckens C.F.M., Rutten M., van Susante J.L.C., Kroeze R.J., de Kleuver M., van Ginneken B., Lessmann N. (2024). "
          "Lumbar spine segmentation in MR images: a dataset and a public benchmark. Scientific Data 11, 264. https://doi.org/10.1038/s41597-024-03090-w. "
          "Dati: SPIDER, Zenodo, doi:10.5281/zenodo.10159290.")
casi['161'] = dict(
    titolo=t("Lombalgia in RM (6/6): uomo, T1 e T2 sagittali a 3 T", "Low back pain on MRI (6/6): man, sagittal T1 and T2 at 3 T"),
    titolo_interno=t("Anterolistesi degenerativa lieve di L4 su L5 con disco L4-L5 disidratato e ridotto, alterazioni dei piatti; altri dischi sani (SPIDER 218)",
                     "Mild degenerative anterolisthesis of L4 on L5 with a dehydrated, narrowed L4-L5 disc and endplate changes; other discs healthy (SPIDER 218)"),
    distretto="Rachide", quesito="lombalgia", modalita="RM", difficolta="Intermedio",
    anamnesi=t("Uomo con storia di lombalgia. RM del rachide lombare senza mezzo di contrasto: T1 e T2 sagittali. Età e altri dati clinici non disponibili nella collezione.",
               "Man with a history of low back pain. Lumbar spine MRI without contrast: sagittal T1 and T2. Age and other clinical data are not available in the collection."),
    domanda=t("Confronta i dischi tra loro e guarda l'allineamento dei corpi vertebrali.", "Compare the discs with each other and look at the alignment of the vertebral bodies."),
    sezioni=[{"nome": t("Reperti", "Findings"), "domanda": t("Che cosa vedi?", "What do you see?")},
             {"nome": t("Causa", "Cause"), "domanda": t("Qual è la causa più probabile dello scivolamento a questo livello?", "What is the most likely cause of the slip at this level?"), "singola": True},
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Qual è la conclusione più adatta?", "What is the most appropriate conclusion?"), "singola": True}],
    opzioni=[
        {"testo": t("Disco L4-L5 scuro in T2 e più basso degli altri, unico livello alterato", "L4-L5 disc dark on T2 and lower than the others, the only abnormal level"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Serie 1 (T2), immagini 12-15: gli altri dischi lombari hanno il nucleo chiaro (Pfirrmann 1-2 nella collezione); L4-L5 è grigio scuro e ridotto (Pfirrmann 3).",
                   "Series 1 (T2), images 12-15: the other lumbar discs have a bright nucleus (Pfirrmann 1-2 in the collection); L4-L5 is dark grey and narrowed (Pfirrmann 3).")},
        {"testo": t("Lieve scivolamento in avanti di L4 su L5 (anterolistesi di grado I)", "Slight forward slip of L4 on L5 (grade I anterolisthesis)"),
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": t("Lo scalino tra i muri posteriori di L4 e L5 è di pochi millimetri: va cercato seguendo la linea dei muri posteriori dall'alto in basso.",
                   "The step between the posterior walls of L4 and L5 is a few millimetres: look for it by following the posterior wall line from top to bottom.")},
        {"testo": t("Ernia discale L5-S1 voluminosa", "Large L5-S1 disc herniation"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("L5-S1 ha altezza e segnale quasi normali e non sporge nel canale.", "L5-S1 has almost normal height and signal and does not protrude into the canal.")},
        {"testo": t("Crollo vertebrale di L4", "L4 vertebral collapse"), "corretta": False, "tipo": "distrattore", "sezione": 0},
        {"testo": t("Degenerativa: disco e faccette articolari usurati lasciano scivolare L4; l'istmo è di solito integro",
                    "Degenerative: worn disc and facet joints let L4 slip; the pars is usually intact"),
         "corretta": True, "tipo": "secondario", "sezione": 1,
         "nota": t("La listesi degenerativa è tipica di L4-L5, spesso con artrosi delle faccette; la causa va confermata (faccette in assiale, istmo in TC o sagittali paramediane).",
                   "Degenerative listhesis is typical of L4-L5, often with facet arthropathy; the cause should be confirmed (facets on axial images, pars on CT or parasagittal images).")},
        {"testo": t("Istmica: la spondilolisi è tipica di L4-L5", "Isthmic: spondylolysis is typical of L4-L5"), "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": t("La spondilolisi istmica è più frequente a L5-S1.", "Isthmic spondylolysis is most common at L5-S1.")},
        {"testo": t("Discopatia degenerativa isolata L4-L5 con lieve anterolistesi di grado I; gli altri livelli sono conservati",
                    "Isolated degenerative disc disease at L4-L5 with mild grade I anterolisthesis; the other levels are preserved"),
         "corretta": True, "tipo": "secondario", "sezione": 2},
        {"testo": t("Esame negativo", "Normal study"), "corretta": False, "tipo": "distrattore", "sezione": 2},
    ],
    spiegazione=t(
        "In una colonna con dischi sani il livello malato spicca: in T2 il disco degenerato perde il segnale chiaro del nucleo e si abbassa.\n"
        "La spondilolistesi degenerativa nasce dall'usura del disco e delle faccette articolari; colpisce soprattutto L4-L5 e può restringere il canale e i recessi laterali, causando claudicatio neurogena. La listesi istmica (da spondilolisi) è invece tipica di L5-S1.\n"
        "Il grado si misura con Meyerding (I fino al 25% del piatto). Gli scivolamenti lievi si vedono meglio seguendo la linea dei muri posteriori; nella RM in posizione supina possono ridursi rispetto alla radiografia in piedi.",
        "In a spine with healthy discs the diseased level stands out: on T2 the degenerated disc loses the bright nuclear signal and becomes lower.\n"
        "Degenerative spondylolisthesis results from wear of the disc and facet joints; it mainly affects L4-L5 and may narrow the canal and lateral recesses, causing neurogenic claudication. Isthmic listhesis (from spondylolysis) is instead typical of L5-S1.\n"
        "The grade is measured with Meyerding (I up to 25% of the endplate). Mild slips are best seen by following the posterior wall line; on supine MRI they may appear smaller than on standing radiographs."),
    regola=t("Listesi a L4-L5: pensa alla forma degenerativa; a L5-S1: cerca la spondilolisi.", "Listhesis at L4-L5: think degenerative; at L5-S1: look for spondylolysis."),
    esito_clinico={"tipo": "altro", "testo": t(
        "Gradazioni del radiologo muscoloscheletrico della collezione SPIDER: L4-L5 spondilolistesi, alterazioni dei piatti superiore e inferiore, riduzione di altezza, protrusione, Pfirrmann 3; L5-S1 Pfirrmann 2; livelli superiori Pfirrmann 1.",
        "Grading by the SPIDER collection musculoskeletal radiologist: L4-L5 spondylolisthesis, upper and lower endplate changes, disc narrowing, bulge, Pfirrmann 3; L5-S1 Pfirrmann 2; upper levels Pfirrmann 1.")},
    fonte={"archivio": "Zenodo (Scientific Data), non TCIA", "collezione": "SPIDER – Lumbar spine segmentation in MR images",
           "soggetto": "paziente 218 (file 218_t1 e 218_t2)", "doi": "10.5281/zenodo.10159290", "licenza": "CC BY 4.0",
           "licenza_url": "https://creativecommons.org/licenses/by/4.0/", "citazione": CIT_SP, "url": "https://zenodo.org/records/10159290",
           "nota": ("Immagini convertite da MHA in DICOM da radio-quiz.it: non sono DICOM originali. Pixel e spaziatura invariati; in molte serie "
                    "le intensità sono già normalizzate nella collezione. Risposte di riferimento: gradazioni per livello di un radiologo "
                    "muscoloscheletrico della collezione (26 anni di esperienza). Età e dati clinici oltre alla lombalgia non disponibili.")},
    serie_iniziale=1, riquadri=2,
    vista={"serie": 1, "idx": 14, "zoom": 1, "panX": 0, "panY": 0, "nota": t("T2 sagittale mediana: disco L4-L5 scuro tra dischi chiari", "Midline sagittal T2: dark L4-L5 disc among bright discs")},
    nota_docente=("Caso creato da Claude il " + OGGI + " dalla collezione SPIDER (Zenodo 10159290, CC BY 4.0), convertita da MHA in DICOM con "
                  "strumenti_claude/spider/spider2dcm.py; testi da strumenti_claude/eco2d/scrivi_156_164.py. Livelli contati dal sacro (disco 1 = L5-S1, "
                  "verificato con le maschere della collezione). NON ancora rivisto dal medico. Paziente SPIDER 218 (M, Philips 3 T). "
                  "La listesi è lieve e si vede meglio sulle fette 13-15; scartato il paziente 56 (ernia L3-L4 della gradazione non riconoscibile con sicurezza)."))

# ================================================================ HC18
CIT_HC = ("van den Heuvel T.L.A., de Bruijn D., de Korte C.L., van Ginneken B. (2018). Automated measurement of fetal head circumference using 2D ultrasound images. "
          "PLoS ONE 13(8): e0200412. https://doi.org/10.1371/journal.pone.0200412. Dati: HC18, Zenodo, doi:10.5281/zenodo.1327317.")
def fonte_hc(n, hc):
    return {"archivio": "Zenodo (PLoS ONE), non TCIA", "collezione": "HC18 – Fetal head circumference (Radboud UMC)",
            "soggetto": f"immagine {n:03d}_HC (circonferenza cranica di riferimento {hc} mm)", "doi": "10.5281/zenodo.1327317", "licenza": "CC BY 4.0",
            "licenza_url": "https://creativecommons.org/licenses/by/4.0/", "citazione": CIT_HC, "url": "https://zenodo.org/records/1327317",
            "nota": ("Immagine convertita da PNG in DICOM da radio-quiz.it: non è un DICOM originale, pixel invariati, spaziatura dei pixel dalla "
                     "collezione (le misure nel visualizzatore sono in millimetri). Risposta di riferimento: circonferenza cranica misurata da un "
                     "ecografista esperto (ellisse) nella collezione. L'epoca gestazionale non è nella collezione: è stimata dalla circonferenza con "
                     "la formula di Hadlock (1984).")}
NOTA_HC = ("Caso creato da Claude il " + OGGI + " dalla collezione HC18 (Zenodo 1327317, CC BY 4.0), convertita da PNG in DICOM US con "
           "strumenti_claude/eco2d/png2us.py (spaziatura dei pixel dalla collezione); testi da strumenti_claude/eco2d/scrivi_156_164.py. "
           "Epoca gestazionale stimata con Hadlock: EG (settimane) = 8,96 + 0,540·CC + 0,0003·CC³, CC in cm. NON ancora rivisto dal medico.")
ANAM_HC = t("Ecografia ostetrica di routine. Immagine assiale della testa fetale. Data dell'ultima mestruazione non disponibile.",
            "Routine obstetric ultrasound. Axial image of the fetal head. Date of last menstrual period not available.")
SEZ_HC = [{"nome": t("Piano", "Plane"), "domanda": t("L'immagine è adatta alla misura?", "Is the image suitable for measurement?")},
          {"nome": t("Misura", "Measurement"), "domanda": t("Quanto misura la circonferenza cranica?", "What is the head circumference?"), "singola": True},
          {"nome": t("Conclusioni", "Conclusions"), "domanda": t("A quale epoca gestazionale corrisponde?", "Which gestational age does it correspond to?"), "singola": True}]
COME_MISURA = t("Con il righello misura il diametro biparietale (da esterno a esterno della teca) e il diametro occipito-frontale; la circonferenza è circa 1,57 × (DBP + DOF). Con l'ellisse si misura direttamente sul contorno esterno della teca.",
                "With the ruler measure the biparietal diameter (outer to outer edge of the skull) and the occipitofrontal diameter; the circumference is about 1.57 × (BPD + OFD). With an ellipse you measure directly along the outer skull edge.")
def misure(giusta_it, giusta_en, sbagliate):
    f = lambda a, b: t("Si stima una circonferenza di " + a[0].lower() + a[1:], "Estimated circumference: " + b[0].lower() + b[1:])
    return ([{"testo": f(giusta_it, giusta_en), "corretta": True, "tipo": "secondario", "sezione": 1, "nota": COME_MISURA}] +
            [{"testo": f(a, b), "corretta": False, "tipo": "distrattore", "sezione": 1} for a, b in sbagliate])
def epoche(giusta, tutte):
    f = lambda a, b: t("Dalla circonferenza della testa si stima un'epoca gestazionale di " + a[0].lower() + a[1:], "From the head circumference, estimated gestational age: " + b[0].lower() + b[1:])
    return [{"testo": f(a, b), "corretta": a == giusta, "tipo": "secondario" if a == giusta else "distrattore", "sezione": 2} for a, b in tutte]
SPIEG_HC = ("La circonferenza cranica (CC) si misura su un piano assiale della testa: ovale regolare e simmetrico, eco della linea mediana continua "
            "interrotta in avanti dal cavo del setto pellucido, talami visibili, cervelletto assente (se si vede il cervelletto il piano è troppo basso e inclinato). "
            "L'ellisse si appoggia sul bordo esterno della teca.\n"
            "Nel primo trimestre l'epoca si data con la lunghezza vertice-sacro; nel secondo trimestre la CC è un buon parametro di datazione. "
            "Nel terzo trimestre la variabilità tra feti aumenta: la CC serve a seguire la crescita, non a datare la gravidanza (si usa la datazione del primo trimestre).",
            "Head circumference (HC) is measured on an axial plane of the head: a regular, symmetric oval, continuous midline echo interrupted anteriorly by the "
            "cavum septi pellucidi, thalami visible, cerebellum not visible (if the cerebellum is seen the plane is too low and tilted). "
            "The ellipse is placed on the outer edge of the skull.\n"
            "In the first trimester gestational age is dated with the crown-rump length; in the second trimester HC is a good dating parameter. "
            "In the third trimester variability between fetuses increases: HC is used to follow growth, not to date the pregnancy (the first-trimester dating is used).")
PIANO_OK = t("Piano assiale della testa adatto: contorno ovale della teca completo e linea mediana visibile",
             "Suitable axial plane of the head: complete oval skull outline and visible midline")
PIANO_NO = t("Non adatto: si vede la colonna vertebrale fetale al posto della testa", "Not suitable: the fetal spine is seen instead of the head")

casi['162'] = dict(
    titolo=t("Ecografia ostetrica (1/3): misura la testa fetale", "Obstetric ultrasound (1/3): measure the fetal head"),
    titolo_interno=t("Circonferenza cranica 100 mm, circa 14-15 settimane (HC18 135)", "Head circumference 100 mm, about 14-15 weeks (HC18 135)"),
    distretto="Ostetricia", quesito="datazione della gravidanza", modalita="Ecografia", difficolta="Base", anamnesi=ANAM_HC,
    domanda=t("Misura la circonferenza cranica con gli strumenti del visualizzatore e stima l'epoca gestazionale.", "Measure the head circumference with the viewer tools and estimate the gestational age."),
    sezioni=SEZ_HC,
    opzioni=[
        {"testo": PIANO_OK, "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagine 0: testa piccola, teca ovale chiusa, eco mediana; l'immagine è un po' obliqua ma il contorno è misurabile.", "Image 0: small head, closed oval skull, midline echo; the image is slightly oblique but the outline is measurable.")},
        {"testo": PIANO_NO, "corretta": False, "tipo": "distrattore", "sezione": 0},
        *misure("Circa 100 mm", "About 100 mm", [("Circa 60 mm", "About 60 mm"), ("Circa 170 mm", "About 170 mm"), ("Circa 250 mm", "About 250 mm")]),
        *epoche("Circa 14-15 settimane", [("Circa 14-15 settimane", "About 14-15 weeks"), ("Circa 20 settimane", "About 20 weeks"), ("Circa 28 settimane", "About 28 weeks"), ("Circa 36 settimane", "About 36 weeks")]),
    ],
    spiegazione=t(*SPIEG_HC),
    regola=t("Ellisse sul bordo esterno della teca, sul piano con linea mediana e cavo del setto pellucido.", "Ellipse on the outer skull edge, on the plane with the midline and cavum septi pellucidi."),
    esito_clinico={"tipo": "altro", "testo": t("Collezione HC18: circonferenza cranica di riferimento 100,1 mm (ecografista esperto). Hadlock: circa 14,7 settimane.",
                                                "HC18 collection: reference head circumference 100.1 mm (experienced sonographer). Hadlock: about 14.7 weeks.")},
    fonte=fonte_hc(135, '100,11'), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Testa fetale in assiale", "Fetal head, axial view")},
    nota_docente=NOTA_HC + " HC18 135: CC 100,11 mm, pixel 0,103 mm.")

casi['163'] = dict(
    titolo=t("Ecografia ostetrica (2/3): misura la testa fetale", "Obstetric ultrasound (2/3): measure the fetal head"),
    titolo_interno=t("Circonferenza cranica 172 mm, circa 20 settimane (HC18 218)", "Head circumference 172 mm, about 20 weeks (HC18 218)"),
    distretto="Ostetricia", quesito="datazione della gravidanza", modalita="Ecografia", difficolta="Intermedio", anamnesi=ANAM_HC,
    domanda=t("Misura la circonferenza cranica con gli strumenti del visualizzatore e stima l'epoca gestazionale.", "Measure the head circumference with the viewer tools and estimate the gestational age."),
    sezioni=SEZ_HC,
    opzioni=[
        {"testo": PIANO_OK, "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagine 0: teca ovale completa e simmetrica, eco mediana continua; dietro, il plesso corioideo chiaro nel ventricolo laterale.", "Image 0: complete, symmetric oval skull, continuous midline echo; posteriorly the bright choroid plexus in the lateral ventricle.")},
        {"testo": t("Non adatto: il piano passa per il cervelletto", "Not suitable: the plane passes through the cerebellum"), "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": t("Il cervelletto non si vede; la struttura chiara posteriore è il plesso corioideo.", "The cerebellum is not seen; the bright posterior structure is the choroid plexus.")},
        *misure("Circa 170 mm", "About 170 mm", [("Circa 100 mm", "About 100 mm"), ("Circa 120 mm", "About 120 mm"), ("Circa 260 mm", "About 260 mm")]),
        *epoche("Circa 20 settimane", [("Circa 14-15 settimane", "About 14-15 weeks"), ("Circa 20 settimane", "About 20 weeks"), ("Circa 28 settimane", "About 28 weeks"), ("Circa 36 settimane", "About 36 weeks")]),
    ],
    spiegazione=t(*SPIEG_HC),
    regola=t("Ellisse sul bordo esterno della teca, sul piano con linea mediana e cavo del setto pellucido.", "Ellipse on the outer skull edge, on the plane with the midline and cavum septi pellucidi."),
    esito_clinico={"tipo": "altro", "testo": t("Collezione HC18: circonferenza cranica di riferimento 172,0 mm (ecografista esperto). Hadlock: circa 19,8 settimane.",
                                                "HC18 collection: reference head circumference 172.0 mm (experienced sonographer). Hadlock: about 19.8 weeks.")},
    fonte=fonte_hc(218, '171,98'), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Testa fetale in assiale", "Fetal head, axial view")},
    nota_docente=NOTA_HC + " HC18 218: CC 171,98 mm, pixel 0,130 mm.")

casi['164'] = dict(
    titolo=t("Ecografia ostetrica (3/3): misura la testa fetale", "Obstetric ultrasound (3/3): measure the fetal head"),
    titolo_interno=t("Circonferenza cranica 259 mm, circa 28 settimane; nel terzo trimestre la CC non data la gravidanza (HC18 693)",
                     "Head circumference 259 mm, about 28 weeks; in the third trimester HC does not date the pregnancy (HC18 693)"),
    distretto="Ostetricia", quesito="crescita fetale", modalita="Ecografia", difficolta="Intermedio",
    anamnesi=t("Ecografia ostetrica del terzo trimestre per la crescita. La gravidanza è stata datata nel primo trimestre. Immagine assiale della testa fetale.",
               "Third-trimester obstetric ultrasound for growth. The pregnancy was dated in the first trimester. Axial image of the fetal head."),
    domanda=t("Misura la circonferenza cranica e decidi come usarla.", "Measure the head circumference and decide how to use it."),
    sezioni=[SEZ_HC[0], SEZ_HC[1],
             {"nome": t("Conclusioni", "Conclusions"), "domanda": t("Come si usa questa misura nel terzo trimestre?", "How is this measurement used in the third trimester?"), "singola": True}],
    opzioni=[
        {"testo": t("Piano adatto della testa: teca ovale, linea mediana con il cavo del setto pellucido (triangolo scuro anteriore)", "Suitable plane of the head: oval skull, midline with the cavum septi pellucidi (anterior dark triangle)"),
         "corretta": True, "tipo": "principale", "sezione": 0,
         "nota": t("Immagine 0: il cavo del setto pellucido è il riferimento del piano corretto; la teca è un po' tagliata dal bordo del settore, ma il contorno si ricostruisce.", "Image 0: the cavum septi pellucidi marks the correct plane; the skull is slightly cut by the edge of the sector, but the outline can be reconstructed.")},
        {"testo": t("Non adatto: è un piano coronale", "Not suitable: it is a coronal plane"), "corretta": False, "tipo": "distrattore", "sezione": 0},
        *misure("Circa 260 mm", "About 260 mm", [("Circa 170 mm", "About 170 mm"), ("Circa 210 mm", "About 210 mm"), ("Circa 340 mm", "About 340 mm")]),
        {"testo": t("La misura della testa si confronta con le curve di crescita per l'epoca già nota dal primo trimestre; non si ridata la gravidanza", "The head measurement is compared with growth charts for the gestational age already known from the first trimester; the pregnancy is not re-dated"),
         "corretta": True, "tipo": "secondario", "sezione": 2,
         "nota": t("Con la datazione del primo trimestre, 259 mm corrisponde a circa 28 settimane secondo Hadlock: se l'epoca vera è simile la crescita del cranio è regolare.", "With first-trimester dating, 259 mm corresponds to about 28 weeks according to Hadlock: if the true age is similar, head growth is normal.")},
        {"testo": t("Si ricalcola la data del parto in base a questa misura", "The due date is recalculated from this measurement"), "corretta": False, "tipo": "distrattore", "sezione": 2,
         "nota": t("Nel terzo trimestre l'errore della datazione biometrica è di ±2-3 settimane: si perderebbero i ritardi di crescita.", "In the third trimester the error of biometric dating is ±2-3 weeks: growth restriction would be missed.")},
    ],
    spiegazione=t(*SPIEG_HC),
    regola=t("Si data una volta sola, presto; dopo si misura la crescita.", "Date once, early; afterwards measure growth."),
    esito_clinico={"tipo": "altro", "testo": t("Collezione HC18: circonferenza cranica di riferimento 258,5 mm (ecografista esperto). Hadlock: circa 28 settimane.",
                                                "HC18 collection: reference head circumference 258.5 mm (experienced sonographer). Hadlock: about 28 weeks.")},
    fonte=fonte_hc(693, '258,5'), vista={"serie": 0, "idx": 0, "zoom": 1, "panX": 0, "panY": 0, "nota": t("Testa fetale in assiale, terzo trimestre", "Fetal head, axial view, third trimester")},
    nota_docente=NOTA_HC + " HC18 693: CC 258,5 mm, pixel 0,155 mm. La frase sulla datazione nel primo trimestre è un'ipotesi del caso, non un dato della collezione.")

# schede di riferimento della mammella (BI-RADS dalla collezione; diametro dove si legge sulle scritte dell'ecografo)
SCHEDE = {'156': ('2', 20, 'Mammella sinistra, quadrante infero-interno: cisti semplice di circa 2 cm. BI-RADS 2: benigna.'),
          '157': ('3', None, 'Mammella sinistra, quadrante supero-esterno: massa solida ovale circoscritta, probabile fibroadenoma. BI-RADS 3: controllo a 6 mesi.'),
          '158': ('5', 14, 'Mammella destra: massa irregolare spiculata di circa 14 mm con ombra posteriore. BI-RADS 5: biopsia con ago tranciante.'),
          '159': ('4', None, 'Mammella sinistra, quadrante infero-interno: area ipoecogena irregolare con ombra posteriore. BI-RADS 4: biopsia con ago tranciante.'),
          '160': ('4', None, 'Mammella destra, quadrante infero-interno: massa irregolare microlobulata. BI-RADS 4: biopsia con ago tranciante.')}
for n, (br, d, testo) in SCHEDE.items():
    casi[n]['scale'] = [{"id": "mammella", "valori": {**({"d": d} if d else {}), "br": br}, "valore": f"BI-RADS {br}", "testo": testo}]
# ---------------------------------------------------------------- scrittura
ordine = ['id', 'visibile', 'aggiornato', 'titolo', 'titolo_interno', 'distretto', 'quesito', 'modalita', 'difficolta', 'anamnesi', 'domanda',
          'sezioni', 'opzioni', 'spiegazione', 'regola', 'esito_clinico', 'scale', 'fonte', 'serie_iniziale', 'riquadri', 'vista', 'nota_docente']
titoli = {}
for n, c in casi.items():
    cid = f'caso-tcia-{n}'
    assert os.path.exists(R + f'casi-free/{cid}/serie.json'), cid
    c = dict(c, id=cid, visibile=True, aggiornato=ORA)
    c.setdefault('serie_iniziale', 0); c.setdefault('riquadri', 1)
    testi = [c['titolo'], c['titolo_interno'], c['anamnesi'], c['domanda'], c['spiegazione'], c['regola'], c['esito_clinico']['testo'], c['vista']['nota']]
    testi += [x for s in c['sezioni'] for x in (s['nome'], s['domanda'])]
    testi += [x for o in c['opzioni'] for x in (o['testo'], o.get('nota')) if x]
    tr = {}
    for x in testi:
        assert x in EN, f'{cid}: manca la traduzione di «{x[:60]}»'
        tr[x] = EN[x]
    json.dump({k: c[k] for k in ordine if k in c}, open(R + f'casi-free/{cid}/caso.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(tr, open(R + f'cloud/web/lingua/casi/{cid}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(', ', ': '))
    titoli[c['titolo']] = EN[c['titolo']]
    print(cid, len(c['opzioni']), 'opzioni,', len(tr), 'testi tradotti')
f = R + 'cloud/web/lingua/casi/_titoli.json'; s = open(f, encoding='utf-8').read(); d = json.loads(s)
fm = None
for ind in (None, 1, 2):
    for sep in (None, (', ', ': '), (',', ':')):
        if json.dumps(d, ensure_ascii=False, indent=ind, separators=sep) + ('\n' if s.endswith('\n') else '') == s: fm = (ind, sep)
assert fm, 'formato _titoli.json'
d.update(titoli)
open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=fm[0], separators=fm[1]) + ('\n' if s.endswith('\n') else ''))
print('titoli aggiunti', len(titoli))
