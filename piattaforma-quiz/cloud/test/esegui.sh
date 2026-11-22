#!/bin/bash
# Test di non regressione di radio-quiz.it: li lancia pubblica.command prima di pubblicare (si possono lanciare
# anche a mano: bash cloud/test/esegui.sh). Simulatore locale con i casi veri e un database vuoto in memoria:
# niente viene scritto online né nella cartella dei casi.
#   anonimizza.test.mjs anonimizzazione DICOM nel browser: dati inventati tolti, pixel e UID, esclusioni, controlli
#   anonimizza-fuzz.test.mjs 1000 DICOM a caso con dati inventati e file rovinati: niente esce (FUZZ_GIRI=n, FUZZ_SEME=n)
#   anonimizza-py.test.mjs anonimizza.py (Mac): unittest e stessi UID del browser (si salta senza pydicom)
#   strumenti-py.test.mjs controlla.py e anteprime.py (preparazione dei casi) su casi inventati
#   logica.test.mjs   server: punteggi, comunicazione, referto, punto, controlli, password, gettoni, URL S3 (vettore AWS)
#   analisi.test.mjs  analisi didattica per i docenti: discriminazione, secondari mancati, calibrazione, mappa degli errori
#   referto.test.mjs  referto PDF, Word e stampa: file ben formati, accenti, pagine, figure, testo dell'utente
#   logica-avvisi.test.mjs conservazione dei dati (cancellazioni con avviso), promemoria, riepiloghi ai docenti, email
#   api-iscrizione.test.mjs iscrizione, conferma email, nuova password, blocco, diritti (profilo, i miei dati, cancellazione)
#   api-google.test.mjs accesso con Google (Google finto nel simulatore): prima volta, account esistenti, attesa, errori
#   api-sfide.test.mjs  sfide tra amici: anteprima pubblica, classifica facoltativa, punteggi dopo l'adesione, limiti, uscita
#   api-proposte.test.mjs casi proposti dagli iscritti: senza controllo dell'anonimato positivo non si pubblicano
#   proprieta.test.mjs regole della correzione su migliaia di casi e risposte a caso (fast-check; FC_GIRI, FC_SEME)
#   api-fuzz.test.mjs     400 richieste a caso a tutte le rotte: mai errori del server, dettagli interni o dati altrui (API_GIRI)
#   date.test.mjs         scadenze in ora italiana, cambio dell'ora, fine mese e fine anno, fuso del server indifferente
#   formati.test.mjs      sintassi DICOM rare: deflate decompresso e letto come l'originale
#   casi.test.mjs     correzione di ogni caso con risposte tipo: proprietà e fotografia (fixture/casi-fotografia.json)
#   traduzioni.test.mjs struttura dei testi inglesi, nessun testo nuovo senza traduzione, segnaposto
#   moduli.test.mjs   correzione IA (parti senza modello), ecocardio, analisi, referto HTML, oggetti DICOM prodotti
#   pagina.test.mjs   moduli precaricati, cache del client, niente script nella pagina
#   scale.test.mjs    scale e classificazioni: calcoli (unità) e fotografia di non regressione
#   api.test.mjs      regole di sicurezza, correzione, percorsi, esami, funzioni del caso
#   limiti.test.mjs   piattaforme dei clienti: utenti massimi, scadenza, sospensione
#   browser.test.mjs  pagine principali senza errori JavaScript, un caso risposto, MPR/3D, telefono (Playwright)
cd "$(dirname "$0")" || exit 1
if [ ! -d node_modules/playwright ] || [ ! -f .chromium-pronto ]; then
  echo "  preparo Playwright e Chromium per i test nel browser (solo la prima volta, circa 150 MB)…"
  if npm install --no-audit --no-fund --silent >/dev/null 2>&1 && npx --yes playwright install chromium >/dev/null 2>&1; then touch .chromium-pronto
  else echo "  Playwright non installato: eseguo solo i test dell'API"; fi
fi
node --test --test-reporter=spec pagina.test.mjs scale.test.mjs anonimizza.test.mjs anonimizza-fuzz.test.mjs anonimizza-py.test.mjs strumenti-py.test.mjs moduli.test.mjs analisi.test.mjs referto.test.mjs logica.test.mjs logica-avvisi.test.mjs proprieta.test.mjs casi.test.mjs traduzioni.test.mjs api.test.mjs api-iscrizione.test.mjs api-google.test.mjs api-sfide.test.mjs api-proposte.test.mjs api-fuzz.test.mjs date.test.mjs formati.test.mjs azienda.test.mjs limiti.test.mjs automazione.test.mjs account_admin.test.mjs cmr.test.mjs t2star.test.mjs browser.test.mjs
