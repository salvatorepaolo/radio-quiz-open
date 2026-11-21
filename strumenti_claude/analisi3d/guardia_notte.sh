#!/bin/bash
# ferma la segmentazione notturna se lo swap cresce di oltre 5 GB e la memoria libera scende sotto il 5%
OUT=/Volumes/Caloggero/strumenti_claude/analisi3d/out
b=$(sysctl -n vm.swapusage | awk '{print $6}' | tr -d M | cut -d. -f1)
while pgrep -f "ia_notte.sh" >/dev/null; do
  u=$(sysctl -n vm.swapusage | awk '{print $6}' | tr -d M | cut -d. -f1); f=$(memory_pressure | tail -1 | grep -o '[0-9]*')
  if [ "$u" -gt $((b+5000)) ] && [ "$f" -lt 5 ]; then touch $OUT/STOP; pkill -f segmenta_ia.py; echo "$(date '+%F %T') guardia: fermato (swap $u MB, libera $f%)" >> $OUT/notte.log; fi
  sleep 15
done
