# patch_ingressi_client_1127.py: provenienza (client), passaparola più visibile, link dei casi da mandare a un collega,
# attestato in evidenza a fine percorso, dashboard (provenienze e casi da condividere). web/app.js, gestione-sito.js, style.css.
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'


def patch(nome, coppie):
    f = W + nome; s = open(f).read()
    for a, b in coppie:
        assert s.count(a) == 1, (nome, a[:90], s.count(a))
        s = s.replace(a, b)
    open(f, 'w').write(s)


ORIGINE = r"""
// 27/11: provenienza della visita, solo alla prima pagina della sessione: etichetta «?da=» del link (anche dopo il #,
// che si toglie subito dall'indirizzo) o categoria del sito di origine (instagram, google…); mai l'indirizzo completo
const ORIGINE = (() => {
  if (CLIENT) return '';
  let da = '';
  try { da = new URLSearchParams(location.search).get('da') || ''; } catch {}
  const h = location.hash, i = h.indexOf('?');
  if (i >= 0) { try { da = da || new URLSearchParams(h.slice(i + 1)).get('da') || ''; } catch {} history.replaceState(null, '', location.pathname + location.search + h.slice(0, i)); }
  let o = String(da).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  if (!o) {
    let host = ''; try { host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch {}
    const interno = host && (host === location.hostname || host.endsWith('.radio-quiz.it'));
    const ORIG = [[/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)facebook\.com$|(^|\.)fb\.com$|^fb\.me$/, 'facebook'], [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'linkedin'],
      [/(^|\.)whatsapp\.(com|net)$|^wa\.me$/, 'whatsapp'], [/^t\.me$|(^|\.)telegram\.org$/, 'telegram'], [/(^|\.)google\.[a-z.]+$/, 'google'], [/(^|\.)bing\.com$/, 'bing'],
      [/(^|\.)duckduckgo\.com$/, 'duckduckgo'], [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, 'x'], [/(^|\.)reddit\.com$/, 'reddit'], [/^news\.ycombinator\.com$/, 'hackernews'],
      [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube'], [/(^|\.)github\.com$/, 'github'], [/(^|\.)tiktok\.com$/, 'tiktok']];
    o = interno ? '' : !host ? 'diretto' : (ORIG.find(([r]) => r.test(host)) || [null, 'altro-sito'])[1];
  }
  try { if (o && !sessionStorage.getItem('rq-origine')) sessionStorage.setItem('rq-origine', o); return sessionStorage.getItem('rq-origine') || o; } catch { return o; }
})();
"""

