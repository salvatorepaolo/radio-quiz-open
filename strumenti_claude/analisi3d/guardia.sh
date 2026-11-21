#!/bin/bash
# ferma l'analisi se lo swap cresce di oltre 5 GB e la memoria libera scende sotto il 5%
b=$(sysctl -n vm.swapusage | awk '{print $6}' | tr -d M | cut -d. -f1)
while pgrep -f "lotto.sh|analizza_tc.py" >/dev/null; do
  u=$(sysctl -n vm.swapusage | awk '{print $6}' | tr -d M | cut -d. -f1)
  f=$(memory_pressure | tail -1 | grep -o '[0-9]*')
  if [ "$u" -gt $((b+5000)) ] && [ "$f" -lt 5 ]; then pkill -f analizza_tc.py; pkill -f lotto.sh; echo "$(date) fermato: swap $u MB (inizio $b), libera $f%" >> out/guardia.log; fi
  sleep 10
done
