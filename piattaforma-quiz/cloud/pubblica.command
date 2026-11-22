#!/bin/bash
# ============================================================
#  Quiz Radiologia — pubblicazione su AWS
#  Doppio clic su questo file. Stesso conto, stessa utenza e
#  stessa regione (Milano) dei Turni. Si può rilanciare quante
#  volte si vuole: aggiorna solo quello che è cambiato.
#  Scritto per bash 3.2, la versione di macOS.
# ============================================================
set -o pipefail
cd "$(dirname "$0")" || exit 1

REGIONE="${AWS_REGION:-eu-south-1}"
STACK="QuizRadiologia"
STATICO="web"
# casi caricati dal Mac: la vetrina (radio-quiz.it, free) usa solo i casi da archivi pubblici (TCIA) in ../casi-free;
# i casi del Polime (../casi) vanno solo nell'istanza «polime» (CASI_DAL_MAC in istanze/polime/istanza.conf)
CASI="../casi-free"
V="  "

# ---------- istanza: la vetrina (radio-quiz.it) o la piattaforma di un'azienda ----------
#   ISTANZA=<nome> bash pubblica.command   → pubblica l'azienda descritta in istanze/<nome>/istanza.conf
#   (stack «QuizIstanza-<nome>», segreti in istanze/<nome>/.segreti; si parte senza casi: li carica l'azienda dal sito)
SEGRETI=".segreti"; USCITE=".uscite.json"; MODO="vetrina"
if [ -n "${ISTANZA:-}" ]; then
  case "${ISTANZA}" in *[!a-z0-9-]*|-*) printf "Nome dell'istanza non valido: solo lettere minuscole, numeri e trattini.\n"; exit 1 ;; esac
  DIR_IST="istanze/${ISTANZA}"
  [ -f "${DIR_IST}/istanza.conf" ] || { printf "Manca %s/istanza.conf: copia istanze/esempio/istanza.conf e compilalo.\n" "${DIR_IST}"; exit 1; }
  bash -n "${DIR_IST}/istanza.conf" 2>/dev/null || { printf "%s/istanza.conf non si legge: ogni valore va fra virgolette.\n" "${DIR_IST}"; exit 1; }
  # shellcheck disable=SC1090
  source "${DIR_IST}/istanza.conf"
  [ -n "${NOME_ISTANZA:-}" ] && [ -n "${DOMINIO:-}" ] && [ -n "${ZONA:-}" ] || { printf "In istanza.conf servono NOME_ISTANZA, DOMINIO e ZONA.\n"; exit 1; }
  STACK="QuizIstanza-${ISTANZA}"; SEGRETI="${DIR_IST}/.segreti"; USCITE="${DIR_IST}/.uscite.json"; MODO="azienda"
  CONTATTO="${CONTATTO:-}"; EMAIL_CONDIVISA="${EMAIL_CONDIVISA:-0}"; INOLTRO_POSTA="${CONTATTO}"
  # un'istanza può ricevere i casi da una cartella del Mac (es. polime: ../casi); le altre li caricano dal sito
  CASI="${CASI_DAL_MAC:-}"
  UTENTI_MAX="${UTENTI_MAX:-}"; SCADENZA="${SCADENZA:-}"; SOSPESA="${SOSPESA:-0}"
  export NOME_ISTANZA CONTATTO EMAIL_CONDIVISA INOLTRO_POSTA UTENTI_MAX SCADENZA SOSPESA
fi
export STACK MODO

titolo(){ printf "\n\033[1m%s\033[0m\n" "${1}"; }
ok(){     printf "${V}\033[32m✓\033[0m %s\n" "${1}"; }
info(){   printf "${V}· %s\n" "${1}"; }
errore(){ printf "\n\033[31m✗ %s\033[0m\n" "${1}"; }
fine(){ printf "\n"; read -r -p "Premi invio per chiudere. " _; exit "${1:-1}"; }
uscita(){ node -e "try{const u=require('./${1}');const s=u['${2}']||{};console.log(s['${3}']||'')}catch(e){console.log('')}" 2>/dev/null; }

clear
printf "\033[1m──────────────────────────────────────────────\n"
printf "  QUIZ RADIOLOGIA — pubblicazione su AWS\n"
[ "${MODO}" = "azienda" ] && printf "  Istanza: %s (%s)\n" "${NOME_ISTANZA}" "${DOMINIO}"
printf "──────────────────────────────────────────────\033[0m\n"

# ---------- 1. strumenti ----------
titolo "1. Strumenti sul Mac"
for c in node npm aws; do
  command -v "${c}" >/dev/null 2>&1 || { errore "Manca il comando ${c} (sono gli stessi dei Turni: brew install node awscli)."; fine 1; }
done
ok "node $(node -v), aws $(aws --version 2>&1 | cut -d' ' -f1)"
[ -d "${STATICO}" ] || { errore "Non trovo la pagina in ${STATICO}."; fine 1; }
[ -z "${CASI}" ] || [ -d "${CASI}" ] || { errore "Non trovo la cartella dei casi in ${CASI}."; fine 1; }
[ -n "${CASI}" ] && ok "casi dalla cartella $(cd "${CASI}" && pwd | sed "s|^${HOME}|~|")"

# ---------- 2. credenziali ----------
titolo "2. Credenziali AWS"
IDENT=$(aws sts get-caller-identity --output text --query 'Arn' 2>&1) || { errore "AWS non risponde: ${IDENT}"; info "Sono le stesse credenziali dei Turni: prova prima che pubblica.command dei Turni funzioni."; fine 1; }
CONTO=$(aws sts get-caller-identity --output text --query 'Account')
export AWS_REGION="${REGIONE}" AWS_DEFAULT_REGION="${REGIONE}"
export CDK_DEFAULT_ACCOUNT="${CONTO}" CDK_DEFAULT_REGION="${REGIONE}"
ok "${IDENT}"
ok "conto ${CONTO}, regione ${REGIONE}"

# ---------- 3. codici e segreti ----------
titolo "3. Codice dell'amministratore"
genera_codice(){ node -e "const c='abcdefghijkmnopqrstuvwxyz23456789';const r=require('crypto').randomBytes(12);let s='';for(let i=0;i<12;i++){s+=c[r[i]%c.length];if(i%4===3&&i<11)s+='-'}console.log(s)"; }
genera_segreto(){ node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }
# Gli account (specializzandi e docenti) li crea l'amministratore dal sito,
# ognuno con il suo codice personale. Qui c'e' solo il codice dell'amministratore.
# Ogni voce mancante viene generata; quelle presenti non si toccano.
# Per cambiare il codice basta cancellarne la riga e rilanciare.
touch "${SEGRETI}" && chmod 600 "${SEGRETI}"
manca(){ ! grep -qE "^[[:space:]]*${1}=" "${SEGRETI}"; }
NUOVI=""
manca CODICE_AMMINISTRATORE && printf 'CODICE_AMMINISTRATORE="%s"\n' "$(genera_codice)" >> "${SEGRETI}" && NUOVI=" amministratore"
manca SEGRETO         && printf 'SEGRETO="%s"\n'         "$(genera_segreto)" >> "${SEGRETI}"
manca SEGRETO_ORIGINE && printf 'SEGRETO_ORIGINE="%s"\n' "$(genera_segreto)" >> "${SEGRETI}"
[ "${MODO}" = "azienda" ] || { manca DOMINIO && printf 'DOMINIO="quiz.turniradiologia.it"\nZONA="turniradiologia.it"\n' >> "${SEGRETI}"; }
if [ -n "${NUOVI}" ]; then ok "generato il codice dell'amministratore (in .segreti, leggibile solo da te)"
else ok "codice dell'amministratore già presente in .segreti"; fi
bash -n "${SEGRETI}" 2>/dev/null || { errore "Il file .segreti non si legge: ogni valore va fra virgolette."; fine 1; }
# shellcheck disable=SC1090,SC1091
source "${SEGRETI}"
for _v in CODICE_AMMINISTRATORE SEGRETO SEGRETO_ORIGINE; do
  [ -n "${!_v}" ] || { errore "In .segreti manca ${_v}."; fine 1; }
