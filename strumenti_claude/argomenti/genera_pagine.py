# genera le pagine per argomento di radio-quiz.it (statiche, indicizzabili)
import json, html
CSS = """:root{--sf:#fff;--txt:#1d2430;--muto:#5b6575;--bord:#d9dee6;--acc:#1f5fbf;--riga:#f4f6f9}
@media (prefers-color-scheme:dark){:root{--sf:#12161d;--txt:#e6e9ee;--muto:#9aa4b2;--bord:#2b3340;--acc:#6ea2ff;--riga:#1a2029}}
*{box-sizing:border-box}body{margin:0;background:var(--sf);color:var(--txt);font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:20px 16px 48px}nav.briciole{font-size:.9rem;color:var(--muto);margin-bottom:10px}
header{display:flex;align-items:center;gap:12px;margin-bottom:6px}header img{width:44px;height:44px}
h1{font-size:1.65rem;line-height:1.25;margin:0}h2{font-size:1.2rem;margin:30px 0 8px;color:var(--acc)}h3{font-size:1.02rem;margin:18px 0 4px}
a{color:var(--acc)}.muto{color:var(--muto)}.sommario{font-size:1.05rem}
.tab{width:100%;border-collapse:collapse;font-size:.95rem;margin:8px 0}.tab th,.tab td{text-align:left;vertical-align:top;padding:7px 8px;border-bottom:1px solid var(--bord)}
.tab th{background:var(--riga);font-weight:600}.scorri{overflow-x:auto}.cod{white-space:nowrap;font-weight:700}
.nota{border-left:3px solid var(--acc);background:var(--riga);padding:10px 14px;border-radius:6px;margin:14px 0}
.prova{background:var(--riga);border:1px solid var(--bord);border-radius:12px;padding:16px 18px;margin:28px 0}
.prova a.btn{display:inline-block;background:#1f5fbf;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:22px;margin-top:6px}
ul{padding-left:22px}li{margin:3px 0}footer{margin-top:36px;font-size:.88rem;color:var(--muto);border-top:1px solid var(--bord);padding-top:12px}"""

def pagina(slug, titolo, descr, h1, corpo, oggi="2026-11-26", altre=()):
    url = f"https://radio-quiz.it/argomenti/{slug}.html"
    ld = {"@context":"https://schema.org","@type":"LearningResource","name":h1,"description":descr,"url":url,
          "inLanguage":"it","learningResourceType":"Scheda di ripasso","educationalLevel":"Medici specializzandi e studenti di medicina",
          "audience":{"@type":"EducationalAudience","educationalRole":"student"},"isAccessibleForFree":True,"dateModified":oggi,
          "license":"https://creativecommons.org/licenses/by-sa/4.0/","publisher":{"@type":"Organization","name":"Quiz Radiologia","url":"https://radio-quiz.it/","logo":"https://radio-quiz.it/client/icona-512.png"}}
    altre_html = " · ".join(f'<a href="{s}.html">{html.escape(t)}</a>' for s, t in altre)
    return f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(titolo)}</title>
<meta name="description" content="{html.escape(descr)}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/logo.svg">
<meta property="og:type" content="article"><meta property="og:site_name" content="Quiz Radiologia"><meta property="og:locale" content="it_IT">
<meta property="og:url" content="{url}"><meta property="og:title" content="{html.escape(h1)}"><meta property="og:description" content="{html.escape(descr)}">
<meta property="og:image" content="https://radio-quiz.it/img/condivisione.jpg"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body>
<main>
<nav class="briciole"><a href="/">Quiz Radiologia</a> › <a href="/argomenti/">Argomenti</a></nav>
<header><img src="/logo.svg" alt=""><h1>{html.escape(h1)}</h1></header>
{corpo}
<p class="muto">Altri argomenti: {altre_html} · <a href="/argomenti/">tutti</a></p>
<footer>
<p>Scheda di ripasso a scopo <b>esclusivamente didattico</b>: non è un dispositivo medico e non sostituisce linee guida, testi di riferimento e giudizio clinico. Testo preparato con l'aiuto dell'intelligenza artificiale, <b>non ancora rivisto da un medico radiologo</b>: segnala errori a <a href="mailto:info@radio-quiz.it">info@radio-quiz.it</a>. Aggiornata il 26/11/2026.</p>
<p>© 2026 Quiz Radiologia · testi con licenza <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.it">CC BY-SA 4.0</a> · <a href="/licenze.html">Licenze e crediti</a> · <a href="https://github.com/salvatorepaolo/radio-quiz-open">Codice sorgente</a></p>
</footer>
</main>
</body>
</html>
"""

def prova(testo, n, titolo_perc):
    return f"""<div class="prova"><b>Mettiti alla prova su casi reali.</b> {testo}<br>
