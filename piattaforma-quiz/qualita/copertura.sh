#!/bin/bash
# Copertura dei test con c8 (licenza ISC): quali righe di web/*.js e api/*.mjs vengono eseguite dai test node.
# Misura anche il simulatore avviato dai test dell'API, quindi la logica del server conta davvero.
# app.js si prova nel browser (browser.test e prova_*.mjs) e qui non è misurato.
# Uso: bash qualita/copertura.sh   → riepilogo a schermo e pagina HTML in qualita/copertura/index.html
QUA="$(cd "$(dirname "$0")" && pwd)" || exit 1
cd "$QUA/../cloud" || exit 1
export PATH="/opt/homebrew/bin:$PATH"
FILE=()
for t in pagina scale anonimizza anonimizza-fuzz anonimizza-py strumenti-py moduli analisi referto logica logica-avvisi proprieta date formati casi traduzioni api api-iscrizione api-proposte api-fuzz date azienda limiti automazione account_admin cmr t2star; do
  FILE+=("test/$t.test.mjs")
done
rm -rf "$QUA/.c8-tmp"
"$QUA/node_modules/.bin/c8" --temp-directory "$QUA/.c8-tmp" --report-dir "$QUA/copertura" \
  --include 'web/*.js' --include 'api/*.mjs' --exclude 'web/app.js' --exclude 'web/lib/**' \
  --reporter text-summary --reporter text --reporter html --reporter json \
  node --test "${FILE[@]}"
