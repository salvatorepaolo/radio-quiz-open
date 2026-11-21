#!/bin/bash
# segmentazione IA (TotalSegmentator, modelli a licenza libera: total + extra) di tutte le TC di casi-free senza ia/
# di notte, un caso alla volta; si ferma creando il file out/STOP o se la memoria finisce (guardia)
cd /Volumes/Caloggero/piattaforma-quiz || exit 1
export RQ_CASI=/Volumes/Caloggero/piattaforma-quiz/casi-free
PY=~/.radioquiz-ia/venv/bin/python; OUT=/Volumes/Caloggero/strumenti_claude/analisi3d/out; mkdir -p $OUT; rm -f $OUT/STOP $OUT/notte.fine
for c in "$@"; do
  [ -f $OUT/STOP ] && { echo "$(date '+%F %T') fermato a mano prima di $c" >> $OUT/notte.log; break; }
  [ -d "$RQ_CASI/$c/ia" ] && [ -n "$(ls $RQ_CASI/$c/ia/*.lab.gz 2>/dev/null)" ] && { echo "$(date '+%F %T') $c già fatto" >> $OUT/notte.log; continue; }
  t0=$(date +%s)
  $PY strumenti/segmenta_ia.py $c --device mps >> $OUT/notte_dettaglio.log 2>&1; e1=$?
  $PY strumenti/segmenta_ia.py $c --extra --device mps >> $OUT/notte_dettaglio.log 2>&1; e2=$?
  echo "$(date '+%F %T') $c base=$e1 extra=$e2 $(( ($(date +%s)-t0)/60 )) min" >> $OUT/notte.log
done
echo "$(date '+%F %T') FINE" >> $OUT/notte.log; touch $OUT/notte.fine
