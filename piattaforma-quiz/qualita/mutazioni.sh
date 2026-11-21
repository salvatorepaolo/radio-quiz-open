#!/bin/bash
# Test dei test (mutation testing) con StrykerJS: vedi stryker.config.mjs. Circa 15-30 minuti, sul Mac.
# Risultato: punteggio di mutazione (mutanti scoperti / totale) e rapporto in piattaforma-quiz/qualita/mutazioni/index.html
QUA="$(cd "$(dirname "$0")" && pwd)" || exit 1
export PATH="/opt/homebrew/bin:$PATH" FUZZ_GIRI="${FUZZ_GIRI:-300}"
cd "$QUA/../cloud" || exit 1
"$QUA/node_modules/.bin/stryker" run "$QUA/stryker.config.mjs"
