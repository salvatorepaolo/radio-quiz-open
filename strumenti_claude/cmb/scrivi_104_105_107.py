import json,os
B=os.path.expanduser("~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free")
LIC="https://creativecommons.org/licenses/by/4.0/"
def O(t,c,tipo,sez,nota=""):
    d={"testo":t,"corretta":c,"tipo":tipo,"sezione":sez}
    if nota: d["nota"]=nota
    return d
def scrivi(cid,c):
    c=dict(id=cid,visibile=False,aggiornato="2026-10-25 19:30",**c)
    json.dump(c,open(f"{B}/{cid}/caso.json","w",encoding="utf8"),ensure_ascii=False,indent=1); print("scritto",cid)

FONTE_MYEL=lambda sogg:{"archivio":"The Cancer Imaging Archive (TCIA)","collezione":"Spinal-Multiple-Myeloma-SEG","soggetto":sogg,"doi":"10.7937/k4qv-hh78","licenza":"CC BY 4.0","licenza_url":LIC,
 "citazione":"Nohel M., Válek V., Rohan T., Štork M., Jakubíček R., Chmelík J., Dostál M. (2026). Segmentation of spinal multiple myeloma lesions in dual-energy CT (Spinal-Multiple-Myeloma-SEG) (Version 1) [Dataset]. The Cancer Imaging Archive. https://doi.org/10.7937/k4qv-hh78",
 "url":"https://www.cancerimagingarchive.net/collection/spinal-multiple-myeloma-seg/",
 "note":"Strati originali da 0,9 mm (passo 0,6 mm) mediati a gruppi di 4 (circa 2,4 mm) per il visualizzatore; serie native dello scanner, nessun altro intervento sui pixel."}

