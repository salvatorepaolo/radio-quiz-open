#!/bin/bash
# dopo la seconda lettura: le 4 serie interrotte (003, 004, 007), poi il confronto IA sui casi con due studi
export RQ_CASI=/Volumes/Caloggero/piattaforma-quiz/casi-free PATH=/opt/homebrew/bin:$PATH
cd /Volumes/Caloggero/piattaforma-quiz || exit 1
PY=/Volumes/Caloggero/strumenti_claude/analisi3d/venv/bin/python
OUT=/Volumes/Caloggero/strumenti_claude/analisi3d/out/dopo.log; : > $OUT
for c in caso-tcia-003 caso-tcia-004 caso-tcia-007; do echo "== $c $(date '+%T')" >> $OUT; $PY strumenti/noduli_ia.py $c >> $OUT 2>&1; done
echo "== confronti $(date '+%T')" >> $OUT
for d in $RQ_CASI/caso-*/; do c=$(basename $d)
  n=$(python3 -c "import json,sys;s=json.load(open('$d/serie.json'));s=s if isinstance(s,list) else s.get('serie',[]);print(sum(1 for x in s if 'Studio 2' in (x.get('descrizione') or '')))" 2>/dev/null)
  [ "${n:-0}" -ge 1 ] && $PY strumenti/confronto_ia.py $c >> $OUT 2>&1
done
echo "FINE $(date '+%T')" >> $OUT
