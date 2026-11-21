# scrivi.py : caso.json delle mammografie CMMD 113, 117, 121, 122, 123 (bozze)
import json,os,math
C=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')
CIT="Cui C., Li L., Cai H., Fan Z., Zhang L., Dan T., Li J., Wang J. (2021). The Chinese Mammography Database (CMMD): An online mammography database with biopsy confirmed types for machine diagnosis of breast. The Cancer Imaging Archive."
def fonte(s): return {"archivio":"The Cancer Imaging Archive (TCIA)","collezione":"CMMD (Chinese Mammography Database)","soggetto":s,"doi":"10.7937/tcia.eqde-4b16","licenza":"CC BY 4.0","licenza_url":"https://creativecommons.org/licenses/by/4.0/","citazione":CIT,"url":"https://www.cancerimagingarchive.net/collection/cmmd/"}
def sede(lato,ora,r):
    cx=100 if lato=='dx' else 300; est=-1 if lato=='dx' else 1; t=ora*math.pi/6
    x=cx+r*math.sin(t); y=122-r*math.cos(t); dx=x-cx; dy=y-122
    ang=math.degrees(math.atan2(dx,-dy))%360
    vic=lambda a: min(abs(ang-a),360-abs(ang-a))<8
    if vic(0): q='unione dei quadranti superiori (QQSS)'
    elif vic(180): q='unione dei quadranti inferiori (QQII)'
    else: q={(True,True):'quadrante supero-esterno (QSE)',(True,False):'quadrante supero-interno (QSI)',(False,True):'quadrante infero-esterno (QIE)',(False,False):'quadrante infero-interno (QII)'}[(dy<0,dx*est>0)]
    nome='mammella destra' if lato=='dx' else 'mammella sinistra'
    return {"lato":lato,"ora":ora,"quad":q,"breve":q[q.find('(')+1:-1],"x":round(x,1),"y":round(y,1),"testo":f"{nome}, {q}, ore {ora}"}
def scheda(lato,ora,r,acr,dist,prof,d,br,testo):
    return [{"id":"mammella","valori":{"sede":sede(lato,ora,r),"acr":acr,"dist":dist,"prof":prof,"d":d,"br":br},"valore":f"BI-RADS {br.upper()}","testo":testo}]
