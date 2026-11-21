# tbad_casi.py: scrive caso.json dei casi 118-120 (dissezione aortica tipo B, collezione TBAD convertita da NRRD)
import json,os
CF=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')
CIT=("Mayer C., Pepe A., Hossain S., Karner B., Arnreiter M., Kleesiek J., Schmid J., Janisch M., Deutschmann H., Fuchsjäger M., "
     "Zimpfer D., Egger J., Mächler H. (2024). Aortic Dissection Dataset and Segmentations. figshare. doi:10.6084/m9.figshare.22269091. "
     "Articolo: Type B Aortic Dissection CTA Collection with True and False Lumen Expert Annotations for the Development of AI-based Algorithms. Scientific Data, 2024.")
def fonte(paz):
    return {"archivio":"figshare","collezione":"TBAD – Aortic Dissection Dataset and Segmentations (Mayer et al.)","soggetto":f"{paz} (immagini convertite da NRRD in DICOM: non sono DICOM originali)",
            "doi":"10.6084/m9.figshare.22269091","licenza":"CC BY 4.0","licenza_url":"https://creativecommons.org/licenses/by/4.0/",
            "citazione":CIT+" Immagini convertite dal formato NRRD in DICOM per il visualizzatore (geometria e densità HU conservate).",
            "url":"https://doi.org/10.6084/m9.figshare.22269091"}
ANAM=("Scenario didattico: paziente giunto in Pronto soccorso per dolore toracico e dorsale; angio-TC dell'aorta toraco-addominale in fase arteriosa. "
      "Età, sesso, storia clinica e fase (acuta o cronica) della malattia non sono forniti dalla collezione. Le immagini sono state convertite da un altro formato (NRRD) in DICOM: densità HU e misure sono conservate.")
def com(motivo): return {"livello":"immediata","accettabili":["urgente"],"destinatari":["ps","richiedente"],"parole":["dissezione","aortica","tipo b"],"motivo":motivo}
RICH={"reparto":"Pronto soccorso","priorita":"PS","lab":[],"allergie":"","farmaci":"","dispositivi":"","gravidanza":""}
SEZ=[{"nome":"Reperti","domanda":"Che cosa vedi? (aorta ascendente, arco, discendente, rami viscerali, lumi)"},
     {"nome":"Conclusioni","domanda":"Qual è la conclusione più adatta?","singola":True}]
REGOLA="Sindrome aortica: prima l'aorta ascendente (decide tipo A o B), poi estensione, lume vero e falso, da quale lume nascono i rami viscerali e renali, diametro massimo e segni di complicazione."
DISTR_COMUNI=[
 ("L'aorta ascendente è dissecata: dissezione di tipo A di Stanford",False,"secondario",0,"L'ascendente è omogeneamente opacizzata, senza flap: il tipo A va escluso guardando l'ascendente in tutte le immagini, non solo l'arco."),
 ("Ematoma intramurale: ispessimento parietale a semiluna senza flap e senza lume falso opacizzato",False,"secondario",0,"Qui c'è un flap intimale con due lumi: non è un ematoma intramurale."),
 ("Artefatto da pulsazione della radice aortica, non c'è un vero flap",False,"secondario",0,"L'artefatto da pulsazione interessa la radice e l'ascendente e non prosegue nell'aorta discendente e addominale; qui il flap si segue per decine di centimetri."),
]
def spieg(extra):
    return ("Classificazione di Stanford: tipo A se è coinvolta l'aorta ascendente (indicazione chirurgica urgente), tipo B se la dissezione inizia dopo l'origine della succlavia sinistra (DeBakey III). "
            "La classificazione TEM (Type, Entry, Malperfusion) aggiunge la sede della porta d'ingresso e la malperfusione d'organo.\n"
            "Distinguere i lumi: il lume vero prosegue in continuità con l'aorta non dissecata, di solito è più piccolo e in arteriosa è più denso; il falso lume è più grande, forma un angolo acuto con il flap (segno del becco), può contenere sottili filamenti (cobweb) e opacizzarsi tardi o trombizzarsi.\n"
            "Nel referto: estensione prossimale e distale, diametro massimo dell'aorta, da quale lume nascono tronco celiaco, mesenterica superiore e renali, perfusione di intestino e reni, segni di rottura (versamento pleurico o mediastinico, ematoma periaortico).\n"
            "Complicazioni che cambiano la gestione nel tipo B: malperfusione, rottura o rottura imminente, dolore o ipertensione refrattari, diametro aortico ≥ 55 mm o crescita rapida; fattori di rischio di evoluzione aneurismatica: diametro iniziale > 40 mm, falso lume ampio o parzialmente trombizzato.\n"
            +extra+"\nNota sulla fonte: immagini di una collezione pubblica (CC BY 4.0) convertite da NRRD in DICOM; i dati clinici non sono disponibili, lo scenario di Pronto soccorso è didattico.")
