#!/usr/bin/env python3
# 28/11: segnalazioni e suggerimenti sul programma, da ogni pagina (pulsante 💬 in alto, link nel piede e nel menu):
# modulo sopra la pagina, anche senza accesso; l'amministratore le legge in Gestione → Segnalazioni e riceve un'email.
import json, os, shutil, sys
C = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
def bak(p):
    if not os.path.exists(p + '.bak_1128sg'): shutil.copy(p, p + '.bak_1128sg')
def rep(t, o, n, nome, prima=False):
    if n in t: return t
    if t.count(o) != 1: sys.exit(f'{nome}: trovato {t.count(o)} volte: {o[:90]!r}')
    return t.replace(o, (n + o) if prima else n)
def scrivi(p, t, t0):
    if t != t0: bak(p); open(p, 'w', encoding='utf-8').write(t); print('ok', p)

# ============================================================ API
p = C + 'api/logica.mjs'; t0 = t = open(p, encoding='utf-8').read()
PUBBLICO = r'''  // ---------------- segnalazioni e suggerimenti sul programma (28/11): da ogni pagina, anche senza accesso.
  // Si salvano tipo, testo, pagina, versione e browser; l'account se c'è (nome ed email si leggono solo quando
  // l'amministratore le apre), l'email solo se la scrive un ospite. Al più 10 al giorno per account, 50 al giorno da ospiti.
  if (parti[1] === 'segnalazioni' && parti.length === 2 && metodo === 'POST') {
    if (!M.scriviSegnalazione || !M.elencoSegnalazioni) return json(404, { errore: 'non disponibile' });
    if (String(dati?.sito || '')) return json(200, { ok: true });   // campo nascosto: lo riempiono solo i robot
    const tipo = TIPI_SEGNALAZIONE[dati?.tipo] ? dati.tipo : 'altro';
    const testo = pulisciTesto(dati?.testo, 3000);
    if (testo.length < 5) return json(400, { errore: 'Scrivi almeno qualche parola.' });
    const g0 = leggiGettone(cfg.segreto, cookie(req.headers));
    let chi = null;
    if (g0?.id === 'admin' && g0.ruolo === 'admin') chi = { id: 'admin', nome: 'Amministratore' };
    else if (g0?.id) { const a = await M.leggiAccount(g0.id).catch(() => null); if (a && a.attivo !== false) chi = a; }
    const email = chi ? '' : pulisciEmail(dati?.email);
    const adesso = ora16(), diOggi = (await M.elencoSegnalazioni()).filter((s) => String(s.data).slice(0, 10) === adesso.slice(0, 10));
    if (chi && diOggi.filter((s) => s.account === chi.id).length >= 10) return json(429, { errore: 'Hai già mandato 10 segnalazioni oggi: grazie! Riprova domani.' });
    if (!chi && diOggi.filter((s) => !s.account).length >= 50) return json(429, { errore: 'Oggi sono arrivate troppe segnalazioni senza accesso: entra con il tuo account o riprova domani.' });
    const s = { id: adesso.replace(/\D/g, '') + '-' + randomBytes(3).toString('hex'), data: adesso, tipo, testo, stato: 'nuova',
      pagina: pulisciTesto(dati?.pagina, 200), versione: pulisciTesto(dati?.versione, 20), browser: String(req.headers?.['user-agent'] || '').slice(0, 200),
      ...(chi ? { account: chi.id } : {}), ...(email ? { email } : {}) };
    await M.scriviSegnalazione(s);
    if (cfg.inviaEmail && cfg.avvisiA) {
      const sito = radice(cfg.indirizzo);
      try {
        await cfg.inviaEmail(cfg.avvisiA, `Quiz Radiologia: nuova segnalazione (${TIPI_SEGNALAZIONE[tipo]})`, corpoEmail([
          `${TIPI_SEGNALAZIONE[tipo]} da ${chi ? (chi.nome || 'un iscritto') : (email ? 'un ospite (' + email + ')' : 'un ospite senza email')}${s.pagina ? ', dalla pagina ' + s.pagina : ''}:`,
          testo.length > 1200 ? testo.slice(0, 1200) + '…' : testo], `${sito}/#/segnalazioni`, { pulsante: 'Apri le segnalazioni' }));
      } catch (e) { console.error('segnalazione', e?.message || e); }
    }
    return json(200, { ok: true });
  }
'''
t = rep(t, "  // ---------------- prova senza registrazione (27/11)", PUBBLICO, 'logica pubblico', prima=True)
ADMIN = r'''  // ---------------- segnalazioni: elenco, stato e nota interna, eliminazione (solo amministratore)
  if (parti[1] === 'segnalazioni' && parti.length === 2 && metodo === 'GET') {
    if (!admin) return json(403, { errore: 'solo l\'amministratore' });
    const l = M.elencoSegnalazioni ? (await M.elencoSegnalazioni()).sort((a, b) => String(b.data).localeCompare(String(a.data))) : [];
    const chi = new Map();
    for (const id of new Set(l.map((s) => s.account).filter((x) => x && x !== 'admin'))) {
      const a = await M.leggiAccount(id).catch(() => null);
      chi.set(id, a ? { nome: a.nome || '', email: a.email || '', ruolo: a.ruolo || '' } : { nome: 'account cancellato' });
    }
    return json(200, l.map((s) => ({ ...s, ...(s.account ? { chi: s.account === 'admin' ? { nome: 'Amministratore' } : chi.get(s.account) } : {}) })));
  }
  if (parti[1] === 'segnalazioni' && parti.length === 4 && metodo === 'POST') {
    if (!admin) return json(403, { errore: 'solo l\'amministratore' });
    const s = /^[0-9]{12}-[0-9a-f]{6}$/.test(parti[2]) ? (await M.elencoSegnalazioni()).find((x) => x.id === parti[2]) : null;
    if (!s) return json(404, { errore: 'segnalazione non trovata' });
    if (parti[3] === 'elimina') { await M.eliminaSegnalazione(s.id); return json(200, { ok: true }); }
    if (parti[3] === 'stato') {
      const stato = ['nuova', 'letta', 'risolta'].includes(dati?.stato) ? dati.stato : s.stato;
      const n = { ...s, stato, nota: pulisciTesto(dati?.nota, 1000), aggiornata: ora16() };
      if (!n.nota) delete n.nota;
      await M.scriviSegnalazione(n); return json(200, { ok: true, stato });
    }
    return json(404, { errore: 'percorso non valido' });
  }

'''
t = rep(t, "  // ---------------- revisione dei casi (27/11): il revisore", ADMIN, 'logica admin', prima=True)
COST = r'''// 28/11: tipi delle segnalazioni sul programma
export const TIPI_SEGNALAZIONE = { errore: 'Qualcosa non funziona', caso: 'Errore in un caso clinico', idea: 'Suggerimento', altro: 'Altro' };
'''
t = rep(t, "const pulisciEmail = (e) =>", COST, 'logica costanti', prima=True)
# conservazione: 12 mesi (manutenzione quotidiana)
CONS = r'''  // 28/11: le segnalazioni sul programma restano 12 mesi
  if (M.elencoSegnalazioni && M.eliminaSegnalazione) {
    const limite = new Date(oggi.getTime() - 365 * 86400000).toISOString().slice(0, 16).replace('T', ' ');
    for (const s of await M.elencoSegnalazioni().catch(() => [])) if (String(s.data) < limite) await M.eliminaSegnalazione(s.id).catch(() => {});
  }
'''
t = rep(t, "  const settimana = await emailSettimana(cfg, oggi)", CONS, 'logica conservazione', prima=True)
scrivi(p, t, t0)

