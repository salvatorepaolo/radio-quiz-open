# Controlli di qualità del codice (solo sul Mac, gratuiti, open source)

Installazione una volta: `brew install gitleaks shellcheck` e `cd piattaforma-quiz/qualita && npm install`.

| Controllo | Comando | Che cosa trova |
|---|---|---|
| Hook prima di ogni commit | automatico (`git config core.hooksPath .githooks`) | segreti, file DICOM, errori ESLint, shellcheck, test veloci |
| Test su GitHub | automatici a ogni push (`.github/workflows/test.yml`) | segreti nei commit nuovi, DICOM, ESLint, shellcheck, tutti i test node e Python; non i test nel browser, che servono le immagini dei casi |
| ESLint | `bash piattaforma-quiz/qualita/lint.sh` | nomi non definiti, chiavi doppie, codice irraggiungibile; avvisi per il codice inutilizzato |
| Copertura dei test | `bash piattaforma-quiz/qualita/copertura.sh` | righe mai eseguite dai test; pagina in `qualita/copertura/index.html` |
| Segreti in tutta la storia | `gitleaks git -c .gitleaks.toml .` (dalla radice) | chiavi, token, password nei commit passati |
| Script | `shellcheck -s bash -S warning <file>` | virgolette, `cd` senza controllo, variabili inutili |
| Copertura nel browser | `bash piattaforma-quiz/qualita/copertura-browser.sh` (`--veloce`: solo browser.test) | quali righe di app.js e dei moduli eseguono i test nel browser; il simulatore serve il codice «strumentato» (COPERTURA_SITO); pagine del client escluse, per non toccare il loro test di privacy |
| Confronto delle schermate | `node strumenti_claude/prova_schermate.mjs` (anche dentro la pubblicazione) (`--aggiorna` dopo un cambiamento voluto) | rotture grafiche in 11 pagine; riferimenti e differenze in strumenti_claude/schermate (non in git) |
| Test dei test | `bash piattaforma-quiz/qualita/mutazioni.sh` (15-30 minuti) | StrykerJS: errori introdotti apposta in anonimizzazione e correzione; quelli che nessun test nota indicano controlli mancanti; rapporto in qualita/mutazioni/ |
| Licenze di ogni file (REUSE) | `piattaforma-quiz/qualita/.venv-reuse/bin/reuse lint` (dalla radice; anche prima di ogni copia pubblica) | ogni file ha licenza e autore dichiarati in `REUSE.toml`, testi in `LICENSES/` |
| Sicurezza del codice | `bash piattaforma-quiz/qualita/sicurezza.sh` (anche dentro la pubblicazione: la ferma solo per problemi gravi) | osv-scanner: vulnerabilità note nelle librerie (package-lock e librerie copiate in `librerie-incluse.json`); semgrep: XSS, eval e simili nel codice. Rapporto in cloud/.log-sicurezza.txt |
| Configurazione AWS | `bash piattaforma-quiz/qualita/infrastruttura.sh piattaforma-quiz/cloud/cdk.out/QuizRadiologia.template.json` (anche dentro la pubblicazione, prima del deploy) | Checkov: permessi IAM, bucket pubblici, cifratura, CloudFront. Eccezioni volute con il motivo in `checkov-accettati.json`; un problema nuovo ferma la pubblicazione. Dopo il deploy si verifica anche che l'API chiamata senza CloudFront risponda 403 |
| Sicurezza del sito vero | `bash piattaforma-quiz/cloud/test/controlla-sito.sh https://radio-quiz.it` (anche dentro la pubblicazione) | intestazioni di sicurezza, file non pubblici (.git, backup, mappe del codice, test) |

Licenze: ESLint MIT, c8 ISC, gitleaks MIT, shellcheck GPL-3 (usato solo come programma, non distribuito), StrykerJS Apache-2.0, istanbul BSD-3-Clause, pixelmatch ISC, pngjs MIT, osv-scanner Apache-2.0, Checkov Apache-2.0, semgrep LGPL-2.1 (programma; regole pubbliche del registro Semgrep, uso interno gratuito).
In emergenza un commit si fa senza controlli con `git commit --no-verify`.

## Altri controlli (Mac, `strumenti_claude/`)
- `prova_rete.mjs`: rete assente, interrotta o lenta durante l'invio della risposta e l'accesso (`BROWSER=webkit|firefox` per gli altri motori).
- `prova_memoria.mjs [n]`: memoria della pagina su n esami TC/RM grandi aperti di seguito (Chromium).
- `prova_lighthouse.mjs [--nuovi-limiti]`: tempi di caricamento da telefono con 4G lenta; riferimenti in `lighthouse-limiti.json`.
- `prova_aggiornamento_client.mjs`: aggiornamento del visualizzatore client installato, con e senza rete.
- `prova_zap.mjs`: scansione OWASP ZAP sul simulatore (circa 25 minuti). Prerequisiti: ZAP 2.17 in `~/.radioquiz-zap/ZAP_2.17.0` (versione multipiattaforma da GitHub) e `brew install openjdk@21`. Gli avvisi accettati sono spiegati nel file.
- `controlla_aws.sh`: configurazione AWS in sola lettura (archivi, backup, due fattori, chiavi, CloudFront, Lambda).

Le prime quattro girano nella suite completa (`tutti_i_test.sh`); ZAP e AWS a parte.

## Su GitHub
- `sito.yml` (ogni giorno): sito, protezioni, certificato, dominio, record della posta (SPF, DKIM, DMARC).
- `link.yml` (ogni lunedì): link esterni dei casi e delle pagine (`cloud/test/controlla-link.mjs`).
- `dependabot.yml`: avvisi sulle librerie vulnerabili, aggiornamenti raccolti una volta al mese.
