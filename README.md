# Quiz Radiologia (radio-quiz.it)

Piattaforma **open source a scopo educativo** per la formazione in radiologia: casi clinici reali e anonimi, un visualizzatore DICOM nel browser e domande a scelta multipla, con la discussione dopo la risposta.

Sito: **https://radio-quiz.it**

> Strumento didattico: **non è un dispositivo medico** e non va usato per la diagnosi o la refertazione clinica.

## Cosa contiene

| Cartella | Cosa c'è |
|---|---|
| `piattaforma-quiz/cloud/web/` | il sito: quiz, visualizzatore DICOM (2D, MPR e 3D, misure, confronto tra esami, vetrini digitali), versione scaricabile che funziona senza rete |
| `piattaforma-quiz/cloud/api/` | il server (AWS Lambda): accesso, risposte, statistiche, gestione dei casi |
| `piattaforma-quiz/cloud/lib/`, `bin/` | l'infrastruttura AWS (CDK): S3, CloudFront, Lambda, DynamoDB |
| `piattaforma-quiz/cloud/test/` | test di unità, del server e nel browser (Playwright), con un simulatore locale |
| `piattaforma-quiz/casi-free/` | i testi dei casi (domande, risposte, discussioni); le immagini non sono nel repository |
| `piattaforma-quiz/strumenti/`, `strumenti_claude/` | strumenti per preparare, anonimizzare e controllare i casi |
| `piattaforma-quiz/qualita/` | controlli di qualità e sicurezza (ESLint, copertura, Checkov, osv-scanner, semgrep) |

## Provarlo sul proprio computer

Servono Node.js 20 o più recente e, per le immagini, i casi scaricati dalle collezioni pubbliche indicate in ciascun `caso.json`.

```bash
cd piattaforma-quiz/cloud/test
npm install
PORTA=8080 CASI=../../casi-free node simulatore.mjs     # poi http://localhost:8080/?prova
bash esegui.sh                                          # tutti i test
```

La pubblicazione su AWS si fa con `piattaforma-quiz/cloud/pubblica.command`. Le chiavi e i codici stanno in un file `.segreti` che non è nel repository.

## Privacy

Le immagini dei casi sono anonime e provengono da archivi pubblici (The Cancer Imaging Archive e altri, con le licenze indicate nel sito alla pagina *Licenze e crediti*). Il visualizzatore scaricabile apre gli esami **solo sul computer di chi lo usa**: le immagini non vengono mai inviate in rete.

## Licenze

- **Codice:** European Union Public Licence v. 1.2 (`LICENSE`).
- **Contenuti didattici** (domande, risposte, discussioni, percorsi, guide): Creative Commons BY-SA 4.0 (`LICENSE-contenuti.txt`).
- **Librerie e modelli di terzi:** con le loro licenze (`piattaforma-quiz/cloud/web/lib/`, `modelli-ia/`).

I dettagli sono in `LICENZE.md`. Il repository segue lo standard [REUSE](https://reuse.software): la licenza e l'autore di ogni file sono in `REUSE.toml`, i testi completi nella cartella `LICENSES/` (controllo: `reuse lint`).

## Modelli di intelligenza artificiale

I file dei modelli non sono nel repository perché troppo grandi; si scaricano quando si usa la funzione che li richiede e girano nel browser, sul computer di chi li usa:
- **noduli polmonari:** MONAI `lung_nodule_ct_detection` (Apache-2.0, addestrato su LUNA16) convertito in ONNX con `strumenti_claude/noduli_onnx/`, eseguito con onnxruntime-web (MIT); su https://radio-quiz.it/modelli-ia/noduli-v2/, con le licenze accanto;
- **referto con l'IA nel browser:** Qwen3-4B (Apache-2.0) nella versione quantizzata di MLC, scaricato da WebLLM (Apache-2.0).

© 2026 Ing. Salvatore Paolo Buemi · info@radio-quiz.it

Questo repository è una copia pubblica, aggiornata a ogni nuova versione, dello sviluppo che avviene altrove.
