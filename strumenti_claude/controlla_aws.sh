#!/bin/bash
# controlla_aws.sh: configurazione AWS di radio-quiz.it, SOLO IN LETTURA (nessuna modifica; le letture non si pagano).
# Archivi (S3) non pubblici e cifrati, backup continuo del database, autenticazione a due fattori, chiavi vecchie,
# distribuzione CloudFront solo HTTPS con TLS recente, versioni di Node delle funzioni ancora supportate.
# Uso: bash controlla_aws.sh   (uscita 1 se qualcosa non va; ⚠ sono solo avvisi)
export PATH="/opt/homebrew/bin:$PATH" AWS_PAGER=""
R=eu-south-1; male=0
bene() { printf '  \033[32m✓\033[0m %s\n' "$1"; }; brutto() { printf '  \033[31m✖\033[0m %s\n' "$1"; male=1; }; avviso() { printf '  \033[33m⚠\033[0m %s\n' "$1"; }
# una lettura non riuscita (rete, permessi) non deve sembrare un problema di configurazione: si segnala e si ripete
ERR=$(mktemp); trap 'rm -f "$ERR"' EXIT
q() { local o e; for _ in 1 2 3; do o=$(aws "$@" --output text 2>&1) && { echo "$o"; return 0; }; e=$o
  case "$e" in *NoSuchPublicAccessBlockConfiguration*|*NoSuchBucketPolicy*|*ServerSideEncryptionConfigurationNotFound*|*ResourceNotFound*) return 1;; esac; sleep 3; done
  echo "lettura non riuscita: aws $1 $2 → ${e:0:120}" >> "$ERR"; return 1; }

echo "Account"
[ "$(q iam get-account-summary --query SummaryMap.AccountMFAEnabled)" = 1 ] && bene "due fattori sull'account principale" || brutto "account principale senza due fattori"
[ "$(q iam get-account-summary --query SummaryMap.AccountAccessKeysPresent)" = 0 ] && bene "nessuna chiave di accesso sull'account principale" || brutto "chiavi di accesso sull'account principale"
for u in $(q iam list-users --query 'Users[].UserName'); do
  if aws iam get-login-profile --user-name "$u" >/dev/null 2>&1; then
    [ -n "$(q iam list-mfa-devices --user-name "$u" --query 'MFADevices[].SerialNumber')" ] && bene "utente $u: accesso alla console con due fattori" || brutto "utente $u: accesso alla console senza due fattori"
  fi
  for d in $(q iam list-access-keys --user-name "$u" --query "AccessKeyMetadata[?Status=='Active'].CreateDate"); do
    g=$(( ( $(date +%s) - $(date -j -f "%Y-%m-%dT%H:%M:%S" "${d%%+*}" +%s 2>/dev/null || date -d "$d" +%s) ) / 86400 ))
    [ "$g" -le 365 ] && bene "utente $u: chiave attiva di $g giorni" || avviso "utente $u: chiave attiva di $g giorni, da rinnovare"
  done
done

echo "Archivi S3"
for b in $(q s3api list-buckets --query "Buckets[?starts_with(Name, 'quizradiologia-')].Name"); do
  pab=$(q s3api get-public-access-block --bucket "$b" --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]')
  [ "$(echo "$pab" | tr '\t' '\n' | grep -c True)" = 4 ] && bene "$b: accesso pubblico bloccato" || brutto "$b: accesso pubblico non bloccato del tutto ($pab)"
  [ "$(q s3api get-bucket-policy-status --bucket "$b" --query PolicyStatus.IsPublic)" != True ] && bene "$b: nessuna regola lo rende pubblico" || brutto "$b: una regola lo rende pubblico"
  [ -n "$(q s3api get-bucket-encryption --bucket "$b" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm')" ] && bene "$b: cifrato" || brutto "$b: non cifrato"
  case "$b" in *dati*) [ "$(q s3api get-bucket-versioning --bucket "$b" --query Status)" = Enabled ] && bene "$b: versioni precedenti conservate" || avviso "$b: senza versioni precedenti (un file cancellato per errore non si recupera)";; esac