done
impronta(){ node --input-type=module -e "import('./api/logica.mjs').then(m=>console.log(m.impronta(process.argv[1])))" "${1}"; }
HASH_ADMIN=$(impronta "${CODICE_AMMINISTRATORE}")
[ -n "${HASH_ADMIN}" ] || { errore "Non riesco a calcolare l'impronta del codice."; fine 1; }
export HASH_ADMIN SEGRETO SEGRETO_ORIGINE DOMINIO ZONA
# limiti di spesa facoltativi, scritti a mano in .segreti (21 nov 2026): WEB_ACL (firewall del piano CloudFront a tariffa
# fissa), LIMITE_API, BUDGET_QUIZ_USD, EMAIL_BUDGET. Se mancano valgono i valori di bin/app.mjs.
export WEB_ACL LIMITE_API BUDGET_QUIZ_USD EMAIL_BUDGET
# casella del gestore (posta in arrivo inoltrata, avvisi del budget): in .segreti come INOLTRO_POSTA, mai nel codice
if [ "${MODO}" = "vetrina" ]; then
  [ -n "${INOLTRO_POSTA:-}" ] || { errore "In .segreti manca INOLTRO_POSTA (la casella a cui inoltrare privacy@ e gli avvisi del budget)."; fine 1; }
  export INOLTRO_POSTA
fi
# sponsor nella vetrina: spenti; SPONSOR="1" in .segreti per riaccenderli (21/11/2026)
export SPONSOR
# accesso con Google, solo nella vetrina (22/11/2026): GOOGLE_ID e GOOGLE_SEGRETO in .segreti (console di Google Cloud)
# accesso con LinkedIn, solo nella vetrina (22/11/2026): LINKEDIN_ID e LINKEDIN_SEGRETO in .segreti (portale sviluppatori LinkedIn)
if [ "${MODO}" = "vetrina" ]; then export GOOGLE_ID GOOGLE_SEGRETO LINKEDIN_ID LINKEDIN_SEGRETO; else unset GOOGLE_ID GOOGLE_SEGRETO LINKEDIN_ID LINKEDIN_SEGRETO; fi
ok "impronta calcolata: il codice in chiaro non finisce su AWS"

# ---------- 4. dipendenze ----------
titolo "4. Dipendenze"
if [ ! -d node_modules ]; then
  info "prima installazione: un minuto"
  npm install --silent || { errore "npm install non riuscito."; fine 1; }
fi
ok "librerie pronte"

prepara_regione(){   # $1 = regione
  if aws cloudformation describe-stacks --stack-name CDKToolkit --region "${1}" >/dev/null 2>&1; then
    ok "account già preparato su ${1}"
  else
    info "prima volta su ${1}: preparo l'account (qualche minuto)"
    npx --yes cdk bootstrap "aws://${CONTO}/${1}" > ".log-preparazione-${1}.txt" 2>&1 \
      || { errore "Preparazione dell'account su ${1} non riuscita:"; tail -n 12 ".log-preparazione-${1}.txt"; fine 1; }
    ok "account preparato su ${1}"
  fi
}

# ---------- 5. dominio e certificato HTTPS ----------
titolo "5. Dominio e certificato HTTPS"
zona_esiste(){ Z=$(aws route53 list-hosted-zones-by-name --dns-name "${1}" --query "HostedZones[?Name=='${1}.'].Id | [0]" --output text 2>/dev/null); [ -n "${Z}" ] && [ "${Z}" != "None" ]; }
# DOMINIO_NUOVO in .segreti: appena il dominio risulta registrato su Route 53 ci si sposta da soli
if [ -n "${DOMINIO_NUOVO:-}" ] && [ "${DOMINIO_NUOVO}" != "${DOMINIO}" ]; then
  # serve la registrazione conclusa, non solo la zona: senza i name server delegati
  # il certificato non si convalida e la pubblicazione resterebbe ferma
  if zona_esiste "${DOMINIO_NUOVO}" && aws route53domains get-domain-detail --domain-name "${DOMINIO_NUOVO}" --region us-east-1 >/dev/null 2>&1; then
    ok "${DOMINIO_NUOVO} è registrato: la piattaforma passa a https://${DOMINIO_NUOVO} (e www.${DOMINIO_NUOVO})"
    DOMINIO="${DOMINIO_NUOVO}"; ZONA="${DOMINIO_NUOVO}"; CERTIFICATO=""
    sed -i '' -e "s|^DOMINIO=.*|DOMINIO=\"${DOMINIO}\"|" -e "s|^ZONA=.*|ZONA=\"${ZONA}\"|" -e '/^CERTIFICATO=/d' -e '/^DOMINIO_NUOVO=/d' "${SEGRETI}" 2>/dev/null \
      || sed -i -e "s|^DOMINIO=.*|DOMINIO=\"${DOMINIO}\"|" -e "s|^ZONA=.*|ZONA=\"${ZONA}\"|" -e '/^CERTIFICATO=/d' -e '/^DOMINIO_NUOVO=/d' "${SEGRETI}"
    export DOMINIO ZONA
  else
    info "${DOMINIO_NUOVO}: registrazione non ancora conclusa su Route 53, per ora resto su ${DOMINIO}"
    info "(si registra dalla console AWS → Route 53 → Registered domains; poi basta rilanciare)"
  fi
fi
if [ -n "${DOMINIO}" ] && ! zona_esiste "${ZONA}"; then
  errore "La zona DNS ${ZONA} non esiste su questo conto AWS."; fine 1
fi
# il certificato salvato deve coprire proprio questo dominio
if [ -n "${CERTIFICATO}" ]; then
  D_CERT=$(aws acm describe-certificate --certificate-arn "${CERTIFICATO}" --region us-east-1 --query 'Certificate.DomainName' --output text 2>/dev/null)
  if [ "${D_CERT}" != "${DOMINIO}" ] && [ "${D_CERT}" != "*.${ZONA}" ]; then
    info "il certificato salvato è per ${D_CERT:-un altro dominio}: ne serve uno per ${DOMINIO}"
    CERTIFICATO=""; sed -i '' -e '/^CERTIFICATO=/d' "${SEGRETI}" 2>/dev/null || sed -i -e '/^CERTIFICATO=/d' "${SEGRETI}"
  fi
fi
STACK_CERT="QuizCert-$(printf '%s' "${DOMINIO}" | tr '.' '-')"
[ "${DOMINIO}" = "quiz.turniradiologia.it" ] && STACK_CERT="QuizRadiologiaCertificato"
export STACK_CERT
if [ -n "${DOMINIO}" ] && [ -z "${CERTIFICATO}" ]; then
  CERTIFICATO=$(aws acm list-certificates --region us-east-1 --certificate-statuses ISSUED \
    --query "CertificateSummaryList[?DomainName=='${DOMINIO}'].CertificateArn | [0]" --output text 2>/dev/null)
  [ "${CERTIFICATO}" = "None" ] && CERTIFICATO=""
  if [ -n "${CERTIFICATO}" ]; then
    ok "trovato un certificato già valido per ${DOMINIO}"
  else
    info "chiedo un certificato per ${DOMINIO} in Virginia (CloudFront accetta solo quelli)"
    info "la convalida avviene da sola con un record DNS in ${ZONA}: 2-10 minuti"
    prepara_regione us-east-1
    npx --yes cdk deploy "${STACK_CERT}" --require-approval never --progress events \
        --outputs-file .uscite-cert.json 2>&1 | tee .log-certificato.txt \
      || { errore "Il certificato non è stato emesso. Il dettaglio è in .log-certificato.txt"; fine 1; }
    CERTIFICATO=$(uscita .uscite-cert.json "${STACK_CERT}" ArnCertificato)
    [ -n "${CERTIFICATO}" ] || { errore "Non leggo l'ARN del certificato."; fine 1; }
    ok "certificato emesso"
  fi
  printf 'CERTIFICATO="%s"\n' "${CERTIFICATO}" >> "${SEGRETI}"