<span class="muto">Percorso «{html.escape(titolo_perc)}»: {n} casi con immagini DICOM anonime da archivi pubblici, visualizzatore nel browser, test d'ingresso e attestato finale. Gratuito.</span><br>
<a class="btn" href="/#/allenamento">Apri i percorsi su radio-quiz.it</a></div>"""

PAG = {}
# ------------------------------------------------------------------ BI-RADS
PAG["bi-rads"] = dict(
 titolo="BI-RADS: categorie da 0 a 6, densità mammaria e lessico — Quiz Radiologia",
 descr="BI-RADS spiegato per specializzandi: categorie 0–6 con rischio di malignità e condotta, densità ACR A–D, lessico di masse, calcificazioni, asimmetrie e distorsioni. Con casi reali per esercitarsi.",
 h1="BI-RADS in mammografia ed ecografia: categorie, densità e lessico",
 corpo=f"""<p class="sommario">Il <b>BI-RADS</b> (Breast Imaging Reporting and Data System, American College of Radiology, 5ª edizione) uniforma il referto della mammella: un lessico comune per descrivere i reperti, una <b>categoria finale</b> che dice quanto è probabile un tumore e che cosa fare, e la <b>densità</b> del seno. Qui il ripasso essenziale, poi i casi su cui allenarsi.</p>

<h2>Le categorie BI-RADS</h2>
<div class="scorri"><table class="tab">
<thead><tr><th>Categoria</th><th>Significato</th><th>Probabilità di tumore</th><th>Condotta</th></tr></thead>
<tbody>
<tr><td class="cod">0</td><td>Incompleto: servono altre immagini o il confronto con esami precedenti</td><td>—</td><td>Proiezioni aggiuntive, ecografia, esami precedenti</td></tr>
<tr><td class="cod">1</td><td>Negativo</td><td>praticamente 0%</td><td>Screening di routine</td></tr>
<tr><td class="cod">2</td><td>Reperto benigno (cisti semplice, linfonodo intramammario, calcificazioni tipicamente benigne, fibroadenoma calcifico)</td><td>praticamente 0%</td><td>Screening di routine</td></tr>
<tr><td class="cod">3</td><td>Probabilmente benigno</td><td>&gt; 0% e ≤ 2%</td><td>Controllo a breve (di solito a 6 mesi), poi per 2–3 anni</td></tr>
<tr><td class="cod">4</td><td>Sospetto: 4A bassa (&gt; 2–10%), 4B moderata (&gt; 10–50%), 4C alta (&gt; 50% e &lt; 95%)</td><td>&gt; 2% e &lt; 95%</td><td>Biopsia</td></tr>
<tr><td class="cod">5</td><td>Altamente suggestivo di malignità</td><td>≥ 95%</td><td>Biopsia</td></tr>
<tr><td class="cod">6</td><td>Tumore già dimostrato con biopsia, prima della terapia definitiva</td><td>—</td><td>Terapia; stadiazione</td></tr>
</tbody></table></div>
<div class="nota">La categoria 3 si usa per reperti con caratteristiche precise, visti a una prima valutazione completa: tipicamente una massa ovale circoscritta non calcificata, un'asimmetria focale o un gruppo di calcificazioni puntiformi. Non è una categoria «di dubbio»: se il reperto non convince, è 4.</div>

<h2>Densità mammaria (ACR)</h2>
<ul>
<li><b>A</b> – quasi completamente adiposa;</li>
<li><b>B</b> – aree sparse di tessuto fibroghiandolare;</li>
<li><b>C</b> – eterogeneamente densa, che può nascondere piccole masse;</li>
<li><b>D</b> – estremamente densa: la sensibilità della mammografia si riduce.</li>
</ul>
<p>Le categorie C e D si dicono «seno denso»; nel referto la densità va sempre indicata perché cambia l'affidabilità dell'esame e può portare a esami integrativi (ecografia, tomosintesi, RM secondo il rischio).</p>