# ============================================================ DynamoDB e simulatore
p = C + 'api/lambda.mjs'; t0 = t = open(p, encoding='utf-8').read()
DB = r'''  // segnalazioni sul programma (28/11): pk "SEGNALAZIONE", sk = id, dati JSON
  elencoSegnalazioni: async () => (await interroga('SEGNALAZIONE')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviSegnalazione: (s) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'SEGNALAZIONE' }, sk: { S: s.id }, dati: { S: JSON.stringify(s) } } })),
  eliminaSegnalazione: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'SEGNALAZIONE' }, sk: { S: id } } })),
'''
t = rep(t, "  // classi: pk \"CLASSE\", sk = id, dati JSON", DB, 'lambda', prima=True)
scrivi(p, t, t0)
p = C + 'test/simulatore.mjs'; t0 = t = open(p, encoding='utf-8').read()
t = rep(t, "const magazzino = {", "const segnalazioni = new Map();   // 28/11\n", 'sim decl', prima=True)
t = rep(t, "  elencoClassi: async () => [...classi.values()],",
        "  elencoSegnalazioni: async () => [...segnalazioni.values()].map((x) => ({ ...x })), scriviSegnalazione: async (s) => { segnalazioni.set(s.id, { ...s }); }, eliminaSegnalazione: async (id) => { segnalazioni.delete(id); },\n",
        'sim metodi', prima=True)