fi
export CERTIFICATO
[ -n "${DOMINIO}" ] && ok "indirizzo: https://${DOMINIO}"

# ---------- test di non regressione: prima di cambiare qualcosa online ----------
# Simulatore locale con i casi veri e un database vuoto (cloud/test): regole di sicurezza, correzione, percorsi,
# esami, pagine principali senza errori JavaScript, un caso risposto, MPR/3D, telefono. Se uno fallisce non si pubblica.
# In emergenza si saltano con: SALTA_TEST=1 open pubblica.command (sconsigliato).
titolo "Test di non regressione"
if [ "${SALTA_TEST:-}" = "1" ]; then info "test saltati (SALTA_TEST=1)"
elif [ -f test/esegui.sh ]; then
  # i test girano sempre come vetrina: le variabili dell'istanza (MODO=azienda…) non devono arrivare al simulatore
  if env -u CASI -u MODO -u STACK -u NOME_ISTANZA -u CONTATTO -u EMAIL_CONDIVISA -u INOLTRO_POSTA -u UTENTI_MAX -u SCADENZA -u SOSPESA bash test/esegui.sh > .log-test.txt 2>&1; then ok "test superati ($(grep -cE '^✔' .log-test.txt) controlli)"
  else
    grep -E '^✖|AssertionError|Error:' .log-test.txt | head -20
    errore "Un test non è passato: non pubblico. Il dettaglio è in cloud/.log-test.txt"; fine 1
  fi
fi

# confronto delle schermate (regressione grafica): 13 pagine fotografate e confrontate con il riferimento.
# Se una pagina cambia oltre la tolleranza non si pubblica. Cambiamento voluto: node strumenti_claude/prova_schermate.mjs --aggiorna
# Solo su questo Mac (i riferimenti contengono immagini dei casi e non sono in git). Emergenza: SALTA_SCHERMATE=1
SCHERMATE=/Volumes/Caloggero/strumenti_claude/prova_schermate.mjs
if [ "${SALTA_TEST:-}" = "1" ] || [ "${SALTA_SCHERMATE:-}" = "1" ]; then info "confronto delle schermate saltato"
elif [ -f "$SCHERMATE" ] && [ -d /Volumes/Caloggero/strumenti_claude/schermate/riferimento ]; then
  if env -u CASI -u MODO -u STACK -u NOME_ISTANZA -u CONTATTO -u EMAIL_CONDIVISA -u INOLTRO_POSTA -u UTENTI_MAX -u SCADENZA -u SOSPESA node "$SCHERMATE" > .log-schermate.txt 2>&1; then ok "schermate uguali al riferimento ($(grep -cE '^✓' .log-schermate.txt) pagine)"
  else
    grep -E '^✖|cambiate|errore JS' .log-schermate.txt | head -15
    errore "L'aspetto di una pagina è cambiato: non pubblico. Rosso = differenze in strumenti_claude/schermate/differenze. Se è voluto: node strumenti_claude/prova_schermate.mjs --aggiorna"; fine 1
  fi
else info "confronto delle schermate non disponibile su questo computer"
fi

# 1.302 giro completo del visualizzatore (scaricabile e piattaforma), come lo farebbe una persona: misura, immagine chiave,
# referto e PDF, esportazioni, MPR + 3D, solo immagini, chiusura. Se qualcosa non funziona non si pubblica. Emergenza: SALTA_GIRO=1
GIRO=/Volumes/Caloggero/strumenti_claude/prova_giro_completo.mjs
if [ "${SALTA_TEST:-}" = "1" ] || [ "${SALTA_GIRO:-}" = "1" ]; then info "giro completo del visualizzatore saltato"
elif [ -f "$GIRO" ]; then
  if env -u CASI -u MODO -u STACK -u NOME_ISTANZA -u CONTATTO -u EMAIL_CONDIVISA -u INOLTRO_POSTA -u UTENTI_MAX -u SCADENZA -u SOSPESA node "$GIRO" > .log-giro.txt 2>&1; then ok "giro completo del visualizzatore ($(grep -cE '^OK' .log-giro.txt) controlli)"
  else
    grep -E '^KO' .log-giro.txt | head -10
    errore "Il giro completo del visualizzatore non è passato: non pubblico. Il dettaglio è in cloud/.log-giro.txt"; fine 1
  fi
fi

# sicurezza del codice: vulnerabilità note nelle librerie (osv-scanner) ed errori di sicurezza nel codice (semgrep).
# Si ferma solo per problemi gravi; il rapporto completo è in cloud/.log-sicurezza.txt. Emergenza: SALTA_SICUREZZA=1
if [ "${SALTA_TEST:-}" = "1" ] || [ "${SALTA_SICUREZZA:-}" = "1" ]; then info "controlli di sicurezza del codice saltati"
elif [ -f ../qualita/sicurezza.sh ]; then
  if bash ../qualita/sicurezza.sh > /dev/null 2>&1; then ok "sicurezza del codice: $(grep -E '^(librerie|codice):' .log-sicurezza.txt | tr '\n' ' ')"
  else
    grep -E 'GRAVE' .log-sicurezza.txt | head -15
    errore "Problema di sicurezza grave: non pubblico. Il dettaglio è in cloud/.log-sicurezza.txt"; fine 1
  fi
fi

# ---------- 6. infrastruttura ----------
titolo "6. Infrastruttura (${REGIONE})"
prepara_regione "${REGIONE}"
STATO=$(aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGIONE}" --output text --query 'Stacks[0].StackStatus' 2>/dev/null)
case "${STATO}" in
  *_IN_PROGRESS) errore "Lo stack è occupato (${STATO}): aspetta qualche minuto e rilancia."; fine 1 ;;
  ROLLBACK_COMPLETE) errore "Una prima creazione non è riuscita. Cancella lo stack e rilancia:"
    info "aws cloudformation delete-stack --stack-name ${STACK} --region ${REGIONE}"; fine 1 ;;
esac
# configurazione AWS (Checkov): permessi IAM, bucket pubblici, cifratura. Le eccezioni volute sono in
# qualita/checkov-accettati.json con il motivo; un problema nuovo ferma la pubblicazione. Emergenza: SALTA_INFRASTRUTTURA=1
if [ "${SALTA_INFRASTRUTTURA:-}" != "1" ] && [ -f ../qualita/infrastruttura.sh ] && command -v checkov >/dev/null; then
  if npx --yes cdk synth "${STACK}" -q > .log-sintesi.txt 2>&1; then
    if bash ../qualita/infrastruttura.sh "cdk.out/${STACK}.template.json" > .log-infrastruttura.txt 2>&1; then ok "$(head -1 .log-infrastruttura.txt)"
    else cat .log-infrastruttura.txt; errore "Configurazione AWS con un problema nuovo: non pubblico (dettaglio in cloud/.log-infrastruttura.txt)"; fine 1; fi
  else info "sintesi CDK non riuscita: controllo della configurazione saltato (il motivo è in .log-sintesi.txt)"; fi