patch('app.js', [
    # provenienza: calcolata prima del primo router()
    ("""  'gestione-casi', 'classi', 'percorsi', 'revisione', 'account']);""",
     """  'gestione-casi', 'classi', 'percorsi', 'revisione', 'account']);""" + ORIGINE),
    ("""  try { fetch('/api/visita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p, c, s, m }), keepalive: true, credentials: 'same-origin' }).catch(() => {}); } catch {}""",
     """  try { fetch('/api/visita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p, c, s, m, ...(s && ORIGINE ? { o: ORIGINE } : {}) }), keepalive: true, credentials: 'same-origin' }).catch(() => {}); } catch {}"""),
    ("""    docente: $('#isc-docente').checked, settimana: $('#isc-settimana')?.checked === true,""",
     """    docente: $('#isc-docente').checked, settimana: $('#isc-settimana')?.checked === true, da: ORIGINE,"""),
    ("""    privacy: $('#gg-privacy').checked, maggiorenne: $('#gg-maggiorenne').checked });""",
     """    privacy: $('#gg-privacy').checked, maggiorenne: $('#gg-maggiorenne').checked, da: ORIGINE });"""),
    # passaparola: dopo una buona risposta in evidenza; casi di prova: link da mandare a un collega
    ("""    const box = document.createElement('div'); box.className = 'esito-condividi';
    box.innerHTML = `<button type="button" class="ghost" id="btn-sfida-caso">🏁 Sfida un amico su questo caso</button>""",
     """    const box = document.createElement('div'); box.className = 'esito-condividi' + (r.punteggio >= 70 ? ' forte' : '');
    // 27/11: dopo una buona risposta il passaparola in evidenza (ogni sfida è un link mandato a un collega)
    box.innerHTML = `${r.punteggio >= 70 ? `<p class="ec-tit"><b>${r.perfetta ? 'Risposta esatta!' : 'Bel risultato!'}</b> Sfida un collega su questo caso: vediamo chi lo legge meglio.</p>` : ''}<button type="button" class="${r.punteggio >= 70 ? 'primary' : 'ghost'}" id="btn-sfida-caso">🏁 Sfida un amico su questo caso</button>"""),
    ("""      if (!OSPITE) aggiungiCondivisioneCaso(r);
      dopoRispostaGuidata();""",
     """      if (!OSPITE) aggiungiCondivisioneCaso(r);
      dopoRispostaGuidata(); aggiungiMandaCaso();"""),
    # fine del percorso: attestato in evidenza
    ("""  if (!dopo) { scriviSessione('quiz-giro', null); avvisoElenco = `${{ ripasso: 'Ripasso', compito: 'Compito', percorso: 'Percorso' }[g.tipo]} «${g.titolo}» completato.`; location.hash = '#/'; return true; }""",
     """  if (!dopo) { scriviSessione('quiz-giro', null); avvisoElenco = `${{ ripasso: 'Ripasso', compito: 'Compito', percorso: 'Percorso' }[g.tipo]} «${g.titolo}» completato.`; if (g.tipo === 'percorso') scriviSessione('quiz-attestato', g.id); location.hash = '#/'; return true; }"""),
    ("""  disegnaElenco(); numeriHome(); iniziaQui(); mostraSponsor($('#sponsor-home'), 'home');""",
     """  disegnaElenco(); numeriHome(); iniziaQui(); attestatoPronto(); mostraSponsor($('#sponsor-home'), 'home');"""),
    ("""// revisione dei casi (pagina «Revisione delle bozze», in testa per il revisore)""",
     r"""// 27/11: casi di prova (si aprono senza iscrizione): «Manda il caso a un collega» con il link per i social /c/<caso>
function aggiungiMandaCaso() {
  if (CLIENT || AZIENDA() || !V.caso) return;
  elencoProva().then((p) => {
    if (!p.casi.some((c) => c.id === V.caso?.id) || qs1('#q-esito .manda-caso')) return;
    const dopo = qs1('#q-esito .esito-condividi') || qs1('#q-esito .guida-dopo') || qs1('#q-esito .esito-azioni') || qs1('#q-esito .esito-testa'); if (!dopo) return;
    const url = `${location.origin}/c/${V.caso.id}?da=amico`, testo = `${V.caso.titolo || 'Un caso di radiologia'}: che cosa vedi? Si apre senza iscriversi.`;
    const d = document.createElement('div'); d.className = 'manda-caso';
    d.innerHTML = `<button type="button" class="ghost" data-manda>🔗 Manda il caso a un collega</button><span class="muted small">Lo apre subito, anche senza account.</span><span class="stato small" data-msg></span>`;
    d.querySelector('[data-manda]').onclick = async () => {
      if (navigator.share) { try { await navigator.share({ title: 'Quiz Radiologia', text: testo, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${testo} ${url}`); d.querySelector('[data-msg]').textContent = 'Link copiato: incollalo in un messaggio.'; } catch { d.querySelector('[data-msg]').textContent = url; }
    };
    dopo.after(d);
  }).catch(() => {});
}
// 27/11: percorso appena finito: attestato e LinkedIn in evidenza in testa alla home
function attestatoPronto() {
  const id = leggiSessione('quiz-attestato', null); qs1('#attestato-pronto')?.remove();
  if (!id || !UTENTE) return;
  const p = PERCORSI.find((x) => x.id === id); if (!p) return;
  const box = document.createElement('div'); box.id = 'attestato-pronto'; box.className = 'attestato-pronto';
  box.innerHTML = `<p><b>🎓 Hai completato il percorso «${esc(p.titolo)}».</b> Scarica l'attestato e aggiungilo al tuo profilo LinkedIn: dalla pagina dell'attestato un clic.</p><p class="riga"><button type="button" class="primary" data-att>🎓 Apri l'attestato</button> <button type="button" class="ghost" data-chiudi>Più tardi</button></p>`;
  box.querySelector('[data-att]').onclick = () => { scriviSessione('quiz-attestato', null); box.remove(); apriAttestato(p); };
  box.querySelector('[data-chiudi]').onclick = () => { scriviSessione('quiz-attestato', null); box.remove(); };
  const prima = $('#lista-casi'); if (prima) prima.before(box);
}
// revisione dei casi (pagina «Revisione delle bozze», in testa per il revisore)"""),
])

