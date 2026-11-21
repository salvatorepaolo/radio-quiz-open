#!/bin/bash
# ============================================================
#  Quiz Radiologia — registrazione del dominio su Route 53
#  Doppio clic. Controlla se il dominio è libero, mostra il prezzo,
#  chiede i dati del titolare e registra SOLO dopo una conferma
#  esplicita. I dati personali non vengono salvati su disco.
#  Scritto per bash 3.2 (macOS).
# ============================================================
set -o pipefail
cd "$(dirname "$0")" || exit 1
V="  "
titolo(){ printf "\n\033[1m%s\033[0m\n" "${1}"; }
ok(){     printf "${V}\033[32m✓\033[0m %s\n" "${1}"; }
info(){   printf "${V}· %s\n" "${1}"; }
errore(){ printf "\n\033[31m✗ %s\033[0m\n" "${1}"; }
fine(){ printf "\n"; read -r -p "Premi invio per chiudere. " _; exit "${1:-1}"; }
R53="--region us-east-1"      # l'API dei domini esiste solo in Virginia

clear
printf "\033[1m──────────────────────────────────────────────\n"
printf "  QUIZ RADIOLOGIA — registrazione del dominio\n"
printf "──────────────────────────────────────────────\033[0m\n"

command -v aws >/dev/null 2>&1 && command -v node >/dev/null 2>&1 || { errore "Servono aws e node (gli stessi dei Turni)."; fine 1; }
IDENT=$(aws sts get-caller-identity --output text --query Arn 2>&1) || { errore "AWS non risponde: ${IDENT}"; fine 1; }
ok "conto AWS: ${IDENT}"

# ---------- 1. disponibilità e prezzi ----------
titolo "1. Il dominio è libero?"
prezzo(){ aws route53domains list-prices --tld "${1}" ${R53} --query 'Prices[0].RegistrationPrice.Price' --output text 2>/dev/null; }
LIBERI=""
for D in radioquiz.it radioquiz.com radioquiz.eu; do
  S=$(aws route53domains check-domain-availability --domain-name "${D}" ${R53} --query Availability --output text 2>&1)
  P=$(prezzo "${D##*.}")
  case "${S}" in
    AVAILABLE) ok "${D} è libero — ${P} USD/anno"; LIBERI="${LIBERI} ${D}" ;;
    UNAVAILABLE|UNAVAILABLE_PREMIUM|RESERVED|DONT_KNOW|PENDING) info "${D}: non disponibile (${S})" ;;
    *) info "${D}: non riesco a verificarlo (${S})" ;;
  esac
done
[ -n "${LIBERI}" ] || { errore "Nessuno dei domini radioquiz è libero. Scegline un altro e dimmelo: aggiorno lo script."; fine 1; }

printf "\n"
read -r -p "${V}Quale registro? (invio = $(echo ${LIBERI} | cut -d' ' -f1)) " DOM
DOM="${DOM:-$(echo ${LIBERI} | cut -d' ' -f1)}"
case " ${LIBERI} " in *" ${DOM} "*) ;; *) errore "${DOM} non è fra quelli liberi."; fine 1 ;; esac
TLD="${DOM##*.}"
PREZZO=$(prezzo "${TLD}")

# ---------- 2. dati del titolare ----------
titolo "2. Dati del titolare (obbligatori per legge, compaiono nel registro)"
[ "${TLD}" = "it" ] && info ".it: serve un indirizzo nell'Unione Europea e il codice fiscale; il WHOIS non è oscurabile"
leggi(){ local v=""; while [ -z "${v}" ]; do read -r -p "${V}${1}: " v; done; printf '%s' "${v}"; }
NOME=$(leggi "Nome")
COGNOME=$(leggi "Cognome")
EMAIL=$(leggi "Email (riceverai la verifica)")
TEL=$(leggi "Telefono (es. 3331234567)")
VIA=$(leggi "Indirizzo (via e numero)")
CITTA=$(leggi "Città")
PROV=$(leggi "Provincia (sigla, es. ME)" | tr '[:lower:]' '[:upper:]')
CAP=$(leggi "CAP")
CF=""; TIPO=""
if [ "${TLD}" = "it" ]; then
  CF=$(leggi "Codice fiscale")
  printf "${V}Registri come: 1) persona fisica  2) libero professionista\n"
  read -r -p "${V}Scelta (invio = 1): " T
  [ "${T}" = "2" ] && TIPO="FREELANCE_WORKERS"
fi