fi
info "creo o aggiorno: la prima volta CloudFront richiede 5-15 minuti"
npx --yes cdk deploy "${STACK}" --require-approval never --progress events \
    --outputs-file "${USCITE}" 2>&1 | tee .log-pubblicazione.txt \
  || { errore "Pubblicazione non riuscita. Il motivo è qui sopra e in .log-pubblicazione.txt"; fine 1; }
SITO=$(uscita "${USCITE}" "${STACK}" BucketSito)
DATI=$(uscita "${USCITE}" "${STACK}" BucketDati)
DIST=$(uscita "${USCITE}" "${STACK}" Distribuzione)
INDIRIZZO=$(uscita "${USCITE}" "${STACK}" Indirizzo)
INDIRIZZO_DOMINIO=$(uscita "${USCITE}" "${STACK}" IndirizzoDominio)
[ -n "${SITO}" ] && [ -n "${DATI}" ] && [ -n "${DIST}" ] || { errore "Non leggo le uscite dello stack."; fine 1; }
ok "infrastruttura pronta"

# ---------- 7. pagina e casi ----------
titolo "7. Pagina e casi"
# controllo automatico dei casi: dati del paziente, file mancanti, testi segnaposto, coerenza (strumenti/controlla.py)
if [ -n "${CASI}" ] && [ -f "../strumenti/controlla.py" ]; then
  # pydicom in un ambiente Python dedicato (strumenti/.venv), creato da solo la prima volta:
  # il Python di Homebrew non permette di installare pacchetti nel sistema
  VENV="../strumenti/.venv"; PY=python3
  if [ ! -x "${VENV}/bin/python" ]; then
    info "preparo l'ambiente Python per il controllo delle immagini (solo la prima volta)…"
    python3 -m venv "${VENV}" >/dev/null 2>&1 && "${VENV}/bin/python" -m pip install -q pydicom >/dev/null 2>&1 \
      || info "pydicom non installato: controllo dei soli testi"
  fi
  [ -x "${VENV}/bin/python" ] && "${VENV}/bin/python" -c "import pydicom" 2>/dev/null && PY="${VENV}/bin/python"
  if "${PY}" "../strumenti/controlla.py" "${CASI}"; then ok "controllo dei casi superato"
  else errore "Il controllo dei casi ha trovato errori (sopra): correggili prima di pubblicare."; fine 1; fi
fi
# controlli automatici della segmentazione IA: geometria, orientamento, risultati non plausibili
# (strumenti/controlla_ia.py): le serie sbagliate vengono segnate «scartata» e il sito non le usa
IA_PY="${HOME}/.radioquiz-ia/venv/bin/python"
if [ -n "${CASI}" ] && [ -f "../strumenti/controlla_ia.py" ] && [ -x "${IA_PY}" ]; then
  if "${IA_PY}" "../strumenti/controlla_ia.py" "${CASI}" --correggi > .log-controllo-ia.txt 2>&1; then ok "$(tail -1 .log-controllo-ia.txt)"
  else info "controllo IA non riuscito: dettaglio in cloud/.log-controllo-ia.txt"; fi
  grep -E 'ERRORE|non plausibili' .log-controllo-ia.txt | head -10