NOTA0="DA CONTROLLARE. Caso creato il 25/10/2026 dalla collezione TBAD (figshare 22269091, CC BY 4.0, licenza verificata con l'API di figshare). Volume NRRD (LPS) convertito in DICOM con strumenti_claude/vm/tbad2dcm.py: HU conservate (uint16 = HU+1024, intercetta −1024), convenzione radiologica, fette dalla testa ai piedi, UID nuovi, ImageType DERIVED. Il campo comincia allo stretto toracico superiore: nessun volto. Reperti scritti guardando le immagini e le segmentazioni degli esperti (lume vero/falso, non pubblicate). "
casi={
"118":dict(paz="TBAD cta02 (cartella cta02s)",
 titolo="Angio-TC aorta toraco-addominale: dolore toracico e dorsale",
 interno="Dissezione aortica tipo B (DeBakey IIIb) dall'arco distale alle iliache comuni, entrambi i lumi pervi, falso lume ampio; tronco celiaco e renale sinistra dal falso lume, renale destra dal lume vero (TBAD cta02)",
 diff="Base", vista={"serie":0,"idx":59,"wc":150,"ww":700,"zoom":1,"panX":0,"panY":0,"nota":"Aorta discendente toracica: flap intimale, lume vero anteriore-mediale compresso e falso lume più ampio"},
 opz=[("Flap intimale nell'aorta discendente con due lumi opacizzati: lume vero più piccolo e falso lume più ampio",True,"principale",0,"Il flap si segue dall'arco distale (immagini 7-15) fino alle iliache comuni (immagine ~200). Nel torace il falso lume ha un'area circa 3 volte quella del vero."),
      ("Aorta ascendente senza flap",True,"secondario",0,"Immagini 25-60: ascendente omogenea. È il punto che decide tipo A o B."),
      ("La dissezione si estende in basso fino alle arterie iliache comuni",True,"secondario",0,"Immagini ~190-200: due lumi anche nelle iliache comuni."),
      ("Tronco celiaco e arteria renale sinistra nascono dal falso lume, la renale destra dal lume vero; reni entrambi perfusi",True,"secondario",0,"Immagini ~130 (celiaco), ~142-148 (renali), secondo la segmentazione degli esperti. Va detto nel referto perché guida un eventuale trattamento endovascolare."),
      ("Aorta discendente non aneurismatica (diametro massimo circa 35-38 mm)",True,"secondario",0,"Asse corto misurato in assiale nel torace. Sopra i 40 mm aumenta il rischio di dilatazione nel tempo."),
      ]+DISTR_COMUNI+[
      ("Versamento pleurico sinistro denso e ematoma periaortico (rottura contenuta)",False,"secondario",0,"Non ci sono versamento né ematoma periaortico: niente segni di rottura."),
      ("Dissezione aortica di tipo B di Stanford estesa dall'arco distale alle iliache comuni, senza segni di rottura né malperfusione evidenti: comunicazione immediata al Pronto soccorso e valutazione chirurgica vascolare",True,"principale",1,"Tipo B non complicato all'imaging: terapia medica (controllo di pressione e frequenza) e sorveglianza, ma la diagnosi va comunicata subito."),
      ("Dissezione aortica di tipo A: intervento cardiochirurgico in emergenza",False,"secondario",1,"L'ascendente non è coinvolta."),
      ("Ematoma intramurale dell'aorta discendente",False,"secondario",1,"C'è un flap con due lumi pervi."),
      ("Aorta normale con artefatto da movimento",False,"secondario",1,"Il flap è continuo su tutta l'aorta discendente e addominale.")],
 extra="In questo caso: tipo B classico con entrambi i lumi pervi; il flap ruota a spirale (il falso lume passa da sinistra-posteriore ad anteriore nell'addome) e i rami viscerali nascono da lumi diversi.",
 motivo="Nuova diagnosi di dissezione aortica: va comunicata subito a voce al medico del Pronto soccorso (controllo della pressione, chirurgo vascolare), anche se di tipo B e senza complicazioni evidenti.",
 nota="Paziente cta02: 260 immagini da 2 mm, pixel 0,76 mm. Mappa immagini = 260 − k del NRRD. Diametro: asse corto massimo 34-38 mm nel torace (segmentazione chiusa 3 mm), rapporto aree falso/vero circa 3. Rami: celiaco k130 (img 130) rosso = falso; renale destra k118 (img 142) lume vero; renale sinistra k112 (img 148) falso; mesenterica superiore non certa (img ~136: origine tra i due lumi), non citata nelle opzioni. Porta d'ingresso non identificata con certezza."),
"119":dict(paz="TBAD cta03 (cartella cta03s)",
 titolo="Angio-TC aorta toraco-addominale: dolore toracico e dorsale, ipertensione",
 interno="Dissezione aortica tipo B con falso lume ampio e aorta discendente prossimale dilatata (circa 55 mm), estesa alle iliache; celiaco, mesenterica superiore e renale sinistra dal lume vero, renale destra dal falso lume (TBAD cta03)",
 diff="Intermedio", vista={"serie":0,"idx":85,"wc":150,"ww":700,"zoom":1.3,"panX":0,"panY":0,"nota":"Aorta discendente prossimale di circa 55 mm: falso lume ampio, lume vero a semiluna a sinistra"},
 opz=[("Dissezione dell'aorta discendente con falso lume ampio e lume vero compresso a semiluna",True,"principale",0,"Il flap si segue dall'arco distale (immagini ~38-60) fino alle iliache comuni (immagine ~315)."),
      ("Aorta ascendente senza flap",True,"secondario",0,"Immagini 70-110: ascendente omogenea."),
      ("Aorta discendente prossimale dilatata, diametro massimo circa 55 mm",True,"secondario",0,"Immagini 45-86: circa 52-57 mm in assiale (misura con la griglia). Soglia di 55 mm: indicazione a valutare il trattamento."),
      ("Tronco celiaco, mesenterica superiore e renale sinistra dal lume vero, renale destra dal falso lume",True,"secondario",0,"Immagini ~200-225, secondo la segmentazione degli esperti. Reni entrambi impregnati."),
      ("La dissezione prosegue nelle arterie iliache comuni",True,"secondario",0,"Immagini ~300-315."),
      ]+DISTR_COMUNI+[
      ("Aorta discendente di calibro normale (circa 25 mm)",False,"secondario",0,"Nel tratto prossimale l'aorta arriva a circa 55 mm."),
      ("Dissezione aortica di tipo B con aorta discendente prossimale dilatata (circa 55 mm): comunicazione immediata e valutazione urgente chirurgica vascolare per un possibile trattamento endovascolare",True,"principale",1,"Diametro ≥ 55 mm = tipo B complicato o ad alto rischio: discussione multidisciplinare per TEVAR."),
      ("Dissezione aortica di tipo B non complicata: solo terapia medica e controllo tra un anno",False,"secondario",1,"Il diametro di circa 55 mm è un criterio di alto rischio: il controllo a un anno non basta."),
      ("Dissezione aortica di tipo A: intervento cardiochirurgico in emergenza",False,"secondario",1,"L'ascendente non è coinvolta."),
      ("Aneurisma dell'aorta discendente senza dissezione",False,"secondario",1,"C'è un flap con due lumi.")],
 extra="In questo caso: il diametro del tratto prossimale del discendente (circa 55 mm) è il dato che cambia la gestione; va misurato in assiale perpendicolare all'asse del vaso (o in MPR), comprendendo entrambi i lumi e il flap.",
 motivo="Nuova diagnosi di dissezione aortica con aorta dilatata: va comunicata subito a voce al Pronto soccorso e al chirurgo vascolare.",
 nota="Paziente cta03: 433 immagini da 1,5 mm, pixel 0,80 mm. Immagine = 433 − k. Diametro con griglia di 1 cm su img 45 (circa 52-54 mm) e img 86 (circa 57 × 47 mm); la segmentazione dà asse corto 41 mm a img 84 e fino a 65 mm all'arco (dove si somma all'arco: non usato). Arco: flap visibile nella parte distale dell'arco (img 55-62), ascendente indenne. Rami: k232/k224 (img 201/209) celiaco e mesenterica dal lume vero; k216/k208 (img 217/225) renale destra dal falso, sinistra dal vero. Iliaca comune destra con falso lume (k130, img 303)."),
"120":dict(paz="TBAD cta04 (cartella cta04s)",
 titolo="Angio-TC aorta toraco-addominale: dolore dorsale",
 interno="Dissezione aortica tipo B con falso lume non opacizzato (trombosi o flusso molto lento) nell'aorta toracica inferiore e addominale e lume vero compresso; rami viscerali dal lume vero; cisti epatiche (TBAD cta04)",
 diff="Avanzato", vista={"serie":0,"idx":140,"wc":100,"ww":500,"zoom":1.5,"panX":0,"panY":0,"nota":"Aorta addominale: lume vero anteriore opacizzato, falso lume posteriore a semiluna non opacizzato (circa 50 HU), mesenterica superiore dal lume vero"},
 opz=[("Dissezione dell'aorta discendente: nel tratto toracico inferiore e addominale il falso lume posteriore non si opacizza (circa 45-90 HU) e il lume vero anteriore è compresso",True,"principale",0,"Immagini ~80-175. Nel torace alto il falso lume è ancora opacizzato (150-200 HU, immagini 12-67): trombosi parziale o flusso lento."),
      ("Aorta ascendente senza flap",True,"secondario",0,"Immagini ~40-70."),
      ("Tronco celiaco, mesenterica superiore e renale destra nascono dal lume vero",True,"secondario",0,"Immagini ~130-162, secondo la segmentazione degli esperti."),
      ("Lesioni epatiche rotonde a densità acqua (circa 0-5 HU): verosimili cisti",True,"secondario",0,"Immagine ~125. Reperto incidentale."),
      ("Il falso lume non opacizzato è un ematoma intramurale senza flap",False,"secondario",0,"Il falso lume si segue in continuità con il tratto toracico opacizzato e il lume vero è deformato a semiluna: è una dissezione con falso lume trombizzato o a flusso lento, non un ematoma intramurale."),
      ("Aorta ascendente dissecata (tipo A)",False,"secondario",0,"Ascendente omogenea."),
      ("Artefatto da pulsazione della radice aortica, non c'è un vero flap",False,"secondario",0,"Il quadro è nell'aorta discendente e addominale."),
      ("Masse epatiche ipervascolari sospette per metastasi",False,"secondario",0,"Le lesioni hanno densità acqua e non si impregnano."),
      ("Dissezione aortica di tipo B con falso lume parzialmente non opacizzato (trombosi parziale o flusso lento) e lume vero compresso; rami viscerali dal lume vero: comunicazione immediata, valutazione chirurgica vascolare e controllo della malperfusione",True,"principale",1,"La trombosi parziale del falso lume è un fattore di rischio di dilatazione; la compressione del lume vero va seguita per la malperfusione."),
      ("Ematoma intramurale dell'aorta discendente",False,"secondario",1,"C'è un flap con lume vero deformato e falso lume opacizzato nel tratto prossimale."),
      ("Trombosi dell'aorta addominale",False,"secondario",1,"Il lume vero è pervio e opacizzato; ciò che non si opacizza è il falso lume."),
      ("Dissezione aortica di tipo A",False,"secondario",1,"L'ascendente non è coinvolta.")],
 extra="In questo caso la trappola è il falso lume che non si opacizza: può sembrare un ematoma intramurale o un trombo murale. Seguirlo dall'alto, dove è ancora opacizzato, e guardare la forma del lume vero (a semiluna, compresso) chiarisce che è una dissezione con falso lume trombizzato o a flusso lento; una fase tardiva distinguerebbe trombo e flusso lento.",
 motivo="Nuova diagnosi di dissezione aortica con lume vero compresso: va comunicata subito a voce al Pronto soccorso (controllo della pressione, chirurgo vascolare, attenzione ai segni di malperfusione).",
 nota="Paziente cta04: 252 immagini da 2 mm, pixel 0,69 mm. Immagine = 252 − k. Densità mediana del falso lume: img 22 202 HU, img 52 158, img 67 152, img 82 82, img 97 71, img 112 52, img 127 47, img 142 61, img 157 87, img 170 60; lume vero 175-230 HU. Diametro massimo asse corto circa 35 mm (escluso l'arco). Rami: celiaco k122 (img 130), mesenterica superiore k116-106 (img 136-146) e renale destra k90 (img 162) dal lume vero. Cisti epatiche img 125 (circa 0-5 HU, fegato circa 70 HU). Con una sola fase arteriosa trombosi e flusso lento non si distinguono con certezza."),
}
for n,d in casi.items():
    opz=[{"testo":t,"corretta":c,"tipo":(("principale" if s==1 else "secondario") if c else "distrattore"),"sezione":s,"nota":no} for (t,c,ti,s,no) in d["opz"]]
    caso={"id":f"caso-tcia-{n}","visibile":False,"titolo":d["titolo"],"titolo_interno":d["interno"],"distretto":"Torace","quesito":"sospetta sindrome aortica acuta",
          "modalita":"TC","difficolta":d["diff"],"anamnesi":ANAM,"domanda":"Descrivi l'aorta (ascendente, arco, discendente, rami viscerali), classifica il quadro e decidi la comunicazione.",
          "sezioni":SEZ,"opzioni":opz,"spiegazione":spieg(d["extra"]),"regola":REGOLA,
          "esito_clinico":{"tipo":"altro","testo":"Dissezione aortica di tipo B secondo la collezione TBAD (angio-TC con lume vero e falso segmentati da esperti). Nessun altro dato clinico disponibile."},
          "fonte":fonte(d["paz"]),"serie_iniziale":0,"riquadri":1,"vista":d["vista"],"comunicazione":com(d["motivo"]),"richiesta":RICH,
          "nota_docente":NOTA0+d["nota"]}
    json.dump(caso,open(CF+f"caso-tcia-{n}/caso.json","w",encoding="utf8"),ensure_ascii=False,indent=1); print("scritto",n,len(opz))
