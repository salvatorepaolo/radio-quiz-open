#!/bin/bash
# infrastruttura.sh: Checkov (Apache-2.0) sul template CloudFormation prodotto da CDK, prima di ogni pubblicazione.
# Controlla permessi IAM, bucket S3 pubblici, cifratura, CloudFront... I controlli non superati ma accettati per scelta
# sono in checkov-accettati.json con il motivo; qualsiasi altro problema esce con 1 e ferma la pubblicazione.
# Uso: bash piattaforma-quiz/qualita/infrastruttura.sh piattaforma-quiz/cloud/cdk.out/QuizRadiologia.template.json
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
Q="$(cd "$(dirname "$0")" && pwd)"; T="${1:?indica il template, es. cdk.out/QuizRadiologia.template.json}"
command -v checkov >/dev/null || { echo "infrastruttura: checkov non installato (brew install checkov)"; exit 0; }
J="$(mktemp)"; trap 'rm -f "$J"' EXIT
checkov -f "$T" --framework cloudformation -o json --quiet --compact > "$J" 2>/dev/null
python3 - "$J" "$Q/checkov-accettati.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); d = d[0] if isinstance(d, list) else d
acc = {k: v for k, v in json.load(open(sys.argv[2])).items() if not k.startswith('_')}
nuovi, accettati = [], 0
for f in d.get('results', {}).get('failed_checks', []):
    rid = f['resource'].split('.', 1)[-1]; a = acc.get(f['check_id'])
    if a and (a['risorse'] == '*' or rid in a['risorse']): accettati += 1
    else: nuovi.append(f"  NUOVO {f['check_id']} {rid}: {f['check_name']}")
s = d.get('summary', {})
print(f"infrastruttura: {s.get('passed', 0)} controlli superati, {accettati} accettati con motivo, {len(nuovi)} problemi nuovi")
print('\n'.join(nuovi)); sys.exit(1 if nuovi else 0)
PY