def O(t,c,tipo,s,nota=""): return {"testo":t,"corretta":c,"tipo":tipo,"nota":nota,"sezione":s}
SEZ=[{"nome":"Composizione","domanda":"Composizione: cosa osservi?"},{"nome":"Reperti","domanda":"Reperti: cosa osservi?"},{"nome":"Conclusioni","domanda":"Qual è la conclusione più adatta?","singola":True}]
DOM="Referta in ordine: composizione, reperti, conclusione con categoria BI-RADS."
casi={}
# ---------------- 113: carcinoma bilaterale sincrono
casi["caso-tcia-113"]=dict(
 titolo="Mammografia bilaterale",
 titolo_interno="Mammografia: carcinoma bilaterale sincrono, due masse spiculate di circa 1,5 cm nei quadranti superiori di entrambe le mammelle (sinistra; destra Luminal A)",
 difficolta="Intermedio",
 anamnesi="Donna di 75 anni. Mammografia bilaterale in due proiezioni (CC e MLO). Quesito clinico non disponibile.",
 sezioni=SEZ, domanda=DOM,
 opzioni=[
  O("Composizione mammaria ACR B: aree sparse di densità fibroghiandolare",True,"secondario",0),
  O("Composizione mammaria ACR D: mammella estremamente densa, che riduce molto la sensibilità",False,"distrattore",0),
  O("Mammella sinistra: massa irregolare ad alta densità a margini spiculati, di circa 1,5 cm (spicule fino a circa 3 cm), nei quadranti superiori in sede centrale (circa ore 12), a circa 3,5 cm dal capezzolo, visibile in CC e in MLO",True,"secondario",1),
  O("Mammella destra: seconda massa irregolare spiculata di circa 1-1,5 cm, anch'essa nei quadranti superiori in sede centrale (circa ore 12), a circa 4-4,5 cm dal capezzolo, visibile in CC e in MLO",True,"secondario",1,"È il reperto che si perde se ci si ferma alla prima lesione (soddisfazione della ricerca)."),
  O("Mammella destra nei limiti: la lesione è solo a sinistra",False,"distrattore",1),
  O("Massa ovale a margini circoscritti con alone chiaro, tipica di fibroadenoma",False,"distrattore",1),
  O("Microcalcificazioni pleomorfe a distribuzione segmentaria",False,"distrattore",1),
  O("Le due immagini simmetriche sono un artefatto di sovrapposizione del tessuto: nessuna massa vera",False,"distrattore",1,"Ogni massa è visibile in due proiezioni della stessa mammella: non è una sovrapposizione."),
  O("Due masse spiculate, una per lato: BI-RADS 5 bilaterale; biopsia percutanea di entrambe (sospetto carcinoma bilaterale sincrono)",True,"principale",2),
  O("BI-RADS 5 a sinistra e BI-RADS 1 a destra: biopsia della sola lesione sinistra",False,"distrattore",2),
  O("Reperti probabilmente benigni (BI-RADS 3 bilaterale): controllo a 6 mesi",False,"distrattore",2)],
 spiegazione="Una massa irregolare ad alta densità con margini spiculati è il segno mammografico più specifico di carcinoma (BI-RADS 5: probabilità di malignità ≥ 95%).\nIn questo caso le masse sono due, una per mammella, in sede quasi speculare. La trappola è la «soddisfazione della ricerca»: trovata la prima lesione si smette di guardare e la seconda si perde. Per evitarla si confrontano sempre le due mammelle nella stessa proiezione (RCC con LCC, RMLO con LMLO) e si completa la lettura anche dopo il primo reperto.\nIl carcinoma mammario bilaterale sincrono è raro (circa 1-3% dei carcinomi); ogni lesione sospetta va comunque biopsiata, perché la seconda può essere un tumore diverso e cambia la terapia. Prima dell'intervento la RM aiuta a definire l'estensione in entrambe le mammelle.\nEsito della collezione: carcinoma in entrambe le mammelle confermato da biopsia; sottotipo molecolare Luminal A a destra, non indicato a sinistra.",
 regola="Trovata una lesione, continua a cercare: confronta sempre le due mammelle nella stessa proiezione.",
 esito_clinico={"tipo":"istologia","testo":"Carcinoma mammario bilaterale confermato da biopsia (dati clinici CMMD: maligno a sinistra e a destra; sottotipo Luminal A a destra, non indicato a sinistra)."},
 scale=scheda('sn',12,40,'b',35,'medio',15,'5',"Mammella sinistra, unione dei quadranti superiori, ore 12, a 3,5 cm dal capezzolo; diametro circa 1,5 cm (con le spicule circa 3 cm). Composizione ACR B. BI-RADS 5: biopsia. Seconda massa spiculata analoga nella mammella destra (ore 12, circa 4-4,5 cm dal capezzolo): BI-RADS 5 anche a destra."),
 fonte=fonte("D2-0565"),
 vista={"serie":1,"idx":0,"zoom":1,"panX":0,"panY":0,"segno":{"a":{"x":40,"y":890},"b":{"x":320,"y":1160}},"nota":"Massa spiculata della mammella sinistra (LCC); la seconda massa è nella destra (RCC, x 1824 y 1460)"},
 comunicazione={"livello":"differita","accettabili":["urgente"],"destinatari":["richiedente"],"parole":["biopsia","bilaterale"],"motivo":"Sospetto carcinoma bilaterale: il medico richiedente va informato perché si organizzino le biopsie; non è un esito critico immediato."},
 nota_docente="Caso importato da TCIA (CMMD, D2-0565) il 25/10/2026 (bozza). DA CONTROLLARE. Reperti letti da Claude sulle immagini.\nLa tabella clinica CMMD ha due righe per D2-0565: massa maligna a sinistra (sottotipo non indicato) e massa maligna a destra (Luminal A): carcinoma bilaterale.\nSedi dall'orientamento DICOM (PatientOrientation): nella LCC (A/R) il basso dell'immagine è mediale; nella LMLO (A/FR) il basso è inferiore. Sinistra: massa all'altezza del capezzolo in CC (centrale) e circa 2,5 cm sopra in MLO → quadranti superiori, ore 12; circa 3,5 cm dal capezzolo; nucleo circa 1,2-1,5 cm. Destra (RCC x 1824 y 1460, RMLO x 1614 y 994): centrale in CC, circa 4 cm sopra il capezzolo in MLO → ore 12; circa 4-4,5 cm dal capezzolo; nucleo circa 1-1,2 cm.\nMisure indicative: spaziatura dichiarata da CMMD 0,094 mm (immagini convertite da TIFF a DICOM dalla collezione, 8 bit, già elaborate). Finestra iniziale calcolata dai percentili della mammella.\nNessun linfonodo ascellare ingrandito evidente a una lettura d'insieme (non inserito tra le risposte).")
