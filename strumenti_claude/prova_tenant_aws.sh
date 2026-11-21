#!/bin/bash
# collaudo della creazione automatica: uso «avvia» | «stato» | «smonta» | «togli»
BASE=https://radio-quiz.it; ID=prova-auto
CODICE=$(sed -n 's/^CODICE_AMMINISTRATORE="\(.*\)"/\1/p' /Volumes/Caloggero/piattaforma-quiz/cloud/.segreti)
CK=$(mktemp); trap 'rm -f "$CK"' EXIT
curl -s -c "$CK" -o /dev/null -X POST -H 'Content-Type: application/json' -d "{\"codice\":\"$CODICE\"}" $BASE/api/accesso
P(){ curl -s -b "$CK" -X POST -H 'Content-Type: application/json' -d "$2" "$BASE$1"; echo; }
case "$1" in
  avvia) P /api/tenant '{"id":"prova-auto","cliente":"Prova creazione automatica","referenteEmail":"info@radio-quiz.it","referenteNome":"Collaudo","utentiMax":5,"note":"piattaforma di collaudo della creazione automatica: da smontare"}' | head -c 300; echo
         P /api/tenant/$ID/avvia '{}' | head -c 400 ;;
  stato) curl -s -b "$CK" $BASE/api/tenant | python3 -c 'import json,sys;d=json.load(sys.stdin);print("automatica",d.get("automatica"));[print(t["id"],t["stato"],t.get("lavoro",{}),t.get("errore",""),"\n",t.get("registro","")[-1500:]) for t in d["elenco"]]' ;;
  smonta) P /api/tenant/$ID '{"stato":"da_smontare"}' | head -c 200; echo; P /api/tenant/$ID/avvia '{"conferma":"prova-auto"}' | head -c 300 ;;
  togli) P /api/tenant/$ID/elimina '{}' ;;
esac