scrivi(p, t, t0)

# ============================================================ pagina
p = C + 'web/index.html'; t0 = t = open(p, encoding='utf-8').read()
t = rep(t, '  <a id="btn-aiuto" class="ghost btn" href="#/aiuto" title="Aiuto e manuale">?</a>',
        '  <button id="btn-segnala" class="ghost btn-segnala" type="button" title="Segnalazioni e suggerimenti: scrivici un problema o un\'idea" aria-label="Segnalazioni e suggerimenti">💬</button>\n', 'html pulsante', prima=True)
t = rep(t, '<a href="/argomenti/">Argomenti</a> · ', '<a href="#" data-segnala="">💬 Segnalazioni e suggerimenti</a> · ', 'html piede', prima=True)
t = rep(t, '    <button id="btn-esci" class="ghost" hidden>Esci</button>',
        '    <a href="#" data-segnala="" class="mu-segnala">💬 Segnalazioni e suggerimenti</a>\n', 'html menu utente', prima=True)
t = rep(t, '      <a id="mg-sponsor" href="#/sponsor" hidden>',
        '      <a id="mg-segnalazioni" href="#/segnalazioni" hidden><span class="mg-ic" style="--c:#e0533d">💬</span><span class="mg-t"><b>Segnalazioni</b><small>problemi e suggerimenti degli utenti</small></span></a>\n',
        'html menu gestione', prima=True)
DLG = '''<!-- 28/11: segnalazioni e suggerimenti, da ogni pagina -->
<dialog id="dlg-segnala" class="dlg-segnala" aria-labelledby="sg-titolo"><form id="sg-form" method="dialog" novalidate>
  <h2 id="sg-titolo">💬 Segnalazioni e suggerimenti</h2>
  <p class="muted small">Hai trovato un errore, qualcosa non funziona o hai un'idea per migliorare Quiz Radiologia? Scrivici: leggiamo tutto.</p>
  <fieldset class="sg-tipi"><legend>Di che cosa si tratta?</legend>
    <label><input type="radio" name="sg-tipo" value="errore" checked> 🐞 Qualcosa non funziona</label>
    <label><input type="radio" name="sg-tipo" value="caso"> 🩻 Errore in un caso clinico</label>
    <label><input type="radio" name="sg-tipo" value="idea"> 💡 Suggerimento</label>
    <label><input type="radio" name="sg-tipo" value="altro"> ✉️ Altro</label>
  </fieldset>
  <label class="sg-campo"><span>Descrivi</span><textarea id="sg-testo" rows="6" maxlength="3000" placeholder="Che cosa stavi facendo, che cosa è successo, che cosa ti aspettavi"></textarea></label>
  <label class="sg-campo" id="sg-email-riga" hidden><span>Email per la risposta (facoltativa)</span><input id="sg-email" type="email" maxlength="200" autocomplete="email"></label>
  <label class="sg-trappola" aria-hidden="true">Sito <input id="sg-sito" tabindex="-1" autocomplete="off"></label>
  <p class="small muted">Insieme al testo inviamo la pagina in cui sei, la versione del sito e il tipo di browser, per capire meglio il problema. Non scrivere dati di pazienti.</p>
  <p id="sg-esito" class="small" role="status"></p>
  <div class="sg-azioni"><button type="button" class="ghost" id="sg-annulla">Chiudi</button><button type="submit" class="primary" id="sg-invia">Invia</button></div>
</form></dialog>
<!-- SEGNALAZIONI (amministratore) -->
<main id="vista-segnalazioni" class="classi" hidden>
  <div class="riga testa-elenco"><h1>Segnalazioni e suggerimenti</h1></div>
  <p class="muted">Quello che gli utenti scrivono con il pulsante 💬, da qualsiasi pagina. Restano 12 mesi, poi si cancellano da sole.</p>
  <div id="sgl-lista"></div>
</main>
'''
t = rep(t, '<footer class="piede-sito">', DLG, 'html dialogo', prima=True)
scrivi(p, t, t0)