<h2>Il lessico mammografico</h2>
<h3>Masse</h3>
<p><b>Forma</b>: ovale, rotonda, irregolare. <b>Margini</b>: circoscritti, oscurati, microlobulati, indistinti, spiculati. <b>Densità</b> rispetto al tessuto: alta, uguale, bassa, a contenuto adiposo. Una massa irregolare con margini spiculati o indistinti è il quadro più sospetto; una massa a contenuto adiposo è benigna.</p>
<h3>Calcificazioni</h3>
<p><b>Tipicamente benigne</b>: cutanee, vascolari, grossolane «a popcorn», a bastoncello (secretorie), rotonde, a guscio, distrofiche, «latte di calcio» (a menisco nella proiezione laterale), su suture.<br>
<b>Morfologia sospetta</b>, in ordine crescente: amorfe, grossolane eterogenee, fini pleomorfe, <b>fini lineari o lineari ramificate</b>.<br>
<b>Distribuzione</b>: diffusa, regionale, raggruppata, <b>lineare</b>, <b>segmentaria</b> (queste due fanno pensare a una crescita lungo un dotto).</p>
<h3>Altri reperti</h3>
<p><b>Asimmetria</b> (vista in una sola proiezione, spesso sovrapposizione), <b>asimmetria globale</b>, <b>focale</b> e <b>in evoluzione</b> (nuova o cresciuta: sospetta). <b>Distorsione architetturale</b> senza massa visibile: se non c'è una cicatrice chirurgica, va studiata (tomosintesi, biopsia). <b>Caratteristiche associate</b>: retrazione della cute o del capezzolo, ispessimento cutaneo, linfonodi ascellari.</p>

<h2>BI-RADS in ecografia</h2>
<p>Per le masse si descrivono <b>forma</b>, <b>orientamento</b> (parallelo alla cute o non parallelo, cioè «più alto che largo», sospetto), <b>margini</b> (circoscritti o non circoscritti: indistinti, angolati, microlobulati, spiculati), <b>ecostruttura</b> e <b>caratteristiche posteriori</b> (rinforzo, ombra, misto). Nel referto: lato, ora come guardando la paziente e distanza dal capezzolo. Una cisti semplice anecogena con rinforzo posteriore è BI-RADS 2.</p>

<h2>Errori frequenti</h2>
<ul>
<li>Dare la categoria al singolo reperto e non all'esame: la categoria finale è quella del reperto più preoccupante.</li>
<li>Usare il 3 per reperti trovati allo screening senza averli prima studiati (prima si assegna 0, poi si completa).</li>
<li>Dimenticare il confronto con gli esami precedenti: un reperto stabile da anni cambia la categoria.</li>
<li>Non correlare mammografia ed ecografia: la massa deve essere la stessa per sede, dimensione e forma.</li>
</ul>
{prova("Mammografie, ecografie e RM mammarie da archivi pubblici: descrivi i reperti, scegli la categoria BI-RADS e confronta la tua risposta con la discussione.", 16, "Mammella: lettura mammografica e BI-RADS")}
""")

# ------------------------------------------------------------------ FIGO cervice
PAG["figo-cervice"] = dict(
 titolo="Stadiazione FIGO 2018 del carcinoma della cervice in RM — Quiz Radiologia",
 descr="Stadiazione FIGO 2018 del carcinoma della cervice uterina: tabella degli stadi, protocollo RM, anello stromale, parametri, vagina, idronefrosi, vescica e retto, linfonodi. Con casi RM reali per esercitarsi.",
 h1="Carcinoma della cervice: stadiazione FIGO 2018 in RM",
 corpo=f"""<p class="sommario">Dal 2018 la stadiazione <b>FIGO</b> del carcinoma della cervice uterina ammette l'imaging: la <b>RM della pelvi</b> è l'esame di riferimento per dimensione del tumore, invasione dei parametri, della vagina e degli organi vicini; TC o PET-TC valutano linfonodi e metastasi. Lo stadio decide fra chirurgia e chemioradioterapia.</p>

