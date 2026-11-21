# Revisione indipendente dei CASI NUOVI (bozze del 06/11/2026)

Segui /Volumes/Caloggero/strumenti_claude/rev/ISTRUZIONI.md (stesse regole e strumenti) con queste differenze:
- La base non è online: copia la bozza locale `~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/caso-tcia-NNN/caso.json` nel file di lavoro.
- Leggi anche il riepilogo di chi ha creato il caso: `~/mnt/Volumes--Caloggero/strumenti_claude/nuovi/esito_NNN.md` (dubbi già noti) e verifica i dati della collezione citati (segmentazioni, istologia, stadio).
- Controlla anche: anonimato (nessun testo identificativo nei pixel, guarda le immagini intere), che le serie siano adatte (niente localizzatori o serie inutili), struttura delle domande (ogni sezione con almeno una corretta e un distrattore, un solo «principale»), vista iniziale sul reperto.
- Esito:
  - se il caso è corretto (dopo le tue correzioni) e non resta un dubbio importante: imposta `"visibile": true` e nella nota_docente sostituisci la riga iniziale «DA CONTROLLARE (bozza …» con «Bozza creata da Claude il 06/11/2026 (testi letti sulle immagini e sui dati della collezione).» mantenendo l'elenco dei dubbi minori come note;
  - se resta un dubbio importante: lascia `"visibile": false` e la riga «DA CONTROLLARE …», e scrivi il dubbio nell'esito di rev_salva.py con «Da controllare dal docente: …».
- Salva con rev_salva.py come per gli altri casi; riepilogo in `~/mnt/Volumes--Caloggero/strumenti_claude/rev/esito_nuovi_GRUPPO.md`.