scrivi("caso-tcia-104",{
 "titolo":"TC a doppia energia del rachide: mieloma multiplo in seconda linea di terapia",
 "titolo_interno":"Mieloma multiplo micromolecolare lambda: lesioni litiche multiple del rachide, maggiori nei corpi da T8 a L1 (sostituzione della spongiosa, corticale conservata); midollo infiltrato chiaro nella mappa a soppressione del calcio (Myel_008)",
 "distretto":"Rachide","quesito":"oncologico","modalita":"TC","difficolta":"Intermedio",
 "anamnesi":"Uomo di 65 anni con mieloma multiplo a catene leggere lambda (catene leggere libere lambda nel siero circa 9.300 mg/L), stadio ISS 3, creatinina 377 µmol/L, calcio nella norma. TC a bassa dose del rachide su apparecchio a doppia energia, eseguita prima della seconda linea di terapia. Sono disponibili la TC convenzionale e la ricostruzione con soppressione del calcio (indice 50).",
 "domanda":"Leggi la colonna con la finestra per l'osso e confronta la TC convenzionale con la mappa a soppressione del calcio.",
 "sezioni":[{"nome":"Scheletro","domanda":"Che cosa vedi nei corpi vertebrali?"},{"nome":"Doppia energia","domanda":"Che cosa aggiunge la ricostruzione con soppressione del calcio?"},{"nome":"Conclusioni","domanda":"Qual è la conclusione?","singola":True}],
 "opzioni":[
  O("Lesioni litiche nei corpi vertebrali da T8 a L1: la spongiosa è sostituita da tessuto a densità dei tessuti molli (circa 20-45 HU) con corticale assottigliata ma conservata",True,"principale",0,"Nella segmentazione degli esperti le lesioni maggiori sono in T8 (circa 20 mL), L1, T11, T12 e T9; nelle vertebre senza lesioni la spongiosa misura circa 130-290 HU."),
  O("Piccole lesioni litiche multiple anche in altri segmenti (cervicali, dorsali alti, lombari)",True,"secondario",0,"La collezione ne segmenta 32 in tutto, da C2 a L3: molte sono di pochi millimetri e si cercano con la finestra per l'osso e le ricostruzioni."),
  O("T8 ha struttura disomogenea, con aree litiche alternate ad aree più dense",True,"secondario",0,"Immagine 109 della TC convenzionale."),
  O("Metastasi osteoaddensanti multiple",False,"distrattore",0,"Le lesioni tolgono osso, non lo aggiungono: nel mieloma le lesioni sono litiche (a «colpo di pugno»), di solito senza orletto sclerotico."),
  O("Crolli vertebrali multipli con frammenti nel canale",False,"distrattore",0,"I corpi lesionati mantengono la forma e la parete posteriore è integra: il rischio di cedimento c'è, ma il crollo non si vede."),
  O("Nella mappa a soppressione del calcio i corpi da T9 a L1 sono chiari (circa 5-20 HU), mentre nelle vertebre sane il midollo è scuro, cioè grasso (circa da -40 a -130 HU)",True,"principale",1,"Togliendo il contributo del calcio resta il contenuto del midollo: grasso nell'adulto sano, tessuto (plasmacellule) dove c'è infiltrazione. È lo stesso principio della RM in T1."),
  O("La soppressione del calcio serve solo a ridurre gli artefatti metallici",False,"distrattore",1,"Per gli artefatti metallici si usano le immagini monoenergetiche ad alta energia; la soppressione del calcio mostra il midollo osseo."),
  O("Nella mappa a soppressione del calcio le vertebre lesionate risultano più scure di quelle sane",False,"distrattore",1,"È il contrario: il midollo infiltrato perde il grasso e diventa più chiaro."),
  O("Mieloma multiplo con lesioni litiche multiple del rachide e infiltrazione midollare estesa da T8 a L1: malattia ossea attiva (criterio CRAB), valutare il rischio di cedimento (SINS) e, se dolore o deficit, la RM",True,"secondario",2),
  O("Metastasi litiche da tumore solido: serve la ricerca del primitivo",False,"distrattore",2,"La diagnosi di mieloma è nota e le catene leggere sono molto alte: lesioni litiche multiple senza sclerosi sono il quadro tipico."),
  O("Osteoporosi senile senza lesioni focali",False,"distrattore",2,"L'osteoporosi riduce la densità in modo uniforme e conserva il grasso midollare (scuro nella mappa a soppressione del calcio); qui ci sono aree focali con tessuto che sostituisce l'osso.")],
 "spiegazione":"Nel mieloma multiplo la TC «total body» a bassa dose ha sostituito la vecchia radiografia dello scheletro (linee guida IMWG): basta una lesione litica di almeno 5 mm per definire la malattia ossea che richiede terapia (criterio CRAB, «B» = bone). Le lesioni sono litiche, senza orletto sclerotico; in questo paziente i corpi da T8 a L1 hanno la spongiosa sostituita da tessuto a 20-45 HU, mentre nelle vertebre sane la spongiosa misura 130-290 HU.\n\nLa TC a doppia energia permette di «togliere» il calcio (virtual non-calcium): nell'adulto il midollo osseo normale è in gran parte grasso e appare scuro (valori negativi), mentre il midollo infiltrato dalle plasmacellule è chiaro, come in RM T1. È utile anche dove la corticale non è ancora erosa: qui le vertebre lesionate misurano circa 5-20 HU, quelle sane da -40 a -130 HU.\n\nCose da riportare: livelli coinvolti, lesioni maggiori, integrità del muro posteriore e del canale, rischio di frattura (SINS), masse extraossee. Le lesioni vanno contate dal sacro o da C2 (usa le ricostruzioni sagittali dell'MPR).\n\nTrappole: non confondere l'osteoporosi diffusa (densità ridotta ma grasso conservato) con l'infiltrazione; nel paziente trattato le lesioni possono diventare sclerotiche durante la risposta (T8 qui ha aree più dense).",
 "regola":"Nel mieloma cerca lesioni litiche ≥ 5 mm su tutta la colonna; con la doppia energia, il midollo chiaro nella mappa senza calcio vuol dire infiltrazione.",
 "esito_clinico":{"tipo":"altro","testo":"Dati della collezione Spinal-Multiple-Myeloma-SEG (paziente Myel_008): mieloma multiplo a catene leggere lambda, ISS 3, seconda linea di terapia (lenalidomide + daratumumab + desametasone), risposta massima parziale (PR). Lesioni litiche segmentate dagli esperti: 32, da C2 a L3, circa 93 mL in tutto."},
 "fonte":FONTE_MYEL("Myel_008"),
 "serie_iniziale":0,"riquadri":2,
 "vista":{"serie":0,"idx":124,"zoom":1,"panX":0,"panY":0,"nota":"T9: spongiosa sostituita da tessuto molle, corticale conservata"},
 "comunicazione":{"livello":"nessuna","accettabili":["differita"],"destinatari":["richiedente"],"parole":["mieloma","litic"],"motivo":"Malattia nota e già in cura; nessun segno di compressione midollare o di crollo: basta il referto. Un crollo con frammento nel canale o un deficit neurologico richiederebbero una chiamata urgente."},
 "nota_docente":"DA CONTROLLARE. Caso creato da Claude il 25/10/2026 da Spinal-Multiple-Myeloma-SEG (IDC, CC BY 4.0), paziente Myel_008, studio 2014-07. Serie: TC convenzionale e Calcium Suppression 50 Index, entrambe mediate a 4 strati (0,6 → 2,4 mm) con strumenti_claude/vm/media_strati.py, poi anonimizza.py. Lesioni dalla SEG della collezione (strumenti_claude/vm/seg_lesioni.py, indici nella serie pubblicata): T8 20,2 mL (img 109), L1 17,7 mL (img 171), T11 16,7 mL (img 146), T12 16,1 mL (img 158), T9 12,3 mL (img 124), T10 5,9 mL (img 133); 26 piccole lesioni < 1 mL da C2 a L3. Densità misurate da Claude (ROI 1 cm al centro del corpo): convenzionale T9 22, T11 33, T12 25, L1 43 HU, T8 192 HU (disomogenea); vertebre sane circa 130-290 HU. Soppressione del calcio: lesioni 5-20 HU, sane da -37 a -132 HU. Non verificati: muro posteriore e canale su tutti i livelli (a vista integri nelle immagini 109-171), presenza di masse paravertebrali. Clinica dalla tabella TSV della collezione (_tcia_grezzi/clinici/myel/)."
})

