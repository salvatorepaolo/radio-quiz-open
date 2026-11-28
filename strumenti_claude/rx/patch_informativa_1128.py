#!/usr/bin/env python3
# 28/11: informativa aggiornata con le funzioni nuove (caso della settimana, avvisi ai revisori,
# prova senza iscrizione, conteggio della provenienza) e testo dell'atlante in licenze.html.
import json, shutil, sys
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'

IT2_OLD = "email di servizio (conferma, nuova password, compiti e promemoria; questi ultimi disattivabili dal profilo)."
IT2_NEW = ("email di servizio (conferma, nuova password, compiti e promemoria, e per docenti e autori l'elenco dei casi da rivedere; "
           "questi ultimi disattivabili dal profilo). Solo se lo chiedi con la casella all'iscrizione, l'email del «caso della settimana» "
           "(consenso, art. 6.1.a): la revochi in ogni momento con il link in fondo a ogni email.")
EN2_OLD = "service emails (confirmation, new password, assignments and reminders; the latter can be turned off from the profile)."
EN2_NEW = ("service emails (confirmation, new password, assignments and reminders, and for teachers and authors the list of cases to review; "
           "the latter can be turned off from the profile). Only if you ask for it with the box at registration, the “case of the week” email "
           "(consent, art. 6.1.a): you can withdraw it at any time with the link at the bottom of every email.")

IT10_OLD = "senza collegarli alla persona."
IT10_NEW = ("senza collegarli alla persona; allo stesso modo conta, come totali, da quale link si arriva (per esempio un post sui social) "
            "e quante iscrizioni ne nascono. Chi prova un caso senza iscriversi riceve solo il cookie tecnico per vederne le immagini; "
            "le sue risposte non vengono salvate.")
EN10_OLD = "without linking them to the person."
EN10_NEW = ("without linking them to the person; in the same way it counts, as totals, which link visitors come from (for example a social media post) "
            "and how many registrations follow. Anyone who tries a case without registering only receives the technical cookie needed to view its images; "
            "their answers are not saved.")

for path, pairs in ((W + 'aiuto.json', ((IT2_OLD, IT2_NEW), (IT10_OLD, IT10_NEW))),
                    (W + 'lingua/en/aiuto.json', ((EN2_OLD, EN2_NEW), (EN10_OLD, EN10_NEW)))):
    t = open(path, encoding='utf-8').read()
    for o, n in pairs:
        if n in t: print('già fatto', path); continue
        if t.count(o) != 1: sys.exit(f'non trovato in {path}: {o[:40]}')
        t = t.replace(o, n)
    json.loads(t)
    if not __import__('os').path.exists(path + '.bak_1128leg'): shutil.copy(path, path + '.bak_1128leg')
    open(path, 'w', encoding='utf-8').write(t); print('ok', path)

L = W + 'licenze.html'
t = open(L, encoding='utf-8').read()
o = "riferimento per adattare l'atlante arterioso: si distribuiscono solo i centri delle strutture calcolati sul template"
n = "riferimento per adattare gli atlanti: si distribuiscono le strutture calcolate sul template (ricampionate a 2 mm) e i loro centri, non il template"
if n not in t:
    if t.count(o) != 1: sys.exit('licenze: riga non trovata')
    shutil.copy(L, L + '.bak_1128leg'); open(L, 'w', encoding='utf-8').write(t.replace(o, n)); print('ok licenze')
