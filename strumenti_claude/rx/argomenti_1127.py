# argomenti_1127.py: aggiunge a strumenti_claude/argomenti/genera_pagine.py quattro schede collegate ai casi di prova
# (si aprono senza iscrizione): polso nel bambino, femore prossimale, dissezione aortica, massa cerebrale in RM.
f = '/Volumes/Caloggero/strumenti_claude/argomenti/genera_pagine.py'
s = open(f).read()

NUOVE = r'''
def prova_caso(testo, casi):
    bott = " ".join(f'<a class="btn" href="/?da=argomenti#/caso/{i}">▶ {html.escape(e)}</a>' for i, e in casi)
    return f"""<div class="prova"><b>Prova subito, senza iscriverti.</b> {testo}<br>{bott}<br>
<span class="muto">Immagini DICOM anonime da archivi pubblici, visualizzatore nel browser, correzione immediata. Gratuito; con l'iscrizione trovi oltre 170 casi e i percorsi con attestato.</span></div>"""

# ------------------------------------------------------------------ polso nel bambino (27/11)
PAG["fratture-polso-bambino"] = dict(
 titolo="Fratture del polso nel bambino: Salter-Harris, torus e greenstick — Quiz Radiologia",
 descr="Fratture del radio distale nel bambino per specializzandi: cartilagine di accrescimento, classificazione di Salter-Harris (I–V), fratture a toro, a legno verde e complete, cosa scrivere nel referto. Con casi reali da provare senza iscriversi.",
 h1="Fratture del polso nel bambino: Salter-Harris, torus e greenstick",
 corpo=f"""<p class="sommario">Il polso è la sede più frequente di frattura nel bambino. L'osso in crescita si rompe in modo diverso da quello dell'adulto: la <b>cartilagine di accrescimento</b> (fisi) è il punto debole, e la corticale è più elastica. Il referto deve dire se la fisi è coinvolta, quanto è spostato il frammento e se ci sono lesioni associate.</p>

<h2>1. L'anatomia che serve</h2>
<ul>
<li><b>Epifisi</b> (estremità, con il nucleo di ossificazione), <b>fisi</b> (banda radiotrasparente di cartilagine), <b>metafisi</b> (osso spugnoso subito sotto la fisi), diafisi.</li>
<li>La fisi distale del radio si chiude intorno ai 16-19 anni, prima nelle ragazze. Fino ad allora una banda chiara regolare è normale, non una frattura: confronta lo spessore lungo tutta la fisi e, nel dubbio, con il lato opposto.</li>
<li>Sempre <b>due proiezioni</b> (antero-posteriore e laterale): molte fratture e quasi tutti gli spostamenti si vedono solo in laterale.</li>
</ul>

<h2>2. La classificazione di Salter-Harris</h2>
<div class="scorri"><table class="tab"><thead><tr><th>Tipo</th><th>Rima di frattura</th><th>Note</th></tr></thead><tbody>
<tr><td class="cod">I</td><td>Solo attraverso la fisi</td><td>La radiografia può essere normale o mostrare solo una fisi allargata e la tumefazione dei tessuti molli.</td></tr>
<tr><td class="cod">II</td><td>Fisi + un frammento di metafisi (frammento di Thurston-Holland)</td><td>La più frequente (circa tre su quattro); di solito buona prognosi.</td></tr>
<tr><td class="cod">III</td><td>Fisi + epifisi, fino all'articolazione</td><td>Intra-articolare: serve una riduzione anatomica.</td></tr>
<tr><td class="cod">IV</td><td>Attraverso epifisi, fisi e metafisi</td><td>Intra-articolare; rischio di ponte osseo attraverso la fisi.</td></tr>
<tr><td class="cod">V</td><td>Schiacciamento della fisi</td><td>Spesso non visibile all'inizio; si riconosce dopo, dal disturbo di crescita.</td></tr>
</tbody></table></div>
<p>Più alto il tipo, maggiore il rischio di <b>arresto o deviazione della crescita</b>. Il mnemonico inglese «SALTR» (Slipped, Above, Lower, Through, Rammed) aiuta a ricordarli.</p>

<h2>3. Le fratture che non coinvolgono la fisi</h2>
<ul>
<li><b>Frattura a toro</b> (buckle): la corticale metafisaria si incurva o fa un piccolo gradino per compressione, senza rima completa. Si vede spesso meglio in laterale. È stabile.</li>
<li><b>Frattura a legno verde</b> (greenstick): corticale rotta dal lato della convessità e solo incurvata dal lato opposto.</li>
<li><b>Incurvamento plastico</b>: l'osso si piega senza rima visibile; si sospetta dal confronto con l'altro osso o con il lato sano.</li>
<li><b>Frattura completa</b> metafisaria o diafisaria: misura angolazione (in gradi) e spostamento (in percentuale del diametro). Nel bambino piccolo le angolazioni sul piano del movimento del polso rimodellano molto; meno quelle rotatorie e quelle vicino alla fine della crescita.</li>
</ul>

<h2>4. Cosa guardare sempre</h2>
<ul>
<li>Lo <b>stiloide ulnare</b> e l'ulna distale: una frattura associata è frequente.</li>
<li>Una frattura isolata della diafisi di radio o ulna fa cercare una lussazione: <b>Monteggia</b> (ulna + capitello radiale lussato: controlla il gomito) e <b>Galeazzi</b> (radio + articolazione radio-ulnare distale).</li>
<li>Lo <b>scafoide</b> negli adolescenti, i tessuti molli (tumefazione, linee adipose spostate).</li>
</ul>

<h2>Il referto</h2>
<p>Osso e segmento (epifisi, fisi, metafisi), tipo di Salter-Harris se la fisi è coinvolta, direzione e entità dello spostamento e dell'angolazione nelle due proiezioni, interessamento articolare, lesioni associate. Una frattura scomposta che richiede riduzione va comunicata subito al medico del Pronto soccorso.</p>
""" + prova_caso("Due radiografie del polso di bambini dopo un trauma: trova la frattura, dille il tipo e indica la condotta.",
    [("caso-tcia-094", "Polso di un ragazzo di 13 anni"), ("caso-tcia-096", "Polso di un bambino di 9 anni")]))

# ------------------------------------------------------------------ femore prossimale (27/11)
PAG["fratture-femore-prossimale"] = dict(
 titolo="Fratture del femore prossimale in RX: collo, pertrocanteriche e Garden — Quiz Radiologia",
 descr="Fratture del femore prossimale per specializzandi: intracapsulari ed extracapsulari, classificazione di Garden, segni alla radiografia, frattura occulta e quando chiedere RM o TC, cosa scrivere nel referto. Con un caso reale da provare senza iscriversi.",
 h1="Fratture del femore prossimale in radiografia: collo, pertrocanteriche e Garden",
 corpo=f"""<p class="sommario">Nell'anziano una caduta banale e il dolore all'anca con l'arto accorciato ed extraruotato fanno pensare a una frattura del femore prossimale. La distinzione che conta per il chirurgo è tra fratture <b>intracapsulari</b> (del collo) ed <b>extracapsulari</b> (trocanteriche): cambiano il rischio per la vascolarizzazione della testa e il tipo di intervento.</p>

<h2>1. Le proiezioni</h2>
<ul>
<li><b>Bacino antero-posteriore</b>, con le due anche a confronto, e <b>proiezione assiale</b> (laterale) dell'anca dolente.</li>
<li>Nell'antero-posteriore l'arto extraruotato accorcia il collo e può nascondere la frattura: il piccolo trocantere molto visibile è un indizio di extrarotazione.</li>
</ul>

<h2>2. Intracapsulari ed extracapsulari</h2>
<div class="scorri"><table class="tab"><thead><tr><th>Sede</th><th>Comprende</th><th>Perché conta</th></tr></thead><tbody>
<tr><td class="cod">Intracapsulari</td><td>Sottocapitate, transcervicali, basicervicali</td><td>Possono interrompere i vasi che nutrono la testa: rischio di necrosi avascolare e di mancata consolidazione. Se scomposte, nell'anziano spesso endoprotesi o protesi.</td></tr>
<tr><td class="cod">Extracapsulari</td><td>Pertrocanteriche (intertrocanteriche), sottotrocanteriche</td><td>Vascolarizzazione conservata, consolidano bene; di solito osteosintesi (chiodo endomidollare o vite-placca). Conta la stabilità: parete mediale (piccolo trocantere) e laterale.</td></tr>
</tbody></table></div>

<h2>3. La classificazione di Garden (fratture del collo)</h2>
<ul>
<li><b>I</b>: incompleta o impattata in valgo; <b>II</b>: completa, non scomposta;</li>
<li><b>III</b>: completa, parzialmente scomposta (le trabecole della testa non sono allineate a quelle dell'acetabolo); <b>IV</b>: completa e del tutto scomposta.</li>
<li>Nella pratica si distingue soprattutto tra <b>non scomposte (I-II)</b> e <b>scomposte (III-IV)</b>, che è anche la distinzione più riproducibile tra osservatori.</li>
</ul>

<h2>4. I segni alla radiografia</h2>
<ul>
<li>Interruzione o gradino della corticale del collo, soprattutto lungo il margine superiore e inferiore.</li>
<li><b>Linea sclerotica</b> di impatto (trabecole sovrapposte) nella frattura ingranata.</li>
<li>Perdita della continuità della <b>linea di Shenton</b> (margine inferiore del collo – margine superiore del forame otturato).</li>
<li>Angolo cervico-diafisario alterato, trabecole spezzate, risalita e accorciamento del femore.</li>
</ul>

<h2>5. Radiografia negativa con forte sospetto</h2>
<p>Una parte delle fratture, soprattutto nell'osteoporosi, non si vede in radiografia (frattura <b>occulta</b>). Se il dolore impedisce il carico, la <b>RM</b> è l'esame più sensibile (edema e rima ipointensa in T1); la <b>TC</b> è l'alternativa quando la RM non è disponibile. Nello stesso esame guarda <b>rami pubici, acetabolo e sacro</b>, che danno lo stesso dolore.</p>

<h2>Il referto</h2>
<p>Lato, sede (intracapsulare o extracapsulare, livello), scomposizione (Garden per il collo), comminuzione e interessamento del piccolo trocantere per le pertrocanteriche, osso patologico (lesioni litiche), artrosi e protesi controlaterale, altre fratture del bacino.</p>
""" + prova_caso("La radiografia del bacino di un paziente in Pronto soccorso con dolore all'anca dopo un trauma: trova la frattura e definisci la sede.",
    [("caso-tcia-098", "RX del bacino in Pronto soccorso")]))

# ------------------------------------------------------------------ dissezione aortica (27/11)
PAG["dissezione-aortica"] = dict(
 titolo="Dissezione aortica in angio-TC: Stanford, DeBakey, vero e falso lume — Quiz Radiologia",
 descr="Dissezione aortica per specializzandi: protocollo dell'angio-TC, classificazioni di Stanford e DeBakey, come distinguere vero e falso lume, malperfusione degli organi, ematoma intramurale e ulcera penetrante, trappole. Con un caso reale da provare senza iscriversi.",
 h1="Dissezione aortica in angio-TC: classificazione, vero e falso lume, malperfusione",
 corpo=f"""<p class="sommario">Nella <b>dissezione aortica</b> il sangue entra nella parete attraverso una lacerazione dell'intima e la separa: il <b>flap</b> intimale divide il <b>vero lume</b> dal <b>falso lume</b>. Insieme all'ematoma intramurale e all'ulcera penetrante fa parte della <b>sindrome aortica acuta</b>, un'urgenza in cui il radiologo deve rispondere in fretta a domande precise.</p>

<h2>1. Il protocollo</h2>
<ul>
<li><b>Senza contrasto</b>: per l'<b>ematoma intramurale</b> (ispessimento a semiluna della parete, spontaneamente iperdenso) e per le calcificazioni intimali spostate verso il centro.</li>
<li><b>Fase arteriosa</b>, possibilmente sincronizzata con l'ECG per la radice e l'aorta ascendente (il movimento cardiaco crea falsi flap); dall'arco sovraortico alle arterie femorali.</li>
<li><b>Fase tardiva</b>: il falso lume può riempirsi lentamente e sembrare trombizzato in arteriosa.</li>
</ul>

<h2>2. Le classificazioni</h2>
<div class="scorri"><table class="tab"><thead><tr><th>Classificazione</th><th>Tipo</th><th>Estensione</th></tr></thead><tbody>
<tr><td class="cod">Stanford</td><td>A</td><td>Coinvolge l'aorta ascendente, qualunque sia la sede della lacerazione: di regola chirurgia urgente.</td></tr>
<tr><td class="cod">Stanford</td><td>B</td><td>Non coinvolge l'ascendente: terapia medica, endovascolare se complicata.</td></tr>
<tr><td class="cod">DeBakey</td><td>I · II · III</td><td>I: dall'ascendente oltre l'arco; II: solo l'ascendente; III: discendente (IIIa sopra il diaframma, IIIb anche sotto).</td></tr>
</tbody></table></div>

<h2>3. Vero e falso lume</h2>
<ul>
<li>Il <b>vero lume</b> è in continuità con l'aorta non dissecata, spesso più piccolo e compresso, con il contrasto più denso nelle prime fasi.</li>
<li>Il <b>falso lume</b> è di solito più grande; ha il <b>segno del becco</b> (angolo acuto tra flap e parete), può contenere sottili «ragnatele» (cobweb) e trombo parziale.</li>
<li>Segui il flap su tutte le immagini e nelle ricostruzioni: indica la <b>porta di entrata</b> e i rientri, se visibili.</li>
</ul>

<h2>4. Le complicanze da cercare</h2>
<ul>
<li><b>Malperfusione</b>: da quale lume nascono tronco celiaco, mesenterica superiore, renali e iliache; reni ipoperfusi, intestino ischemico, arti.</li>
<li><b>Rottura</b>: ematoma periaortico o mediastinico, emotorace; nel tipo A <b>emopericardio</b> e coinvolgimento delle coronarie e della valvola aortica.</li>
<li>Diametro massimo dell'aorta e del falso lume, utile per il controllo nel tempo.</li>
</ul>

<h2>Trappole</h2>
<ul>
<li>Artefatto da <b>pulsazione</b> della radice senza sincronizzazione ECG: falsa linea nell'ascendente.</li>
<li>Artefatti a striscia dal contrasto denso nella vena brachiocefalica sinistra.</li>
<li><b>Trombo murale</b> di un aneurisma scambiato per falso lume trombizzato: nel trombo murale le calcificazioni intimali sono all'esterno, nella dissezione sono spostate verso il lume.</li>
</ul>

<h2>Il referto e la comunicazione</h2>
<p>Tipo (Stanford e DeBakey), estensione, porta di entrata, rapporti dei rami con i due lumi, segni di malperfusione e di rottura, diametri. È un <b>risultato critico</b>: va comunicato subito a voce al medico richiedente e al chirurgo vascolare o cardiochirurgo, e documentato.</p>
""" + prova_caso("Angio-TC dell'aorta toraco-addominale di un paziente con dolore toracico e dorsale: riconosci la dissezione, classificala e controlla da dove nascono i rami viscerali.",
    [("caso-tcia-118", "Angio-TC dell'aorta")]))

# ------------------------------------------------------------------ massa cerebrale in RM (27/11)
PAG["massa-cerebrale-rm"] = dict(
 titolo="Massa cerebrale in RM: metastasi o glioma? Segni e diagnosi differenziale — Quiz Radiologia",
 descr="Lesione cerebrale in RM per specializzandi: segni delle metastasi e dei gliomi (anche l'astrocitoma IDH-mutato e il segno del mismatch T2-FLAIR), lesioni con anello, diffusione e perfusione, cosa scrivere nel referto. Con casi reali da provare senza iscriversi.",
 h1="Massa cerebrale in RM: metastasi o glioma?",
 corpo=f"""<p class="sommario">Davanti a una lesione cerebrale in RM la prima domanda è: <b>metastasi o tumore primitivo</b>? La storia clinica conta molto (un tumore noto rende la metastasi la prima ipotesi nell'adulto), ma le immagini danno indizi forti: numero, sede, edema, impregnazione, diffusione.</p>

<h2>1. Le sequenze</h2>
<ul>
<li><b>T2 e FLAIR</b> per la lesione e l'edema; <b>T1 dopo gadolinio</b>, meglio volumetrica con strati sottili, per le lesioni piccole; <b>diffusione</b> (DWI e mappa ADC); <b>SWI</b> o T2* per sangue e calcio.</li>
<li>La <b>perfusione</b> (rCBV) e la spettroscopia aiutano nei casi dubbi.</li>
</ul>

<h2>2. Le metastasi</h2>
<ul>
<li>Spesso <b>multiple</b> (ma una lesione singola non esclude una metastasi).</li>
<li>Alla <b>giunzione tra corteccia e sostanza bianca</b> e nelle zone di confine tra territori arteriosi; circa 80% negli emisferi cerebrali, 15% nel cervelletto, il resto nel tronco.</li>
<li><b>Edema vasogenico</b> ampio rispetto alle dimensioni della lesione; impregnazione nodulare o ad anello.</li>
<li>Primitivi più frequenti: polmone, mammella, melanoma, rene, colon. Tendono a <b>sanguinare</b> soprattutto melanoma, rene, tiroide e coriocarcinoma.</li>
</ul>

<h2>3. I gliomi</h2>
<ul>
<li><b>Glioma di basso grado</b> (per esempio l'astrocitoma IDH-mutato di grado 2): area iperintensa in T2/FLAIR nella sostanza bianca e nella corteccia, effetto massa modesto, edema scarso, impregnazione assente o minima.</li>
<li><b>Segno del mismatch T2-FLAIR</b>: lesione omogeneamente iperintensa in T2 e quasi ipointensa in FLAIR al centro, con un orletto iperintenso. Ha alta specificità per l'astrocitoma IDH-mutato senza codelezione 1p/19q.</li>
<li><b>Glioblastoma</b>: impregnazione irregolare ad anello spesso, necrosi centrale, infiltrazione del corpo calloso («a farfalla»); l'alterazione intorno contiene tumore infiltrante, non solo edema.</li>
<li>La classificazione OMS dei tumori del sistema nervoso centrale (5ª edizione, 2021) si basa anche sulle alterazioni molecolari: in RM si propone l'ipotesi, la diagnosi è istologica e molecolare.</li>
</ul>

<h2>4. Lesioni con impregnazione ad anello: la diagnosi differenziale</h2>
<div class="scorri"><table class="tab"><thead><tr><th>Lesione</th><th>Indizi</th></tr></thead><tbody>
<tr><td class="cod">Ascesso</td><td>Forte restrizione della diffusione al centro; capsula liscia, più sottile verso il ventricolo.</td></tr>
<tr><td class="cod">Metastasi</td><td>Spesso multiple, sede cortico-sottocorticale, edema ampio, perfusione bassa nell'edema intorno.</td></tr>
<tr><td class="cod">Glioblastoma</td><td>Anello irregolare e spesso, necrosi, corpo calloso, perfusione alta anche intorno alla parte impregnata.</td></tr>
<tr><td class="cod">Demielinizzazione</td><td>Anello incompleto, aperto verso la corteccia; poco effetto massa per le dimensioni.</td></tr>
<tr><td class="cod">Linfoma</td><td>Periventricolare o del corpo calloso, restrizione della diffusione omogenea; nell'immunocompetente raramente necrotico.</td></tr>
</tbody></table></div>

<h2>Il referto</h2>
<p>Numero, sede e dimensioni delle lesioni, impregnazione, diffusione, emorragia, edema ed effetto massa (spostamento della linea mediana, ernie, idrocefalo). Un effetto massa importante o un'ernia in atto vanno comunicati subito.</p>
""" + prova_caso("Due RM dell'encefalo: una donna con un carcinoma renale noto e una giovane donna con una lesione frontale. Metastasi o glioma?",
    [("caso-tcia-062", "RM: donna di 74 anni con carcinoma renale"), ("caso-tcia-060", "RM: donna di 22 anni, lesione frontale")]))
'''

