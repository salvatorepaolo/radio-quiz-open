#!/bin/bash
# seconda lettura dei noduli (MONAI + TotalSegmentator) su tutti i casi con polmoni nella segmentazione IA
export RQ_CASI=/Volumes/Caloggero/piattaforma-quiz/casi-free PATH=/opt/homebrew/bin:$PATH
cd /Volumes/Caloggero/piattaforma-quiz || exit 1
PY=/Volumes/Caloggero/strumenti_claude/analisi3d/venv/bin/python
OUT=/Volumes/Caloggero/strumenti_claude/analisi3d/out/noduli.log; : > $OUT
CASI=$($PY - <<'P'
import json, glob, os
r = []
for f in sorted(glob.glob('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-*/ia/*.json')):
    try: g = json.load(open(f))
    except Exception: continue
    if sum(1 for n in (g.get('etichette') or {}).values() if str(n).startswith('lung_')) >= 3:
        r.append(f.split('/')[-3])
print(' '.join(sorted(set(r))))
P
)
echo "$(date '+%F %T') casi con polmoni: $CASI" >> $OUT
for c in $CASI; do
  t0=$(date +%s); $PY strumenti/noduli_ia.py $c >> $OUT.dettaglio 2>&1; st=$?
  echo "$(date '+%F %T') $c esito=$st $(( ($(date +%s)-t0)/60 )) min" >> $OUT
done
echo "$(date '+%F %T') FINE" >> $OUT; touch /Volumes/Caloggero/strumenti_claude/analisi3d/out/noduli.fine
