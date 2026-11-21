import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1108scaleref')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:100], s.count(a)); s = s.replace(a, b)

# «Copia nel referto» anche quando la scala non ha un punteggio (solo testo), e con i dati inseriti, non solo la frase finale
sost("""      $('#scala-esito').innerHTML = (r ? `<div class="scala-valore">${esc(r.testo)}</div>${r.valore !== '' ? '<button type="button" class="ghost" id="scala-copia" title="Aggiunge la frase al referto libero">Copia nel referto</button>' : ''}`""",
     """      $('#scala-esito').innerHTML = (r ? `<div class="scala-valore">${esc(r.testo)}</div><button type="button" class="ghost" id="scala-copia" title="Aggiunge al referto il risultato e i dati inseriti nella scala (con i disegni compilati)">Copia nel referto</button>`""")
# dati compilati della scala: «campo: valore» per ogni voce visibile e compilata
sost("""    const leggi = () => {
      for (const c of S.campi) {""", """    const datiCompilati = () => S.campi.filter((c) => !$(`#scala-corpo [data-campo="${c.id}"]`)?.hidden).map((c) => {
      const x = v[c.id];
      if (x == null || x === '' || (Array.isArray(x) && !x.length)) return null;
      if (MAPPA(c)) { const t = $(`#scala-corpo [data-mappa-testo="${c.id}"]`)?.textContent?.trim(); return t ? [c.nome, t] : null; }
      if (c.tipo === 'mm') return [c.nome, `${virgola(+x, x % 1 ? 1 : 0)} mm`];
      if (c.tipo === 'num') return [c.nome, `${String(x).replace('.', ',')}${c.unita ? ' ' + c.unita : ''}`];
      const nomeDi = (val) => (c.scelte || []).find(([w]) => String(w) === String(val))?.[1] ?? String(val);
      return [c.nome, Array.isArray(x) ? x.map(nomeDi).join(', ') : nomeDi(x)];
    }).filter(Boolean);
    const leggi = () => {
      for (const c of S.campi) {""")
sost("""          aggiungiAlEditor(`<p>${esc(r.testo)}</p>`);""",
     """          const dati = datiCompilati();
          aggiungiAlEditor(`<p><b>${esc(S.nome.replace(/ \\(.*/, ''))}</b>: ${esc(r.testo)}</p>${dati.length ? `<ul>${dati.map(([n, x]) => `<li>${esc(n)}: ${esc(x)}</li>`).join('')}</ul>` : ''}`);""")
sost("""        const t = $('#q-referto'); if (!t) return; t.value = (t.value.trim() ? t.value.trim() + '\\n' : '') + r.testo; t.closest('details')?.setAttribute('open', ''); T.misure++; });""",
     """        const t = $('#q-referto'); if (!t) return; const dati = datiCompilati();
        t.value = (t.value.trim() ? t.value.trim() + '\\n' : '') + `${S.nome.replace(/ \\(.*/, '')}: ${r.testo}` + dati.map(([n, x]) => `\\n- ${n}: ${x}`).join(''); t.closest('details')?.setAttribute('open', ''); T.misure++; });""")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