patch('gestione-sito.js', [
    ("""    h += trImbuto(d.imbuto);""",
     """    h += trImbuto(d.imbuto) + trProvenienze(d.provenienze) + await trCondividi();"""),
    ("""// 27/11: dalla visita al primo caso""",
     r"""// 27/11: da dove arrivano le visite (prima pagina della sessione) e le iscrizioni
const NOMI_ORIGINI = { instagram: 'Instagram', 'instagram-bio': 'Instagram (link nella bio)', facebook: 'Facebook', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', telegram: 'Telegram',
  google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', x: 'X (Twitter)', reddit: 'Reddit', hackernews: 'Hacker News', youtube: 'YouTube', github: 'GitHub', tiktok: 'TikTok',
  amico: 'Link mandato da un iscritto', diretto: 'Diretto (indirizzo scritto, app, link senza etichetta)', 'altro-sito': 'Altri siti', 'link-caso': 'Link a un caso (origine non nota)' };
function trProvenienze(l) {
  if (!Array.isArray(l)) return '';
  const righe = l.map((x) => `<tr><td>${A.esc(NOMI_ORIGINI[x.da] || x.da)}</td><td class="n">${trNum(x.visite)}</td><td class="n">${trNum(x.iscrizioni)}</td><td class="n">${x.visite ? trNum(100 * x.iscrizioni / x.visite, 1) : '–'}</td></tr>`).join('');
  return `<div class="tr-box" style="margin-bottom:14px"><h3>Da dove arrivano</h3>${l.length ? `<table class="tab"><thead><tr><th>Provenienza</th><th>Visite</th><th>Iscrizioni</th><th>Iscrizioni ogni 100 visite</th></tr></thead><tbody>${righe}</tbody></table>` : '<p class="muted small">Ancora nessun dato: i conteggi partono dal 27/11/2026.</p>'}
    <p class="muted small">Dalla prima pagina di ogni visita: l'etichetta del link (<code>?da=…</code>) o il sito di provenienza (solo la categoria, mai l'indirizzo). WhatsApp e molte app non dicono da dove arriva la visita: usa i link con l'etichetta, qui sotto.</p></div>`;
}
// 27/11: casi di prova da condividere: link con l'anteprima per i social (/c/<caso>) e testo pronto, per canale
async function trCondividi() {
  let p; try { p = await A.getJSON('/api/prova'); } catch { return ''; }
  if (!p?.casi?.length) return '';
  const o = location.origin, CANALI = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['whatsapp', 'WhatsApp']];
  const riga = (c) => `<li class="cd-caso"><img src="/img/condividi/${A.esc(c.id)}.jpg" alt="" width="72" height="72" loading="lazy"><div><b>${A.esc(c.titolo)}</b>${c.id === p.giorno ? ' <span class="badge">caso del giorno</span>' : ''}<div class="muted small">${A.esc(c.domanda || '')}</div>
    <div class="cd-az">${CANALI.map(([k, n]) => `<button type="button" class="ghost" data-copia="${A.esc(`${o}/c/${c.id}?da=${k}`)}">🔗 ${n}</button>`).join('')}<button type="button" class="ghost" data-copia="${A.esc(`${c.titolo}: che cosa vedi? ${c.domanda || ''} Prova il caso senza iscriverti: ${o}/c/${c.id}?da=social`)}">📝 Testo del post</button></div></div></li>`;
  return `<div class="tr-box cd-box" style="margin-bottom:14px"><h3>Casi da condividere</h3><p class="muted small">Si aprono senza iscrizione. Il link <code>/c/…</code> mostra sui social l'immagine e la domanda del caso, e conta da dove arrivano le visite. Link per la bio di Instagram: <button type="button" class="ghost" data-copia="${A.esc(`${o}/?da=instagram-bio#/prova`)}">🔗 copia</button> <span class="stato small" id="cd-msg"></span></p><ul class="cd-lista">${p.casi.map(riga).join('')}</ul></div>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest?.('.cd-box [data-copia]'); if (!b) return;
  const m = A.$('#cd-msg');
  try { await navigator.clipboard.writeText(b.dataset.copia); if (m) m.textContent = 'Copiato: ' + b.dataset.copia.slice(0, 80); } catch { if (m) m.textContent = b.dataset.copia; }
});
// 27/11: dalla visita al primo caso"""),
])

css = r"""
/* 27/11: passaparola, casi da condividere, attestato pronto */
.esito-condividi.forte { padding: .7rem .9rem; border-radius: 10px; background: var(--accento-tenue, #e8f1ff); border: 1px solid var(--bordo, #cfd8e3); }
.esito-condividi .ec-tit { margin: 0 0 .45rem; }
.manda-caso { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .7rem; margin: .5rem 0; }
.attestato-pronto { margin: .8rem 0; padding: .8rem 1rem; border-radius: 12px; border: 1px solid #e3c766; background: #fff8e1; color: #3b2f00; }
.attestato-pronto p { margin: .2rem 0; }
.cd-lista { list-style: none; margin: .5rem 0 0; padding: 0; display: grid; gap: .6rem; }
.cd-caso { display: flex; gap: .7rem; align-items: flex-start; }
.cd-caso img { border-radius: 8px; background: #000; flex: none; }
.cd-az { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: .3rem; }
.cd-az button { padding: .2rem .55rem; font-size: .85rem; }
"""
open(W + 'style.css', 'a').write(css)
print('ok')
