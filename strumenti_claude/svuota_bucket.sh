#!/bin/bash
# svuota_bucket.sh BUCKET REGIONE : cancella tutti gli oggetti e tutte le versioni, poi il bucket
B=$1; R=$2
while :; do
  aws s3api list-object-versions --bucket "$B" --region "$R" --max-items 1000 --output json > /tmp/sv_$B.json || break
  python3 - "$B" <<'P' > /tmp/sv_$B.del
import json,sys
d=json.load(open(f"/tmp/sv_{sys.argv[1]}.json"))
o=[{"Key":x["Key"],"VersionId":x["VersionId"]} for x in d.get("Versions",[])+d.get("DeleteMarkers",[])]
print(json.dumps({"Objects":o,"Quiet":True})) if o else None
P
  [ -s /tmp/sv_$B.del ] || break
  aws s3api delete-objects --bucket "$B" --region "$R" --delete file:///tmp/sv_$B.del > /dev/null || break
done
aws s3api delete-bucket --bucket "$B" --region "$R" && echo "BUCKET $B CANCELLATO"