a = '\nORDINE = [("bi-rads","BI-RADS in mammografia ed ecografia"),("figo-cervice","Stadiazione FIGO della cervice in RM"),("embolia-polmonare","Embolia polmonare in angio-TC")]'
assert s.count(a) == 1
s = s.replace(a, NUOVE + '\nORDINE = [("bi-rads","BI-RADS in mammografia ed ecografia"),("figo-cervice","Stadiazione FIGO della cervice in RM"),("embolia-polmonare","Embolia polmonare in angio-TC"),'
              '("dissezione-aortica","Dissezione aortica in angio-TC"),("fratture-polso-bambino","Fratture del polso nel bambino"),("fratture-femore-prossimale","Fratture del femore prossimale"),("massa-cerebrale-rm","Massa cerebrale in RM: metastasi o glioma?")]')
a = '"Schede di ripasso di radiologia per specializzandi: BI-RADS, stadiazione FIGO della cervice in RM, embolia polmonare in angio-TC, ciascuna con casi reali da risolvere."'
assert s.count(a) == 1
s = s.replace(a, '"Schede di ripasso di radiologia per specializzandi: BI-RADS, stadiazione FIGO della cervice in RM, embolia polmonare e dissezione aortica in angio-TC, fratture del polso nel bambino e del femore prossimale, massa cerebrale in RM. Ciascuna con casi reali da risolvere."')
# le pagine nuove portano la loro data
a = '    open(f"{slug}.html","w").write(pagina(slug, p["titolo"], p["descr"], p["h1"], p["corpo"], altre=altre))'
assert s.count(a) == 1
s = s.replace(a, '    open(f"{slug}.html","w").write(pagina(slug, p["titolo"], p["descr"], p["h1"], p["corpo"], oggi=p.get("oggi", "2026-11-26"), altre=altre))')
for k in ["fratture-polso-bambino", "fratture-femore-prossimale", "dissezione-aortica", "massa-cerebrale-rm"]:
    a = f'PAG["{k}"] = dict(\n'
    s = s.replace(a, f'PAG["{k}"] = dict(\n oggi="2026-11-27",\n')
open(f, 'w').write(s)
print('ok')
