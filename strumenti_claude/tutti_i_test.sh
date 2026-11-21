#!/bin/bash
# tutti i test locali (simulatore): unità e API, browser, giro di tutte le pagine, inglese, file grandi, GPU
# 1.247: in parallelo. I test node --test girano in fila, intanto gli script leggeri girano a GIRI per volta
# (PARALLELI=2 di base), ognuno con la sua porta (PORTA_PROVA): niente scontri tra simulatori.
# Gli script pesanti (file grandi, GPU, IA, 3D) girano da soli alla fine, perché si rallentano a vicenda.
# Il riepilogo resta in /tmp/tutti.log, una riga per test (l'ordine può cambiare); i dettagli in /tmp/t_<nome>.log.
export PATH=/opt/homebrew/bin:$PATH
# se la suite viene fermata, si fermano anche gli script lanciati in parallelo (altrimenti continuano da soli)
trap 'trap - TERM INT; pkill -P $$; kill 0' TERM INT
OUT=/tmp/tutti.log; : > $OUT
P=${PARALLELI:-2}
INIZIO=$(date +%s)
CLOUD=/Volumes/Caloggero/piattaforma-quiz/cloud/test
QUI=/Volumes/Caloggero/strumenti_claude
PESANTI="prova_altri_browser prova_vetrini prova_vetrino_sito prova_casi_vetrini prova_vetrino_esempio prova_vetrini_strumenti prova_vetrini_chiave prova_vetrini_chiave_sito prova_volumi_noduli prova_traccia prova_scala_nodulo prova_parere_ui prova_rete prova_video prova_parti_scoperte prova_misure_1263 prova_memoria prova_aggiornamento_client prova_lighthouse prova_cmr_1115 prova_grande prova_gpu prova_noduli_1111 prova_noduli_client_1111 prova_omp_1114 prova_3d_1114 prova_casi_142_147"
LEGGERI="prova_schermate prova_menu_utente prova_cls_telefono prova_cruscotto prova_dock prova_proposte controllo_generale prova_en prova_ente prova_confronto_scale prova_schemi prova_v206 prova_v207 prova_v208 prova_v209 prova_v210 prova_v211 prova_v212 prova_v213 prova_v214 prova_v215 prova_v216 prova_v217 prova_v218 prova_v219 prova_v220 prova_v222 prova_v223 prova_v224 prova_v225 prova_v226 prova_v227 prova_v228 prova_v229 prova_v230 prova_v231 prova_v232 prova_v233 prova_v234 prova_v235 prova_v236 prova_v237 prova_v238 prova_v239 prova_v240 prova_v241 prova_v242 prova_v243 prova_v244 prova_v245 prova_v246 prova_1110 prova_en_client prova_confronto_1111 prova_neuro_1111 prova_layout_1111 prova_novizio_1114 prova_divisione_1115 prova_accessibilita"

# uno script: limite di 10 minuti (un test bloccato non ferma la suite), riga di riepilogo in $OUT
uno() {
  local s=$1 porta=$2
  cd "$QUI" || return 1; PORTA_PROVA=$porta perl -e 'alarm 600; exec @ARGV' node $s.mjs > /tmp/t_$s.log 2>&1; local st=$?
  local r; r=$(tail -4 /tmp/t_$s.log | tr '\n' ' ' | cut -c1-600); [ $st -eq 142 ] && r="BLOCCATO oltre 10 minuti · $r"
  echo "$s: $r" >> $OUT
}
export -f uno; export OUT QUI

( cd "$CLOUD" || exit 1
  for t in pagina scale anonimizza anonimizza-fuzz anonimizza-py strumenti-py moduli analisi referto logica logica-avvisi proprieta date formati casi traduzioni api api-iscrizione api-proposte api-fuzz date azienda limiti automazione account_admin cmr t2star browser; do
    perl -e 'alarm 900; exec @ARGV' node --test $t.test.mjs > /tmp/t_$t.log 2>&1
    r=$(grep -E "^ℹ (pass|fail)" /tmp/t_$t.log | tr '\n' ' '); echo "$t: $r" >> $OUT
  done ) &

# porte 21000, 21010, 21020…: una diversa per ogni script
i=0; for s in $LEGGERI; do echo "$s $((21000 + i * 10))"; i=$((i + 1)); done \
  | xargs -P "$P" -L 1 bash -c 'uno "$0" "$1"' &
# in attesa con «wait» (non in primo piano): così un TERM ferma subito la suite e gli script figli
wait
for s in $PESANTI; do uno $s $((22000 + i * 10)); i=$((i + 1)); done
echo "FINE in $(( ($(date +%s) - INIZIO) / 60 )) minuti" >> $OUT