<h2>Gli stadi FIGO 2018</h2>
<div class="scorri"><table class="tab">
<thead><tr><th>Stadio</th><th>Definizione</th></tr></thead>
<tbody>
<tr><td class="cod">IA</td><td>Carcinoma invasivo diagnosticato solo al microscopio, profondità ≤ 5 mm (IA1 &lt; 3 mm; IA2 da 3 a 5 mm)</td></tr>
<tr><td class="cod">IB1</td><td>Confinato alla cervice, invasione &gt; 5 mm, diametro massimo ≤ 2 cm</td></tr>
<tr><td class="cod">IB2</td><td>Diametro &gt; 2 cm e ≤ 4 cm</td></tr>
<tr><td class="cod">IB3</td><td>Diametro &gt; 4 cm</td></tr>
<tr><td class="cod">IIA</td><td>Due terzi superiori della vagina, senza parametri (IIA1 ≤ 4 cm; IIA2 &gt; 4 cm)</td></tr>
<tr><td class="cod">IIB</td><td>Invasione dei parametri, senza arrivare alla parete pelvica</td></tr>
<tr><td class="cod">IIIA</td><td>Terzo inferiore della vagina</td></tr>
<tr><td class="cod">IIIB</td><td>Parete pelvica e/o idronefrosi o rene non funzionante (salvo altra causa)</td></tr>
<tr><td class="cod">IIIC1 / IIIC2</td><td>Linfonodi pelvici (C1) o lombo-aortici (C2), qualunque sia il tumore; si annota «r» se dall'imaging, «p» se dall'istologia</td></tr>
<tr><td class="cod">IVA</td><td>Mucosa della vescica o del retto (confermata con biopsia)</td></tr>
<tr><td class="cod">IVB</td><td>Metastasi a distanza</td></tr>
</tbody></table></div>

<h2>Il protocollo RM</h2>
<ul>
<li><b>T2 ad alta risoluzione</b> sagittale e, soprattutto, <b>assiale obliquo perpendicolare al canale cervicale</b>: è il piano in cui si giudicano anello stromale e parametri.</li>
<li><b>Diffusione (DWI)</b> con mappa ADC: il tumore è iperintenso in DWI e ipointenso in ADC; aiuta a misurarlo e a vedere piccoli residui.</li>
<li>Assiale T2 o DWI su tutto l'addome fino ai reni, per idronefrosi e linfonodi lombo-aortici.</li>
<li>Gel vaginale (facoltativo) per distendere i fornici; antiperistaltico per ridurre gli artefatti intestinali. Il mezzo di contrasto dinamico è utile soprattutto nei tumori piccoli.</li>
</ul>