fi
# numero di versione: cresce di uno a ogni pubblicazione; si vede nel sito (pagina iniziale e «?»)
# e serve anche a far scaricare ai browser i moduli nuovi di lib/ (che restano in cache un'ora)
# le istanze delle aziende usano il numero dell'ultima pubblicazione della vetrina (stesso codice)
if [ "${MODO}" = "azienda" ]; then NUMERO=$(cat .versione 2>/dev/null || echo 0); else NUMERO=$(( $(cat .versione 2>/dev/null || echo 0) + 1 )); fi
VERSIONE="1.${NUMERO}"
# librerie grandi (motore MPR/3D, IA del referto) compresse qui al massimo (comprimi.mjs, .br-cache): si caricano
# già compresse, con Content-Encoding br. L'hash del motore 3D va in versione.json: app.js lo usa nell'indirizzo,
# così il browser riscarica il motore solo quando cambia, non a ogni pubblicazione.
BR_MPR=$(node comprimi.mjs "${STATICO}/lib/mpr3d.js" 2>/dev/null) || BR_MPR=""
BR_LLM=$(node comprimi.mjs "${STATICO}/lib/webllm.js" 2>/dev/null) || BR_LLM=""
H_MPR=$(echo "${BR_MPR}" | awk '{print $2}')
NUMERI=$(node -e '
const fs = require("fs"), p = require("path"), d = process.argv[1]; let casi = 0; const met = new Set(), dis = new Set();
for (const c of fs.readdirSync(d)) { const f = p.join(d, c, "caso.json"); if (!fs.existsSync(f)) continue; let j; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  if (j.visibile === false) continue; casi++; met.add(j.modalita || "Altro"); if (j.distretto) dis.add(j.distretto); }
process.stdout.write(`,"casi":${casi},"metodiche":${met.size},"distretti":${dis.size}`);' "${CASI}" 2>/dev/null || true)
printf '{"versione":"%s","numero":%s,"data":"%s","mpr3d":"%s"%s}\n' "${VERSIONE}" "${NUMERO}" "$(date '+%Y-%m-%d %H:%M')" "${H_MPR}" "${NUMERI}" > "${STATICO}/versione.json"
# no-cache: il browser ricontrolla a ogni apertura (risponde «non modificato» se è uguale), così
# dopo una pubblicazione nessuno resta con la versione vecchia della pagina
# copie di lavoro (*.bak*, backup_vista/) mai online: restano solo sul Mac
NOPUB=(--exclude "*.bak*" --exclude "*.map" --exclude "backup_vista/*" --exclude "*~" --exclude "*.orig")
# copia da caricare in .web-pub con app.js e style.css ridotti (minifica.mjs, esbuild): un terzo in meno
# da leggere per il browser e circa un quinto in meno da scaricare; web/ resta com'è. Se la riduzione non riesce si carica web/.
PUB="${STATICO}"
if rsync -a --delete --exclude "/casi" --exclude "*.DS_Store" "${NOPUB[@]}" "${STATICO}/" ".web-pub/" \
   && node minifica.mjs .web-pub > .log-minifica.txt 2>&1 && node --check .web-pub/app.js; then
  PUB=".web-pub"; ok "$(tail -1 .log-minifica.txt)"
else info "riduzione di app.js non riuscita (dettaglio in cloud/.log-minifica.txt): carico i file originali"; fi
aws s3 sync "${PUB}" "s3://${SITO}/" --delete --exclude "casi/*" --exclude "*.DS_Store" --exclude "lib/*" "${NOPUB[@]}" \
    --cache-control "no-cache" --only-show-errors \
  || { errore "Caricamento della pagina non riuscito."; fine 1; }
GIA_BR=(); [ -n "${BR_MPR}" ] && GIA_BR+=(--exclude "mpr3d.js"); [ -n "${BR_LLM}" ] && GIA_BR+=(--exclude "webllm.js")
aws s3 sync "${PUB}/lib" "s3://${SITO}/lib/" --delete --exclude "*.DS_Store" "${NOPUB[@]}" ${GIA_BR[@]+"${GIA_BR[@]}"} \
    --cache-control "max-age=3600" --only-show-errors \
  || { errore "Caricamento della pagina non riuscito."; fine 1; }
# le due librerie compresse: si caricano solo se il contenuto è cambiato (hash nei metadati dell'oggetto)
for X in "mpr3d.js|${BR_MPR}" "webllm.js|${BR_LLM}"; do
  NOME="${X%%|*}"; BR_F=$(echo "${X#*|}" | awk '{print $1}'); BR_H=$(echo "${X#*|}" | awk '{print $2}'); [ -n "${BR_F}" ] || continue
  ORA=$(aws s3api head-object --bucket "${SITO}" --key "lib/${NOME}" --query 'Metadata.sha' --output text 2>/dev/null)
  if [ "${ORA}" != "${BR_H}" ]; then
    aws s3 cp "${BR_F}" "s3://${SITO}/lib/${NOME}" --content-encoding br --content-type "text/javascript; charset=utf-8" \
      --cache-control "max-age=3600" --metadata "sha=${BR_H}" --only-show-errors \
      && ok "lib/${NOME} caricato compresso ($(( $(wc -c < "${BR_F}") / 1024 )) kB)" \
      || { errore "Caricamento di lib/${NOME} non riuscito."; fine 1; }
  fi
done
# e se ne erano finite online in passato, si tolgono (solo queste copie, mai i casi)
aws s3 rm "s3://${SITO}/" --recursive --exclude "*" --include "*.bak*" --include "*.map" --include "backup_vista/*" --include "*~" --include "*.orig" --exclude "casi/*" --only-show-errors \
  || { errore "Pulizia delle copie di lavoro non riuscita."; fine 1; }
[ "${MODO}" = "vetrina" ] && echo "${NUMERO}" > .versione
ok "pagina caricata (versione ${VERSIONE})"
# codice per la creazione automatica delle piattaforme dei clienti (lavoro AWS CodeBuild «CreaPiattaforme»):
# la stessa versione appena pubblicata, senza segreti, dipendenze, test e casi
CODICE_B=$(uscita "${USCITE}" "${STACK}" BucketCodice)
if [ "${MODO}" = "vetrina" ] && [ -n "${CODICE_B}" ]; then
  TGZ="$(mktemp -d)/codice.tgz"
  if COPYFILE_DISABLE=1 tar --no-xattrs -czf "${TGZ}" --exclude='./node_modules' --exclude='./cdk.out' --exclude='./istanze' --exclude='./.segreti*' --exclude='./.uscite*' \
       --exclude='./.log*' --exclude='./.web-pub' --exclude='./.br-cache' --exclude='./.casi-br' --exclude='./.casi-pk' --exclude='*.dcm' --exclude='./test' --exclude='*.DS_Store' --exclude='./web/casi' --exclude='./web/esempi' . \
     && aws s3 cp "${TGZ}" "s3://${CODICE_B}/codice.tgz" --only-show-errors; then ok "codice per la creazione automatica delle piattaforme aggiornato"
  else info "codice per la creazione automatica non caricato: le piattaforme dei clienti si creano ancora con crea-istanze.command"; fi
  rm -rf "$(dirname "${TGZ}")"
fi
# casi dalla cartella del Mac: vetrina (casi-free) e istanze con CASI_DAL_MAC (le altre aziende li caricano dal sito)
# SALTA_CASI=1: pubblica solo pagina e infrastruttura (es. prima creazione di un'istanza, casi copiati da bucket a bucket)
if [ -n "${CASI}" ] && [ "${SALTA_CASI:-}" = "1" ]; then info "casi dal Mac saltati (SALTA_CASI=1)"
elif [ -n "${CASI}" ]; then
info "immagini anonimizzate: la prima volta qualche minuto per caso (~0,5 GB ciascuno)"
# niente --delete: i casi caricati dal sito (pagina «Nuovo caso») non sono in questa cartella
# casi eliminati dal sito (pagina «Modifica caso» → Elimina): non vanno ricaricati,
# a meno che nella cartella del caso ci sia il file AGGIORNA (ripristino)
ESCLUSI=()
for ID in $(aws s3 ls "s3://${DATI}/eliminati/" 2>/dev/null | awk '/PRE/ {print $2}' | tr -d /); do
  [ -d "${CASI}/${ID}" ] || continue
  if [ -f "${CASI}/${ID}/AGGIORNA" ]; then
    aws s3 rm "s3://${DATI}/eliminati/${ID}/caso.json" --only-show-errors && info "${ID}: era stato eliminato dal sito, lo ripristino (file AGGIORNA)"
  else
    ESCLUSI+=(--exclude "${ID}/*"); info "${ID}: eliminato dal sito, non lo ricarico (per ripristinarlo: file AGGIORNA nella sua cartella)"
  fi
done
# casi modificati nell'editor del sito (immagini aggiunte o tolte): prima si riprendono qui le immagini
# nuove, serie.json e caso.json; le immagini tolte online vanno nella sottocartella «_rimosse» del caso
for ID in $(aws s3 ls "s3://${DATI}/modifiche-immagini/" 2>/dev/null | awk '{print $4}' | sed 's/\.json$//'); do
  d="${CASI}/${ID}"
  [ -d "${d}" ] || { aws s3 rm "s3://${DATI}/modifiche-immagini/${ID}.json" --only-show-errors; continue; }
  # 1.265: solo le immagini che qui mancano (quelle aggiunte con l'editor, caricate non compresse); le altre online sono
  # copie compresse con brotli e non devono finire sopra gli originali
  node riprendi-nuove.mjs "${SITO}" "${ID}" "${d}" \
    && aws s3 cp "s3://${SITO}/casi/${ID}/serie.json" "${d}/serie.json" --only-show-errors \
    && aws s3 cp "s3://${DATI}/casi/${ID}/caso.json" "${d}/caso.json" --only-show-errors \
    || { errore "${ID}: non riesco a riprendere le modifiche fatte nell'editor del sito"; fine 1; }
  node -e '
    const fs = require("fs"), path = require("path"), d = process.argv[1];
    const usati = new Set(JSON.parse(fs.readFileSync(path.join(d, "serie.json"))).flatMap((s) => s.files || []));
    let n = 0;
    const giro = (rel) => { for (const e of fs.readdirSync(path.join(d, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) giro(r);
      else if (e.name.endsWith(".dcm") && !usati.has(r.split(path.sep).join("/"))) {
        const dest = path.join(d, "_rimosse", r); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.renameSync(path.join(d, r), dest); n++; } } };
    if (fs.existsSync(path.join(d, "serie"))) giro("serie");
    console.log(n);' "${d}" > /tmp/rimosse.$$ || { errore "${ID}: riordino delle immagini non riuscito"; fine 1; }
  aws s3 rm "s3://${DATI}/modifiche-immagini/${ID}.json" --only-show-errors
  ok "${ID}: riprese le modifiche alle immagini fatte nel sito ($(cat /tmp/rimosse.$$) immagini tolte, spostate in ${ID}/_rimosse)"
  rm -f /tmp/rimosse.$$
done
# 1.265: le immagini DICOM si caricano compresse con brotli (Content-Encoding: br, circa metà del traffico; il browser le
# decomprime da solo). Copie in .casi-br (comprimi-casi.mjs); i vetrini (cartelle «vetrino/») restano come sono, perché
# il visualizzatore li legge a pezzi con richieste parziali. Gli altri file (anteprime, IA) come prima.
# intestazioni delle serie (modalità, piano, posizione) in serie-meta.json: il visualizzatore non deve scaricare immagini
# intere, compresse, solo per leggerle (strumenti/meta_serie.py; si rifà solo per i casi cambiati)
if [ -f "../strumenti/meta_serie.py" ]; then
  MPY=python3; [ -x "../strumenti/.venv/bin/python" ] && MPY="../strumenti/.venv/bin/python"
  if "${MPY}" "../strumenti/meta_serie.py" "${CASI}" > .log-meta-serie.txt 2>&1; then ok "$(tail -1 .log-meta-serie.txt)"
  else info "serie-meta.json non aggiornato (vedi .log-meta-serie.txt): il visualizzatore legge le intestazioni dalle immagini"; fi
fi
node comprimi-casi.mjs "${CASI}" .casi-br || { errore "Compressione delle immagini non riuscita."; fine 1; }
# 1.277: pacchetti di immagini (una TC di 200 immagini in 4-6 file: molte meno richieste); nome = impronta del contenuto
node pacchetti-casi.mjs "${CASI}" .casi-pk > .log-pacchetti.txt 2>&1 && ok "$(tail -1 .log-pacchetti.txt)" \
  || { errore "Pacchetti delle immagini non riusciti (vedi .log-pacchetti.txt)."; fine 1; }
# 21/11/2026: si caricano solo i casi cambiati. Ogni «aws s3 sync» su tutta la cartella elenca da solo ~40 000 oggetti
# online anche quando non è cambiato niente (diversi minuti a ogni pubblicazione). L'impronta di ogni caso (numero,
# dimensione e data dei file grandi, contenuto di quelli piccoli, in ${CASI}, .casi-br e .casi-pk; esclusi caso.json, AGGIORNA e _rimosse) si salva dopo un
# caricamento riuscito in .casi-pk/.caricati-<stack>.json; i casi con l'impronta uguale non si toccano. Si carica tutta
# la cartella, come prima, la prima volta, con più di 20 casi cambiati o con TUTTI_I_CASI=1. I casi caricati dal sito
# (editor) non c'entrano: non sono in questa cartella.
IMPRONTE=".casi-pk/.caricati-${STACK}.json"
rm -f "${IMPRONTE}.nuovo"
CAMBIATI=$(node -e '
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const [casi, file, tutti] = process.argv.slice(1);
const salta = new Set(["caso.json", "AGGIORNA", ".DS_Store", "_rimosse"]);
// file JSON e file piccoli: il contenuto, perché alcuni passaggi li riscrivono uguali a ogni pubblicazione
// (pacchetti.json); immagini e pacchetti: dimensione e data, senza rileggerli
const impronta = (id) => { let n = 0, b = 0; const h = crypto.createHash("sha1");
  const giro = (d) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    es.sort((x, y) => (x.name < y.name ? -1 : 1));
    for (const e of es) { if (salta.has(e.name)) continue; const p = path.join(d, e.name);
      if (e.isDirectory()) giro(p); else { const s = fs.statSync(p); n++; b += s.size;
        h.update(p + "\0" + s.size + "\0"); h.update(e.name.endsWith(".json") || s.size < 65536 ? fs.readFileSync(p) : String(Math.round(s.mtimeMs))); } } };
  for (const base of [casi, ".casi-br", ".casi-pk"]) giro(path.join(base, id));
  return `${n}:${b}:${h.digest("hex").slice(0, 16)}`; };
const ids = fs.readdirSync(casi, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
const nuove = Object.fromEntries(ids.map((id) => [id, impronta(id)]));
let vecchie = null; try { vecchie = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
fs.writeFileSync(file + ".nuovo", JSON.stringify(nuove));
const cambiati = ids.filter((id) => !vecchie || vecchie[id] !== nuove[id]);
console.log(tutti === "1" || !vecchie || cambiati.length > 20 ? "TUTTI" : cambiati.join(" "));
' "${CASI}" "${IMPRONTE}" "${TUTTI_I_CASI:-}") || CAMBIATI="TUTTI"
if [ "${CAMBIATI}" = "TUTTI" ]; then
info "carico tutta la cartella dei casi (prima volta, molti casi cambiati o TUTTI_I_CASI=1)"
# 1.272: i due caricamenti (originali senza .dcm, .dcm compressi) riguardano file diversi e vanno insieme
# (ognuno elenca da solo ~40 000 oggetti online): circa metà del tempo
aws s3 sync "${CASI}" "s3://${SITO}/casi/" --exclude "*caso.json" --exclude "*serie.json" --exclude "*serie-meta.json" --exclude "*AGGIORNA" --exclude "*.DS_Store" \
    --exclude "*.dcm" --include "*/vetrino/*.dcm" --exclude "*/_rimosse/*" ${ESCLUSI[@]+"${ESCLUSI[@]}"} \
    --cache-control "max-age=86400" --only-show-errors &
P_ORIG=$!
aws s3 sync .casi-br "s3://${SITO}/casi/" --exclude "*" --include "*.dcm" ${ESCLUSI[@]+"${ESCLUSI[@]}"} \
    --content-encoding br --content-type "application/dicom" --cache-control "max-age=86400" --only-show-errors &
P_BR=$!
# pacchetti: non cambiano mai (il nome è l'impronta del contenuto), il browser li tiene un anno
aws s3 sync .casi-pk "s3://${SITO}/casi/" --exclude "*" --include "*/pacchetti/*.rqp" ${ESCLUSI[@]+"${ESCLUSI[@]}"} \
    --content-encoding br --content-type "application/octet-stream" --cache-control "public, max-age=31536000, immutable" --only-show-errors &
P_PK=$!
wait "${P_ORIG}" || { wait "${P_BR}" || true; wait "${P_PK}" || true; errore "Caricamento delle immagini non riuscito."; fine 1; }
wait "${P_BR}" || { wait "${P_PK}" || true; errore "Caricamento delle immagini compresse non riuscito."; fine 1; }
wait "${P_PK}" || { errore "Caricamento dei pacchetti di immagini non riuscito."; fine 1; }
# l'elenco delle serie (e le intestazioni, serie-meta.json) può cambiare: il browser lo ricontrolla subito;
# si carica dopo le immagini, così non indica mai file non ancora online
aws s3 sync .casi-pk "s3://${SITO}/casi/" --exclude "*" --include "*/pacchetti.json" ${ESCLUSI[@]+"${ESCLUSI[@]}"} \
    --cache-control "no-cache" --content-type "application/json; charset=utf-8" --only-show-errors \
  || { errore "Caricamento dell'elenco dei pacchetti non riuscito."; fine 1; }
aws s3 sync "${CASI}" "s3://${SITO}/casi/" --exclude "*" --include "*serie.json" --include "*serie-meta.json" ${ESCLUSI[@]+"${ESCLUSI[@]}"} \
    --cache-control "no-cache" --content-type "application/json; charset=utf-8" --only-show-errors \
  || { errore "Caricamento dell'elenco delle serie non riuscito."; fine 1; }
else
[ -n "${CAMBIATI}" ] && info "casi cambiati dall'ultima pubblicazione: ${CAMBIATI}" || info "nessun caso cambiato dall'ultima pubblicazione"
for ID in ${CAMBIATI}; do
  case " ${ESCLUSI[*]-} " in *" ${ID}/* "*) continue ;; esac
  D="s3://${SITO}/casi/${ID}/"
  # stessi file e stesse intestazioni del caricamento di tutta la cartella, un caso alla volta
  aws s3 sync "${CASI}/${ID}" "${D}" --exclude "*caso.json" --exclude "*serie.json" --exclude "*serie-meta.json" --exclude "*AGGIORNA" --exclude "*.DS_Store" \
      --exclude "*.dcm" --include "*vetrino/*.dcm" --exclude "*_rimosse/*" --cache-control "max-age=86400" --only-show-errors &
  P_ORIG=$!; P_BR=""; P_PK=""
  if [ -d ".casi-br/${ID}" ]; then
    aws s3 sync ".casi-br/${ID}" "${D}" --exclude "*" --include "*.dcm" \
        --content-encoding br --content-type "application/dicom" --cache-control "max-age=86400" --only-show-errors &
    P_BR=$!
  fi
  if [ -d ".casi-pk/${ID}" ]; then
    aws s3 sync ".casi-pk/${ID}" "${D}" --exclude "*" --include "*pacchetti/*.rqp" \
        --content-encoding br --content-type "application/octet-stream" --cache-control "public, max-age=31536000, immutable" --only-show-errors &
    P_PK=$!
  fi
  E=0; wait "${P_ORIG}" || E=1
  [ -n "${P_BR}" ] && { wait "${P_BR}" || E=1; }
  [ -n "${P_PK}" ] && { wait "${P_PK}" || E=1; }
  [ "${E}" = "0" ] || { errore "${ID}: caricamento delle immagini non riuscito."; fine 1; }
  # gli elenchi dopo le immagini, come sopra: non indicano mai file non ancora online
  if [ -d ".casi-pk/${ID}" ]; then
    aws s3 sync ".casi-pk/${ID}" "${D}" --exclude "*" --include "*pacchetti.json" \
        --cache-control "no-cache" --content-type "application/json; charset=utf-8" --only-show-errors \
      || { errore "${ID}: caricamento dell'elenco dei pacchetti non riuscito."; fine 1; }
  fi
  aws s3 sync "${CASI}/${ID}" "${D}" --exclude "*" --include "*serie.json" --include "*serie-meta.json" \
      --cache-control "no-cache" --content-type "application/json; charset=utf-8" --only-show-errors \
    || { errore "${ID}: caricamento dell'elenco delle serie non riuscito."; fine 1; }
done
fi
# casi con il file AGGIORNA: la cartella locale è quella giusta, quindi online si tolgono
# le immagini che qui non ci sono più (es. mammografie/RX «for processing» scartate)
for d in "${CASI}"/*/; do
  ID=$(basename "${d}")
  [ -f "${d}AGGIORNA" ] && [ -d "${d}serie" ] || continue
  case " ${ESCLUSI[*]-} " in *" ${ID}/* "*) continue ;; esac
  # immagini: dalle copie compresse (solo i .dcm); gli altri file dagli originali (anteprime…)
  aws s3 sync ".casi-br/${ID}/serie" "s3://${SITO}/casi/${ID}/serie/" --delete --exclude "*" --include "*.dcm" \
      --content-encoding br --content-type "application/dicom" --cache-control "max-age=86400" --only-show-errors \
    && aws s3 sync "${d}serie" "s3://${SITO}/casi/${ID}/serie/" --delete --exclude "*.DS_Store" --exclude "*.dcm" \
      --cache-control "max-age=86400" --only-show-errors \
    || { errore "${ID}: pulizia delle immagini online non riuscita"; fine 1; }
done
ok "immagini caricate"
# impronte dei casi appena caricati (vedi sopra): la prossima volta si caricano solo quelli cambiati
[ -f "${IMPRONTE}.nuovo" ] && mv -f "${IMPRONTE}.nuovo" "${IMPRONTE}"
# 1.272: le date dei caso.json online con un solo elenco (prima: una richiesta per caso, ~1 s l'una);
# se l'elenco non riesce si torna alla richiesta per caso, mai a «manca online» (sovrascriverebbe l'editor)
ELENCO_DATI=$(mktemp); ELENCO_OK=0
aws s3api list-objects-v2 --bucket "${DATI}" --prefix casi/ --query "Contents[?ends_with(Key, '/caso.json')].[Key,LastModified]" \
    --output text > "${ELENCO_DATI}" 2>/dev/null && ELENCO_OK=1
online_di(){
  if [ "${ELENCO_OK}" = "1" ]; then awk -F'\t' -v k="casi/${1}/caso.json" '$1 == k { print $2; exit }' "${ELENCO_DATI}"
  else aws s3api head-object --bucket "${DATI}" --key "casi/${1}/caso.json" --query LastModified --output text 2>/dev/null || true; fi
}
for f in "${CASI}"/*/caso.json; do
  [ -f "${f}" ] || continue
  ID=$(basename "$(dirname "${f}")")
  case " ${ESCLUSI[*]-} " in *" ${ID}/* "*) continue ;; esac
  # un file vuoto «AGGIORNA» nella cartella del caso forza l'invio della versione locale (una volta)
  if [ -f "$(dirname "${f}")/AGGIORNA" ]; then FORZA=1; else FORZA="${AGGIORNA_CASI:-}"; fi
  # senza «AGGIORNA»: si carica se manca online o se la copia nel Mac è più recente di quella online;
  # se è più recente quella online (modificata con l'editor del sito), resta quella
  ONLINE=$(online_di "${ID}")
  if [ "${FORZA}" != "1" ] && [ -n "${ONLINE}" ] && [ "${ONLINE}" != "None" ] \
     && node -e 'process.exit(require("fs").statSync(process.argv[1]).mtimeMs > Date.parse(process.argv[2]) ? 1 : 0)' "${f}" "${ONLINE}"; then
    info "${ID}: online è già aggiornato (le modifiche fatte dall'editor restano)"
  else
    aws s3 cp "${f}" "s3://${DATI}/casi/${ID}/caso.json" --content-type "application/json; charset=utf-8" --only-show-errors \
      && ok "${ID}: domande e risposte caricate" || { errore "${ID}: caricamento non riuscito"; fine 1; }
    rm -f "$(dirname "${f}")/AGGIORNA"
  fi
done
rm -f "${ELENCO_DATI}"
fi   # fine dei casi dal Mac
aws cloudfront create-invalidation --distribution-id "${DIST}" --paths "/*" >/dev/null 2>&1 \
  && ok "cache di CloudFront svuotata" || info "non sono riuscito a svuotare la cache: le modifiche arrivano entro 5 minuti"

# ---------- 8. verifica ----------
titolo "8. Verifica dal sito"
BASE="${INDIRIZZO}"
if [ -n "${INDIRIZZO_DOMINIO}" ] && curl -fsS --max-time 15 -o /dev/null "${INDIRIZZO_DOMINIO}/" 2>/dev/null; then
  BASE="${INDIRIZZO_DOMINIO}"
elif [ -n "${INDIRIZZO_DOMINIO}" ]; then
  info "${INDIRIZZO_DOMINIO} non risponde ancora (il DNS può metterci qualche minuto): verifico su ${INDIRIZZO}"
fi
COOKIE=$(mktemp); PROVE_OK=1
prova(){ if [ "${2}" = "${3}" ]; then ok "${1}"; else errore "${1}: atteso ${3}, ottenuto ${2}"; PROVE_OK=0; fi; }
for _ in 1 2 3 4 5 6; do
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "${BASE}/")
  [ "${C}" = "200" ] && break; sleep 20
done
prova "la pagina si apre" "${C}" 200
prova "senza codice l'API è chiusa" "$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/casi")" 401
prova "un codice sbagliato non entra" "$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"codice":"sbagliato"}' "${BASE}/api/accesso")" 401
COOKIE_S=$(mktemp)
# corpo in una variabile: la bash 3.2 di macOS non tratta come le altre le graffe dentro ${3:-...}
POST(){ CORPO='{}'; [ -n "${3:-}" ] && CORPO="${3}"; curl -s -b "${1}" -X POST -H 'Content-Type: application/json' -d "${CORPO}" "${BASE}${2}"; }
campo(){ node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(('${1}').split('.').reduce((o,k)=>o[k],v))}catch(e){console.log('')}})"; }
prova "il codice dell'amministratore entra" "$(curl -s -c "${COOKIE}" -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"${CODICE_AMMINISTRATORE}\"}" "${BASE}/api/accesso")" 200
N=$(curl -s -b "${COOKIE}" "${BASE}/api/casi" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).length)}catch(e){console.log(0)}})")
if [ "${MODO}" = "azienda" ] && [ -z "${CASI}" ]; then ok "casi caricati dall'azienda: ${N:-0}"
else [ "${N}" -gt 0 ] 2>/dev/null && ok "casi visibili: ${N}" || { errore "nessun caso visibile"; PROVE_OK=0; }; fi
# pulizia: account di prova rimasti da pubblicazioni precedenti
for VECCHIO in $(curl -s -b "${COOKIE}" "${BASE}/api/account" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{JSON.parse(s).filter(a=>a.nome==='Prova pubblicazione (da eliminare)').forEach(a=>console.log(a.id))}catch(e){}})"); do
  POST "${COOKIE}" "/api/account/${VECCHIO}/elimina" >/dev/null && info "eliminato un vecchio account di prova (${VECCHIO})"
