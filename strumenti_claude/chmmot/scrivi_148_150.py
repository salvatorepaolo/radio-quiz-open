# scrivi_148_150.py: testi dei casi talassemia 148-150 (CHMMOTv1), modello caso-tcia-108/109
import json, os, sys
BASE = sys.argv[1]  # .../piattaforma-quiz/casi-free

FONTE = {
    "archivio": "Mendeley Data",
    "collezione": "CHMMOTv1 (Cardiac and Hepatic Multi-Echo T2* MRI Images and Clinical Dataset for Iron Overload on Thalassemia Patients)",
    "doi": "10.17632/3d8bwn2fsh.1",
    "licenza": "CC BY 4.0",
    "licenza_url": "https://creativecommons.org/licenses/by/4.0/",
    "citazione": "Jalilian M., Abedi I., Zamanian M., Bolhasani H. (2023). CHMMOTv1: Cardiac and Hepatic Multi-Echo (T2*) MRI Images and Clinical Dataset for Iron Overload on Thalassemia Patients (Version 1) [Data set]. Mendeley Data. https://doi.org/10.17632/3d8bwn2fsh.1. DICOM originali GE 1,5 T; serie riorganizzate da radio-quiz.it (una serie per fetta, echi in ordine di TE), pixel non modificati.",
}
SEZ = [
    {"nome": "Reperti", "domanda": "Che cosa vedi?"},
    {"nome": "Conclusioni", "domanda": "Qual è la conclusione?", "singola": True},
]
DOMANDA = "Scorri gli echi delle serie T2* (dal TE più breve al più lungo) nel cuore e nel fegato. Che cosa vedi e come lo quantifichi? Qual è la conclusione?"
FARMACI = "Terapia chelante (dettagli non forniti)"

SPIEGAZIONE_BASE = (
    "Il ferro accorcia il T2*: nelle sequenze gradient-echo multi-eco il segnale dei tessuti carichi di ferro cala tanto più in fretta quanto più ferro c'è. "
    "Si mette una ROI e si adatta una curva S(TE) = S0·e^(−TE/T2*); R2* = 1000/T2* (s⁻¹). "
    "Cuore: ROI a tutto spessore sul setto interventricolare della fetta medioventricolare in asse corto (lontano dagli artefatti di suscettibilità di vene cardiache e polmone della parete laterale). "
    "Soglie del cuore a 1,5 T: T2* > 20 ms normale, 10-20 ms sovraccarico lieve-moderato, < 10 ms grave. "
    "Fegato: ROI nel parenchima del lobo destro lontano dai vasi; dall'R2* si stima la concentrazione di ferro epatico (LIC, mg Fe/g di peso secco) con una curva di calibrazione (la collezione usa quella di Garbowski 2014: LIC ≈ 0,029·R2*^1,014). "
    "Classi della LIC più usate: < 2 mg/g normale (fino a circa 1,8), 2-7 lieve, 7-15 moderato, > 15 grave. "
    "Con segnali molto bassi il rumore crea un «pavimento»: un fit su tutti gli echi sovrastima il T2*; si usano il troncamento degli echi finali o un modello con costante (offset). "
    "Nel visualizzatore lo strumento T2* (Altre misure → T2*) riporta la ROI su tutti gli echi della fetta, mostra la curva, il T2* e l'R2* con i due modelli e, per il fegato, la LIC. "
)

casi = {}

