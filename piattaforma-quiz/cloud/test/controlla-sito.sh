#!/bin/bash
# Controlli di sicurezza sul sito pubblicato (solo lettura, nessun account): intestazioni HTTP e file che non devono
# essere raggiungibili. Lo lancia pubblica.command dopo ogni pubblicazione; si può lanciare anche a mano:
#   bash cloud/test/controlla-sito.sh https://radio-quiz.it
# Esce con 1 se un controllo fallisce.
BASE="${1:-https://radio-quiz.it}"; BASE="${BASE%/}"
OK=0
bene() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
male() { printf '  \033[31m✖ %s\033[0m\n' "$1"; OK=1; }

INT=$(curl -sI --max-time 20 "${BASE}/" | tr -d '\r')
intest() { printf '%s\n' "$INT" | grep -i "^$1:" | head -1 | cut -d' ' -f2-; }
CSP=$(intest content-security-policy)
SCRIPT_SRC=$(printf '%s' "$CSP" | tr ';' '\n' | grep -i 'script-src' | head -1)
[ -n "$CSP" ] && bene "CSP presente" || male "CSP assente"
case "$SCRIPT_SRC" in
  *unsafe-inline*) male "CSP: script-src ammette script in linea" ;;
  *http:*|*\**) male "CSP: script-src ammette script da altri siti ($SCRIPT_SRC)" ;;
  "") male "CSP senza script-src" ;;
  *) bene "CSP: niente script in linea né di altri siti" ;;
esac
case "$(intest default-src; printf '%s' "$CSP" | tr ';' '\n' | grep -i 'default-src')" in *"'self'"*) bene "CSP: default-src 'self'" ;; *) male "CSP: default-src non limitato" ;; esac
HSTS=$(intest strict-transport-security); ETA=$(printf '%s' "$HSTS" | grep -o 'max-age=[0-9]*' | cut -d= -f2)
[ "${ETA:-0}" -ge 15552000 ] && bene "HSTS (max-age ${ETA})" || male "HSTS assente o troppo breve: ${HSTS:-nessuno}"
[ "$(intest x-frame-options | tr a-z A-Z)" = "DENY" ] && bene "X-Frame-Options DENY" || male "X-Frame-Options non DENY"
[ "$(intest x-content-type-options | tr A-Z a-z)" = "nosniff" ] && bene "X-Content-Type-Options nosniff" || male "nosniff assente"
[ -n "$(intest referrer-policy)" ] && bene "Referrer-Policy: $(intest referrer-policy)" || male "Referrer-Policy assente"
PP=$(intest permissions-policy)
case "$PP" in *"camera=()"*"geolocation=()"*) bene "Permissions-Policy: fotocamera e posizione disattivate" ;; *) male "Permissions-Policy: ${PP:-assente}" ;; esac
[ -z "$(intest x-powered-by)" ] && bene "nessuna intestazione X-Powered-By" || male "X-Powered-By presente"
# http → https
REDIR=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "http://${BASE#https://}/")
case "$REDIR" in 30[178]\ https://*) bene "http rimanda a https" ;; *) male "http non rimanda a https ($REDIR)" ;; esac

# certificato HTTPS: giorni alla scadenza (CloudFront lo rinnova da solo; se mancano meno di 14 giorni qualcosa non va)
HOST=${BASE#https://}; HOST=${HOST%%/*}
if [ "${BASE#https://}" != "$BASE" ] && command -v openssl >/dev/null; then
  FINE=$(echo | openssl s_client -connect "${HOST}:443" -servername "$HOST" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$FINE" ]; then
    SEC=$(date -j -f "%b %e %H:%M:%S %Y %Z" "$FINE" +%s 2>/dev/null || date -d "$FINE" +%s 2>/dev/null)
    GIORNI=$(( (SEC - $(date +%s)) / 86400 ))
    [ "$GIORNI" -ge 14 ] && bene "certificato HTTPS valido ancora $GIORNI giorni" || male "certificato HTTPS in scadenza: $GIORNI giorni"
  else male "certificato HTTPS non leggibile"; fi
fi

# file che non devono essere raggiungibili (403 o 404)
chiuso() { local c; c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}$1"); case "$c" in 403|404) bene "chiuso: $1" ;; *) male "raggiungibile ($c): $1" ;; esac; }
for p in /.git/config /.git/HEAD /.gitignore /.githooks/pre-commit /.segreti /.env /backup_vista/ /test/esegui.sh /test/simulatore.mjs \
         /lib/mpr3d.js.bak_1114 /index.html.bak /app.js.map /style.css.map /scale.js.map /scale-dati.js.map /cmr-ui.js.map /api/../.segreti /casi/caso-tcia-001/caso.json /casi/caso-tcia-001/serie.json /casi/; do
  chiuso "$p"
done
# l'API senza accesso risponde 401 e non elenca i casi
c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}/api/casi"); [ "$c" = "401" ] && bene "API chiusa senza accesso" || male "API senza accesso: $c"
exit $OK
