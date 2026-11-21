#!/usr/bin/env python3
"""Mette in bozza i casi con risultati IA discordanti dal testo e scrive nella nota del docente cosa controllare.
Legge il codice dell'amministratore da cloud/.segreti (non lo stampa). Uso: python3 strumenti/bozze_ia.py cloud/cdk.out/dubbi.json"""
import json, os, re, sys, urllib.request, http.cookiejar
BASE = "https://radio-quiz.it"
radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seg = open(os.path.join(radice, "cloud", ".segreti")).read()
codice = re.search(r'^\s*CODICE_AMMINISTRATORE="?([^"\n]+)"?', seg, re.M).group(1)
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def chiama(metodo, percorso, dati=None):
    r = urllib.request.Request(BASE + percorso, method=metodo, data=json.dumps(dati).encode() if dati is not None else None,
                               headers={"content-type": "application/json", "user-agent": "radio-quiz-strumenti"})
    with op.open(r, timeout=30) as f:
        return json.loads(f.read() or b"null")
chiama("POST", "/api/accesso", {"codice": codice})
dubbi = json.load(open(sys.argv[1]))
for cid, x in dubbi.items():
    c = chiama("GET", f"/api/casi/{cid}/completo")
    nota = c.get("nota_docente") or ""
    nota = re.sub(r"DA CONTROLLARE \(analisi IA[\s\S]*?FINE CONTROLLO IA\.\n*", "", nota)
    testo = ("DA CONTROLLARE (analisi IA del 10/10/2026): l'IA ha trovato reperti che il testo del caso non cita. "
             "Guarda le immagini (MPR, «IA: misure automatiche», gruppo «Reperti trovati dall'IA»): se il reperto c'è, aggiungilo al testo e alle risposte; "
             "se è un falso positivo, ignoralo. Poi togli questa nota e rimetti il caso visibile.\n- " + "\n- ".join(x["dubbi"]) + "\nFINE CONTROLLO IA.\n\n")
    c["nota_docente"] = (testo + nota).strip()[:5000]
    c["visibile"] = False
    chiama("POST", f"/api/casi/{cid}", c)
    print(f"{cid}: in bozza, {len(x['dubbi'])} punti da controllare")
