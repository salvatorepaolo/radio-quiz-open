# Quiz Radiologia

Piattaforma di addestramento per specializzandi in radiologia: casi clinici con immagini DICOM
anonimizzate, visualizzatore nel browser e domande a scelta multipla.
È online su **https://quiz.turniradiologia.it** (AWS, stesso conto dei Turni).

## Cartelle
```
piattaforma-quiz/
  anonimizza.py      crea un nuovo caso da una cartella DICOM, anonimizzandola
  casi/              un caso = immagini anonimizzate + caso.json (domande e risposte)
  cloud/             tutto ciò che va su AWS
    pubblica.command   doppio clic per pubblicare o aggiornare
    web/               la pagina (visualizzatore + quiz)
    api/ lib/ bin/     server (Lambda) e infrastruttura (CDK)
    LEGGIMI.md         account, ruoli, dettagli della pubblicazione
```

## Due siti separati (da ottobre 2026)
| Sito | Casi | Cartella sul Mac | Pubblicazione |
|---|---|---|---|
| https://radio-quiz.it (free, iscrizione libera) | solo casi da archivi pubblici (TCIA), `caso-tcia-NNN` | `casi-free/` | `cloud/pubblica.command` |
| https://polime.radio-quiz.it (Policlinico G. Martino, solo su invito) | casi del Polime, `caso-NNN` | `casi/` | `cloud/pubblica-azienda.command` → `polime` |

I casi del Polime non vanno mai in `casi-free/`, e viceversa. Le due istanze hanno account, risultati e codici
dell'amministratore separati (quello del Polime è in `cloud/istanze/polime/.segreti`).

## Aggiungere un caso
1. `python3 anonimizza.py "/percorso/cartella_esame" caso-002`
   (serve Python 3 con pydicom: `pip3 install --user pydicom`). L'originale non viene modificato.
2. Compila `casi/caso-002/caso.json`, oppure pubblica e poi completa il caso dall'editor online
   (con un account docente o amministratore).
3. Doppio clic su `cloud/pubblica.command`.

## Anonimizzazione
- **Lista bianca:** restano solo i campi tecnici. Vengono eliminati nome, ID, nascita, sesso,
  età, ospedale, reparto, medici, operatori, apparecchio, tutte le date e tutti i tag privati.
  Gli UID vengono rigenerati.
- **Immagini escluse:** secondary capture, immagini a colori e immagini con testo nei pixel.
- Con un apparecchio nuovo, controlla comunque a vista le prime immagini.

## Visualizzatore
- **Scorrimento:** rotellina o frecce.
- **Trascinamento:** applica lo strumento attivo (Finestra, Sposta, Zoom, Misura in mm).
- **Mouse:** tasto destro per lo zoom; Shift o tasto centrale per spostare.
- **Altro:** preset di finestra, cine, valore HU sotto il cursore.
- **Formati:** DICOM non compresso e JPEG Lossless.

Librerie open source: dicomParser e jpeg-lossless-decoder-js (MIT).
