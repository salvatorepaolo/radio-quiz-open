#!/bin/bash
# crea-istanze.command — crea o aggiorna le piattaforme dei clienti registrate in radio-quiz.it
# (Gestione → Clienti e piattaforme). Per ognuna in coda: scrive istanze/<id>/istanza.conf, pubblica lo stack AWS
# separato (pubblica.command), alla prima creazione invita il referente come amministratore e segna lo stato online.
# Le piattaforme «da smontare» NON vengono cancellate in automatico: lo script mostra il comando da dare a mano.
cd "$(dirname "$0")" || exit 1
fine(){ printf "\n"; read -r -p "Premi invio per chiudere. " _; exit "${1:-0}"; }
[ -f .segreti ] && [ -f .uscite.json ] || { printf "Manca la pubblicazione della vetrina (.segreti, .uscite.json).\n"; fine 1; }
CODICE=$(sed -n 's/^CODICE_AMMINISTRATORE="\(.*\)"/\1/p' .segreti)
BASE=$(python3 -c 'import json;d=json.load(open(".uscite.json"));print(next(iter(d.values())).get("IndirizzoDominio",""))')
[ -n "${CODICE}" ] && [ -n "${BASE}" ] || { printf "Non leggo il codice dell'amministratore o l'indirizzo della vetrina.\n"; fine 1; }
VERSIONE=$(python3 -c 'import json;print(json.load(open("web/versione.json"))["versione"])' 2>/dev/null)
CK=$(mktemp); trap 'rm -f "${CK}" "${CK}.t"' EXIT
curl -s -c "${CK}" -o /dev/null -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"${CODICE}\"}" "${BASE}/api/accesso"
ELENCO=$(curl -s -b "${CK}" "${BASE}/api/tenant")
printf '%s' "${ELENCO}" | python3 -c 'import json,sys; json.load(sys.stdin)["elenco"]' 2>/dev/null || { printf "La vetrina non risponde come previsto: %s\n" "${ELENCO:0:200}"; fine 1; }
stato(){ curl -s -b "${CK}" -o /dev/null -X POST -H 'Content-Type: application/json' -d "$2" "${BASE}/api/tenant/$1/stato"; }
# una riga per piattaforma in coda: id, stato, poi i campi di istanza.conf in JSON
CODA=$(printf '%s' "${ELENCO}" | python3 -c '
import json,sys
for t in json.load(sys.stdin)["elenco"]:
    if t.get("stato") in ("da_creare","da_aggiornare","da_smontare") or (t.get("stato")=="sospesa" and not t.get("sospesaApplicata")): print(t["id"]+"\t"+t["stato"]+"\t"+json.dumps(t))')
[ -n "${CODA}" ] || { printf "\nNessuna piattaforma in coda.\n"; fine 0; }
printf "\nPiattaforme in coda:\n%s\n\n" "$(printf '%s\n' "${CODA}" | cut -f1,2 | sed 's/^/  · /')"
read -r -p "Procedo? [s/N] " R; [ "${R}" = "s" ] || [ "${R}" = "S" ] || fine 0
while IFS=$'\t' read -r ID ST JS; do
  case "${ID}" in *[!a-z0-9-]*|-*|"") printf "Identificativo non valido: %s\n" "${ID}"; continue ;; esac
  if [ "${ST}" = "da_smontare" ]; then
    printf "\n— %s: da smontare. Per sicurezza non lo faccio in automatico. Quando sei sicuro (i dati del cliente vanno persi):\n" "${ID}"
    printf "    aws cloudformation delete-stack --stack-name QuizIstanza-%s --region eu-south-1\n  poi segna «smontata» dalla pagina o rilancia questo script.\n" "${ID}"
    continue
  fi
  printf "\n=== %s (%s) ===\n" "${ID}" "${ST}"
  mkdir -p "istanze/${ID}"
  # segreti condivisi con la creazione automatica dal pannello (Parameter Store): se qui mancano, si prendono da lì
  PARAM="/radio-quiz/tenant/${ID}/segreti"
  if [ ! -s "istanze/${ID}/.segreti" ]; then
    aws ssm get-parameter --region eu-south-1 --name "${PARAM}" --with-decryption --query Parameter.Value --output text > "istanze/${ID}/.segreti" 2>/dev/null || : > "istanze/${ID}/.segreti"
    chmod 600 "istanze/${ID}/.segreti"
  fi
  printf '%s' "${JS}" | python3 -c '
import json,sys
t=json.load(sys.stdin); q=lambda v: str(v or "").replace("\\","").replace("\"","").replace("$","").replace("`","")
print("# generato da crea-istanze.command (dati da Gestione → Clienti e piattaforme): le modifiche vanno fatte nella pagina")
print("NOME_ISTANZA=\"%s\"" % q(t.get("nomeIstanza") or t.get("cliente")))
print("DOMINIO=\"%s\"" % q(t["dominio"])); print("ZONA=\"%s\"" % q(t["zona"]))
print("CONTATTO=\"%s\"" % q(t.get("contatto") or t.get("referenteEmail")))
print("EMAIL_CONDIVISA=\"1\"")
print("UTENTI_MAX=\"%s\"" % (int(t.get("utentiMax") or 0) or ""))
print("SCADENZA=\"%s\"" % q(t.get("scadenza")))
print("SOSPESA=\"%s\"" % ("1" if t.get("stato")=="sospesa" else "0"))' > "istanze/${ID}/istanza.conf"
  if ISTANZA="${ID}" bash pubblica.command < /dev/null > "istanze/${ID}/.log-pubblicazione.txt" 2>&1; then
    [ -s "istanze/${ID}/.segreti" ] && aws ssm put-parameter --region eu-south-1 --name "${PARAM}" --type SecureString --overwrite --value "file://istanze/${ID}/.segreti" > /dev/null 2>&1
    INV=""
    if [ "${ST}" = "da_creare" ]; then
      CI=$(sed -n 's/^CODICE_AMMINISTRATORE="\(.*\)"/\1/p' "istanze/${ID}/.segreti")
      DOM=$(printf '%s' "${JS}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["dominio"])')
      CORPO=$(printf '%s' "${JS}" | python3 -c 'import json,sys;t=json.load(sys.stdin);print(json.dumps({"nome":t.get("referenteNome") or t["referenteEmail"].split("@")[0],"email":t["referenteEmail"],"ruolo":"admin","invita":True}))')
      curl -s -c "${CK}.t" -o /dev/null -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"${CI}\"}" "https://${DOM}/api/accesso"
      R=$(curl -s -b "${CK}.t" -X POST -H 'Content-Type: application/json' -d "${CORPO}" "https://${DOM}/api/account")
      printf '%s' "${R}" | grep -q '"account"' && INV=',"invitato":true' && printf "  invito inviato al referente\n" || printf "  invito non riuscito: %s\n" "${R:0:200}"
    fi
    NUOVO="attiva"; [ "${ST}" = "sospesa" ] && NUOVO="sospesa"
    stato "${ID}" "{\"stato\":\"${NUOVO}\",\"versione\":\"${VERSIONE}\"${INV}}"
    printf "  ✓ pubblicata (dettagli in istanze/%s/.log-pubblicazione.txt)\n" "${ID}"
  else
    stato "${ID}" '{"stato":"errore","errore":"pubblicazione non riuscita: vedi istanze/'"${ID}"'/.log-pubblicazione.txt sul Mac"}'
    printf "  ✗ pubblicazione non riuscita: guarda istanze/%s/.log-pubblicazione.txt\n" "${ID}"
  fi
done <<< "${CODA}"
fine 0
