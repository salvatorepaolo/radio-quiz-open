#!/usr/bin/env python3
"""Confronta i casi online (API, come amministratore) con i caso.json locali e con i controlli di completezza.
Non stampa il codice dell'amministratore. Con --allinea riporta nei caso.json locali visibilità e nota del docente di quelli online.
Uso: python3 strumenti/confronta_online.py [--allinea]"""
import json, os, re, sys, urllib.request, http.cookiejar
BASE = "https://radio-quiz.it"
# cartella dei casi: «casi», oppure «casi-free» (quella usata dalla pubblicazione del sito gratuito)
radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARTELLA_CASI = os.environ.get("CASI") or ("casi" if os.path.isdir(os.path.join(radice, "casi")) else "casi-free")
codice = re.search(r'^\s*CODICE_AMMINISTRATORE="?([^"\n]+)"?', open(os.path.join(radice, "cloud", ".segreti")).read(), re.M).group(1)
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def chiama(m, p, d=None):
    r = urllib.request.Request(BASE + p, method=m, data=json.dumps(d).encode() if d is not None else None, headers={"content-type": "application/json", "user-agent": "radio-quiz-strumenti"})
    return json.loads(op.open(r, timeout=30).read() or b"null")
chiama("POST", "/api/accesso", {"codice": codice})
elenco = chiama("GET", "/api/casi")
online = {c["id"]: c for c in elenco}
locali = sorted(d for d in os.listdir(os.path.join(radice, CARTELLA_CASI)) if d.startswith("caso-") and os.path.exists(os.path.join(radice, CARTELLA_CASI, d, "caso.json")))
print(f"online {len(online)} casi ({sum(1 for c in elenco if c.get('visibile') is False)} bozze), locali {len(locali)}")
solo_loc = [c for c in locali if c not in online]; solo_on = [c for c in online if c not in locali]
if solo_loc: print("solo in locale:", solo_loc)
if solo_on: print("solo online:", solo_on)
allinea = "--allinea" in sys.argv
diff = {}
for cid in locali:
    if cid not in online: continue
    c = chiama("GET", f"/api/casi/{cid}/completo")
    p = os.path.join(radice, CARTELLA_CASI, cid, "caso.json"); l = json.load(open(p))
    d = [k for k in ("titolo", "visibile", "nota_docente", "spiegazione", "domanda", "modalita", "distretto") if (l.get(k) if k != "visibile" else l.get(k) is not False) != (c.get(k) if k != "visibile" else c.get(k) is not False)]
    if len(l.get("opzioni") or []) != len(c.get("opzioni") or []): d.append("opzioni")
    if d: diff[cid] = d
    if allinea and any(k in d for k in ("visibile", "nota_docente")):
        l["visibile"] = c.get("visibile", True)
        if c.get("nota_docente"): l["nota_docente"] = c["nota_docente"]
        json.dump(l, open(p, "w"), ensure_ascii=False, indent=1)
for cid, d in diff.items(): print(f"{cid}: diverso in {', '.join(d)}")
# controlli di completezza dei casi visibili (come in Gestione → Casi)
avvisi = [(c["id"], c.get("controlli")) for c in elenco if c.get("visibile") is not False and c.get("controlli")]
for cid, a in avvisi: print(f"{cid} (visibile): {'; '.join(a)}")
print("fine")
