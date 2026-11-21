#!/bin/bash
# Pubblica (o aggiorna) la piattaforma di un'azienda: chiede il nome dell'istanza e lancia pubblica.command.
# Le istanze sono le cartelle in istanze/ (tranne «esempio»), ognuna con il suo istanza.conf.
cd "$(dirname "$0")" || exit 1
printf "\nIstanze delle aziende:\n"
for d in istanze/*/; do n=$(basename "${d}"); [ "${n}" = "esempio" ] && continue
  [ -f "${d}istanza.conf" ] && printf "  · %s — %s\n" "${n}" "$(sed -n 's/^NOME_ISTANZA="\(.*\)"/\1/p' "${d}istanza.conf")"; done
printf "\n"
read -r -p "Nome dell'istanza da pubblicare (es. polime): " N
[ -n "${N}" ] || exit 0
ISTANZA="${N}" exec bash pubblica.command
