#!/bin/bash
# Copertura di app.js e dei moduli del sito misurata nel browser. Il simulatore serve il codice «strumentato» (COPERTURA_SITO)
# e ogni pagina rimanda i contatori: si misurano così tutti i test nel browser senza modificarli.
# Solo sul Mac (i test nel browser usano le immagini dei casi).
#   bash piattaforma-quiz/qualita/copertura-browser.sh            tutta la suite (tutti_i_test.sh, circa 20-25 minuti)
#   bash piattaforma-quiz/qualita/copertura-browser.sh --veloce   solo browser.test.mjs (pochi minuti)
QUA="$(cd "$(dirname "$0")" && pwd)" || exit 1
export PATH="/opt/homebrew/bin:$PATH" COPERTURA_SITO="$QUA/.copertura-browser"
rm -rf "$COPERTURA_SITO"
if [ "${1:-}" = "--veloce" ]; then
  (cd "$QUA/../cloud/test" && node --test browser.test.mjs) | grep -E "^ℹ (pass|fail)"
else
  bash "$QUA/../../strumenti_claude/tutti_i_test.sh"; cat /tmp/tutti.log
fi
node "$QUA/copertura-browser.mjs"