done
# un account di prova, creato e poi eliminato: controlla che uno specializzando
# veda i casi ma non le risposte, gli account o i risultati
R=$(POST "${COOKIE}" /api/account '{"nome":"Prova pubblicazione (da eliminare)","ruolo":"specializzando"}')
ID_PROVA=$(printf '%s' "${R}" | campo account.id); COD_PROVA=$(printf '%s' "${R}" | campo codice)
if [ -n "${ID_PROVA}" ] && [ -n "${COD_PROVA}" ]; then
  ok "l'amministratore crea gli account"
  prova "lo specializzando di prova entra" "$(curl -s -c "${COOKIE_S}" -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"${COD_PROVA}\"}" "${BASE}/api/accesso")" 200
  # le immagini si aprono solo dopo aver aperto il caso (l'API rilascia il permesso «qc» per quel caso);
  # lo specializzando vede solo i casi visibili: se sono tutti in bozza la prova si salta
  PRIMO=$(curl -s -b "${COOKIE_S}" "${BASE}/api/casi" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s)[0]?.id||'')}catch(e){console.log('')}})")
  FILE=""
  if [ -n "${PRIMO}" ]; then
    curl -s -b "${COOKIE_S}" -c "${COOKIE_S}" -o /dev/null "${BASE}/api/casi/${PRIMO}"
    FILE=$(node -e "try{console.log(require('${CASI}/${PRIMO}/serie.json')[0].files[0])}catch(e){console.log('')}")
  else
    info "nessun caso visibile agli specializzandi (tutti in bozza): prova delle immagini saltata"
  fi
  if [ -n "${FILE}" ]; then
    prova "le immagini si aprono dopo aver aperto il caso" "$(curl -s -b "${COOKIE_S}" -o /dev/null -w "%{http_code}" "${BASE}/casi/${PRIMO}/${FILE}")" 200
    ALTRO=$(find "${CASI}" -mindepth 1 -maxdepth 1 -type d ! -name "${PRIMO}" -exec basename {} \; | sort | head -1)
    ALTROF=$(node -e "try{console.log(require('${CASI}/${ALTRO}/serie.json')[0].files[0])}catch(e){console.log('')}")
    [ -n "${ALTROF}" ] && prova "le immagini di un caso non aperto restano chiuse" "$(curl -s -b "${COOKIE_S}" -o /dev/null -w "%{http_code}" "${BASE}/casi/${ALTRO}/${ALTROF}")" 403
    prova "le immagini senza accesso sono chiuse" "$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/casi/${PRIMO}/${FILE}")" 403
  fi
  # con tutti i casi in bozza lo specializzando non vede nemmeno il caso: 404 invece di 403
  if [ -n "${PRIMO}" ]; then ATTESO=403; else ATTESO=404; fi
  prova "lo specializzando non legge le risposte" "$(curl -s -b "${COOKIE_S}" -o /dev/null -w "%{http_code}" "${BASE}/api/casi/${PRIMO:-$(ls "${CASI}" | head -1)}/completo")" "${ATTESO}"
  prova "lo specializzando non vede gli account" "$(curl -s -b "${COOKIE_S}" -o /dev/null -w "%{http_code}" "${BASE}/api/account")" 403
  prova "lo specializzando non scarica i risultati" "$(curl -s -b "${COOKIE_S}" -o /dev/null -w "%{http_code}" "${BASE}/api/risultati")" 403
  POST "${COOKIE}" "/api/account/${ID_PROVA}/elimina" >/dev/null
  prova "l'account di prova è eliminato e non entra più" "$(curl -s -b "${COOKIE_S}" -o /dev/null -w "%{http_code}" "${BASE}/api/casi")" 401