p = C + 'web/app.js'; t0 = t = open(p, encoding='utf-8').read()
t = rep(t, "'gestione-casi', 'aiuto', 'profilo', 'statistiche', 'esame', 'errore', 'confronto', 'client', 'tenant', 'sfida']) $(`#vista-${v}`).hidden = v !== nome;",
        "'gestione-casi', 'aiuto', 'profilo', 'statistiche', 'esame', 'errore', 'confronto', 'client', 'tenant', 'sfida', 'segnalazioni']) $(`#vista-${v}`).hidden = v !== nome;", 'js viste')
t = rep(t, "$('#btn-account').hidden = !ADMIN; $('#mg-statistiche').hidden = !ADMIN;",
        "$('#btn-account').hidden = !ADMIN; $('#mg-statistiche').hidden = !ADMIN; { const m = $('#mg-segnalazioni'); if (m) m.hidden = !ADMIN || !CLOUD; }", 'js menu')
t = rep(t, "    else if (tipo === 'revisione' && AUTORE && CLOUD) { vista('revisione'); await apriRevisione(); }",
        "    else if (tipo === 'segnalazioni' && ADMIN && CLOUD) { vista('segnalazioni'); await apriSegnalazioni(); }\n", 'js rotta', prima=True)
JS = r'''// ---------------------------------------------------------------- 28/11: segnalazioni e suggerimenti da ogni pagina
// pulsante 💬 in alto, link nel piede e nel menu del profilo: modulo sopra la pagina, anche senza accesso
function apriSegnala(tipo) {
  const d = $('#dlg-segnala'); if (!d) return;
  if (tipo) { const r = d.querySelector(`input[name="sg-tipo"][value="${tipo}"]`); if (r) r.checked = true; }
  $('#sg-email-riga').hidden = !!UTENTE; $('#sg-esito').textContent = ''; $('#sg-esito').className = 'small'; $('#sg-invia').disabled = false;
  $('#menu-utente')?.removeAttribute('open');
  if (!d.open) d.showModal();
  $('#sg-testo').focus();
}
{
  const b = $('#btn-segnala'); if (b && CLIENT) b.hidden = true;
  b?.addEventListener('click', () => { let caso = false; try { caso = !$('#vista-caso').hidden; } catch {} apriSegnala(caso ? 'caso' : ''); });
  document.addEventListener('click', (e) => { const a = e.target.closest?.('[data-segnala]'); if (!a) return; e.preventDefault(); apriSegnala(a.dataset.segnala || ''); });
  $('#sg-annulla')?.addEventListener('click', () => $('#dlg-segnala').close());
  $('#sg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const testo = $('#sg-testo').value.trim(), es = $('#sg-esito');
    if (testo.length < 5) { es.className = 'small ko'; es.textContent = 'Scrivi almeno qualche parola.'; $('#sg-testo').focus(); return; }
    $('#sg-invia').disabled = true; es.className = 'small'; es.textContent = 'Invio…';
    try {
      await postJSON('/api/segnalazioni', { tipo: $('#dlg-segnala').querySelector('input[name="sg-tipo"]:checked')?.value || 'altro', testo,
        email: UTENTE ? '' : $('#sg-email').value.trim(), sito: $('#sg-sito').value, pagina: (location.pathname + location.hash).slice(0, 200), versione: VERSIONE.versione || '' });
      $('#sg-testo').value = ''; es.className = 'small ok'; es.textContent = 'Grazie! La segnalazione è arrivata.';
      setTimeout(() => { const d = $('#dlg-segnala'); if (d.open) d.close(); }, 2200);
    } catch (err) { es.className = 'small ko'; es.textContent = err?.message || 'Invio non riuscito: riprova.'; $('#sg-invia').disabled = false; }
  });
}
const SGL = { filtro: 'aperte' };
const SGL_TIPI = { errore: '🐞 Non funziona', caso: '🩻 Caso clinico', idea: '💡 Suggerimento', altro: '✉️ Altro' };
const SGL_STATI = { nuova: 'Nuova', letta: 'Letta', risolta: 'Risolta' };
async function apriSegnalazioni() {
  const box = $('#sgl-lista'); if (!box) return;
  box.innerHTML = '<p class="muted">Carico…</p>';
  let l; try { l = await getJSON('/api/segnalazioni'); } catch (e) { box.innerHTML = e instanceof NonAutorizzato ? '' : `<p class="ko">${esc(e.message)}</p>`; return; }
  const n = (st) => l.filter((s) => s.stato === st).length;
  const vedi = l.filter((s) => SGL.filtro === 'tutte' || (SGL.filtro === 'aperte' ? s.stato !== 'risolta' : s.stato === SGL.filtro));
  const kpi = (cls, tit, val) => `<div class="cmr-kpi ${cls}"><span class="k-tit">${tit}</span><span class="k-val">${val}</span></div>`;
  const chi = (s) => s.chi ? `${esc(s.chi.nome || '')}${s.chi.ruolo ? ` <span class="muted">(${esc(s.chi.ruolo)})</span>` : ''}` : `<span class="muted">ospite</span>${s.email ? ' · ' + esc(s.email) : ''}`;
  const email = (s) => s.email || s.chi?.email || '';
  const voce = (s) => `<li class="sgl-v st-${esc(s.stato)}">
    <div class="sgl-testa"><b>${SGL_TIPI[s.tipo] || esc(s.tipo)}</b> <span class="sgl-stato">${esc(SGL_STATI[s.stato] || s.stato)}</span>
      <span class="muted small">${esc(String(s.data || '').slice(8, 10))}/${esc(String(s.data || '').slice(5, 7))} ${esc(String(s.data || '').slice(11, 16))} · ${chi(s)}${s.pagina ? ` · <a href="${esc(s.pagina.startsWith('/') ? s.pagina : '/' + s.pagina)}">${esc(s.pagina)}</a>` : ''}</span></div>
    <p class="sgl-testo">${esc(s.testo).replace(/\n/g, '<br>')}</p>
    <details class="small muted"><summary>Dettagli tecnici</summary>versione ${esc(s.versione || '—')} · ${esc(s.browser || '—')}</details>
    <div class="sgl-azioni"><select data-st="${esc(s.id)}" aria-label="Stato">${Object.entries(SGL_STATI).map(([k, v]) => `<option value="${k}"${k === s.stato ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <input data-nota="${esc(s.id)}" maxlength="1000" placeholder="Nota interna (facoltativa)" value="${esc(s.nota || '')}">
      <button type="button" data-salva="${esc(s.id)}">Salva</button>
      ${email(s) ? `<a class="btn ghost" href="mailto:${encodeURIComponent(email(s))}?subject=${encodeURIComponent('La tua segnalazione su Quiz Radiologia')}">✉️ Rispondi</a>` : ''}
      <button type="button" class="ghost" data-elimina="${esc(s.id)}">Elimina</button></div></li>`;
  box.innerHTML = `<div class="cmr-kpis">${kpi(n('nuova') ? 'dubbio' : 'ok', 'Nuove', n('nuova'))}${kpi('', 'Lette', n('letta'))}${kpi('ok', 'Risolte', n('risolta'))}${kpi('', 'Totale', l.length)}</div>
    <div class="rvd-filtri"><select id="sgl-filtro" aria-label="Quali segnalazioni">${[['aperte', 'Da gestire (nuove e lette)'], ['nuova', 'Solo nuove'], ['letta', 'Solo lette'], ['risolta', 'Risolte'], ['tutte', 'Tutte']].map(([v, s]) => `<option value="${v}"${v === SGL.filtro ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
    ${vedi.length ? `<ul class="sgl-lista">${vedi.map(voce).join('')}</ul>` : '<p class="muted">Nessuna segnalazione da mostrare.</p>'}`;
  $('#sgl-filtro').addEventListener('change', (e) => { SGL.filtro = e.target.value; apriSegnalazioni(); });
  box.querySelectorAll('[data-salva]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.salva; b.disabled = true;
    try { await postJSON(`/api/segnalazioni/${id}/stato`, { stato: box.querySelector(`[data-st="${id}"]`).value, nota: box.querySelector(`[data-nota="${id}"]`).value }); avvisoBreve('Salvato.'); apriSegnalazioni(); }
    catch (e) { b.disabled = false; avvisoBreve(e.message); }
  }));
  box.querySelectorAll('[data-elimina]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.conferma !== '1') { b.dataset.conferma = '1'; b.textContent = 'Conferma: elimina'; b.classList.add('pericolo'); return; }
    try { await postJSON(`/api/segnalazioni/${b.dataset.elimina}/elimina`, {}); apriSegnalazioni(); } catch (e) { avvisoBreve(e.message); }
  }));
}
'''
t = rep(t, "$('#btn-schermo').addEventListener('click', schermoIntero);", JS, 'js segnala', prima=True)
scrivi(p, t, t0)

