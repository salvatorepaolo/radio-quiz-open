# Nuovi casi gratuiti per radio-quiz.it (6 novembre 2026)

Crei casi clinici didattici da archivi pubblici. Ogni caso nasce in BOZZA («DA CONTROLLARE») e sarà poi rivisto da un revisore indipendente.

## Regole (obbligatorie)
- Solo esami **DICOM originali** come escono da un PACS (serie native), da collezioni con licenza **CC BY** (o CC0). Niente NIfTI, PNG, secondary capture, dati «Restricted» o CC BY-NC.
- Il reperto che decide la risposta deve **vedersi davvero** sulle immagini. Usa i dati della collezione (clinica, istologia, stadio, segmentazioni SEG/RTSTRUCT) per verificare sede e diagnosi; non inventare reperti; formule prudenti dove non sei certo.
- Immagini anonime: si passa SEMPRE da anonimizza.py. Niente nomi/date/strutture nei testi. Età e sesso solo se noti dai dati.
- MAI scrivere «confermato dal docente». Il caso resta `visibile: false` e la nota_docente comincia con «DA CONTROLLARE (bozza 06/11/2026, creato da Claude): …» con i dubbi elencati.
- Usa SOLO i numeri di caso che ti sono assegnati. Non toccare altri casi, non pubblicare, non modificare file in cloud/web.

## Strumenti
Shell del Mac: strumento `mcp__remote-devices__MacOS-MCP__Shell` (caricalo con ToolSearch "select:mcp__remote-devices__MacOS-MCP__Shell"; premetti `export PATH=/opt/homebrew/bin:$PATH`; ogni chiamata dura al massimo ~55 s: i lavori lunghi lanciali con nohup … & e controlla dopo). Il Mac ha internet (IDC, GDC, TCIA).
Shell del VM: `mcp__remote-devices__device_bash` (cartelle del Mac in ~/mnt/Volumes--Caloggero; niente internet; per python: `pip3 install --user --break-system-packages -q pydicom pylibjpeg pylibjpeg-libjpeg numpy pillow scipy`).
Per GUARDARE un PNG: `mcp__remote-devices__device_stage_files` con il percorso del Mac (/Volumes/Caloggero/…), poi Read sullo stagedPath.

1. **Scelta e scaricamento (IDC, stessi DICOM di TCIA, veloce)** — sul Mac:
   `/Volumes/Caloggero/strumenti_claude/venv_idc/bin/python` con `from idc_index import IDCClient; c = IDCClient()`;
   `c.sql_query("select PatientID, StudyInstanceUID, SeriesInstanceUID, Modality, SeriesDescription, series_size_MB, instanceCount, license_short_name from index where collection_id='cptac_stad'")`;
   `c.download_from_selection(seriesInstanceUID=[...], downloadDir='/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/<collezione>/<paziente>', dirTemplate='%SeriesInstanceUID')`.
   Dati clinici CPTAC/TCGA: API GDC, es. `curl -s 'https://api.gdc.cancer.gov/cases?filters={"op":"in","content":{"field":"submitter_id","value":["C3L-xxxx"]}}&expand=diagnoses,demographic&format=json'` (codifica l'URL). Altre collezioni: tabelle cliniche nella pagina TCIA della collezione (scaricale con curl sul Mac in /Volumes/Caloggero/piattaforma-quiz/clinici/).
2. **Anonimizzazione** — sul Mac, una cartella con dentro SOLO le serie da usare (sposta fuori SEG/RTSTRUCT, localizzatori, serie inutili):
   `cd /Volumes/Caloggero/piattaforma-quiz && ~/.radioquiz-ia/venv/bin/python anonimizza.py "<cartella>" caso-tcia-NNN`
   (crea casi-free/caso-tcia-NNN/serie/ e serie.json). Serie con strati molto sottili (> 400 immagini): tieni 1 strato ogni 2-3 prima di anonimizzare (copia dei file scelti in una cartella di lavoro). Rinomina le descrizioni delle serie in serie.json in italiano chiaro (es. «TC addome, fase portale, 5 mm»).
3. **Guardare le immagini** — nel VM: `python3 ~/mnt/Volumes--Caloggero/strumenti_claude/vm/rev_pannelli.py NNN` (panoramiche in /Volumes/Caloggero/_viste/rev/NNN/) e `vm/vk.py` per i dettagli (uso nelle prime righe del file). Misure con PixelSpacing; densità con RescaleSlope/Intercept. Trova il reperto principale e l'immagine migliore per la «vista» (serie, idx, wc, ww, segno con a/b in pixel dell'immagine, nota).
4. **Scrivere il caso** — modello di struttura: guarda 2-3 caso.json esistenti di buona qualità, es. `casi-free/caso-tcia-028/caso.json`, `caso-tcia-003`, `caso-tcia-063` (campi: titolo [senza diagnosi], titolo_interno [con diagnosi], distretto, quesito, modalita, difficolta, anamnesi, domanda, sezioni [nome, domanda, singola?], opzioni [testo, corretta, tipo principale/secondario/distrattore, sezione, nota], spiegazione, regola, esito_clinico {tipo, testo}, fonte {archivio, collezione, soggetto, doi, licenza, licenza_url, citazione, url}, serie_iniziale, riquadri, vista, nota_docente).
   Regole delle domande: ogni sezione ha almeno una risposta corretta e almeno un distrattore plausibile; un solo reperto «principale» in tutto il caso; conclusione che riprende il principale; 3-4 sezioni (es. Tecnica, Reperti, Stadiazione/Estensione, Conclusione); spiegazione didattica con le trappole; regola in una frase.
   Scrivi caso.json con python (json.dump ensure_ascii=False, indent=1) in casi-free/caso-tcia-NNN/caso.json, `visibile: false`, `id` = caso-tcia-NNN.
5. **Controllo** — sul Mac: `cd /Volumes/Caloggero/piattaforma-quiz/cloud && /opt/homebrew/bin/node test/verifica_casi.mjs ../casi-free 2>&1 | grep -A3 caso-tcia-NNN` (se lo script ha un uso diverso leggi le prime righe) e `~/.radioquiz-ia/venv/bin/python ../strumenti/controlla.py ../casi-free 2>&1 | grep NNN`. Nessun ERRORE.
6. **Riepilogo** in `/Volumes/Caloggero/strumenti_claude/nuovi/esito_NNN.md`: collezione, paziente, licenza e DOI, serie usate, diagnosi e come l'hai verificata, dubbi, percorsi didattici adatti (id da cloud/web/percorsi.json), testo per licenze.html se la collezione è nuova. Rispondi con lo stesso riepilogo, breve, in italiano.