else
  errore "non sono riuscito a creare l'account di prova: ${R}"; PROVE_OK=0
fi
rm -f "${COOKIE_S}"
rm -f "${COOKIE}"

# sicurezza del sito: intestazioni HTTP e file che non devono essere raggiungibili (solo lettura)
if [ -f test/controlla-sito.sh ]; then
  info "intestazioni di sicurezza e file non pubblici"
  bash test/controlla-sito.sh "${BASE}" || PROVE_OK=0
fi
# l'API chiamata direttamente (senza CloudFront e senza l'intestazione segreta) deve rispondere 403
FUN=$(aws cloudformation describe-stack-resource --stack-name "${STACK}" --logical-resource-id ApiF70053CD --region "${REGIONE}" \
  --query StackResourceDetail.PhysicalResourceId --output text 2>/dev/null)
URL_FUN=$([ -n "${FUN}" ] && aws lambda get-function-url-config --function-name "${FUN}" --region "${REGIONE}" --query FunctionUrl --output text 2>/dev/null)
if [ -n "${URL_FUN}" ] && [ "${URL_FUN}" != "None" ]; then
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "${URL_FUN}api/casi")" = "403" ]; then ok "API non raggiungibile scavalcando CloudFront (403)"
  else errore "L'API risponde anche senza passare da CloudFront: controlla SEGRETO_ORIGINE"; PROVE_OK=0; fi