p = C + 'web/style.css'; t0 = t = open(p, encoding='utf-8').read()
CSS = '''
/* 28/11: segnalazioni e suggerimenti */
.btn-segnala{font-size:1rem;line-height:1}
.dlg-segnala{width:min(560px,94vw);border:1px solid var(--bord);border-radius:16px;background:var(--pan);color:var(--txt);padding:0;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.dlg-segnala::backdrop{background:rgba(6,10,18,.55)}
.dlg-segnala form{display:grid;gap:.7rem;padding:1.1rem 1.2rem}
.dlg-segnala h2{margin:0;font-size:1.2rem}
.dlg-segnala p{margin:0}
.sg-tipi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.35rem .8rem;border:1px solid var(--bord);border-radius:10px;padding:.5rem .8rem .7rem;margin:0}
.sg-tipi legend{font-weight:600;padding:0 .3rem}
.sg-tipi label{display:flex;align-items:center;gap:.4rem;cursor:pointer}
.sg-campo{display:grid;gap:.25rem;font-weight:600}
.sg-campo textarea,.sg-campo input{font:inherit;font-weight:400;width:100%;box-sizing:border-box}
.sg-trappola{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}
.sg-azioni{display:flex;justify-content:flex-end;gap:.5rem}
.mu-segnala{display:block}
.sgl-lista{list-style:none;padding:0;display:grid;gap:.7rem}
.sgl-v{border:1px solid var(--bord);border-left:4px solid var(--acc);border-radius:12px;padding:.7rem .9rem;background:var(--pan)}
.sgl-v.st-nuova{border-left-color:var(--warn)}.sgl-v.st-risolta{border-left-color:var(--ok);opacity:.85}
.sgl-testa{display:flex;flex-wrap:wrap;align-items:baseline;gap:.3rem .6rem}
.sgl-stato{font-size:.75rem;padding:.05rem .45rem;border-radius:999px;background:var(--pan2);border:1px solid var(--bord)}
.sgl-testo{margin:.45rem 0;white-space:normal;overflow-wrap:anywhere}
.sgl-azioni{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin-top:.4rem}
.sgl-azioni input{flex:1 1 14rem;min-width:0}
.sgl-azioni .pericolo{color:var(--ko);border-color:var(--ko)}
'''
if '.dlg-segnala' not in t: t += CSS
scrivi(p, t, t0)

