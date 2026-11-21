import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
def sost(testo, vecchio, nuovo, nome):
    n = testo.count(vecchio)
    if n != 1: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)
# RM cardiaca: «Modello di referto» e «Copia nel referto» vanno nell'editor del referto (nel client il campo del quiz è nascosto)
a = open(R + 'web/app.js', encoding='utf-8').read()
a = sost(a, "  $('#cmr-modello').onclick = () => { const q = $('#q-referto'); if (!q) return; q.value = (q.value.trim() ? q.value.trim() + '\\n\\n' : '') + modelloRefertoCmr(ris); q.closest('details')?.setAttribute('open', ''); };",
  "  $('#cmr-modello').onclick = () => cmrAlReferto(modelloRefertoCmr(ris), true);", 'cmr modello')
a = sost(a, "  $('#cmr-copia')?.addEventListener('click', () => { const q = $('#q-referto'); if (!q) return; q.value = (q.value.trim() ? q.value.trim() + '\\n' : '') + ris.righe.join('. ') + '.'; q.closest('details')?.setAttribute('open', ''); });",
  "  $('#cmr-copia')?.addEventListener('click', () => cmrAlReferto(ris.righe.join('. ') + '.', false));", 'cmr copia')
a = sost(a, "function inserisciNelReferto(testo) {",
  "// RM cardiaca → referto: nell'editor (client, o editor aperto sulla piattaforma), altrimenti nel campo del quiz\n"
  "async function cmrAlReferto(testo, aCapo) {\n"
  "  if (CLIENT && !$('#dlg-referto')?.open) await apriReferto();\n"
  "  if ($('#dlg-referto')?.open) { aggiungiAlEditor(String(testo).split('\\n').filter((r) => r.trim()).map((r) => `<p>${esc(r)}</p>`).join('')); salvaBozzaReferto(); avvisoBreve('Inserito nel referto.'); return; }\n"
  "  const q = $('#q-referto'); if (!q) return;\n"
  "  q.value = (q.value.trim() ? q.value.trim() + (aCapo ? '\\n\\n' : '\\n') : '') + testo; q.closest('details')?.setAttribute('open', ''); q.dispatchEvent(new Event('input', { bubbles: true }));\n"
  "}\n"
  "function inserisciNelReferto(testo) {", 'cmr funzione')
open(R + 'web/app.js', 'w', encoding='utf-8').write(a)
en = json.load(open(R + 'web/lingua/en.json', encoding='utf-8'))
en.setdefault('Inserito nel referto.', 'Added to the report.')
json.dump(en, open(R + 'web/lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('cmr OK')
