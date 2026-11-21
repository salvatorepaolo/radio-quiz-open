#!/bin/bash
# sicurezza.sh: controlli di sicurezza del codice, tutti open source e gratuiti, eseguiti anche dentro pubblica.command.
#  1. osv-scanner (Apache-2.0): vulnerabilita' note nelle librerie (package-lock e librerie copiate, elencate in librerie-incluse.json)
#  2. semgrep (LGPL-2.1, regole pubbliche del registro): errori di sicurezza tipici nel codice del sito e del server (XSS, eval, ...)
# Esce con 1 solo per problemi GRAVI (CVSS >= 7 o regola semgrep di livello ERROR); il resto va nel rapporto.
# Rapporto completo: piattaforma-quiz/cloud/.log-sicurezza.txt   Uso: bash piattaforma-quiz/qualita/sicurezza.sh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
Q="$(cd "$(dirname "$0")" && pwd)"; C="$Q/../cloud"; LOG="$C/.log-sicurezza.txt"; TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
: > "$LOG"; GRAVI=0

# ---------- 1. librerie ----------
if command -v osv-scanner >/dev/null; then
  python3 - "$Q/librerie-incluse.json" > "$TMP/package-lock.json" <<'PY'
import json, sys
l = {k: v for k, v in json.load(open(sys.argv[1])).items() if not k.startswith('_')}
print(json.dumps({"name": "librerie-incluse", "lockfileVersion": 3, "packages": {"": {}, **{"node_modules/" + k: {"version": v} for k, v in l.items()}}}))
PY
  ARG=(-L "$TMP/package-lock.json")
  for f in "$C/package-lock.json" "$C/test/package-lock.json" "$C/mpr3d/package-lock.json" "$Q/package-lock.json"; do [ -f "$f" ] && ARG+=(-L "$f"); done
  osv-scanner scan source "${ARG[@]}" --format json > "$TMP/osv.json" 2>>"$LOG"
  python3 - "$TMP/osv.json" >> "$LOG" <<'PY' || GRAVI=1
import json, sys
try: d = json.load(open(sys.argv[1]))
except Exception: print("librerie: osv-scanner non ha risposto (rete?)"); sys.exit(0)
gravi, tutte = 0, []
for r in d.get("results") or []:
    for p in r.get("packages") or []:
        for g in p.get("groups") or []:
            try: s = float(g.get("max_severity") or 0)
            except ValueError: s = 0
            nome = p["package"]["name"] + "@" + p["package"]["version"]
            tutte.append((s, nome, ",".join(g.get("ids", [])[:2]), r.get("source", {}).get("path", "").split("/")[-2]))
            gravi += s >= 7
print(f"librerie: {len(tutte)} vulnerabilita' note, {gravi} gravi (CVSS >= 7)")
for s, n, i, f in sorted(tutte, reverse=True): print(f"  {'GRAVE ' if s >= 7 else ''}{s or '?'}  {n}  {i}  ({f})")
sys.exit(1 if gravi else 0)
PY
else echo "librerie: osv-scanner non installato (brew install osv-scanner)" >> "$LOG"; fi

# ---------- 2. codice ----------
if command -v semgrep >/dev/null; then
  (cd "$C" && semgrep scan --metrics=off --quiet --config p/javascript --config p/nodejs --config p/xss \
     --exclude lib --exclude 'modelli-ia' --exclude '*.bak*' --exclude node_modules --exclude cdk.out --exclude mpr3d --exclude test \
     --exclude backup_vista --max-target-bytes 0 --timeout 60 --json -o "$TMP/sg.json" web api >/dev/null 2>>"$LOG")
  python3 - "$TMP/sg.json" >> "$LOG" <<'PY' || GRAVI=1
import json, sys
try: d = json.load(open(sys.argv[1]))
except Exception: print("codice: semgrep non ha risposto (rete per scaricare le regole?)"); sys.exit(0)
r = d.get("results", []); g = [x for x in r if x["extra"]["severity"] == "ERROR"]
print(f"codice: {len(d['paths']['scanned'])} file, {len(r)} segnalazioni, {len(g)} gravi")
for x in r: print(f"  {'GRAVE ' if x in g else ''}{x['check_id'].split('.')[-1]}  {x['path']}:{x['start']['line']}")
sys.exit(1 if g else 0)
PY
else echo "codice: semgrep non installato (brew install semgrep)" >> "$LOG"; fi

cat "$LOG"
exit $GRAVI