<h2>Che cosa guardare, stadio per stadio</h2>
<h3>Dimensione</h3>
<p>Diametro massimo del tumore in qualsiasi piano, in T2 (confronto con la DWI): separa IB1, IB2 e IB3 e, in vagina, IIA1 da IIA2. È la misura che più spesso cambia la terapia.</p>
<h3>Anello stromale e parametri</h3>
<p>Lo stroma cervicale è un <b>anello ipointenso in T2</b> attorno al tumore iperintenso. Un anello <b>integro</b> esclude con alta affidabilità l'invasione dei parametri (stadio ≤ IIA). Si parla di <b>IIB</b> quando l'anello è interrotto a tutto spessore e il tumore si estende con margini nodulari o spiculati nel grasso parametriale o ingloba i vasi uterini. Attenzione: un anello assottigliato o l'edema peritumorale non bastano.</p>
<h3>Vagina</h3>
<p>Nel T2 sagittale la parete vaginale è ipointensa: il tumore la sostituisce. Conta il livello: terzo superiore-medio (IIA) o terzo inferiore (IIIA).</p>
<h3>Parete pelvica e ureteri</h3>
<p>Tumore a meno di 3 mm o a contatto con muscoli (otturatore interno, piriforme, elevatore dell'ano) o vasi iliaci → IIIB. Anche l'<b>idronefrosi</b> da compressione dell'uretere porta a IIIB: per questo i reni vanno sempre guardati.</p>
<h3>Vescica e retto</h3>
<p>IVA richiede l'interruzione della parete ipointensa con tumore che raggiunge la mucosa o il lume. L'<b>edema bolloso</b> della parete vescicale da solo non è IVA. La perdita del piano adiposo senza infiltrazione della parete non basta.</p>
<h3>Linfonodi</h3>
<p>Sospetti se asse corto &gt; 10 mm, forma rotonda, margini irregolari o <b>necrosi</b> (il segno più specifico). Anche un tumore piccolo con linfonodi pelvici positivi è IIIC1r.</p>

<h2>Errori frequenti</h2>
<ul>
<li>Sovrastimare i parametri per un anello assottigliato, per edema o per il piano assiale non obliquo.</li>
<li>Dimenticare reni e linfonodi lombo-aortici: idronefrosi (IIIB) e linfonodi (IIIC2) cambiano lo stadio più dell'aspetto locale.</li>
<li>Misurare il tumore solo in un piano.</li>
<li>Dare IVA per edema bolloso.</li>
</ul>
{prova("Quattro RM della pelvi con carcinoma della cervice a stadi diversi: misura il tumore, valuta anello stromale, vagina, reni e vescica e scegli lo stadio FIGO.", 4, "Carcinoma della cervice: stadiazione FIGO in RM")}
""")

# ------------------------------------------------------------------ Embolia
PAG["embolia-polmonare"] = dict(
 titolo="Embolia polmonare in angio-TC: segni, cuore destro e trappole — Quiz Radiologia",
 descr="Embolia polmonare all'angio-TC per specializzandi: protocollo, segni di embolo acuto e cronico, sovraccarico del ventricolo destro (VD/VS), infarto polmonare, artefatti che simulano trombi, esame non diagnostico. Con casi reali.",
 h1="Embolia polmonare in angio-TC: segni, cuore destro e trappole",
 corpo=f"""<p class="sommario">L'<b>angio-TC delle arterie polmonari</b> è l'esame di riferimento quando si sospetta un'embolia polmonare. Un referto utile risponde a quattro domande: l'esame è diagnostico? Ci sono emboli, e fin dove? C'è sovraccarico del cuore destro? Ci sono altre cause dei sintomi?</p>

<h2>1. L'esame è diagnostico?</h2>
<ul>
<li>Acquisizione con <b>bolus tracking</b> sul tronco polmonare; opacizzazione adeguata intorno a <b>250 HU</b> o più nel tronco. Sotto, i rami segmentari e sottosegmentari non sono valutabili e va scritto nel referto.</li>
<li>Artefatti da <b>respiro</b> e da movimento cardiaco alle basi.</li>
<li><b>Interruzione transitoria del contrasto</b>: un'inspirazione profonda richiama sangue non opacizzato dalla vena cava inferiore e lo fa arrivare nelle arterie polmonari; è più frequente in gravidanza. Il segno: arterie poco opacizzate con aorta ben opacizzata.</li>
</ul>

<h2>2. I segni dell'embolo</h2>
<h3>Acuto</h3>
<ul>
<li><b>Difetto di riempimento</b> centrale nel lume, circondato da contrasto: «a ciambella» in sezione trasversale, «a binario» in sezione longitudinale.</li>
<li>Embolo che occlude il vaso, che appare <b>ingrandito</b> rispetto agli altri.</li>
<li>Margini che formano un <b>angolo acuto</b> con la parete (a menisco).</li>
<li>Emboli «a sella» sulla biforcazione del tronco polmonare.</li>
</ul>
<h3>Cronico (CTEPH)</h3>
<ul>
<li>Trombo <b>eccentrico</b>, aderente alla parete con angolo ottuso, talora calcifico.</li>
<li>Bande e reti intraluminali, stenosi, vasi ridotti di calibro.</li>
<li>Perfusione a mosaico, arterie bronchiali ipertrofiche, tronco polmonare dilatato.</li>
</ul>

<h2>3. Il cuore destro</h2>
<p>Il sovraccarico del ventricolo destro identifica i pazienti più a rischio e va sempre riportato:</p>
<ul>
<li>Rapporto <b>VD/VS &gt; 1</b> (diametri massimi trasversali, in assiale o nella ricostruzione quattro camere);</li>
<li><b>setto interventricolare</b> rettilineo o spostato verso sinistra;</li>
<li><b>reflusso</b> del mezzo di contrasto in vena cava inferiore e vene sovraepatiche;</li>
<li>tronco polmonare dilatato (più tipico della forma cronica).</li>
</ul>

<h2>4. Il parenchima e le altre cause</h2>
<p>L'<b>infarto polmonare</b> è un'opacità periferica a cuneo con base sulla pleura, spesso nei lobi inferiori, a volte con alone invertito; può associarsi un piccolo versamento. Guardare sempre anche aorta, pericardio, pleura, coste e addome superiore: la dispnea ha molte altre cause (polmonite, scompenso, dissezione, pneumotorace).</p>

<h2>Trappole che simulano un embolo</h2>
<ul>
<li><b>Artefatto da mescolamento</b> o da flusso: difetto mal definito, sparisce con finestre larghe o nella fase più tardiva; misura HU più alta di un trombo.</li>
<li><b>Vene polmonari</b> scambiate per arterie: seguire il vaso fino all'atrio sinistro o accanto al bronco (l'arteria accompagna il bronco).</li>
<li><b>Linfonodi ilari</b> e bronchi pieni di muco accanto all'arteria.</li>
<li>Artefatti a striscia dal contrasto denso in vena cava superiore.</li>
<li>Effetto di volume parziale nei rami che decorrono nel piano di scansione: controllare nelle ricostruzioni MPR.</li>
</ul>

