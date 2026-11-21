#!/bin/bash
# scarica il testo attuale (online) di tutti i casi della vetrina, per la traduzione
cd /Volumes/Caloggero/piattaforma-quiz/cloud || exit 1
CODICE=$(sed -n 's/^CODICE_AMMINISTRATORE="\(.*\)"/\1/p' .segreti); BASE=https://radio-quiz.it; CK=/tmp/ck_i18n
curl -s -c "$CK" -o /dev/null -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"${CODICE}\"}" "$BASE/api/accesso"
OUT=/Volumes/Caloggero/piattaforma-quiz/i18n/casi-it; mkdir -p $OUT
curl -s -b "$CK" "$BASE/api/casi" > /tmp/elenco_casi.json
for id in $(/opt/homebrew/bin/node -e 'const j=JSON.parse(require("fs").readFileSync("/tmp/elenco_casi.json"));const l=Array.isArray(j)?j:(j.casi||[]);console.log(l.map(c=>c.id).join(" "))'); do
  curl -s -b "$CK" "$BASE/api/casi/$id/completo" > "$OUT/$id.json"
done
rm -f "$CK"; ls $OUT | wc -l