scrivi("caso-tcia-105",{
 "titolo":"Ecografia del fegato prima di una biopsia: paziente con melanoma",
 "titolo_interno":"Noduli epatici ipoecogeni multipli in paziente con melanoma (probabili metastasi), ecografia di guida alla biopsia (CMB-MEL MSB-07848)",
 "distretto":"Addome","quesito":"oncologico","modalita":"Ecografia","difficolta":"Base",
 "anamnesi":"Paziente con melanoma, arruolato in un programma di biobanca che raccoglie tessuto tumorale. Ecografia del lobo destro del fegato eseguita per guidare una biopsia percutanea. Età, sesso e altri dati clinici non sono forniti dalla collezione.",
 "domanda":"Descrivi il fegato e le lesioni bersaglio.",
 "sezioni":[{"nome":"Reperti","domanda":"Che cosa vedi?"},{"nome":"Conclusioni","domanda":"Qual è l'interpretazione più probabile?","singola":True}],
 "opzioni":[
  O("Noduli multipli ipoecogeni, solidi, rotondeggianti, di circa 1-2 cm, nel lobo destro del fegato",True,"principale",0,"Si vedono in diverse scansioni (immagini 0, 1, 2, 4, 5)."),
  O("Al color Doppler i noduli non mostrano segnale vascolare evidente al loro interno",True,"secondario",0,"Immagini 1 e 2: nella finestra colore non c'è flusso nei noduli; il Doppler a bassa sensibilità non esclude però una vascolarizzazione."),
  O("Noduli anecogeni con rinforzo posteriore (cisti)",False,"distrattore",0,"Sono ipoecogeni, non anecogeni, e non hanno rinforzo di parete posteriore."),
  O("Un'unica lesione iperecogena omogenea a margini netti",False,"distrattore",0,"Le lesioni sono più d'una e scure rispetto al parenchima."),
  O("Dilatazione delle vie biliari intraepatiche",False,"distrattore",0,"Le strutture tubulari visibili sono vasi; non ci sono dotti dilatati paralleli ai rami portali."),
  O("Metastasi epatiche multiple, probabili, da melanoma: la biopsia serve a confermarle e a raccogliere tessuto",True,"principale",1),
  O("Emangiomi multipli: nessun approfondimento",False,"distrattore",1,"Gli emangiomi tipici sono iperecogeni; noduli ipoecogeni multipli in un paziente oncologico sono metastasi fino a prova contraria."),
  O("Steatosi focale",False,"distrattore",1,"La steatosi focale è iperecogena e ha sedi tipiche (vicino alla colecisti, al legamento falciforme); la risparmio focale è ipoecogena ma non forma noduli multipli rotondi.")],
 "spiegazione":"In un paziente con tumore noto, noduli solidi ipoecogeni multipli nel fegato sono metastasi fino a prova contraria. L'aspetto ecografico delle metastasi è vario: ipoecogene (le più frequenti), «a bersaglio» con alone ipoecogeno, iperecogene (tumori ipervascolari, carcinoide, colon) o cistiche. Nel melanoma sono spesso multiple e ipoecogene.\n\nDiagnosi differenziale: le cisti sono anecogene con rinforzo posteriore; gli emangiomi tipici sono iperecogeni e ben definiti; la steatosi focale e le aree di risparmio hanno sedi tipiche e non deformano i vasi. Il passo successivo è la stadiazione con TC o RM con mezzo di contrasto e, se serve una conferma istologica, la biopsia ecoguidata sul nodulo più accessibile, come in questo esame.",
 "regola":"Noduli epatici solidi multipli in un paziente oncologico: metastasi fino a prova contraria.",
 "esito_clinico":{"tipo":"altro","testo":"Dati della collezione CMB-MEL (Cancer Moonshot Biobank): paziente con melanoma; ecografia eseguita per una biopsia del fegato. L'istologia del campione non è pubblica nei dati aperti."},
 "fonte":{"archivio":"The Cancer Imaging Archive (TCIA)","collezione":"CMB-MEL (Cancer Moonshot Biobank – Melanoma Collection)","soggetto":"MSB-07848","doi":"10.7937/GWSP-WH72","licenza":"CC BY 4.0","licenza_url":LIC,
  "citazione":"Cancer Moonshot Biobank. (2022). Cancer Moonshot Biobank – Melanoma Collection (CMB-MEL) [dataset]. The Cancer Imaging Archive. Data used in this publication were generated by the National Cancer Institute's Cancer Moonshot Biobank.",
  "url":"https://www.cancerimagingarchive.net/collection/cmb-mel/"},
 "serie_iniziale":0,"riquadri":0,
 "vista":{"serie":0,"idx":1,"zoom":1,"panX":0,"panY":0,"nota":"Noduli ipoecogeni multipli del lobo destro"},
 "comunicazione":{"livello":"nessuna","accettabili":["differita"],"destinatari":["richiedente"],"parole":["metastasi"],"motivo":"Esame eseguito per la biopsia in un paziente con tumore noto: basta il referto."},
 "nota_docente":"DA CONTROLLARE. Caso creato da Claude il 25/10/2026 da CMB-MEL (IDC, CC BY 4.0), paziente MSB-07848, serie «US liver biopsy» (GE LOGIQ E9, 15 immagini): tolta un'immagine vuota (la quarta, solo artefatto); le altre 14 anonimizzate con anonimizza.py (aggiunta PlanarConfiguration=0 nelle due immagini color Doppler, che ne erano prive). Le calibrazioni (Ultrasound Regions) sono state tolte dall'anonimizzazione: niente misure in mm nel visualizzatore; le dimensioni (1-2 cm) sono stimate sulla scala di profondità (15 cm). Non è nota la sede esatta del prelievo né l'istologia. DOI della collezione da ricontrollare sulla pagina TCIA."
})

