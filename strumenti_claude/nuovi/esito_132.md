# Esito caso-tcia-132 (bozza 06/11/2026, Claude)

- **Area scoperta**: RM ginecologica, endometrio (finora solo cervice in TCGA-CESC e un caso simulato su CPTAC-UCEC).
- **Collezione**: CPTAC-UCEC, IDC `cptac_ucec`, licenza **CC BY 4.0**, DOI 10.7937/K9/TCIA.2018.3R3JUISW — già presente in licenze.html (la riga attuale parla solo del caso simulato 082: aggiungere che c'è anche un caso con immagini non modificate).
- **Paziente**: C3N-01876 (donna, 65 anni alla diagnosi).
- **Serie usate** (6, 168 immagini): T2 sagittale, T1 sagittale, T2 assiale, T2 coronale, mappa ADC, T1 FS sagittale dopo gadolinio. Escluse la diffusione TRACEW (4 valori b nella stessa serie) e le dinamiche. Anonimizzate con anonimizza.py (lavoro in `_lavoro132/staging`, cartella spostata in casi-free solo a caso completo).
- **Diagnosi e verifica**: GDC: adenocarcinoma endometrioide G2, pT1b N0 M0, FIGO I. Sede ed estensione verificate con le annotazioni del tumore della collezione (RTSTRUCT «Pre-Dose, UTERUS - 1», DOI 10.7937/89m3-kq43, CC BY 4.0): circa 8 × 6,6 × 4,5 cm. In RM: massa che distende la cavità, intermedia in T2, ipoimpregnante rispetto al miometrio, ADC circa 700 (×10⁻⁶ mm²/s presunto); miometrio residuo di 3-5 mm.
- **Vista**: serie 0 (T2 sagittale), idx 12, segno (110,162)-(186,162) = circa 5,9 cm.
- **Dubbi**: la profondità di invasione (≥50%) in RM è una stima su un miometrio stirato da una massa voluminosa, la risposta si appoggia al pT1b; canale cervicale poco distinguibile per la compressione; unità ADC dedotte; annessi e linfonodi lomboaortici non valutati.
- **Scartata**: C3N-02632 (T1b, massa più piccola ma miometrio altrettanto sottile, nessun vantaggio didattico).
- **Percorsi adatti**: `pelvi`, `oncologia`.
- **Controlli**: verifica_casi.mjs e controlla.py: 0 errori (solo l'avviso «DA CONTROLLARE»). visibile: false.
