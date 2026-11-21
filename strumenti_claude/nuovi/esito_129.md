# caso-tcia-129 — bozza 06/11/2026 (Claude)

- **Collezione**: HCC-TACE-Seg (IDC `hcc_tace_seg`), paziente **HCC_075**, studio basale pre-TACE.
- **Licenza / DOI**: CC BY 4.0 — https://doi.org/10.7937/TCIA.5FNA-0924 (testo per licenze.html in esito_128.md)
- **Serie usate** (2,5 mm): 0 basale (97 img), 1 fase arteriosa tardiva (107), 2 fase portale (109). SEG escluse.
- **Diagnosi**: epatocarcinoma scarsamente differenziato **gigante (~19 cm) del lobo destro (S5-S8) in fegato NON cirrotico** → LI-RADS **non applicabile**, serve la biopsia. Contrasto didattico con il 128 (LR-5 in cirrosi).
- **Verifica**: tabella clinica (F 67, nessun virus, cirrosi 0, Child A, PS 1, poorly differentiated, coinvolgimento > 50%, invasione vascolare/PVT 1, linfonodi 1, metastasi 1, AFP 38,5, TNM IVB, BCLC C, DEB-TACE); SEG esperti: 15 × 18,5 × 18,5 cm (~2,4 l, Feret 188 mm); HU mediane massa basale 36, arteriosa 48, portale 51 (fegato 50/87/115): ampia necrosi centrale, tessuto periferico e setti eterogenei.
- **Schede `scale`**: lirads {sede S5-S8, rischio no} → «non applicabile»; segmenti {S5-S8, d 188, n 1, nat nd}.
- **Vista**: serie 1, img 38, wc 60 / ww 350.
- **Dubbi**: la **trombosi portale** della tabella NON l'ho dimostrata con certezza sulle immagini (ramo destro inglobato, tronco opacizzato) → non è tra le risposte; cava retroepatica non riconoscibile (compressione probabile); linfonodi e metastasi non verificati; S4 escluso dalla sede, da confermare.
- **Candidati con PVT scartati** (trombo non chiaramente visibile): HCC_061, 064, 053, 054, 035, 009; HCC_002/003 hanno arteriosa e portale nella stessa serie.
- **Percorsi adatti**: `addome`, `oncologia`, `normale` (trappola: LI-RADS fuori dalla popolazione a rischio).
- **Controlli**: verifica_casi.mjs e controlla.py senza errori (solo l'avviso «DA CONTROLLARE»).