# ---------------- 148: bambina di 6 anni, cuore normale, fegato grave ----------------
casi["148"] = {
    "titolo": "RM cardiaca e del fegato T2*: bambina di 6 anni con talassemia major in terapia trasfusionale",
    "titolo_interno": "Bambina: cuore senza sovraccarico (T2* 29,6 ms) e fegato con sovraccarico grave (T2* 2,0 ms, R2* 500 s⁻¹, LIC circa 16 mg/g) – CHMMOTv1 1023",
    "distretto": "Cuore",
    "modalita": "RM",
    "difficolta": "Avanzato",
    "quesito": "sovraccarico di ferro",
    "anamnesi": "Bambina di 6 anni con talassemia major, trasfusa regolarmente. RM a 1,5 T per il controllo del sovraccarico di ferro: gradient-echo multi-eco (12 echi) in asse corto del cuore (2 fette) e assiale del fegato (4 fette). Ferritina 5.410 µg/L, AST 27, ALT 38, ALP 325 U/L. Terapia chelante in corso (tipo e dosi non forniti dalla collezione).",
    "richiesta": {"reparto": "Ematologia pediatrica (centro talassemie)", "priorita": "P",
                  "lab": [["Ferritina", "5.410 µg/L"], ["AST / ALT", "27 / 38 U/L"], ["ALP", "325 U/L"]],
                  "allergie": "", "farmaci": FARMACI, "dispositivi": "", "gravidanza": ""},
    "opzioni": [
        {"testo": "Miocardio con segnale conservato fino agli ultimi echi, come il muscolo della parete toracica: T2* miocardico normale (> 20 ms)",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Valore della collezione: T2* 29,6 ms (R2* 33 s⁻¹, MIC 0,94 mg/g). Misura indicativa di radio-quiz.it: circa 25 ms su una ROI di parete del ventricolo sinistro; sul setto, spesso solo 2-3 pixel in una bambina, la ROI prende anche il sangue delle cavità e il valore sale oltre 80 ms."},
        {"testo": "Fegato chiaro nel primo eco che diventa quasi nero già al quarto eco (TE circa 5 ms), molto prima della milza e dei muscoli: sovraccarico epatico grave",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Collezione: T2* epatico 2,0 ms, R2* 500 s⁻¹ (la LIC del foglio, «1518», è un refuso: con la calibrazione della collezione R2* 500 dà circa 16 mg/g). Misura indicativa di radio-quiz.it sulle fette 2-3: 2,1-2,3 ms con il modello con offset."},
        {"testo": "In un cuore piccolo il setto è spesso pochi pixel: una ROI troppo larga prende il sangue delle cavità, che ha un T2* lungo, e falsa la misura verso valori alti",
         "corretta": True, "tipo": "secondario", "sezione": 0},
        {"testo": "Il miocardio scurisce rapidamente come il fegato: sovraccarico cardiaco grave",
         "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": "Il miocardio resta grigio fino agli ultimi echi; scurisce rapidamente il fegato."},
        {"testo": "Il fegato è già scuro nel primo eco, quindi il T2* non è misurabile",
         "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": "Nel primo eco (TE circa 1 ms) il fegato ha ancora segnale: il calo nei 3-4 echi successivi basta per il fit (T2* circa 2 ms)."},
        {"testo": "Sovraccarico di ferro epatico grave con cuore senza ferro: segnalarlo all'ematologo con il referto per adeguare la chelazione e ripetere la RM T2* di cuore e fegato nei controlli periodici",
         "corretta": True, "tipo": "principale", "sezione": 1},
        {"testo": "Sovraccarico di ferro cardiaco grave: rischio di scompenso, chelazione intensiva per il cuore",
         "corretta": False, "tipo": "distrattore", "sezione": 1},
        {"testo": "Nessun sovraccarico significativo: a 6 anni il ferro non si accumula ancora e la ferritina alta è dovuta a infiammazione",
         "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": "Il ferro trasfusionale si accumula fin dai primi anni, prima nel fegato; il cuore di solito si carica più tardi."},
        {"testo": "Esame non valutabile nei bambini: la misura T2* vale solo negli adulti",
         "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": "La RM T2* si usa anche nei bambini, quando riescono a stare fermi e trattenere il respiro (spesso dai 6-8 anni; prima può servire la sedazione)."},
    ],
    "spiegazione": SPIEGAZIONE_BASE + (
        "In questa bambina il miocardio non perde segnale in modo apprezzabile negli echi (T2* della collezione 29,6 ms, normale), mentre il fegato è quasi nero dal quarto eco (T2* 2,0 ms, R2* 500 s⁻¹, LIC circa 16 mg/g: grave). "
        "Nel bambino il ferro trasfusionale si deposita prima nel fegato; il cuore si carica di solito più tardi, ma va controllato periodicamente con la RM. "
        "Nei cuori piccoli il setto è sottile: ingrandisci l'immagine prima di disegnare la ROI e tienila nel miocardio, anche a costo di pochi pixel, perché il sangue delle cavità ha un T2* lungo e alza il valore (una ROI che prende il sangue dà con lo strumento T2* valori oltre 100-200 ms)."
    ),
    "esito_clinico": {"tipo": "altro", "testo": "Valori della collezione CHMMOTv1: T2* cardiaco 29,6 ms (R2* 33,1 s⁻¹, MIC 0,94 mg/g), cuore «Normal»; T2* epatico 2,0 ms (R2* 499,7 s⁻¹), fegato «Severe»; ferritina 5.410 µg/L."},
    "comunicazione": {"livello": "differita", "accettabili": ["urgente"], "destinatari": ["richiedente"],
                      "parole": ["fegato", "T2*"],
                      "motivo": "Sovraccarico epatico grave con cuore senza ferro: va segnalato all'ematologo con il referto per adeguare la chelazione, senza urgenza."},
    "regola": "Nel bambino il ferro si deposita prima nel fegato: misura sempre fegato e cuore, e nel cuore piccolo tieni la ROI nel miocardio, fuori dal sangue.",
    "serie_iniziale": 0, "riquadri": 2, "disposizione": [0, 3],
    "vista": {"serie": 0, "idx": 0, "zoom": 1.8, "panX": 0, "panY": 0, "nota": "Asse corto, primo eco: scorri gli echi e confronta miocardio e fegato"},
    "nota_docente": "Preparato il 22/11/2026. CHMMOTv1 (Mendeley, CC BY 4.0), paziente 1023 del foglio «With Follow-Up» (F, 6 anni), seconda riga del foglio (T2* cuore 29,6 ms, fegato 2,0 ms). Importate: 1023_3/SR_12 e SR_14 (T2* cuore, 2 fette × 12 echi), 1023_4/SR_3 (T2* fegato, 4 fette × 12 echi); nessuna cine per questo esame. Serie divise per fetta e ordinate per TE con strumenti_claude/chmmot/prepara2.py (pixel non modificati), poi anonimizza.py; descrizioni e numeri di serie ripuliti. L'altro esame della stessa paziente (prima riga: cuore 5,7 ms, fegato 0,3 ms; cartelle 1023_1 e 1023_2) è stato escluso: la collezione non dà l'intervallo né la data delle visite, l'età è 6 anni in entrambe e un miglioramento del cuore da 5,7 a 29,6 ms con ferritina in aumento non è plausibile senza dati; le serie sono in _tcia_grezzi/chmmot/escluse_148_esameA. Immagini: corrispondenza confermata (esame escluso con fegato nero già al primo eco, questo con fegato chiaro al primo eco e nero al quarto). La LIC del foglio (1518) è un refuso: con la formula della collezione R2* 499,7 dà circa 15,8 mg/g. Misure di Claude (strumenti_claude/chmmot/t2star*.py): fegato fetta 2 e 3 (ROI x 165-195, y 265-290) T2* 2,1-2,3 ms con offset; cuore: parete del VS (x 133-139, y 133-139, fetta 1) circa 25 ms; ROI sul setto (x 114-118) 80-120 ms perché il setto è di 2-3 pixel e la ROI prende il sangue. Funzione ventricolare non valutabile (nessuna cine).",
}

# ---------------- 149: ragazza di 14 anni, cuore normale, fegato lieve ----------------
casi["149"] = {
    "titolo": "RM cardiaca e del fegato T2*: ragazza di 14 anni con talassemia major in terapia trasfusionale",
    "titolo_interno": "Cuore senza sovraccarico (T2* 33,9 ms) e fegato con sovraccarico lieve (T2* 7,4 ms, LIC 4,3 mg/g) – CHMMOTv1 2014",
    "distretto": "Cuore",
    "modalita": "RM",
    "difficolta": "Base",
    "quesito": "sovraccarico di ferro",
    "anamnesi": "Ragazza di 14 anni con talassemia major, trasfusa regolarmente. RM a 1,5 T per il controllo del sovraccarico di ferro: gradient-echo multi-eco (12 echi) in asse corto del cuore e assiale del fegato, cine bSSFP. Ferritina 1.997 µg/L, AST 19, ALT 12, ALP 349 U/L. Terapia chelante in corso (tipo e dosi non forniti dalla collezione).",
    "richiesta": {"reparto": "Ematologia (centro talassemie)", "priorita": "P",
                  "lab": [["Ferritina", "1.997 µg/L"], ["AST / ALT", "19 / 12 U/L"], ["ALP", "349 U/L"]],
                  "allergie": "", "farmaci": FARMACI, "dispositivi": "", "gravidanza": ""},
    "opzioni": [
        {"testo": "Setto interventricolare con segnale conservato fino agli ultimi echi: T2* miocardico normale (> 20 ms)",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Collezione: T2* 33,9 ms (R2* 29,5 s⁻¹, MIC 0,94 mg/g). Misura indicativa di radio-quiz.it sul setto della fetta 2: 25-27 ms."},
        {"testo": "Fegato che scurisce in modo graduale negli echi, più del muscolo paravertebrale ma senza diventare nero: sovraccarico epatico lieve",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Collezione: T2* epatico 7,4 ms, R2* 138 s⁻¹, LIC 4,3 mg/g (lieve: 2-7 mg/g). Misura indicativa di radio-quiz.it sulla fetta 3: circa 7,8 ms con offset."},
        {"testo": "Fegato quasi nero già dal secondo eco: sovraccarico epatico grave",
         "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": "È il quadro dei casi con T2* epatico di 1-2 ms (per esempio 108 e 150); qui il fegato ha ancora segnale agli ultimi echi."},
        {"testo": "Il T2* epatico di circa 7 ms è nella norma, quindi non c'è ferro nel fegato",
         "corretta": False, "tipo": "distrattore", "sezione": 0,
         "nota": "Conta la LIC stimata dall'R2*: 4,3 mg/g è sopra il normale (fino a circa 1,8-2 mg/g), e la collezione la classifica «Mild». Alcune tabelle mettono il limite del T2* epatico intorno ai 6 ms, ma con le calibrazioni su biopsia (come quella di Garbowski) una LIC normale corrisponde a un T2* di circa 15 ms o più."},
        {"testo": "Sovraccarico di ferro epatico lieve, cuore senza ferro: quadro controllato dalla chelazione; refertare con i valori e proseguire i controlli RM periodici",
         "corretta": True, "tipo": "principale", "sezione": 1},
        {"testo": "Sovraccarico cardiaco lieve-moderato (T2* 10-20 ms): rivalutare la chelazione per il cuore",
         "corretta": False, "tipo": "distrattore", "sezione": 1},
        {"testo": "Sovraccarico epatico grave: avvisare subito l'ematologo per intensificare la chelazione",
         "corretta": False, "tipo": "distrattore", "sezione": 1},
        {"testo": "Nessun accumulo di ferro: con questa ferritina la RM è inutile",
         "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": "La LIC è 4,3 mg/g, sopra il normale, e la ferritina non predice il ferro cardiaco né quello epatico con precisione."},
    ],
    "spiegazione": SPIEGAZIONE_BASE + (
        "In questa ragazza il setto resta grigio fino agli ultimi echi (T2* 33,9 ms nella collezione: normale), mentre il fegato scurisce gradualmente: T2* 7,4 ms, R2* 138 s⁻¹, LIC 4,3 mg/g, sovraccarico lieve. "
        "Attenzione a non leggere il T2* epatico con le soglie del cuore: per il fegato si ragiona sulla LIC. "
        "È un quadro di buon controllo della chelazione: si referta con i valori e si prosegue con i controlli periodici."
    ),
    "esito_clinico": {"tipo": "altro", "testo": "Valori della collezione CHMMOTv1: T2* cardiaco 33,9 ms (R2* 29,5 s⁻¹, MIC 0,94 mg/g), cuore «Normal»; T2* epatico 7,4 ms (R2* 138,2 s⁻¹, LIC 4,3 mg/g), fegato «Mild»; ferritina 1.997 µg/L."},
    "comunicazione": {"livello": "nessuna", "accettabili": ["differita"], "destinatari": ["richiedente"],
                      "parole": ["fegato", "lieve"],
                      "motivo": "Sovraccarico epatico lieve e cuore normale: basta il referto, non serve una comunicazione a parte."},
    "regola": "Per il fegato conta la LIC stimata dall'R2*, non le soglie del T2* cardiaco.",
    "serie_iniziale": 1, "riquadri": 2, "disposizione": [1, 6],
    "vista": {"serie": 1, "idx": 0, "zoom": 1.6, "panX": 0, "panY": 0, "nota": "Fetta medioventricolare, primo eco: scorri gli echi e guarda il setto"},
    "nota_docente": "Preparato il 22/11/2026. CHMMOTv1 (Mendeley, CC BY 4.0), paziente 2014 del foglio «Without Follow-Up» (F, 14 anni). Importate: 2014_1/SR_9 (T2* cuore, 3 fette × 12 echi), 2014_1/SR_6 (cine bSSFP, 30 fasi), 2014_2/SR_3 (T2* fegato, 4 fette × 12 echi). Serie divise per fetta e ordinate per TE con strumenti_claude/chmmot/prepara2.py (pixel non modificati), poi anonimizza.py. Misure di Claude (strumenti_claude/chmmot/t2star*.py): setto fetta 2 (x 116-122, y 113-130) 25-27 ms; fegato fetta 3 (x 140-220, y 230-270) 7,8-7,9 ms con offset, 8,7-9,3 ms log-lineare. Coerente con la collezione (33,9 e 7,4 ms). La LIC 4,3 mg/g torna con la formula della collezione (0,029·138,2^1,014). Le colonne della bilirubina del foglio non sono usate (in alcuni pazienti la diretta supera la totale).",
}

# ---------------- 150: donna di 35 anni, cuore moderato, fegato molto grave, ferritina bassa ----------------
casi["150"] = {
    "titolo": "RM cardiaca e del fegato T2*: donna di 35 anni con talassemia major, ferritina 1.191 µg/L",
    "titolo_interno": "Ferritina non elevatissima ma sovraccarico cardiaco lieve-moderato (T2* 11 ms) ed epatico grave (T2* 1,6 ms, LIC 19,9 mg/g) – CHMMOTv1 2003",
    "distretto": "Cuore",
    "modalita": "RM",
    "difficolta": "Intermedio",
    "quesito": "sovraccarico di ferro",
    "anamnesi": "Donna di 35 anni con talassemia major, trasfusa regolarmente. RM a 1,5 T per il controllo del sovraccarico di ferro: gradient-echo multi-eco (12 echi) in asse corto del cuore e assiale del fegato, cine bSSFP. Ferritina 1.191 µg/L, AST 17, ALT 21, ALP 295 U/L. Terapia chelante in corso (tipo e dosi non forniti dalla collezione).",
    "richiesta": {"reparto": "Ematologia (centro talassemie)", "priorita": "P",
                  "lab": [["Ferritina", "1.191 µg/L"], ["AST / ALT", "17 / 21 U/L"], ["ALP", "295 U/L"]],
                  "allergie": "", "farmaci": FARMACI, "dispositivi": "", "gravidanza": ""},
    "opzioni": [
        {"testo": "Setto che perde segnale negli echi intermedi più del muscolo scheletrico, ma senza diventare nero: T2* miocardico tra 10 e 20 ms, sovraccarico cardiaco lieve-moderato",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Collezione: T2* 11,0 ms (R2* 91 s⁻¹, MIC 2,7 mg/g). Misura indicativa di radio-quiz.it sul setto della fetta 2: 11-12 ms."},
        {"testo": "Fegato quasi nero dal secondo-terzo eco: sovraccarico epatico grave (LIC oltre 15 mg/g)",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Collezione: T2* 1,6 ms, R2* 627 s⁻¹, LIC 19,9 mg/g («Very severe» nella collezione). Misura indicativa di radio-quiz.it sulla fetta 3: circa 1,4 ms con offset; un fit log-lineare su tutti gli echi dà circa 9 ms per il pavimento di rumore."},
        {"testo": "Anche la milza scurisce rapidamente negli echi: c'è ferro anche nella milza, come atteso nell'emosiderosi trasfusionale",
         "corretta": True, "tipo": "secondario", "sezione": 0,
         "nota": "Misura indicativa sulla milza (fetta 3): T2* circa 1 ms."},
        {"testo": "Il setto ha lo stesso segnale del muscolo scheletrico in tutti gli echi: cuore senza ferro",
         "corretta": False, "tipo": "distrattore", "sezione": 0},
        {"testo": "Sovraccarico cardiaco lieve-moderato ed epatico grave nonostante una ferritina non molto alta: segnalarlo all'ematologo con il referto per rivedere la chelazione",
         "corretta": True, "tipo": "principale", "sezione": 1},
        {"testo": "Con una ferritina di circa 1.200 µg/L il sovraccarico è per forza modesto: nessuna modifica della terapia",
         "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": "La ferritina stima male il ferro dei tessuti, soprattutto quello cardiaco: per questo si fa la RM."},
        {"testo": "Sovraccarico cardiaco grave (T2* sotto 10 ms): rischio immediato di scompenso e aritmie, comunicazione urgente",
         "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": "Il T2* è di 11 ms: lieve-moderato, vicino alla soglia del grave. Va segnalato, ma non è il quadro sotto i 10 ms."},
        {"testo": "Quadro di emocromatosi primitiva: test genetico HFE e salassi",
         "corretta": False, "tipo": "distrattore", "sezione": 1,
         "nota": "Nella talassemia trasfusa il ferro viene dalle trasfusioni (milza coinvolta); il salasso non si può fare in un'anemia trasfusione-dipendente."},
    ],
    "spiegazione": SPIEGAZIONE_BASE + (
        "Qui la ferritina è relativamente bassa (1.191 µg/L), ma la RM mostra un fegato quasi nero dal secondo-terzo eco (T2* 1,6 ms, LIC 19,9 mg/g: grave) e un setto che scurisce più del muscolo (T2* 11 ms: lieve-moderato, vicino alla soglia del grave). "
        "Anche la milza perde segnale rapidamente: nel sovraccarico trasfusionale il ferro si accumula nei macrofagi del sistema reticolo-endoteliale (fegato e milza), mentre nell'emocromatosi primitiva la milza è risparmiata. "
        "La ferritina è un indicatore indiretto e imperfetto: non sostituisce la misura del ferro nel cuore e nel fegato."
    ),
    "esito_clinico": {"tipo": "altro", "testo": "Valori della collezione CHMMOTv1: T2* cardiaco 11,0 ms (R2* 91,2 s⁻¹, MIC 2,7 mg/g), cuore «Moderate»; T2* epatico 1,6 ms (R2* 626,9 s⁻¹, LIC 19,92 mg/g), fegato «Very severe»; ferritina 1.191 µg/L."},
    "comunicazione": {"livello": "differita", "accettabili": ["urgente"], "destinatari": ["richiedente"],
                      "parole": ["T2*", "cuore", "fegato"],
                      "motivo": "Ferro cardiaco lieve-moderato ed epatico grave con ferritina non molto alta: l'ematologo deve saperlo per rivedere la chelazione; non è un'urgenza da minuti."},
    "regola": "La ferritina non basta: un fegato grave e un cuore già carico possono esserci anche con ferritina di poco sopra i 1.000 µg/L.",
    "serie_iniziale": 1, "riquadri": 2, "disposizione": [1, 6],
    "vista": {"serie": 1, "idx": 0, "zoom": 1.6, "panX": 0, "panY": 0, "nota": "Fetta medioventricolare, primo eco: scorri gli echi e guarda il setto"},
    "nota_docente": "Preparato il 22/11/2026. CHMMOTv1 (Mendeley, CC BY 4.0), paziente 2003 del foglio «Without Follow-Up» (F, 35 anni). Importate: 2003_1/SR_9 (T2* cuore, 3 fette × 12 echi), 2003_1/SR_6 (cine bSSFP, 30 fasi), 2003_2/SR_3 (T2* fegato, 4 fette × 12 echi). Serie divise per fetta e ordinate per TE con strumenti_claude/chmmot/prepara2.py (pixel non modificati), poi anonimizza.py. Misure di Claude (strumenti_claude/chmmot/t2star*.py): setto fetta 2 (x 114-119, y 110-130) 11,2-11,8 ms; fegato fetta 3 (x 100-160, y 240-290) 1,4 ms con offset, 8,7-9,4 ms log-lineare (pavimento di rumore); milza (x 340-360, y 280-320) circa 0,8 ms con offset. Coerente con la collezione (11,0 e 1,6 ms). Nelle soglie della LIC usate nel caso (> 15 mg/g grave) 19,9 mg/g è «grave»; la collezione lo chiama «Very severe». Le colonne della bilirubina del foglio non sono usate (diretta 2,1 > totale 0,3: incoerenti).",
}

for cid, c in casi.items():
    p = os.path.join(BASE, f"caso-tcia-{cid}", "caso.json")
    d = {"titolo": c["titolo"], "titolo_interno": c["titolo_interno"], "distretto": c["distretto"], "modalita": c["modalita"],
         "difficolta": c["difficolta"], "quesito": c["quesito"], "anamnesi": c["anamnesi"], "richiesta": c["richiesta"],
         "domanda": DOMANDA, "sezioni": SEZ, "opzioni": c["opzioni"], "spiegazione": c["spiegazione"],
         "esito_clinico": c["esito_clinico"], "fonte": FONTE, "serie_iniziale": c["serie_iniziale"], "riquadri": c["riquadri"],
         "disposizione": c["disposizione"], "vista": c["vista"], "comunicazione": c["comunicazione"], "regola": c["regola"],
         "nota_docente": c["nota_docente"], "id": f"caso-tcia-{cid}", "visibile": False}
    json.dump(d, open(p, "w"), ensure_ascii=False, indent=1)
    print("scritto", p)
