#!/bin/bash
cd /Volumes/Caloggero/piattaforma-quiz || exit 1
export RQ_CASI=/Volumes/Caloggero/piattaforma-quiz/casi-free
PY=~/.radioquiz-ia/venv/bin/python
for c in "$@"; do
  $PY strumenti/segmenta_ia.py $c --device mps
  $PY strumenti/segmenta_ia.py $c --extra --device mps
done
touch /Volumes/Caloggero/strumenti_claude/analisi3d/out/ia.fine