# ---------------- 117: microcalcificazioni raggruppate
casi["caso-tcia-117"]=dict(
 titolo="Mammografia bilaterale",
 titolo_interno="Mammografia: gruppo di microcalcificazioni fini pleomorfe di circa 1-1,5 cm nel QSE destro vicino al capezzolo; carcinoma (Luminal B)",
 difficolta="Intermedio",
 anamnesi="Donna di 33 anni. Mammografia bilaterale in due proiezioni (CC e MLO). Quesito clinico non disponibile.",
 sezioni=SEZ, domanda=DOM,
 opzioni=[
  O("Composizione mammaria ACR C: mammella eterogeneamente densa, che può nascondere piccole masse",True,"secondario",0),
  O("Composizione mammaria ACR A: mammella quasi completamente adiposa",False,"distrattore",0),
  O("Mammella destra: gruppo di microcalcificazioni fini pleomorfe (di forma e dimensioni diverse), a distribuzione raggruppata in un'area di circa 1-1,5 cm, nel quadrante supero-esterno, vicino al capezzolo (terzo anteriore, circa 2-2,5 cm dal capezzolo), visibile in CC e in MLO",True,"secondario",1),
  O("Nessuna massa chiaramente associata al gruppo di calcificazioni in mammografia",True,"secondario",1,"In una mammella densa una massa può essere nascosta: l'ecografia mirata resta utile."),
  O("Calcificazioni grossolane «a pop-corn» di fibroadenoma involuto",False,"distrattore",1),
  O("Calcificazioni «a latte di calce» che si stratificano nella MLO (cisti)",False,"distrattore",1),
  O("Calcificazioni vascolari lineari «a binario»",False,"distrattore",1),
  O("Gruppo di calcificazioni nel quadrante infero-interno della mammella sinistra",False,"distrattore",1),
  O("Microcalcificazioni fini pleomorfe raggruppate: BI-RADS 4C (accettabili 4B-5); biopsia stereotassica sotto vuoto",True,"principale",2),
  O("Calcificazioni benigne (BI-RADS 2): controllo di screening",False,"distrattore",2),
  O("Probabilmente benigne (BI-RADS 3): controllo a 6 mesi",False,"distrattore",2),
  O("Basta l'ecografia: se non mostra lesioni, controllo tra un anno",False,"distrattore",2,"Le microcalcificazioni si vedono male in ecografia: un'ecografia negativa non le esclude.")],
 spiegazione="Le calcificazioni si valutano per morfologia e distribuzione (BI-RADS 5ª edizione).\nMorfologia: le calcificazioni tipicamente benigne (cutanee, vascolari, grossolane a pop-corn, a latte di calce, a guscio d'uovo, distrofiche) non richiedono approfondimento; quelle sospette sono amorfe, grossolane eterogenee, fini pleomorfe e fini lineari o lineari ramificate (le più sospette).\nDistribuzione: diffusa (in genere benigna), regionale, raggruppata (un gruppo entro circa 2 cm), lineare e segmentaria (le più sospette, seguono un dotto).\nQui ci sono calcificazioni fini pleomorfe raggruppate in un'area di circa 1-1,5 cm: BI-RADS 4C (probabilità di malignità tra 50% e 95%; anche 4B o 5 sono scelte accettabili). Si procede con la biopsia stereotassica sotto vuoto, controllando con la radiografia dei frustoli che le calcificazioni siano state prelevate.\nL'ecografia non serve a escludere: le microcalcificazioni si vedono male e una ecografia negativa non cambia l'indicazione alla biopsia.\nEsito della collezione: carcinoma mammario, sottotipo Luminal B.",
 regola="Calcificazioni fini pleomorfe o lineari raggruppate o segmentarie: biopsia stereotassica, anche se l'ecografia è negativa.",
 esito_clinico={"tipo":"istologia","testo":"Carcinoma mammario destro confermato da biopsia, sottotipo molecolare Luminal B (dati clinici CMMD)."},
 scale=scheda('dx',10,30,'c',25,'anteriore',13,'4c',"Mammella destra, quadrante supero-esterno, ore 10, a circa 2-2,5 cm dal capezzolo, terzo anteriore; gruppo di microcalcificazioni di circa 1-1,5 cm. Composizione ACR C. BI-RADS 4C: biopsia stereotassica (accettabili 4B e 5)."),
 fonte=fonte("D2-0063"),
 vista={"serie":0,"idx":0,"zoom":3,"panX":0,"panY":0,"segno":{"a":{"x":1400,"y":860},"b":{"x":1660,"y":1110}},"nota":"Gruppo di microcalcificazioni fini pleomorfe della mammella destra (RCC)"},
 comunicazione={"livello":"differita","accettabili":["urgente"],"destinatari":["richiedente"],"parole":["biopsia","calcificazioni"],"motivo":"Reperto sospetto che richiede biopsia: il medico va informato, ma non è un esito critico immediato."},
 nota_docente="Caso importato da TCIA (CMMD, D2-0063) il 25/10/2026 (bozza). DA CONTROLLARE. Reperti letti da Claude sulle immagini.\nGruppo trovato con un filtro top-hat e guardato a piena risoluzione: RCC centro x 1531 y 985, RMLO centro x 1469 y 1347; estensione circa 1,1 cm in CC e 1,2-1,3 cm in MLO. Sede dall'orientamento DICOM (RCC P/L: il basso è mediale; RMLO P/FL: il basso è inferiore): circa 1,4 cm laterale e 2 cm sopra il capezzolo, circa 2-2,5 cm dal capezzolo → QSE, ore 10, terzo anteriore. Mammella sinistra densa senza reperti sospetti evidenti a una lettura d'insieme.\nMisure indicative: spaziatura dichiarata da CMMD 0,094 mm (immagini convertite da TIFF a DICOM dalla collezione, 8 bit). Finestra iniziale calcolata dai percentili della mammella.")