# ============================================================ inglese
p = C + 'web/lingua/en.json'; s = open(p, encoding='utf-8').read().rstrip(); d = json.loads(s)
EN = {
 "Segnalazioni e suggerimenti: scrivici un problema o un'idea": 'Feedback and suggestions: tell us about a problem or an idea',
 'Segnalazioni e suggerimenti': 'Feedback and suggestions', '💬 Segnalazioni e suggerimenti': '💬 Feedback and suggestions',
 'Segnalazioni': 'Feedback', 'problemi e suggerimenti degli utenti': 'problems and suggestions from users',
 "Hai trovato un errore, qualcosa non funziona o hai un'idea per migliorare Quiz Radiologia? Scrivici: leggiamo tutto.":
   'Found a mistake, something not working, or have an idea to improve Radiology Quiz? Write to us: we read everything.',
 'Di che cosa si tratta?': 'What is it about?', '🐞 Qualcosa non funziona': '🐞 Something is not working',
 '🩻 Errore in un caso clinico': '🩻 Mistake in a clinical case', '💡 Suggerimento': '💡 Suggestion', '✉️ Altro': '✉️ Other',
 'Descrivi': 'Describe', 'Che cosa stavi facendo, che cosa è successo, che cosa ti aspettavi': 'What you were doing, what happened, what you expected',
 'Email per la risposta (facoltativa)': 'Email for a reply (optional)', 'Sito': 'Website',
 'Insieme al testo inviamo la pagina in cui sei, la versione del sito e il tipo di browser, per capire meglio il problema. Non scrivere dati di pazienti.':
   'Along with the text we send the page you are on, the site version and the browser type, to better understand the problem. Do not write patient data.',
 'Chiudi': 'Close', 'Invia': 'Send', 'Segnalazioni e suggerimenti': 'Feedback and suggestions',
 'Quello che gli utenti scrivono con il pulsante 💬, da qualsiasi pagina. Restano 12 mesi, poi si cancellano da sole.':
   'What users write with the 💬 button, from any page. Kept for 12 months, then deleted automatically.',
 'Scrivi almeno qualche parola.': 'Write at least a few words.', 'Invio…': 'Sending…',
 'Grazie! La segnalazione è arrivata.': 'Thank you! Your feedback has been received.', 'Invio non riuscito: riprova.': 'Sending failed: please try again.',
 'Nuove': 'New', 'Lette': 'Read', 'Risolte': 'Resolved', 'Totale': 'Total', 'Nuova': 'New', 'Letta': 'Read', 'Risolta': 'Resolved',
 'Da gestire (nuove e lette)': 'To handle (new and read)', 'Solo nuove': 'New only', 'Solo lette': 'Read only', 'Tutte': 'All',
 'Nessuna segnalazione da mostrare.': 'No feedback to show.', 'Dettagli tecnici': 'Technical details', 'Nota interna (facoltativa)': 'Internal note (optional)',
 '✉️ Rispondi': '✉️ Reply', 'Elimina': 'Delete', 'Conferma: elimina': 'Confirm: delete', 'Salva': 'Save', 'ospite': 'guest',
 '🐞 Non funziona': '🐞 Not working', '🩻 Caso clinico': '🩻 Clinical case', 'Stato': 'Status', 'Quali segnalazioni': 'Which feedback',
 'Hai già mandato 10 segnalazioni oggi: grazie! Riprova domani.': 'You have already sent 10 messages today: thank you! Try again tomorrow.',
 'Oggi sono arrivate troppe segnalazioni senza accesso: entra con il tuo account o riprova domani.': 'Too many messages without login today: sign in with your account or try again tomorrow.',
}
nuove = {k: v for k, v in EN.items() if k not in d}
if nuove:
    s = s[:-1] + ''.join(', ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) for k, v in nuove.items()) + '}\n'
    json.loads(s); bak(p); open(p, 'w', encoding='utf-8').write(s); print('ok en', len(nuove))