scrivi("caso-tcia-107",{
 "titolo":"Ecografia del collo prima di una biopsia: carcinoma polmonare e linfonodo cervicale destro",
 "titolo_interno":"Linfonodo cervicale destro ingrandito (circa 2,8 × 1,7 cm), rotondo, ipoecogeno, senza ilo adiposo: probabile metastasi linfonodale; biopsia ecoguidata (CMB-LCA MSB-02120)",
 "distretto":"Collo","quesito":"oncologico","modalita":"Ecografia","difficolta":"Base",
 "anamnesi":"Paziente con carcinoma polmonare, arruolato in un programma di biobanca che raccoglie tessuto tumorale. Ecografia del collo a destra e biopsia ecoguidata di un linfonodo. Età, sesso e altri dati clinici non sono forniti dalla collezione.",
 "domanda":"Descrivi il linfonodo bersaglio e i criteri che lo rendono sospetto.",
 "sezioni":[{"nome":"Reperti","domanda":"Che cosa vedi?"},{"nome":"Conclusioni","domanda":"Qual è l'interpretazione?","singola":True}],
 "opzioni":[
  O("Linfonodo cervicale destro ingrandito, di circa 2,8 × 1,7 cm, di forma rotondeggiante",True,"principale",0,"Misure impresse nell'immagine 3 (2,78 e 1,74 cm); altri linfonodi vicini misurano circa 2 e 1,9 × 1,1 cm."),
  O("Struttura ipoecogena omogenea, senza ilo adiposo iperecogeno riconoscibile",True,"secondario",0,"La perdita dell'ilo e la forma rotonda sono i criteri più utili di sospetto."),
  O("Il linfonodo è accanto a una grossa vena del collo (immagini 0-1), che va riconosciuta prima del prelievo",True,"secondario",0,"Il vaso anecogeno ovale accanto al linfonodo è verosimilmente la vena giugulare interna: con l'eco si sceglie un percorso dell'ago che lo eviti."),
  O("Linfonodo ovale con ilo adiposo conservato e rapporto asse corto/lungo < 0,5",False,"distrattore",0,"È la descrizione di un linfonodo reattivo, non di questo."),
  O("Cisti della seconda fessura branchiale",False,"distrattore",0,"La lesione è solida e ipoecogena, non anecogena, e ne compaiono più di una."),
  O("Linfonodi cervicali destri sospetti per metastasi da carcinoma polmonare: biopsia ecoguidata indicata per conferma (in stadiazione un linfonodo sovraclaveare metastatico è N3)",True,"principale",1),
  O("Linfonodi reattivi: controllo tra 3 mesi",False,"distrattore",1,"Forma rotonda, assenza di ilo e dimensioni in un paziente oncologico non permettono di attendere."),
  O("Ascesso del collo: drenaggio urgente",False,"distrattore",1,"Non ci sono raccolte liquide né segni infiammatori; la lesione è solida.")],
 "spiegazione":"Criteri ecografici di sospetto di un linfonodo: forma rotonda (rapporto asse corto/lungo > 0,5), assenza dell'ilo adiposo iperecogeno, vascolarizzazione periferica o caotica al Doppler, necrosi (aree anecogene), microcalcificazioni (tipiche delle metastasi del carcinoma papillare della tiroide), margini sfumati se c'è estensione extracapsulare. Le dimensioni da sole sono un criterio debole.\n\nNel carcinoma polmonare un linfonodo sovraclaveare o scalenico metastatico è N3 (stadio almeno IIIB-IIIC, IVA-B se ci sono metastasi a distanza): la biopsia ecoguidata è un modo poco invasivo per ottenere istologia e stadio insieme. Prima di infilare l'ago si riconoscono i vasi (vena giugulare, carotide) e si sceglie un percorso sicuro; nelle immagini con l'ago si vede la punta dentro il linfonodo.",
 "regola":"Linfonodo rotondo, senza ilo adiposo, in un paziente oncologico: sospetto metastatico, anche se piccolo.",
 "esito_clinico":{"tipo":"altro","testo":"Dati della collezione CMB-LCA (Cancer Moonshot Biobank): paziente con carcinoma polmonare; ecografia eseguita per una biopsia di un linfonodo cervicale destro. L'istologia del campione non è pubblica nei dati aperti."},
 "fonte":{"archivio":"The Cancer Imaging Archive (TCIA)","collezione":"CMB-LCA (Cancer Moonshot Biobank – Lung Cancer Collection)","soggetto":"MSB-02120","doi":"10.7937/3CX3-S132","licenza":"CC BY 4.0","licenza_url":LIC,
  "citazione":"Cancer Moonshot Biobank. (2022). Cancer Moonshot Biobank – Lung Cancer Collection (CMB-LCA) (Version 12) [dataset]. The Cancer Imaging Archive. https://doi.org/10.7937/3cx3-s132. Data used in this publication were generated by the National Cancer Institute's Cancer Moonshot Biobank.",
  "url":"https://www.cancerimagingarchive.net/collection/cmb-lca/"},
 "serie_iniziale":0,"riquadri":0,
 "vista":{"serie":0,"idx":3,"zoom":1,"panX":0,"panY":0,"nota":"Linfonodo di circa 2,8 × 1,7 cm, rotondo, senza ilo"},
 "comunicazione":{"livello":"nessuna","accettabili":["differita"],"destinatari":["richiedente"],"parole":["linfonod"],"motivo":"Esame eseguito per la biopsia in un paziente con tumore noto: basta il referto."},
 "nota_docente":"DA CONTROLLARE. Caso creato da Claude il 25/10/2026 da CMB-LCA (IDC, CC BY 4.0), paziente MSB-02120, serie «US GUIDED LYMPH NODE SUPERFICIAL BIOPSY» (Philips, 18 immagini, 4 passaggi bioptici «BX 1-4», una con color Doppler). Le misure sono quelle impresse nei pixel dall'operatore (2,78 × 1,74 cm; 2,01 cm; 1,92 × 1,07 cm; 1,21 e 1,67 cm nelle scansioni con sonda lineare ad alta frequenza). La vena accanto al linfonodo è interpretata da Claude come giugulare interna (non indicata nelle immagini). Livello cervicale non indicato. L'istologia non è pubblica."
})