# ---------------- 121: massa + linfonodo, triplo negativo
casi["caso-tcia-121"]=dict(
 titolo="Mammografia bilaterale in una donna giovane",
 titolo_interno="Mammografia: massa ad alta densità di circa 4-5 cm della mammella sinistra con linfonodo ascellare di circa 2,5 cm senza ilo adiposo; carcinoma triplo negativo",
 difficolta="Intermedio",
 anamnesi="Donna di 29 anni. Mammografia bilaterale in due proiezioni (CC e MLO). Quesito clinico non disponibile.",
 sezioni=SEZ, domanda=DOM,
 opzioni=[
  O("Composizione mammaria ACR C: mammella eterogeneamente densa",True,"secondario",0),
  O("Composizione mammaria ACR A: mammella quasi completamente adiposa",False,"distrattore",0),
  O("Mammella sinistra: grande massa ad alta densità di circa 4-5 cm, di forma irregolare-ovalare, a margini in parte circoscritti e in parte oscurati o indistinti, nella porzione centrale-superiore (terzo medio-posteriore), visibile in CC e in MLO",True,"secondario",1),
  O("Cavo ascellare sinistro (MLO): linfonodo ingrandito di circa 2,5 cm, rotondeggiante e denso, senza ilo adiposo",True,"secondario",1,"Un linfonodo ascellare normale è ovale, piccolo e ha un ilo adiposo (centro chiaro): questo è rotondo, grande e omogeneamente denso."),
  O("Mammella destra senza masse o calcificazioni sospette",True,"secondario",1),
  O("Massa a margini interamente circoscritti con alone chiaro: tipico fibroadenoma",False,"distrattore",1),
  O("Microcalcificazioni fini lineari ramificate a distribuzione segmentaria",False,"distrattore",1),
  O("Linfonodo ascellare di aspetto normale, piccolo e con ilo adiposo",False,"distrattore",1),
  O("Massa sospetta con linfonodo ascellare patologico: BI-RADS 5 (almeno 4C); ecografia di mammella e ascella con biopsia della massa e del linfonodo",True,"principale",2),
  O("Giovane età: probabile fibroadenoma, BI-RADS 3 e controllo a 6 mesi",False,"distrattore",2,"L'età non rende benigna una massa di 4-5 cm con un linfonodo patologico."),
  O("Reperti benigni (BI-RADS 2): nessun approfondimento",False,"distrattore",2)],
 spiegazione="Nelle donne giovani l'esame di prima scelta per un nodulo palpabile è l'ecografia, ma la mammografia resta utile per le calcificazioni e l'estensione. In questo caso la mammografia mostra una grande massa ad alta densità con margini solo in parte circoscritti e, nel cavo ascellare, un linfonodo rotondo, grande e senza ilo adiposo: l'insieme è altamente sospetto (BI-RADS 5, almeno 4C).\nTrappola: il carcinoma triplo negativo cresce in fretta e spesso si presenta come una massa rotonda o ovale, a margini in parte circoscritti, senza spicule e senza calcificazioni: può sembrare un fibroadenoma, soprattutto in una donna giovane. Dimensioni, alta densità, margini non del tutto circoscritti e linfonodo patologico orientano verso la malignità.\nGestione: ecografia di mammella e ascella, biopsia percutanea della massa e agobiopsia o biopsia del linfonodo, poi stadiazione e RM mammaria (spesso prima della chemioterapia neoadiuvante). In una donna di 29 anni con carcinoma triplo negativo si propone anche la consulenza genetica (BRCA).\nEsito della collezione: carcinoma mammario sinistro triplo negativo; lo stato del linfonodo non è indicato.",
 regola="Massa e linfonodo ascellare rotondo senza ilo: si biopsiano entrambi, anche in una donna giovane.",
 esito_clinico={"tipo":"istologia","testo":"Carcinoma mammario sinistro confermato da biopsia, sottotipo triplo negativo (dati clinici CMMD); istologia del linfonodo non indicata."},
 scale=scheda('sn',12,45,'c',40,'medio',45,'5',"Mammella sinistra, porzione centrale-superiore (ore 12 circa), a circa 4 cm dal capezzolo, terzo medio-posteriore; diametro circa 4-5 cm. Linfonodo ascellare sinistro di circa 2,5 cm senza ilo adiposo. Composizione ACR C. BI-RADS 5: biopsia (accettabile 4C)."),
 fonte=fonte("D2-0724"),
 vista={"serie":3,"idx":0,"zoom":1,"panX":0,"panY":0,"segno":{"a":{"x":40,"y":40},"b":{"x":760,"y":1450}},"nota":"Massa della mammella sinistra e linfonodo ascellare (LMLO)"},
 comunicazione={"livello":"differita","accettabili":["urgente"],"destinatari":["richiedente"],"parole":["biopsia","linfonodo"],"motivo":"Sospetto carcinoma con linfonodo patologico: il medico va informato rapidamente per la biopsia, ma non è un esito critico immediato."},
 nota_docente="Caso importato da TCIA (CMMD, D2-0724) il 25/10/2026 (bozza). DA CONTROLLARE. Reperti letti da Claude sulle immagini.\nMassa: LMLO centro circa x 527 y 1124, LCC centro circa x 367 y 1307; circa 4 × 5 cm. Linfonodo: LMLO in alto, centro circa x 218 y 172, circa 2,6 × 2,4 cm, densità simile alla massa (mediana circa 99 contro 107, grasso circa 19 in unità di grigio), senza ilo adiposo; dietro c'è forse una seconda formazione rotondeggiante più piccola. Nella RMLO in alto c'è una struttura saturata al bordo dell'immagine (circa 250 unità, verosimilmente spalla o braccio), non un linfonodo.\nSede dall'orientamento DICOM: centrale in CC (all'altezza del capezzolo), superiore in MLO. Mammella destra densa senza reperti sospetti evidenti.\nMisure indicative: spaziatura dichiarata da CMMD 0,094 mm (immagini convertite da TIFF a DICOM dalla collezione, 8 bit). Finestra iniziale calcolata dai percentili della mammella.")
