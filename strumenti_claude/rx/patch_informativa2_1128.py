#!/usr/bin/env python3
# 28/11 (2): informativa — dove arriva la posta di privacy@/info@ e quanto restano i dati nelle copie di sicurezza.
import json, os, shutil, sys
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
P = {
 W + 'aiuto.json': [
  ("coperti dalle clausole contrattuali standard.",
   "coperti dalle clausole contrattuali standard. Le email scritte a privacy@radio-quiz.it e info@radio-quiz.it arrivano su Amazon SES, "
   "dove restano 30 giorni, e vengono inoltrate alla casella personale del titolare su Gmail (Google), che aderisce al Data Privacy Framework UE-USA."),
  ("restano solo in forma anonima, per le statistiche dei casi.",
   "restano solo in forma anonima, per le statistiche dei casi. I dati cancellati spariscono anche dalle copie di sicurezza: dal ripristino "
   "del database dopo 35 giorni, dalle copie giornaliere al più tardi dopo 4 mesi. I registri tecnici del server si cancellano dopo 30 giorni."),
 ],
 W + 'lingua/en/aiuto.json': [
  ("covered by the standard contractual clauses.",
   "covered by the standard contractual clauses. Emails sent to privacy@radio-quiz.it and info@radio-quiz.it arrive at Amazon SES, "
   "where they are kept for 30 days, and are forwarded to the controller's personal Gmail mailbox (Google), which participates in the EU-US Data Privacy Framework."),
  ("remain only in anonymous form, for case statistics.",
   "remain only in anonymous form, for case statistics. Deleted data also disappear from the backups: from database restore "
   "after 35 days, from the daily copies at the latest after 4 months. Server technical logs are deleted after 30 days."),
 ],
}
for path, pairs in P.items():
    t = open(path, encoding='utf-8').read()
    for o, n in pairs:
        if n in t: print('già fatto'); continue
        if t.count(o) != 1: sys.exit(f'non trovato ({t.count(o)}) in {path}: {o}')
        t = t.replace(o, n)
    json.loads(t)
    if not os.path.exists(path + '.bak_1128leg2'): shutil.copy(path, path + '.bak_1128leg2')
    open(path, 'w', encoding='utf-8').write(t); print('ok', path)