# ============================================================ informativa (it + en)
for p, o, n in ((C + 'web/aiuto.json', 'Le sfide si chiudono alla scadenza o dopo 90 giorni."',
                 'Le sfide si chiudono alla scadenza o dopo 90 giorni.", "Segnalazioni e suggerimenti (facoltativi, pulsante 💬): conserviamo il testo che scrivi, il tipo, la pagina da cui scrivi, la versione del sito e il tipo di browser; se sei entrato, il collegamento al tuo account; se scrivi senza accesso, l\'email solo se la indichi, per risponderti. Servono a correggere errori e migliorare il servizio (legittimo interesse, art. 6.1.f), le legge solo il titolare e si cancellano dopo 12 mesi. Non scrivere dati di pazienti."'),
                (C + 'web/lingua/en/aiuto.json', 'Challenges close at the deadline or after 90 days."',
                 'Challenges close at the deadline or after 90 days.", "Feedback and suggestions (optional, 💬 button): we keep the text you write, its type, the page you write from, the site version and the browser type; if you are signed in, the link to your account; if you write without signing in, your email only if you provide it, so we can reply. They are used to fix mistakes and improve the service (legitimate interest, art. 6.1.f), are read only by the controller and are deleted after 12 months. Do not write patient data."')):
    t0 = t = open(p, encoding='utf-8').read()
    if n not in t:
        if t.count(o) != 1: sys.exit(f'informativa {p}: {t.count(o)}')
        t = t.replace(o, n); json.loads(t)
    scrivi(p, t, t0)