# ---------------- 122: massa ovale benigna
casi["caso-tcia-122"]=dict(
 titolo="Mammografia della mammella destra",
 titolo_interno="Mammografia: massa ovale prevalentemente circoscritta di circa 2,5 cm nel QII destro, vicino al capezzolo; benigna alla biopsia",
 difficolta="Intermedio",
 anamnesi="Donna di 51 anni. Mammografia della mammella destra in due proiezioni (CC e MLO): la collezione fornisce solo la mammella con il reperto. Quesito clinico non disponibile.",
 sezioni=SEZ, domanda=DOM,
 opzioni=[
  O("Composizione mammaria ACR C: mammella eterogeneamente densa",True,"secondario",0),
  O("Composizione mammaria ACR A: mammella quasi completamente adiposa",False,"distrattore",0),
  O("Mammella destra: massa ovale di circa 2,5 cm, di densità pari o lievemente superiore al tessuto ghiandolare, con margini in gran parte circoscritti e in parte oscurati dal tessuto sovrapposto, nel quadrante infero-interno vicino al capezzolo (circa 2-2,5 cm), visibile in CC e in MLO",True,"secondario",1),
  O("Piccola calcificazione grossolana puntiforme vicino al margine inferiore della massa, di aspetto benigno",True,"secondario",1),
  O("Massa irregolare a margini spiculati con distorsione del tessuto vicino",False,"distrattore",1),
  O("Microcalcificazioni fini lineari ramificate all'interno della massa",False,"distrattore",1),
  O("Retrazione del capezzolo e ispessimento cutaneo",False,"distrattore",1),
  O("Massa ovale prevalentemente circoscritta, con margini in parte oscurati: BI-RADS 0, completare con ecografia mirata (poi BI-RADS 3 o 4A secondo l'ecografia)",True,"principale",2,"In questo caso la lesione è stata biopsiata ed è risultata benigna."),
  O("BI-RADS 5: altamente sospetta, biopsia urgente",False,"distrattore",2),
  O("Esame negativo (BI-RADS 1): controllo di screening",False,"distrattore",2)],
 spiegazione="Una massa ovale o rotonda a margini circoscritti, senza calcificazioni sospette, è più spesso benigna (fibroadenoma, cisti, linfonodo intramammario). I margini però vanno descritti con onestà: se una parte è oscurata dal tessuto sovrapposto non si può dire «interamente circoscritta».\nIn mammografia una massa nuova non caratterizzata si classifica BI-RADS 0 e si completa con l'ecografia mirata: se è una cisti semplice diventa BI-RADS 2; se è solida, ovale, parallela alla cute e circoscritta può essere BI-RADS 3 (controllo a 6 mesi) o, a 51 anni, si sceglie spesso la biopsia (BI-RADS 4A). La categoria 5 è riservata ai reperti con segni chiari di malignità (spicule, forma irregolare, calcificazioni sospette).\nLa piccola calcificazione grossolana vicino alla massa ha un aspetto benigno e non cambia la conclusione.\nEsito della collezione: lesione benigna alla biopsia (l'istotipo non è indicato; il più frequente per una massa così è il fibroadenoma).",
 regola="Massa ovale circoscritta senza calcificazioni sospette: prima l'ecografia; BI-RADS 5 solo con segni chiari di malignità.",
 esito_clinico={"tipo":"istologia","testo":"Lesione benigna alla biopsia (dati clinici CMMD; istotipo non indicato)."},
 scale=scheda('dx',5,35,'c',25,'anteriore',25,'0',"Mammella destra, quadrante infero-interno, ore 5, a circa 2-2,5 cm dal capezzolo, terzo anteriore; diametro circa 2,5 cm. Composizione ACR C. BI-RADS 0 in mammografia: ecografia mirata (poi 3 o 4A); biopsia: benigna."),
 fonte=fonte("D1-1006"),
 riquadri=2, disposizione=[0,1],
 vista={"serie":0,"idx":0,"zoom":1.5,"panX":0,"panY":0,"segno":{"a":{"x":1060,"y":1290},"b":{"x":1400,"y":1590}},"nota":"Massa ovale della mammella destra (RCC)"},
 comunicazione={"livello":"nessuna","accettabili":["differita"],"destinatari":["richiedente"],"parole":["ecografia"],"motivo":"Reperto da completare con ecografia, probabilmente benigno: basta il referto."},
 nota_docente="Caso importato da TCIA (CMMD, D1-1006) il 25/10/2026 (bozza). DA CONTROLLARE. Reperti letti da Claude sulle immagini.\nPer i casi D1 CMMD fornisce solo la mammella con il reperto (RCC e RMLO). La tabella dà «benigno» alla biopsia senza istotipo (in passato i benigni CMMD erano stati scartati: qui il caso è usato come trappola della massa circoscritta, dichiarando che l'istotipo non è noto).\nMassa: RCC centro circa x 1227 y 1436, RMLO centro circa x 1148 y 1542; circa 2,6 × 2,1 cm in CC. Margine inferiore circoscritto, superiore in parte oscurato. Piccola calcificazione grossolana anulare di circa 1,5 mm sotto il margine inferiore in entrambe le proiezioni.\nSede dall'orientamento DICOM (RCC P/L: il basso è mediale; RMLO P/FL: il basso è inferiore): circa 1,5 cm mediale e 2 cm sotto il capezzolo → QII, ore 5, terzo anteriore.\nMisure indicative: spaziatura dichiarata da CMMD 0,094 mm (immagini convertite da TIFF a DICOM dalla collezione, 8 bit). Finestra iniziale calcolata dai percentili della mammella.")
