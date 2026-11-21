import sys
W = sys.argv[1]
src = open(W + '/app.js', encoding='utf-8').read()
def rep(old, new, count=1):
    global src
    n = src.count(old); assert n == count, (n, old[:90]); src = src.replace(old, new)

rep("let DOCENTE = new URLSearchParams(location.search).has('docente');",
"""let DOCENTE = new URLSearchParams(location.search).has('docente');
// versione client (visualizzatore da installare, offline): /client/ o ?client. Niente accesso, niente server
const CLIENT = location.pathname.startsWith('/client/') || new URLSearchParams(location.search).has('client');
const CL = { studio: null, voci: [], nFin: 0, canale: null, installa: null };
if (CLIENT) document.documentElement.classList.add('client');""")
rep("async function chiSono() {\n  try {", "async function chiSono() {\n  if (CLIENT) return true;                                  // versione client: nessun account\n  try {")
rep("  const [, tipo, id] = location.hash.split('/');\n", "  const [, tipo, id] = location.hash.split('/');\n  if (CLIENT) return routerClient(tipo);\n", 1)
rep("async function apriCaso(id) {", "async function apriCaso(id, locale = null) {")
rep("  const caso = await getJSON(`/api/casi/${id}`); if (vecchia()) return;", "  const caso = locale ? locale.caso : await getJSON(`/api/casi/${id}`); if (vecchia()) return;")
rep("  const serie = await getJSON(`/casi/${id}/serie.json`, { cache: 'no-store' }); if (vecchia()) return;",
    "  const serie = locale ? structuredClone(locale.serie) : await getJSON(`/casi/${id}/serie.json`, { cache: 'no-store' }); if (vecchia()) return;")
rep("  BUF.clear();\n  const divise = await dividiPerPiano(", "  BUF.clear(); if (locale) for (const [u, b] of locale.buf) BUF.set(u, b);\n  const divise = await dividiPerPiano(")
rep("  renderQuiz(); mostraModoCasuale(); mostraGiro(); aggiornaWorkspaceMG(); aggiornaWorkspaceFasi();",
    "  if (!CLIENT) { renderQuiz(); mostraModoCasuale(); mostraGiro(); } aggiornaWorkspaceMG(); aggiornaWorkspaceFasi();")
rep("'esame', 'errore', 'confronto']) $(`#vista-${v}`).hidden = v !== nome;", "'esame', 'errore', 'confronto', 'client']) $(`#vista-${v}`).hidden = v !== nome;")
# esportazione senza scritte
rep("""    disegnaFusione(k, g);
    disegnaMisure(k, g);""", """    disegnaFusione(k, g);
    if (!V.senzaScritte) disegnaMisure(k, g);""")
rep("""    disegnaPunto(k, g);
    disegnaCollegato(k, g);
    disegnaSegno(k, g);""", """    if (!V.senzaScritte) { disegnaPunto(k, g); disegnaCollegato(k, g); disegnaSegno(k, g); }""")
rep("""  if (img) disegnaRiferimento(k);
  disegnaEtichette(k);""", """  if (img && !V.senzaScritte) disegnaRiferimento(k);
  if (!V.senzaScritte) disegnaEtichette(k);""")
# finestre collegate: la posizione del riquadro attivo va alle altre finestre
rep("""    if (V.confronto && V.sincro && sincro) sincronizzaDa(k);
    if (FUS.attiva) aggiornaFusione(k);""", """    if (V.confronto && V.sincro && sincro) sincronizzaDa(k);
    if (CLIENT && sincro && k === V.attivo) clientInvia(p);
    if (FUS.attiva) aggiornaFusione(k);""")

CLIENTJS = open(W + '/../../../strumenti_claude/patch/client_parte.js', encoding='utf-8').read()
rep("if (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) && location.search.includes('prova')) window.__dbg = {",
    CLIENTJS + "\nif (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) && (location.search.includes('prova') || CLIENT)) window.__dbg = { CL, caricaClient, esportaClient,")
open(W + '/app.js', 'w', encoding='utf-8').write(src)
print('ok app')
