import json,os,sys
sys.path.insert(0,os.path.dirname(__file__))
B=os.path.expanduser("~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free")
LIC="https://creativecommons.org/licenses/by/4.0/"
def O(t,c,tipo,sez,nota=""):
    d={"testo":t,"corretta":c,"tipo":tipo,"sezione":sez}
    if nota: d["nota"]=nota
    return d
f104=json.load(open(f"{B}/caso-tcia-104/caso.json"))
fonte=dict(f104["fonte"]); fonte["soggetto"]="Myel_050"
c={"id":"caso-tcia-106","visibile":False,"aggiornato":"2026-10-25 19:45",
 "titolo":"TC a doppia energia del rachide: mieloma multiplo alla diagnosi",
 "titolo_interno":"Mieloma multiplo IgG lambda: lesione litica espansiva del corpo di T10 (circa 5 cm, guscio corticale assottigliato) e piccole lesioni litiche in altri livelli (Myel_050)",
 "distretto":"Rachide","quesito":"oncologico","modalita":"TC","difficolta":"Intermedio",
 "anamnesi":"Uomo di 73 anni con mieloma multiplo IgG lambda di nuova diagnosi, stadio ISS 2, creatinina 136 µmol/L, calcio nella norma. TC a bassa dose del rachide su apparecchio a doppia energia prima della terapia di prima linea. Sono disponibili la TC convenzionale e la ricostruzione con soppressione del calcio (indice 50).",
 "domanda":"Leggi la colonna con la finestra per l'osso e le ricostruzioni sagittali: qual è la lesione maggiore e che cosa va valutato?",
 "sezioni":[{"nome":"Scheletro","domanda":"Che cosa vedi?"},{"nome":"Conclusioni","domanda":"Qual è la conclusione?","singola":True}],
 "opzioni":[
  O("Lesione litica espansiva del corpo di T10, di circa 5 cm, che rigonfia il profilo della vertebra e lascia solo un sottile guscio di corticale",True,"principale",0,"Nella segmentazione degli esperti misura circa 40 mL (immagini 130-150 circa); al centro la densità è bassa (circa 5 HU) contro circa 140 HU della spongiosa sana di L3."),
  O("Piccole lesioni litiche anche in T8, T9, T12 e nei lombari",True,"secondario",0,"La collezione segmenta 22 lesioni: oltre a T10 sono tutte sotto 3 mL (le maggiori in T8 e T9, circa 2 mL)."),
  O("Nella mappa a soppressione del calcio la lesione di T10 è chiara (circa 0 HU) mentre il midollo delle vertebre sane è scuro (circa -70 HU)",True,"secondario",0,"Il midollo normale dell'adulto è grasso; il tessuto mielomatoso no."),
  O("Emangioma vertebrale tipico",False,"distrattore",0,"L'emangioma ha trabecole verticali ispessite («a puntini» in assiale, «a velluto a coste» in sagittale) e densità grassa; non rigonfia la vertebra lasciando un guscio sottile."),
  O("Lesione osteoaddensante (sclerotica)",False,"distrattore",0,"Il corpo di T10 è svuotato: resta solo la corticale periferica."),
  O("Mieloma con lesione litica espansiva di T10 a rischio di cedimento: valutare il muro posteriore e l'estensione nel canale (RM), stabilità (SINS) e indicazione a radioterapia o consolidamento oltre alla terapia sistemica",True,"principale",1),
  O("Metastasi da carcinoma renale",False,"distrattore",1,"Anche le metastasi renali sono litiche ed espansive, ma qui la diagnosi di mieloma è nota e le altre lesioni sono tipiche."),
  O("Spondilodiscite di T9-T10",False,"distrattore",1,"Il disco e i piatti adiacenti non sono il centro del processo: la lesione è nel corpo vertebrale.")],
 "spiegazione":"Il mieloma può dare lesioni litiche «a colpo di pugno» piccole e multiple, oppure lesioni espansive che rigonfiano l'osso lasciando un guscio corticale sottile (aspetto simile al plasmocitoma). In T10 il corpo è sostituito da tessuto a bassa densità: con la corticale così sottile il rischio di cedimento è alto, e se il tessuto supera il muro posteriore può comprimere il midollo. Per questo, oltre a contare le lesioni, il referto deve dire: integrità del muro posteriore, estensione nel canale o nei tessuti paravertebrali, stabilità (punteggio SINS), e suggerire la RM se ci sono dolore o segni neurologici.\n\nCon la TC a doppia energia la mappa a soppressione del calcio mostra il contenuto del midollo: scuro (grasso) dove è normale, chiaro dove è infiltrato.\n\nDiagnosi differenziale delle lesioni litiche espansive vertebrali: metastasi di rene e tiroide, plasmocitoma, emangioma aggressivo, tumore a cellule giganti, cisti aneurismatica (giovani).",
 "regola":"Davanti a una lesione litica vertebrale, guarda sempre il muro posteriore e il canale: sono loro a decidere l'urgenza.",
 "esito_clinico":{"tipo":"altro","testo":"Dati della collezione Spinal-Multiple-Myeloma-SEG (paziente Myel_050): mieloma multiplo IgG lambda, ISS 2, prima linea (bortezomib + lenalidomide + desametasone). Lesioni segmentate dagli esperti: 22, la maggiore in T10 (circa 40 mL)."},
 "fonte":fonte,
 "serie_iniziale":0,"riquadri":2,
 "vista":{"serie":0,"idx":140,"zoom":1,"panX":0,"panY":0,"nota":"T10: lesione litica espansiva con guscio corticale sottile"},
 "comunicazione":{"livello":"differita","accettabili":["nessuna","urgente"],"destinatari":["richiedente"],"parole":["t10","mieloma"],"motivo":"Lesione a rischio di cedimento in un paziente che sta per iniziare la terapia: va segnalata al curante in giornata perché valuti RM, stabilità e radioterapia. Diventerebbe urgente con deficit neurologico o compressione midollare."},
 "nota_docente":"DA CONTROLLARE. Caso creato da Claude il 25/10/2026 da Spinal-Multiple-Myeloma-SEG (IDC, CC BY 4.0), paziente Myel_050, studio 2016-09. Serie: TC convenzionale e Calcium Suppression 50 Index, mediate a 4 strati (0,6 → 2,4 mm) con strumenti_claude/vm/media_strati.py, poi anonimizza.py. Lesioni dalla SEG della collezione (strumenti_claude/vm/seg_lesioni.py): T10 40,2 mL (centro img 140, estensione circa 47 × 46 × 54 mm), T8 2,5 mL (img 115), T9 1,9 mL (img 125), T12 1,0 mL, L2 0,7 mL, altre 17 < 0,5 mL. Densità (ROI 1 cm): T10 5 HU convenzionale, -1 HU soppressione del calcio; L3 sana 141 e -74 HU. Valori bassi al centro di T10: da capire se componente cistica o necrotica. Non verificati: muro posteriore ed estensione epidurale (a vista il canale sembra conservato alle immagini 136-144), masse paravertebrali; altezza di T10 nelle sagittali."}
json.dump(c,open(f"{B}/caso-tcia-106/caso.json","w",encoding="utf8"),ensure_ascii=False,indent=1); print("ok")
