#!/bin/bash
# Controllo automatico del sito online (launchd: 7:40 e 19:40). Se trova problemi riprova dopo 3 minuti (per non dare
# falsi allarmi per un disservizio di un attimo); se restano, manda un'email a info@radio-quiz.it e una notifica sul Mac.
# Registro: /Volumes/Caloggero/strumenti_claude/controlli/
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
DIR=/Volumes/Caloggero/strumenti_claude
[ -d "$DIR" ] || exit 0                      # disco esterno non collegato: niente controllo
mkdir -p "$DIR/controlli"
# durante una pubblicazione il sito cambia: si rimanda
if pgrep -f pubblica_vetrina.sh >/dev/null; then echo "$(date '+%F %T') rimandato: pubblicazione in corso" >> "$DIR/controlli/storico.log"; exit 0; fi
F="$DIR/controlli/$(date '+%Y-%m-%d_%H%M').txt"
esito=0
node "$DIR/controllo_quotidiano.mjs" > "$F" 2>&1 || { sleep 180; node "$DIR/controllo_quotidiano.mjs" > "$F" 2>&1 || esito=1; }
if [ $esito = 0 ]; then
  echo "$(date '+%F %T') tutto a posto" >> "$DIR/controlli/storico.log"
else
  echo "$(date '+%F %T') PROBLEMI (vedi $(basename "$F"))" >> "$DIR/controlli/storico.log"
  node -e 'const t=require("fs").readFileSync("/tmp/controllo_quotidiano.txt","utf8");process.stdout.write(JSON.stringify({Simple:{Subject:{Data:"radio-quiz.it: il controllo automatico ha trovato problemi"},Body:{Text:{Data:t}}}}))' > /tmp/controllo_quotidiano_mail.json
  aws sesv2 send-email --region eu-south-1 --from-email-address avvisi@radio-quiz.it --destination ToAddresses=info@radio-quiz.it --content file:///tmp/controllo_quotidiano_mail.json >> "$DIR/controlli/storico.log" 2>&1
  osascript -e 'display notification "Il controllo automatico del sito ha trovato problemi: vedi la cartella controlli" with title "radio-quiz.it"' 2>/dev/null
fi
# si tengono gli ultimi 60 resoconti
ls -1t "$DIR"/controlli/20*.txt 2>/dev/null | tail -n +61 | while read -r x; do mv "$x" "$DIR/controlli/vecchi/" 2>/dev/null || { mkdir -p "$DIR/controlli/vecchi"; mv "$x" "$DIR/controlli/vecchi/"; }; done
exit $esito
