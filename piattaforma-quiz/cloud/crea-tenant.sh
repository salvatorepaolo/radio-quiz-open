#!/bin/bash
# crea-tenant.sh — gira su AWS CodeBuild (progetto «CreaPiattaforme» della vetrina), avviato dal pannello
# Gestione → Clienti e piattaforme. Crea, aggiorna, sospende o smonta la piattaforma di UN cliente:
# stessi passi di crea-istanze.command sul Mac, ma senza il Mac.
#   variabili: TENANT_ID, AZIONE (crea|aggiorna|sospendi|smonta), TENANT_JSON (dati del pannello), ESITO_TOKEN,
#              INDIRIZZO_VETRINA, REGIONE
# I segreti della piattaforma (codice dell'amministratore, chiavi) stanno in AWS Systems Manager Parameter Store
# (/radio-quiz/tenant/<id>/segreti, cifrati): mai nei log. Il codice dell'amministratore non compare nell'output.
set -u
ID="${TENANT_ID:-}"; AZ="${AZIONE:-}"
[[ "${ID}" =~ ^[a-z0-9][a-z0-9-]{1,29}$ ]] || { echo "identificativo non valido"; exit 1; }
case "${AZ}" in crea|aggiorna|sospendi|smonta) ;; *) echo "azione non valida"; exit 1 ;; esac
export AWS_REGION="${REGIONE:-eu-south-1}" AWS_DEFAULT_REGION="${REGIONE:-eu-south-1}"
PARAM="/radio-quiz/tenant/${ID}/segreti"
LOG="/tmp/pubblicazione-${ID}.txt"; : > "${LOG}"
VERSIONE=$(python3 -c 'import json;print(json.load(open("web/versione.json"))["versione"])' 2>/dev/null || echo "")
esito(){   # $1 stato, $2 errore, $3 invitato (1/0)
  python3 - "$1" "${2:-}" "${3:-0}" "${VERSIONE}" "${LOG}" > /tmp/esito.json <<'PY'
import json,sys,re
st,err,inv,ver,log=sys.argv[1:6]
try: righe=open(log,encoding='utf-8',errors='replace').read().splitlines()
except Exception: righe=[]
righe=[re.sub(r'\x1b\[[0-9;]*m','',r) for r in righe if 'odice amministratore' not in r and 'CODICE_AMMINISTRATORE' not in r]
print(json.dumps({"token":__import__('os').environ.get('ESITO_TOKEN',''),"stato":st,"errore":err,"invitato":inv=='1',"versione":ver,"log":"\n".join(righe[-40:])[-6000:]}))
PY
  curl -s -m 30 -X POST -H 'Content-Type: application/json' --data @/tmp/esito.json "${INDIRIZZO_VETRINA}/api/tenant/${ID}/esito" | head -c 300; echo
}
trap 'esito errore "lavoro interrotto (vedi il registro di CodeBuild)"' ERR

if [ "${AZ}" = "smonta" ]; then
  echo "smonto QuizIstanza-${ID} (i bucket con i dati restano, per sicurezza)"
  if aws cloudformation delete-stack --stack-name "QuizIstanza-${ID}" >> "${LOG}" 2>&1 \
     && aws cloudformation wait stack-delete-complete --stack-name "QuizIstanza-${ID}" >> "${LOG}" 2>&1; then
    trap - ERR; esito smontata "" 0; exit 0
  fi
  trap - ERR; esito errore "smontaggio non riuscito" 0; exit 1
fi

mkdir -p "istanze/${ID}"
# segreti già esistenti (aggiornamento): dal Parameter Store
aws ssm get-parameter --name "${PARAM}" --with-decryption --query Parameter.Value --output text > "istanze/${ID}/.segreti" 2>/dev/null || : > "istanze/${ID}/.segreti"
chmod 600 "istanze/${ID}/.segreti"
# istanza.conf dai dati del pannello (stesse regole di crea-istanze.command)
SOSP=0; [ "${AZ}" = "sospendi" ] && SOSP=1
printf '%s' "${TENANT_JSON}" | SOSP="${SOSP}" python3 -c '
import json,sys,os
t=json.load(sys.stdin); q=lambda v: str(v or "").replace("\\","").replace("\"","").replace("$","").replace("`","")
print("# generato da crea-tenant.sh (dati da Gestione → Clienti e piattaforme)")
print("NOME_ISTANZA=\"%s\"" % q(t.get("nomeIstanza") or t.get("cliente")))
print("DOMINIO=\"%s\"" % q(t["dominio"])); print("ZONA=\"%s\"" % q(t["zona"]))
print("CONTATTO=\"%s\"" % q(t.get("contatto") or t.get("referenteEmail")))
print("EMAIL_CONDIVISA=\"1\"")
print("UTENTI_MAX=\"%s\"" % (int(t.get("utentiMax") or 0) or ""))
print("SCADENZA=\"%s\"" % q(t.get("scadenza")))
print("SOSPESA=\"%s\"" % os.environ["SOSP"])' > "istanze/${ID}/istanza.conf"

echo "pubblico QuizIstanza-${ID} (${AZ}): il dettaglio va nel registro dell'esito, senza codici"
# test già passati con la pubblicazione della vetrina (stesso codice); CloudFormation crea le risorse con il ruolo del bootstrap
if CREAZIONE_CLOUD=1 SALTA_TEST=1 ISTANZA="${ID}" TERM=dumb bash pubblica.command < /dev/null > "${LOG}" 2>&1; then OK=1; else OK=0; fi
grep -vE 'odice amministratore|CODICE_AMMINISTRATORE' "${LOG}" | tail -n 60
# i segreti (nuovi o invariati) tornano nel Parameter Store
if [ -s "istanze/${ID}/.segreti" ]; then
  aws ssm put-parameter --name "${PARAM}" --type SecureString --overwrite --value "file://istanze/${ID}/.segreti" > /dev/null \
    || echo "ATTENZIONE: segreti non salvati nel Parameter Store"
fi
trap - ERR
if [ "${OK}" != "1" ]; then esito errore "pubblicazione non riuscita (registro qui sotto)" 0; exit 1; fi
INV=0
if [ "${AZ}" = "crea" ]; then
  CI=$(sed -n 's/^CODICE_AMMINISTRATORE="\(.*\)"/\1/p' "istanze/${ID}/.segreti")
  DOM=$(printf '%s' "${TENANT_JSON}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["dominio"])')
  CORPO=$(printf '%s' "${TENANT_JSON}" | python3 -c 'import json,sys;t=json.load(sys.stdin);print(json.dumps({"nome":t.get("referenteNome") or t["referenteEmail"].split("@")[0],"email":t["referenteEmail"],"ruolo":"admin","invita":True}))')
  CK=$(mktemp)
  for _ in 1 2 3 4 5 6; do
    C=$(curl -s -c "${CK}" -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"${CI}\"}" "https://${DOM}/api/accesso")
    [ "${C}" = "200" ] && break; sleep 30
  done
  R=$(curl -s -b "${CK}" -X POST -H 'Content-Type: application/json' -d "${CORPO}" "https://${DOM}/api/account")
  printf '%s' "${R}" | grep -q '"account"' && INV=1 && echo "invito inviato al referente" || echo "invito non riuscito: ${R:0:200}"
  rm -f "${CK}"
fi
ST=attiva; [ "${AZ}" = "sospendi" ] && ST=sospesa
esito "${ST}" "" "${INV}"
