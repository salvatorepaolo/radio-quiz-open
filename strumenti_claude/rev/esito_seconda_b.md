# Seconda revisione, gruppo b (06/11/2026): casi 070, 077, 086

Backup in `piattaforma-quiz/_backup_rev_20261106/caso-tcia-{070,077,086}.json` (non c'erano prima). Modificato solo `casi-free/caso-tcia-NNN/caso.json` (non `i18n/casi-it`, non `cloud/web`). Campo `aggiornato` aggiornato e file `AGGIORNA` creato, come fa rev_salva.py. Niente pubblicato, niente cancellato. Pannelli di lavoro in `_viste/rev2b/`.

| Caso | Esito | Prove |
|---|---|---|
| 070 | **(a) risolto: artefatto** | Cine 3 camere (serie indice 2, 17001), 20 fasi. Zona chiara sul lato destro della radice aortica (pixel circa 70,105): il massimo **non è fisso**. Circa 400-485 in diastole (fasi 0, 18, 19) e 900-1020 in sistole (fasi 2-8, insieme al getto), con strie scure all'interno. Per confronto: sangue nelle camere circa 170-225, grasso sottocutaneo vicino alla bobina circa 410-515. Un tessuto non raddoppia il segnale nel ciclo né supera ogni altro tessuto: è un artefatto di flusso della bSSFP. Nessun'altra serie passa per quel punto (la più vicina è a 37 mm). |
| 077 | **(c) non risolvibile** | TC arteriosa da 5 mm, immagini 24-43, più ricostruzioni sagittali e coronali. Alle immagini 33-38 c'è **un solo** tessuto ovale di circa 30-35 mm a destra dell'aorta, a circa 45-50 HU, senza piano adiposo che separi un linfonodo dalla cava. Verso il basso continua nella cava infrarenale (circa 18-23 mm alle immagini 41-43, stessa densità). Non si può dire se sia un linfonodo, la cava o entrambi. N1 resta un dato istologico. |
| 086 | **(b) testo corretto** | ROI su T1 FS pre, fase 1, fase 2 e tardiva alle immagini 22-23 (massa centrata circa a x186, y194). Centro (r 6 px): pre circa 230, post meno pre da -30 a +20 in tutte le fasi, cioè **nessuna impregnazione misurabile** (le sottrazioni della scanner, scala circa ×3, sono coerenti). Anello periferico: +35-60 in fase 1, +70-100 in tardiva. Corticale: +200-245. Fegato: +7 in fase 1 (fase arteriosa precoce). All'immagine 21 (polo, volume parziale) +35/+60/+48. |

## Frasi cambiate

**070**
- Nota dell'opzione 0, aggiunta: «La zona molto chiara sul lato destro della radice aortica non è un reperto: è un artefatto di flusso della bSSFP (intensità che cresce in sistole insieme al getto e cala in diastole, più alta di qualsiasi tessuto dell'immagine).»
- Nota docente: tolta la riga «Da controllare dal docente: la zona chiara fissa …», aggiunta in testa la riga «[seconda revisione 06/11/2026] Esito (a) …».

**077** (il dubbio resta nella nota docente)
- Titolo interno, prima: «… pT3 N1 M1: linfonodo interaortocavale e metastasi polmonari». Dopo: «… pT3 N1 M1: metastasi polmonari; linfonodo non separabile dalla cava in fase arteriosa».
- Opzione 5 (resta corretta e secondaria), prima: «Tessuto solido verosimilmente linfonodale (linfonodo ingrandito) interaortocavale/retrocavale di circa 2-3 cm». Dopo: «Tessuto ovale di circa 3 cm a destra dell'aorta (immagini 33-37) non separabile dalla vena cava inferiore non opacizzata: possibile linfonodo interaortocavale, da chiarire in fase venosa». Nota riscritta: densità simile, nessun piano adiposo, N1 istologico, serve la fase venosa.
- Opzione 8 (conclusione), prima: «… con linfonodo interaortocavale e metastasi polmonari multiple: stadio IV; …». Dopo: «… con metastasi polmonari multiple: stadio IV (tessuto interaortocavale da chiarire in fase venosa); …».

**086**
- Opzione 1, prima: «Impregnazione scarsa in fase 1, molto inferiore alla corticale, con al più un lieve e lento aumento nelle fasi successive (da giudicare sulle sottrazioni, perché la massa è in parte spontaneamente iperintensa in T1)». Dopo: «Impregnazione scarsa, molto inferiore alla corticale: assente nella parte centrale (spontaneamente iperintensa in T1), lieve e lentamente crescente alla periferia (da giudicare sulle sottrazioni)». Nella nota sono stati aggiunti i valori delle ROI.
- Opzione 6 (conclusione), prima: «… con impregnazione lieve e lenta: …». Dopo: «… con impregnazione lieve, lenta e solo periferica: …».
- Nota docente: tolta la riga «Da controllare dal docente: entità reale dell'impregnazione …», aggiunta in testa la riga dell'esito (b).

## Note
- 086: il reperto principale dice ancora «massa solida». La parte che si impregna è solo periferica; l'istologia (papillare) lo sostiene. Non l'ho cambiato.
- Il file `i18n/casi-it/caso-tcia-NNN.json` non è stato toccato: viene aggiornato con la pubblicazione, che resta al docente.
- In `_viste/rev2b/` restano file temporanei `_t6.png` … `_t11.png`, perché la VM non può cancellare.
