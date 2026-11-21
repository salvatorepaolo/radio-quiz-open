#!/bin/bash
# ESLint su web/, api/, test/ e script .mjs di cloud. Uso: bash qualita/lint.sh [file...]
QUA="$(cd "$(dirname "$0")" && pwd)" || exit 1
cd "$QUA/../cloud" || exit 1
if [ $# -gt 0 ]; then set -- "$@"; else set -- web api test ./*.mjs; fi
exec "$QUA/node_modules/.bin/eslint" -c "$QUA/eslint.config.js" --no-warn-ignored "$@"
