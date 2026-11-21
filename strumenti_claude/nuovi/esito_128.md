# caso-tcia-128 — bozza 06/11/2026 (Claude)

- **Collezione**: HCC-TACE-Seg (TCIA; scaricata da IDC `hcc_tace_seg`), paziente **HCC_062**, studio basale pre-TACE.
- **Licenza / DOI**: CC BY 4.0 — https://doi.org/10.7937/TCIA.5FNA-0924
- **Serie usate** (2,5 mm, DICOM originali, anonimizzate con anonimizza.py): 0 basale (79 img), 1 fase arteriosa tardiva (111), 2 fase portale (111). SEG escluse.
- **Diagnosi**: epatocarcinoma tipico LI-RADS **LR-5** del **segmento 8** (cupola, settore anteriore destro), circa 7,5-8 cm (SEG esperti 6,7 × 7,9 × 6 cm, ~141 ml).
- **Verifica**: tabella clinica TCIA V2 (F 71, HCV, cirrosi, Child A, istologia moderatamente-scarsamente differenziato, nodulo singolo 7,3 cm, nessuna invasione vascolare/PVT, AFP 38.531, TNM I, BCLC B); SEG esperti 'Mass'; HU mediane massa/fegato: basale 44/64, arteriosa 115/89, portale 117/152 → APHE + wash-out; capsula visibile in portale (img 21-26). Vena porta pervia.
- **Scheda `scale`**: lirads {sede ['S8'], rischio si, pre algo, d 78, aphe si, wo si, caps si, cresc no} → LR-5.
- **Vista**: serie 1, img 23, wc 80 / ww 300, segno sulla massa.
- **Dubbi**: segmento 8 (accettare 8/7 per le dimensioni); morfologia epatica senza segni evidenti di cirrosi (cirrosi solo clinica); manca la fase tardiva; BCLC B nonostante nodulo singolo.
- **Scartato**: HCC_050 (wash-out non dimostrabile → sarebbe LR-4); spostato in `_lavoro128/scarti/`.
- **Percorsi adatti**: `addome`, `oncologia`.
- **Controlli**: verifica_casi.mjs e controlla.py senza errori (solo l'avviso atteso «DA CONTROLLARE»).

## Testo per licenze.html (collezione nuova)
HCC-TACE-Seg — Moawad A. W., Fuentes D., Morshid A., Khalaf A. M., Elmohr M. M., Abusaif A., Hazle J. D., Kaseb A. O., Hassan M., Mahvash A., Szklaruk J., Qayyom A., Elsayes K. (2021). Multimodality annotated HCC cases with and without advanced imaging segmentation [Data set]. The Cancer Imaging Archive. https://doi.org/10.7937/TCIA.5FNA-0924 — Licenza CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Immagini anonimizzate e ricompresse senza perdita; casi caso-tcia-128, caso-tcia-129.
