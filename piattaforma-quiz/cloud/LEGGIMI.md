# Quiz Radiologia su AWS

**Pubblicare:** doppio clic su `pubblica.command` (la prima volta: tasto destro → Apri).
Usa lo stesso conto, la stessa utenza e la stessa regione (Milano) dei Turni.
Si può rilanciare quando si vuole: aggiorna solo quello che è cambiato.

- **Indirizzo:** https://quiz.turniradiologia.it. Se in `.segreti` c'è `DOMINIO_NUOVO="radioquiz.it"`,
  appena il dominio risulta registrato su Route 53 la pubblicazione si sposta da sola su
  https://radioquiz.it (e www), con il suo certificato. Il vecchio indirizzo smette di rispondere.
- **Codice dell'amministratore:** è nel file `.segreti` in questa cartella e lo script lo mostra alla fine.
  Per cambiarlo, cancella la riga `CODICE_AMMINISTRATORE` e rilancia.

## Account
L'amministratore entra con il suo codice e apre **Account**, dove può:
- **creare un account:** nome e ruolo (specializzando o docente). Il codice personale compare
  **una volta sola** e va comunicato di persona;
- **rigenerare un codice:** quello vecchio smette subito di funzionare;
- **disattivare o riattivare** un account (ad esempio a fine rotazione);
- **eliminarlo:** i risultati già registrati restano.

| Ruolo | Cosa può fare |
|---|---|
| Specializzando | Risolve i casi. I risultati vengono registrati a suo nome. |
| Docente | Modifica i casi e scarica i risultati (CSV). |
| Amministratore | Tutto quello che fa il docente, più la gestione degli account. |

## Cosa crea
- **S3 "Sito"** (privato): la pagina e le immagini anonimizzate, servite solo tramite CloudFront.
  Le immagini si aprono solo dopo l'accesso con un codice.
- **S3 "Dati"** (privato, mai esposto): domande e risposte corrette, con versioni
  (una modifica sbagliata si recupera).
- **Lambda**, dietro CloudFront su /api: account, casi e risultati. Le risposte corrette
  non arrivano mai al browser prima che lo specializzando abbia risposto.
- **DynamoDB**: account (solo l'impronta dei codici) e risultati.
- **Certificato HTTPS** in Virginia, convalidato da solo nella zona turniradiologia.it.
  I record DNS dei Turni non vengono toccati.

## Analisi (docenti e amministratore)
Pulsante **Analisi** in alto. Si basa di regola sul **primo tentativo** di ogni specializzando.
- **Casi:**
  - punteggio medio, risposte esatte, tempo mediano;
  - per ogni opzione: quanti l'hanno scelta, quanti l'hanno trattata correttamente, la
    **discriminazione** e la sicurezza dichiarata (gli «errori convinti» sono distrattori scelti da «sicuri»);
  - i **reperti secondari mancati** da chi ha trovato il principale;
  - le serie aperte e quante immagini sono state scorse.
- **Specializzandi:** punteggio e andamento nel tempo, reperti secondari trovati, **calibrazione**
  (quanto spesso è corretto chi si dichiara sicuro, probabile o in ipotesi), tempo, uso di MPR e
  risultati per area (distretto · modalità).
- **Scarica CSV:** tutte le risposte, con tentativo, sicurezza, tempi e strumenti.

Per ottenere un'analisi utile, nell'editor indica per ogni opzione se è il **reperto principale**,
un **reperto secondario** o un **distrattore**, e la **modalità** del caso.
I casi già scritti funzionano lo stesso: la prima opzione corretta vale come principale.
Prima di rispondere, lo specializzando indica per ogni scelta quanto ne è sicuro.
Tempi, serie viste e strumenti usati vengono registrati con la risposta; li vedono solo docenti e amministratore.

## Visualizzatore: 2D e MPR + 3D
Nel caso, il pulsante **MPR + 3D** apre la vista a quattro riquadri (assiale, sagittale, coronale e 3D)
della serie selezionata:
- **Piani:** trascina le linee colorate per spostare i piani e le maniglie per ruotarli (MPR obliqua).
- **Strato:** spessore da 3 a 40 mm, con MIP, media o MinIP (es. MIP 10–20 mm per i vasi).
- **3D:** preset «Angio e ossa», «Organi con mdc», «Osso», «Cuore e vasi», «Polmone», «Muscoli».
  Trascina per ruotare, tasto destro o rotellina per lo zoom.
- **Requisiti:** serve una serie di almeno 10 immagini parallele (le TC assiali vanno benissimo) e un
  computer con WebGL2. Sui telefoni resta la vista 2D.
- **Caricamento:** il motore 3D (circa 1 MB compresso) si scarica solo alla prima apertura.
  La serie intera deve essere in memoria: pochi secondi per una TC addome.

## Visualizzatore: più serie, misure e fasi
- **Riquadri:** da 1 a 4 serie insieme (menu «1 riquadro… 4 riquadri»). Clicca un riquadro (bordo blu), poi scegli
  la serie a sinistra. Con **Sincronizza**, i riquadri con lo stesso piano vanno alla stessa posizione
  (con zoom e spostamento), quelli con piani diversi mostrano la **linea di riferimento** tratteggiata.
- **Disposizione automatica:** all'apertura del caso, se ci sono da 2 a 4 serie ne va una per riquadro; se le serie
  sono corte (immagini salvate, ricostruzioni singole) va un'immagine per riquadro. Le MIP non mostrano linee di
  riferimento. Il docente può fissare il numero di riquadri nell'editor («Riquadri all'apertura»).
