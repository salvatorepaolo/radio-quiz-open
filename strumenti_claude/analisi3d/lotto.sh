#!/bin/bash
cd /Volumes/Caloggero/strumenti_claude/analisi3d || exit 1
for c in 034:0002_SIMULATO 001:0003_Recon_2_CHEST 025:0003_CHEST_1_25_MM; do n=${c%%:*}; s=${c#*:}
  venv/bin/python analizza_tc.py /Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-$n/serie/$s out/$n --modo torace --device mps > out/$n.log 2>&1
  venv/bin/python render3d.py out/$n/modello3d.glb out/$n/render3d.png >> out/$n.log 2>&1; done
venv/bin/python analizza_tc.py /Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-118/serie/0001_AngioTC_aorta out/118 --modo vasi --device mps > out/118.log 2>&1
venv/bin/python render3d.py out/118/modello3d.glb out/118/render3d.png >> out/118.log 2>&1
touch out/lotto.fine