<h2>Il referto e la comunicazione</h2>
<p>Un'embolia polmonare, soprattutto con sovraccarico destro, è un <b>risultato critico</b>: va comunicata subito al medico richiedente, e la comunicazione va documentata. Nel referto: sede più prossimale degli emboli, lato, segni di sovraccarico destro, qualità dell'esame, reperti associati.</p>
<div class="prova"><b>Mettiti alla prova su casi reali.</b> Quattro angio-TC del torace da archivi pubblici, con emboli centrali e periferici: scorri le immagini, usa MPR e finestre, misura VD/VS, rispondi e scegli come comunicare l'esito.<br>
<span class="muto">Sono nel percorso «Urgenze: embolia polmonare» (18 casi: anche aorta, ictus, traumi e fratture), con visualizzatore DICOM nel browser, test d'ingresso e attestato finale. Gratuito.</span><br>
<a class="btn" href="/#/allenamento">Apri i percorsi su radio-quiz.it</a></div>
""")

ORDINE = [("bi-rads","BI-RADS in mammografia ed ecografia"),("figo-cervice","Stadiazione FIGO della cervice in RM"),("embolia-polmonare","Embolia polmonare in angio-TC")]
for slug, p in PAG.items():
    altre = [(s,t) for s,t in ORDINE if s != slug]
    open(f"{slug}.html","w").write(pagina(slug, p["titolo"], p["descr"], p["h1"], p["corpo"], altre=altre))

# indice
voci = "".join(f'<li><a href="{s}.html"><b>{html.escape(PAG[s]["h1"])}</b></a><br><span class="muto">{html.escape(PAG[s]["descr"])}</span></li>' for s,_ in ORDINE)
corpo_i = f"""<p class="sommario">Schede di ripasso per specializzandi e studenti, ognuna collegata a un percorso di casi reali da risolvere nel visualizzatore DICOM di <a href="/">radio-quiz.it</a>.</p>
<ul>{voci}</ul>
<div class="prova"><b>Allenati sui casi.</b> Oltre 170 casi di TC, RM, radiografia, ecografia, mammografia e vetrini digitali, con domande a scelta multipla e discussione. Gratuito e open source.<br><a class="btn" href="/">Vai a radio-quiz.it</a></div>"""
ix = pagina("index", "Argomenti di radiologia: schede di ripasso — Quiz Radiologia", "Schede di ripasso di radiologia per specializzandi: BI-RADS, stadiazione FIGO della cervice in RM, embolia polmonare in angio-TC, ciascuna con casi reali da risolvere.", "Argomenti di radiologia: schede di ripasso", corpo_i)
ix = ix.replace('https://radio-quiz.it/argomenti/index.html','https://radio-quiz.it/argomenti/').replace('<p class="muto">Altri argomenti:  · <a href="/argomenti/">tutti</a></p>\n','')
open("index.html","w").write(ix)
print("ok")