done

echo "Database (DynamoDB)"
for t in $(q dynamodb list-tables --region $R --query "TableNames[?starts_with(@, 'Quiz')]"); do
  [ "$(q dynamodb describe-continuous-backups --region $R --table-name "$t" --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus)" = ENABLED ] && bene "$t: backup continuo (ripristino a un istante degli ultimi 35 giorni)" || brutto "$t: backup continuo spento"
  [ "$(q dynamodb describe-table --region $R --table-name "$t" --query Table.DeletionProtectionEnabled)" = True ] && bene "$t: protetta dalla cancellazione" || avviso "$t: non protetta dalla cancellazione accidentale"
done

echo "Funzioni (Lambda)"
for f in $(q lambda list-functions --region $R --query "Functions[?starts_with(FunctionName, 'Quiz')].[FunctionName]"); do
  rt=$(q lambda get-function-configuration --region $R --function-name "$f" --query Runtime)
  case "$rt" in nodejs2[2-9].x|nodejs[3-9]*.x|python3.1[2-9]) bene "$f: $rt";; *) avviso "$f: $rt, versione vecchia o in dismissione";; esac
  # indirizzo diretto della funzione: CloudFront aggiunge un'intestazione segreta; senza, la funzione deve rifiutare
  if aws lambda get-function-url-config --region $R --function-name "$f" >/dev/null 2>&1; then
    if [ "$(q lambda get-function-url-config --region $R --function-name "$f" --query AuthType)" = AWS_IAM ]; then bene "$f: indirizzo diretto solo con firma"
    else
      [ "$(q lambda get-function-configuration --region $R --function-name "$f" --query 'Environment.Variables.SEGRETO_ORIGINE != null')" = True ] || brutto "$f: indirizzo diretto senza intestazione segreta di CloudFront"
      u=$(q lambda get-function-url-config --region $R --function-name "$f" --query FunctionUrl)
      st=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${u}api/casi")
      [ "$st" = 403 ] && bene "$f: chiamata diretta senza CloudFront rifiutata (403)" || brutto "$f: chiamata diretta senza CloudFront: $st invece di 403"
    fi
  fi
done

echo "CloudFront"
for d in $(q cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items || \`[]\`, 'radio-quiz.it')].Id"); do
  c=$(aws cloudfront get-distribution-config --id "$d" --output json 2>/dev/null)
  vp=$(echo "$c" | python3 -c 'import json,sys; c=json.load(sys.stdin)["DistributionConfig"]; b=[c["DefaultCacheBehavior"]]+c.get("CacheBehaviors",{}).get("Items",[]); print(" ".join(sorted({x["ViewerProtocolPolicy"] for x in b})))')
  case " $vp " in *" allow-all "*) brutto "$d: accetta HTTP senza reindirizzare a HTTPS";; *) bene "$d: solo HTTPS ($vp)";; esac
  tls=$(echo "$c" | python3 -c 'import json,sys; print(json.load(sys.stdin)["DistributionConfig"]["ViewerCertificate"].get("MinimumProtocolVersion",""))')
  case "$tls" in TLSv1.2*|TLSv1.3*) bene "$d: TLS minimo $tls";; *) brutto "$d: TLS minimo $tls";; esac
  oac=$(echo "$c" | python3 -c 'import json,sys; o=json.load(sys.stdin)["DistributionConfig"]["Origins"]["Items"]; print(sum(1 for x in o if ".s3." in x["DomainName"] and not x.get("OriginAccessControlId") and not x.get("S3OriginConfig",{}).get("OriginAccessIdentity")))')
  [ "$oac" = 0 ] && bene "$d: gli archivi si leggono solo attraverso CloudFront" || brutto "$d: $oac archivi letti senza controllo di accesso"
done
if [ -s "$ERR" ]; then echo "Letture non riuscite (risultati incompleti, riprovare):"; sed 's/^/  ⚠ /' "$ERR"; exit 2; fi
exit $male