else info "indirizzo diretto dell'API non trovato: controllo saltato"; fi

# copia pubblica del codice (github.com/salvatorepaolo/radio-quiz-open): l'ultimo commit, senza storia, dopo i controlli
# di pubblica-sorgenti.sh. Solo per la vetrina; se non riesce il sito resta pubblicato. Per saltarla: SALTA_SORGENTI=1
if [ "${MODO}" = "vetrina" ] && [ "${SALTA_SORGENTI:-}" != "1" ] && [ -f ../../pubblica-sorgenti.sh ]; then
  if bash ../../pubblica-sorgenti.sh > .log-sorgenti.txt 2>&1; then ok "codice pubblico: $(tail -1 .log-sorgenti.txt | sed 's/^[✓·] *//')"
  else info "copia pubblica del codice non aggiornata (dettaglio in cloud/.log-sorgenti.txt)"; tail -3 .log-sorgenti.txt; fi
fi

# ---------- fatto ----------
printf "\n\033[1m──────────────────────────────────────────────\n"
[ "${PROVE_OK}" = "1" ] && printf "  PUBBLICATO\n" || printf "  PUBBLICATO, MA QUALCHE VERIFICA NON È PASSATA (vedi sopra)\n"
printf "──────────────────────────────────────────────\033[0m\n\n"
printf "  Indirizzo:            \033[1m%s\033[0m\n" "${INDIRIZZO_DOMINIO:-${INDIRIZZO}}"
printf "  Codice amministratore: \033[1m%s\033[0m\n\n" "${CODICE_AMMINISTRATORE}"
if [ "${MODO}" = "azienda" ]; then
  printf "  Entra con questo codice, apri Gestione → Iscritti e docenti e invita\n"
  printf "  l'amministratore dell'azienda (ruolo Amministratore): riceve un'email\n"
  printf "  per scegliere la password e poi invita docenti e specializzandi.\n\n"
else
  printf "  Entra con questo codice e apri «Account» per creare gli account\n"
  printf "  di specializzandi e docenti: ognuno riceve il suo codice personale.\n\n"
fi
printf "  Il codice resta nel file %s: non mandarlo\n" "${SEGRETI}"
printf "  per email. Per cambiarlo: cancella la riga e rilancia.\n"
fine 0
