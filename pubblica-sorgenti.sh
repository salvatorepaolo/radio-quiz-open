#!/bin/bash
# pubblica-sorgenti.sh: aggiorna la copia PUBBLICA del codice (github.com/salvatorepaolo/radio-quiz-open) con lo stato
# attuale del repository privato, in un solo commit per versione e SENZA la storia (che contiene dati non pubblicabili).
# Prima di inviare controlla: nessun segreto (gitleaks), nessuna email personale (quella di INOLTRO_POSTA in .segreti),
# nessun file DICOM. Esclusi i registri dei controlli quotidiani. Uso: bash pubblica-sorgenti.sh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
set -euo pipefail
RADICE="$(cd "$(dirname "$0")" && pwd)"; cd "$RADICE"
PUB="${RADICE}/_sorgenti-pubbliche"; REMOTO="https://github.com/salvatorepaolo/radio-quiz-open.git"
[ -z "$(git status --porcelain --untracked-files=no)" ] || echo "· modifiche non salvate: non vanno nella copia pubblica (si pubblica l'ultimo commit)"
VER="$(cat piattaforma-quiz/cloud/.versione 2>/dev/null || echo '?')"; COMMIT="$(git rev-parse --short HEAD)"
[ -d "$PUB/.git" ] || git clone -q "$REMOTO" "$PUB" 2>/dev/null || { mkdir -p "$PUB"; git -C "$PUB" init -q -b main; git -C "$PUB" remote add origin "$REMOTO"; }
# stato attuale, senza storia: tutto quello che git conosce tranne i registri dei controlli
find "$PUB" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git archive HEAD | tar -x -C "$PUB"
rm -rf "$PUB/strumenti_claude/controlli"
# controlli prima di pubblicare
MIA="$(bash -c 'source piattaforma-quiz/cloud/.segreti >/dev/null 2>&1; echo "${INOLTRO_POSTA:-}"')"
if [ -n "$MIA" ] && grep -rIl --exclude-dir=.git -F "$MIA" "$PUB" >/dev/null; then echo "✖ l'email personale compare in:"; grep -rIl --exclude-dir=.git -F "$MIA" "$PUB"; exit 1; fi
DICOM=$(find "$PUB" -type f ! -path '*/.git/*' -size +132c -exec sh -c 'for f; do if [ "$(dd if="$f" bs=1 skip=128 count=4 2>/dev/null)" = DICM ]; then echo "$f"; fi; done' _ {} +) || true
[ -z "$DICOM" ] || { echo "✖ file DICOM: $DICOM"; exit 1; }
gitleaks dir --no-banner --redact -c .gitleaks.toml "$PUB" >/dev/null 2>&1 || { echo "✖ gitleaks: possibile segreto (gitleaks dir -c .gitleaks.toml $PUB -v)"; exit 1; }
echo "✓ nessun segreto, nessuna email personale, nessun DICOM"
cd "$PUB"; git add -A
if git diff --cached --quiet; then echo "· niente di nuovo da salvare"
else git -c user.name="Salvatore Paolo Buemi" -c user.email="info@radio-quiz.it" commit -q -m "radio-quiz 1.${VER} (dal commit ${COMMIT})"; fi
git push -q -u origin main && echo "✓ copia pubblica aggiornata: versione ${VER}"