- **Studi diversi (coregistrazione):** se il caso contiene due esami (es. attuale e precedente), le serie compaiono come
  «Studio 1» (il più vecchio) e «Studio 2». Premi **Allinea** e clicca lo stesso punto anatomico (es. un processo
  spinoso) in due riquadri: da lì scorrono insieme. È un allineamento per traslazione: va bene se il paziente
  era posizionato in modo simile.
- **Strumenti:** Misura (mm), **ROI** ellittica (media ± DS, min/max, area; HU solo per la TC), **Angolo**.
- **Analisi delle fasi:** una ROI viene ricopiata nella stessa sede nei riquadri con lo stesso piano. Sotto le
  immagini c'è la tabella con il valore in ogni fase, la variazione rispetto alla basale, la curva e:
  - in TC il **wash-out** assoluto e relativo;
  - in RM il **tipo di curva** (I progressiva, II plateau, III wash-out).
  Le fasi si riconoscono dal nome della serie («basale/pre/senza», «tardiva»). Le RM dinamiche con tutte le fasi
  in una sola serie vengono divise in «fase 1/N… N/N» al caricamento. Allo stesso modo un pacchetto di
  ricostruzioni con piani diversi viene diviso in assiale, coronale e sagittale.

## Aggiornare le domande di un caso già online
Di regola un caso già online non viene sovrascritto. Per inviare la versione locale di `casi/<caso>/caso.json`
crea nella cartella del caso un file vuoto chiamato `AGGIORNA` e rilancia: viene usato una volta e poi cancellato.

## Elenco dei casi e allenamento casuale
- I casi sono raggruppati per **metodica** (TC, RM, RX, Ecografia…), con schede per filtrarli. La metodica è quella
  scelta nell'editor; per i casi vecchi viene dedotta dal titolo.
- **Allenamento casuale:** apre un caso a caso tra quelli della metodica scelta, senza ripetizioni nella sessione;
  dopo la risposta compare «Prossimo caso casuale».

## Ingrandire una vista
- **Doppio clic** su un riquadro: occupa tutto il visualizzatore (di nuovo doppio clic o Esc per tornare).
- In MPR + 3D il doppio clic ingrandisce assiale, sagittale, coronale o 3D.
- **Schermo intero:** pulsante nella barra (con un solo riquadro anche il doppio clic).

## Misure in MPR + 3D
ROI, Misura, Angolo e Punto funzionano anche sui piani MPR, obliqui compresi. La ROI mostra media ± DS, min/max e
area; inoltre una **ROI 3D**: l'ellissoide costruito sulla ROI (terzo asse uguale alla media dei due disegnati),
con diametri, volume stimato in cm³ e densità media.

## Eliminare un caso (docenti)
In «Modifica caso», in fondo: **Elimina caso**, poi riscrivi il codice del caso per confermare. Le immagini vengono
cancellate, le domande archiviate (recuperabili) e i risultati restano. La pubblicazione dal Mac non lo ricarica;
per ripristinarlo, file vuoto `AGGIORNA` nella cartella del caso e rilancia.

## Nuovo caso (docenti e amministratore)
Dal sito, **+ Nuovo caso**:
1. **Cartella:** trascina la cartella dell'esame, oppure usa «Scegli cartella».
2. **Anonimizzazione:** le immagini vengono anonimizzate **nel browser**, quindi i dati del paziente
   non lasciano il computer. Le secondary capture e i file non DICOM vengono esclusi.
3. **Controllo:** guarda le anteprime e togli la spunta alle serie che non vuoi, per esempio se vedi
   testo con dati del paziente.
4. **Caricamento:** con «Anonimizza e carica» ogni file viene ricontrollato prima dell'invio.
   Se dovesse contenere ancora nome, ID o ospedale, il caricamento si ferma.
5. **Domande:** si apre l'editor, dove scrivi anamnesi, opzioni e discussione. Il caso resta in
   **bozza**, visibile solo ai docenti, finché non spunti «Visibile agli specializzandi».

## Aggiungere casi dal Mac (alternativa)
1. `python3 anonimizza.py "/cartella/esame" caso-002` nella cartella piattaforma-quiz, poi
   compila `casi/caso-002/caso.json` (oppure completa il caso dall'editor online dopo la pubblicazione).
2. Rilancia `pubblica.command`: carica le immagini nuove e le domande dei casi nuovi.

Un caso **già online non viene sovrascritto**, così le modifiche fatte dall'editor online restano.
Per forzare la versione locale di un caso: file vuoto `AGGIORNA` nella sua cartella (vedi sopra).

## Costo indicativo
Con poche decine di utenti e qualche caso si resta sui centesimi al mese.
La voce principale è lo spazio occupato su S3: circa 0,5 GB per caso.
