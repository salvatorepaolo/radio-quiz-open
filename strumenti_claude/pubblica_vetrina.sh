#!/bin/bash
# pubblica_vetrina.sh: pubblica radio-quiz.it in background; log /tmp/pub.log, fine in /tmp/pub.fine
# Dopo la pubblicazione controlla il sito vero (controllo_live.mjs) e, se qualcosa non va, manda un'email a info@radio-quiz.it.
rm -f /tmp/pub.fine
export PATH=/opt/homebrew/bin:$PATH
cd /Volumes/Caloggero/piattaforma-quiz/cloud || exit 1
caffeinate -dimsu bash pubblica.command > /tmp/pub.log 2>&1
ESITO=$?
if [ $ESITO -eq 0 ]; then
  sleep 20   # la distribuzione CloudFront ha appena invalidato la cache
  if node /Volumes/Caloggero/strumenti_claude/controllo_live.mjs >> /tmp/pub.log 2>&1; then echo "controllo del sito: tutto a posto" >> /tmp/pub.log
  else
    node -e 'const t=require("fs").readFileSync("/tmp/controllo_live.txt","utf8");process.stdout.write(JSON.stringify({Simple:{Subject:{Data:"radio-quiz.it: problemi dopo la pubblicazione"},Body:{Text:{Data:t}}}}))' > /tmp/controllo_live_mail.json
    aws sesv2 send-email --region eu-south-1 --from-email-address avvisi@radio-quiz.it --destination ToAddresses=info@radio-quiz.it --content file:///tmp/controllo_live_mail.json >> /tmp/pub.log 2>&1 \
      && echo "controllo del sito: PROBLEMI, email inviata" >> /tmp/pub.log
  fi
else
  printf '{"Simple":{"Subject":{"Data":"radio-quiz.it: pubblicazione non riuscita"},"Body":{"Text":{"Data":"La pubblicazione si è fermata (codice %s). Ultime righe del log:\\n%s"}}}}' "$ESITO" "$(tail -15 /tmp/pub.log | sed 's/\x1b\[[0-9;]*m//g' | tr -d '"\\' | tr '\n' '|' | sed 's/|/\\n/g')" > /tmp/pub_mail.json
  aws sesv2 send-email --region eu-south-1 --from-email-address avvisi@radio-quiz.it --destination ToAddresses=info@radio-quiz.it --content file:///tmp/pub_mail.json >> /tmp/pub.log 2>&1
fi
echo "FINE $ESITO" > /tmp/pub.fine
