#!/usr/bin/env python3
"""Prova (e, se serve, esecuzione) del ripristino del backup giornaliero di radio-quiz.it.

La Lambda salva ogni giorno alle 08:00 tutta la tabella (account, risultati, classi, impostazioni…)
in s3://<bucket dati>/backup/AAAA-MM-GG.json.gz (90 giorni). Questo strumento usa l'AWS CLI del Mac.

    python3 strumenti/prova_ripristino.py                  # prova sull'ultimo backup
    python3 strumenti/prova_ripristino.py --data 2026-10-08
    python3 strumenti/prova_ripristino.py --ripristina     # riscrive il backup nella tabella vera (chiede conferma)

La prova non tocca la tabella vera: crea una tabella temporanea, ci scrive tutte le voci del backup,
le rilegge e le confronta una per una, poi cancella la tabella e il file scaricato.
Stampa solo conteggi: nessun nome, email o impronta esce sullo schermo.
"""
import gzip, hashlib, json, os, subprocess, sys, tempfile, time

REGIONE = "eu-south-1"
STACK = "QuizRadiologia"


def aws(*args, json_out=True):
    r = subprocess.run(["aws", *args, "--region", REGIONE] + (["--output", "json"] if json_out else []),
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[-400:])
    return json.loads(r.stdout) if json_out and r.stdout.strip() else r.stdout


def risorse():
    out = aws("cloudformation", "describe-stacks", "--stack-name", STACK)["Stacks"][0]["Outputs"]
    bucket = next(o["OutputValue"] for o in out if o["OutputKey"] == "BucketDati")
    tabelle = [t for t in aws("dynamodb", "list-tables")["TableNames"] if t.startswith(STACK + "-Risultati")]
    if len(tabelle) != 1:
        raise RuntimeError(f"tabella non trovata in modo univoco: {tabelle}")
    return bucket, tabelle[0]


def scarica(bucket, data):
    if not data:
        el = aws("s3api", "list-objects-v2", "--bucket", bucket, "--prefix", "backup/").get("Contents", [])
        if not el:
            raise RuntimeError("nessun backup nel bucket")
        chiave = sorted(o["Key"] for o in el)[-1]
    else:
        chiave = f"backup/{data}.json.gz"
    fd, f = tempfile.mkstemp(suffix=".json.gz"); os.close(fd)
    try:
        aws("s3", "cp", f"s3://{bucket}/{chiave}", f, "--only-show-errors", json_out=False)
        d = json.load(gzip.open(f))
    finally:
        os.remove(f)
    return chiave, d


def impronta(v):
    return hashlib.sha256(json.dumps(v, sort_keys=True).encode()).hexdigest()


def conteggi(voci):
    c = {}
    for v in voci:
        k = v["pk"]["S"].split("#")[0]
        c[k] = c.get(k, 0) + 1
    return dict(sorted(c.items()))


def scrivi(tabella, voci):
    for i in range(0, len(voci), 25):
        richiesta = {tabella: [{"PutRequest": {"Item": v}} for v in voci[i:i + 25]]}
        for giro in range(8):
            fd, f = tempfile.mkstemp(suffix=".json"); os.close(fd)
            try:
                with open(f, "w") as h:
                    json.dump(richiesta, h)
                r = aws("dynamodb", "batch-write-item", "--request-items", f"file://{f}")
            finally:
                os.remove(f)
            resto = r.get("UnprocessedItems") or {}
            if not resto:
                break
            richiesta = resto; time.sleep(0.5 * (giro + 1))
        else:
            raise RuntimeError("scrittura incompleta (voci non elaborate)")


def leggi(tabella):
    voci, args = [], ["dynamodb", "scan", "--table-name", tabella]
    while True:
        r = aws(*args)
        voci += r.get("Items", [])
        if not r.get("LastEvaluatedKey"):
            return voci
        args = ["dynamodb", "scan", "--table-name", tabella, "--exclusive-start-key", json.dumps(r["LastEvaluatedKey"])]


def prova(d):
    voci = d["voci"]
    nome = f"{STACK}-ProvaRipristino-{int(time.time())}"
    print(f"Tabella temporanea: {nome}")
    aws("dynamodb", "create-table", "--table-name", nome, "--billing-mode", "PAY_PER_REQUEST",
        "--attribute-definitions", "AttributeName=pk,AttributeType=S", "AttributeName=sk,AttributeType=S",
        "--key-schema", "AttributeName=pk,KeyType=HASH", "AttributeName=sk,KeyType=RANGE")
    try:
        aws("dynamodb", "wait", "table-exists", "--table-name", nome, json_out=False)
        t0 = time.time(); scrivi(nome, voci)
        letti = leggi(nome)
        a = {impronta(v) for v in voci}; b = {impronta(v) for v in letti}
        ok = a == b and len(letti) == len(voci)
        print(f"Scritte {len(voci)} voci in {time.time() - t0:.1f} s, rilette {len(letti)}: " + ("identiche al backup ✓" if ok else f"DIFFERENZE: {len(a - b)} mancanti, {len(b - a)} in più ✗"))
        return ok
    finally:
        aws("dynamodb", "delete-table", "--table-name", nome)
        print("Tabella temporanea cancellata.")


def main():
    a = sys.argv[1:]
    data = a[a.index("--data") + 1] if "--data" in a else None
    bucket, tabella = risorse()
    chiave, d = scarica(bucket, data)
    voci = d.get("voci", [])
    print(f"Backup {chiave} del {d.get('data', '?')[:16]}: {len(voci)} voci {conteggi(voci)}")
    vive = leggi(tabella)
    print(f"Tabella in uso ora: {len(vive)} voci {conteggi(vive)}")
    if "--ripristina" in a:
        print("\nATTENZIONE: le voci del backup verranno riscritte nella tabella in uso (quelle con la stessa chiave sono sostituite;")
        print("quelle create dopo il backup restano). Per procedere scrivi RIPRISTINA:")
        if input("> ").strip() != "RIPRISTINA":
            print("Annullato."); return
        scrivi(tabella, voci)
        print(f"Ripristinate {len(voci)} voci nella tabella {tabella}.")
        return
    ok = prova(d)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