CONTATTO=$(mktemp)
trap 'rm -f "${CONTATTO}"' EXIT
NOME="${NOME}" COGNOME="${COGNOME}" EMAIL="${EMAIL}" TEL="${TEL}" VIA="${VIA}" CITTA="${CITTA}" PROV="${PROV}" CAP="${CAP}" CF="${CF}" TIPO="${TIPO}" TLD="${TLD}" \
node -e '
const e = process.env;
const tel = e.TEL.replace(/[^\d+]/g, "").replace(/^\+?39/, "");
const c = { FirstName: e.NOME, LastName: e.COGNOME, ContactType: "PERSON", AddressLine1: e.VIA, City: e.CITTA,
  State: e.PROV.toUpperCase(), CountryCode: "IT", ZipCode: e.CAP, PhoneNumber: "+39." + tel, Email: e.EMAIL };
if (e.TLD === "it") {
  c.ExtraParams = [{ Name: "IT_PIN", Value: e.CF.toUpperCase().replace(/\s/g, "") }, { Name: "IT_NATIONALITY", Value: "IT" }];
  if (e.TIPO) c.ExtraParams.push({ Name: "IT_REGISTRANT_ENTITY_TYPE", Value: e.TIPO });
}
process.stdout.write(JSON.stringify(c));' > "${CONTATTO}" || { errore "Dati non validi."; fine 1; }

# ---------- 3. conferma ----------
titolo "3. Riepilogo"
printf "${V}Dominio:   \033[1m%s\033[0m per 1 anno, rinnovo automatico\n" "${DOM}"
printf "${V}Costo:     \033[1m%s USD\033[0m (addebitati sul conto AWS, più IVA)\n" "${PREZZO}"
printf "${V}Titolare:  %s %s, %s, %s %s (%s)\n" "${NOME}" "${COGNOME}" "${VIA}" "${CAP}" "${CITTA}" "${PROV}"
printf "${V}Email:     %s\n" "${EMAIL}"
printf "\n"
read -r -p "${V}Scrivi SI (maiuscolo) per acquistare: " CONF
[ "${CONF}" = "SI" ] || { info "Nessun acquisto fatto."; fine 0; }

# .it non permette di oscurare i dati nel WHOIS; .eu li oscura già di suo; .com sì
PRIV="--no-privacy-protect-admin-contact --no-privacy-protect-registrant-contact --no-privacy-protect-tech-contact"
[ "${TLD}" = "com" ] && PRIV="--privacy-protect-admin-contact --privacy-protect-registrant-contact --privacy-protect-tech-contact"
OP=$(aws route53domains register-domain ${R53} --domain-name "${DOM}" --duration-in-years 1 --auto-renew \
  --admin-contact "file://${CONTATTO}" --registrant-contact "file://${CONTATTO}" --tech-contact "file://${CONTATTO}" \
  ${PRIV} \
  --query OperationId --output text 2>&1) || { errore "La registrazione non è partita:"; printf "${V}%s\n" "${OP}"; fine 1; }
rm -f "${CONTATTO}"
ok "richiesta inviata (operazione ${OP})"

# ---------- 4. attesa ----------
titolo "4. Attesa della conferma del registro"
info "di solito pochi minuti, a volte qualche ora. Controllo ogni 30 secondi per 10 minuti."
for _ in $(seq 1 20); do
  ST=$(aws route53domains get-operation-detail --operation-id "${OP}" ${R53} --query Status --output text 2>/dev/null)
  case "${ST}" in
    SUCCESSFUL) printf "\n"; ok "${DOM} è registrato!"; break ;;
    ERROR|FAILED) printf "\n"; errore "Il registro ha rifiutato la richiesta:"
      aws route53domains get-operation-detail --operation-id "${OP}" ${R53} --query Message --output text; fine 1 ;;
    *) printf "." ; sleep 30 ;;
  esac
done
[ "${ST}" = "SUCCESSFUL" ] || { printf "\n"; info "non ancora concluso (${ST}): è normale. AWS ti scrive quando è fatto."; }

if grep -q '^DOMINIO_NUOVO=' .segreti 2>/dev/null; then
  sed -i '' -e "s|^DOMINIO_NUOVO=.*|DOMINIO_NUOVO=\"${DOM}\"|" .segreti 2>/dev/null || sed -i -e "s|^DOMINIO_NUOVO=.*|DOMINIO_NUOVO=\"${DOM}\"|" .segreti
else
  printf 'DOMINIO_NUOVO="%s"\n' "${DOM}" >> .segreti
fi

printf "\n\033[1m──────────────────────────────────────────────\033[0m\n"
printf "  Prossimi passi:\n"
printf "  1. Apri l'email di AWS e conferma l'indirizzo (obbligatorio,\n"
printf "     altrimenti il dominio viene sospeso dopo 15 giorni).\n"
printf "  2. Quando la registrazione è conclusa, doppio clic su\n"
printf "     pubblica.command: la piattaforma passa da sola a\n"
printf "     https://%s\n" "${DOM}"
fine 0