# ---------------- 123: calcificazioni segmentarie con asimmetria
casi["caso-tcia-123"]=dict(
 titolo="Mammografia bilaterale",
 titolo_interno="Mammografia: microcalcificazioni fini pleomorfe e lineari-ramificate segmentarie in un'area di asimmetria di circa 3 cm nel QSE sinistro; carcinoma (Luminal B)",
 difficolta="Avanzato",
 anamnesi="Donna di 37 anni. Mammografia bilaterale in due proiezioni (CC e MLO). Quesito clinico non disponibile.",
 sezioni=SEZ, domanda=DOM,
 opzioni=[
  O("Composizione mammaria ACR C: mammella eterogeneamente densa",True,"secondario",0,"Anche ACR B è una scelta discutibile ma vicina."),
  O("Composizione mammaria ACR A: mammella quasi completamente adiposa",False,"distrattore",0),
  O("Mammella sinistra, quadrante supero-esterno (terzo medio-posteriore): numerose microcalcificazioni fini pleomorfe e fini lineari, in parte ramificate, in un'area di circa 3 cm a distribuzione segmentaria-regionale, visibili in CC e in MLO",True,"secondario",1),
  O("Le calcificazioni stanno in un'area di densità asimmetrica a margini indistinti (possibile massa), visibile in entrambe le proiezioni",True,"secondario",1),
  O("Mammella destra senza reperti sospetti",True,"secondario",1),
  O("Calcificazioni grossolane «a pop-corn» di fibroadenoma involuto",False,"distrattore",1),
  O("Calcificazioni «a latte di calce» che si stratificano nella MLO",False,"distrattore",1),
  O("Calcificazioni cutanee con centro chiaro, alla periferia della mammella",False,"distrattore",1),
  O("Area di calcificazioni nel quadrante infero-interno",False,"distrattore",1),
  O("Calcificazioni fini lineari-ramificate e pleomorfe segmentarie in un'area di asimmetria: BI-RADS 5 (almeno 4C); biopsia stereotassica sotto vuoto e valutazione dell'estensione (ecografia, RM)",True,"principale",2),
  O("Calcificazioni benigne (BI-RADS 2): controllo di screening",False,"distrattore",2),
  O("Probabilmente benigne (BI-RADS 3): controllo a 6 mesi",False,"distrattore",2)],
 spiegazione="Le calcificazioni fini lineari o lineari ramificate («a scrittura») e le fini pleomorfe sono le morfologie più sospette del lessico BI-RADS; la distribuzione segmentaria (a triangolo con l'apice verso il capezzolo, lungo un dotto) aumenta ancora il sospetto, perché suggerisce un carcinoma che cresce dentro i dotti (componente intraduttale).\nQui le calcificazioni occupano un'area di circa 3 cm nel quadrante supero-esterno e stanno in una densità asimmetrica a margini indistinti, visibile in due proiezioni: l'insieme è BI-RADS 5 (almeno 4C).\nGestione: biopsia stereotassica sotto vuoto delle calcificazioni (con radiografia dei frustoli), ecografia mirata dell'area e dell'ascella per cercare una componente solida o un linfonodo da biopsiare, RM per l'estensione: l'area di calcificazioni sottostima spesso l'estensione del tumore.\nNelle mammelle dense le calcificazioni restano visibili, mentre le masse si nascondono: guardare le calcificazioni con lo zoom o la lente.\nEsito della collezione: carcinoma mammario sinistro, sottotipo Luminal B.",
 regola="Calcificazioni lineari ramificate o segmentarie: BI-RADS 5 e biopsia; l'estensione reale del tumore è spesso maggiore.",
 esito_clinico={"tipo":"istologia","testo":"Carcinoma mammario sinistro confermato da biopsia, sottotipo molecolare Luminal B (dati clinici CMMD)."},
 scale=scheda('sn',2,55,'c',70,'medio',30,'5',"Mammella sinistra, quadrante supero-esterno, ore 2, a circa 7 cm dal capezzolo, terzo medio; area di calcificazioni di circa 3 cm in una densità asimmetrica. Composizione ACR C. BI-RADS 5: biopsia stereotassica (accettabile 4C)."),
 fonte=fonte("D2-0095"),
 vista={"serie":3,"idx":0,"zoom":2.5,"panX":0,"panY":0,"segno":{"a":{"x":300,"y":950},"b":{"x":660,"y":1290}},"nota":"Microcalcificazioni segmentarie nell'area di asimmetria della mammella sinistra (LMLO)"},
 comunicazione={"livello":"differita","accettabili":["urgente"],"destinatari":["richiedente"],"parole":["biopsia","calcificazioni"],"motivo":"Reperto altamente sospetto che richiede biopsia: il medico va informato, ma non è un esito critico immediato."},
 nota_docente="Caso importato da TCIA (CMMD, D2-0095) il 25/10/2026 (bozza). DA CONTROLLARE. Reperti letti da Claude sulle immagini.\nCalcificazioni trovate con un filtro top-hat e guardate a piena risoluzione: LCC centro circa x 327 y 833, LMLO centro circa x 478 y 1119; area di circa 3,2 × 2,3 cm in MLO. Sede dall'orientamento DICOM (LCC A/R: il basso è mediale; LMLO A/FR: il basso è inferiore): circa 6,5 cm laterale al capezzolo in CC e molto sopra in MLO → QSE, ore 2; distanza dal capezzolo circa 7 cm; profondità circa a metà tra capezzolo e parete in CC.\nDistribuzione: segmentaria o regionale (il limite tra le due non è netto: le risposte dicono «segmentaria-regionale»). Composizione B-C (scelta C). Nella LMLO due piccoli linfonodi ascellari ovali (non valutati nelle risposte). Mammella destra senza reperti sospetti evidenti.\nMisure indicative: spaziatura dichiarata da CMMD 0,094 mm (immagini convertite da TIFF a DICOM dalla collezione, 8 bit). Finestra iniziale calcolata dai percentili della mammella.")
for cid,v in casi.items():
    c={"id":cid,"titolo":v["titolo"],"titolo_interno":v["titolo_interno"],"distretto":"Mammella","quesito":"mammografia","modalita":"Mammografia","difficolta":v["difficolta"],
       "anamnesi":v["anamnesi"],"domanda":v["domanda"],"sezioni":v["sezioni"],"opzioni":v["opzioni"],"spiegazione":v["spiegazione"],"regola":v["regola"],
       "esito_clinico":v["esito_clinico"],"scale":v["scale"],"fonte":v["fonte"],"disposizione":v.get("disposizione",[0,1,2,3]),"riquadri":v.get("riquadri",4),
       "vista":v["vista"],"comunicazione":v["comunicazione"],"nota_docente":v["nota_docente"],"visibile":False}
    json.dump(c,open(C+cid+"/caso.json","w",encoding="utf8"),ensure_ascii=False,indent=1)
    print(cid,"ok",c["scale"][0]["valori"]["sede"]["testo"])
