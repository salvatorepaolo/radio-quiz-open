import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A, H, C = W + 'app.js', W + 'index.html', W + 'style.css'
for f in (A, H, C): shutil.copy(f, f + '.bak_1107a11y')
def sost(s, a, b, n=1):
    assert s.count(a) == n, (a[:80], s.count(a)); return s.replace(a, b)

h = open(H, encoding='utf-8').read()
# ricerca: combobox con aria-expanded (aggiornato dallo script) e nome accessibile
h = sost(h, 'autocomplete="off" role="combobox" aria-controls="chip-quesiti">', 'autocomplete="off" role="combobox" aria-controls="chip-quesiti" aria-expanded="false" aria-autocomplete="list" aria-label="Cerca casi per sospetto clinico, distretto o titolo">')
h = sost(h, '<select id="gc-stato">', '<select id="gc-stato" aria-label="Stato dei casi">')
h = sost(h, '<select id="gc-metodica">', '<select id="gc-metodica" aria-label="Metodica">')
h = sost(h, '<select id="gc-distretto">', '<select id="gc-distretto" aria-label="Distretto">')
h = sost(h, '<input type="checkbox" id="gc-tutti">', '<input type="checkbox" id="gc-tutti" aria-label="Seleziona tutti i casi dell\'elenco">')
h = sost(h, '<select id="inv-ruolo">', '<select id="inv-ruolo" aria-label="Ruolo">')
open(H, 'w', encoding='utf-8').write(h)

s = open(A, encoding='utf-8').read()
s = sost(s, "$('#cerca').addEventListener('blur', () => { $('#chip-quesiti').hidden = true; });",
 """$('#cerca').addEventListener('blur', () => { $('#chip-quesiti').hidden = true; });
// accessibilità: aria-expanded della ricerca segue la lista dei suggerimenti
new MutationObserver(() => $('#cerca').setAttribute('aria-expanded', String(!$('#chip-quesiti').hidden))).observe($('#chip-quesiti'), { attributes: true, attributeFilter: ['hidden'] });""")
# linguette degli studi: role="tab" e aria-selected
s = sost(s, """    return `<button data-n="${esc(st.id)}" class="${/Pregresso/.test(e) ? 'pregresso' : 'attuale'}${V.studi.length === 1 ? ' on' : ''}">""",
 """    return `<button role="tab" aria-selected="${V.studi.length === 1}" data-n="${esc(st.id)}" class="${/Pregresso/.test(e) ? 'pregresso' : 'attuale'}${V.studi.length === 1 ? ' on' : ''}">""")
s = sost(s, "  qsAll('#tab-studi button').forEach((b) => b.classList.toggle('on', b.dataset.n === id));",
 "  qsAll('#tab-studi button').forEach((b) => { b.classList.toggle('on', b.dataset.n === id); b.setAttribute('aria-selected', String(b.dataset.n === id)); });")
# gestione casi: casella di ogni riga con il nome del caso
s = sost(s, """<td><input type="checkbox" data-id="${esc(c.id)}" ${GC.sel.has(c.id) ? 'checked' : ''}></td>""",
 """<td><input type="checkbox" data-id="${esc(c.id)}" aria-label="Seleziona ${esc(c.titolo_interno || c.titolo || c.id)}" ${GC.sel.has(c.id) ? 'checked' : ''}></td>""")
# maniglia del foglio sul telefono: niente role=button attorno ai due pulsanti (comandi annidati)
s = sost(s, "m.className = 'q-maniglia'; m.setAttribute('role', 'button'); m.title", "m.className = 'q-maniglia'; m.title")
open(A, 'w', encoding='utf-8').write(s)

c = open(C, encoding='utf-8').read()
# contrasto (WCAG AA 4,5:1) nel tema chiaro: blu e ambra un poco più scuri, etichette delle metodiche con testo scuro
c = sost(c, '  --acc:#1f6fd1;--ok:#13804f;--ko:#c62f2f;--warn:#a96a00;', '  --acc:#1a62bb;--ok:#13804f;--ko:#c62f2f;--warn:#8a5600;')
c += """
/* accessibilità: contrasto delle etichette delle metodiche nel tema chiaro (testo = colore della metodica scurito) */
:root[data-tema="chiaro"] .met-pill{color:color-mix(in srgb,var(--m) 45%,#000)}
:root[data-tema="chiaro"] .gc-tab .gc-prob{color:#7a4b00}
"""
open(C, 'w', encoding='utf-8').write(c)
print('ok')
