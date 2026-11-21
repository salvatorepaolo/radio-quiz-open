import shutil, json, re
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
N = ['app.js', 'index.html', 'style.css', 'lingua/en.json']
for n in N: shutil.copy(W + n, W + n + '.bak_1109persone')
T = {n: open(W + n, encoding='utf-8').read() for n in N}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:100], T[k].count(a)); T[k] = T[k].replace(a, b)
H, A, C = 'index.html', 'app.js', 'style.css'

# ---------------- pagina «Iscritti e docenti»: HTML
i = T[H].index('<main id="vista-account" class="account" hidden>')
j = T[H].index('<p id="acc-msg" class="muted"></p>', i) + len('<p id="acc-msg" class="muted"></p>')
T[H] = T[H][:i] + '''<main id="vista-account" class="account" hidden>
  <section class="acc-hero pagina-eroe">
    <span class="acc-hero-ico" aria-hidden="true">👥</span>
    <div class="acc-hero-testo"><h1>Iscritti e docenti</h1>
      <p class="solo-vetrina">Chi si iscrive attiva l'account confermando l'email. Da qui scegli il ruolo di ognuno, assegni i docenti di riferimento, disattivi o elimini.</p>
      <p class="solo-azienda">Gli account li crei tu con un invito per email: ognuno sceglie la propria password dal link (valido 7 giorni).</p>
      <p class="acc-stat small" id="acc-stat"></p>
      <details class="acc-come solo-vetrina"><summary>Come funziona</summary><p>L'iscrizione è automatica: chiunque si registra e attiva l'account confermando l'email; chi vuole si dichiara docente da sé.
        Un docente vede i risultati solo di chi lo ha scelto come riferimento o di chi gli assegni da qui (l'iscritto riceve un'email e può toglierlo dal profilo).
        L'autore può caricare e modificare i casi; i casi nuovi restano in bozza finché un revisore non li controlla.</p></details></div>
    <div class="eroe-azioni"><button type="button" class="primary" id="acc-invita-apri" aria-expanded="false" aria-controls="form-invito">＋ Invita una persona</button></div>
  </section>
  <form id="form-invito" class="acc-invito" hidden>
    <div class="inv-testa"><b>✉ Invita una persona</b><span class="muted small">riceve un'email con il link per scegliere la password (valido 7 giorni)</span>
      <button type="button" class="ghost inv-chiudi" id="inv-chiudi" aria-label="Chiudi">✕</button></div>
    <div class="inv-campi">
      <label>Nome e cognome<input id="inv-nome" placeholder="Mario Rossi" required maxlength="80" autocomplete="off"></label>
      <label>Email<input id="inv-email" type="email" placeholder="nome@ospedale.it" required maxlength="254" autocomplete="off"></label>
    </div>
    <fieldset class="inv-ruoli"><legend>Ruolo</legend>
      <label class="inv-ruolo"><input type="radio" name="inv-r" value="specializzando" checked><span class="inv-ic" aria-hidden="true">🎓</span><span><b>Specializzando</b><small>svolge i casi e vede i propri progressi</small></span></label>
      <label class="inv-ruolo"><input type="radio" name="inv-r" value="docente"><span class="inv-ic" aria-hidden="true">🧑‍🏫</span><span><b>Docente</b><small>segue i suoi studenti, crea classi e compiti</small></span></label>
      <label class="inv-ruolo"><input type="radio" name="inv-r" value="admin"><span class="inv-ic" aria-hidden="true">🛡</span><span><b>Amministratore</b><small>gestisce account, casi, percorsi e statistiche</small></span></label>
    </fieldset>
    <select id="inv-ruolo" aria-label="Ruolo" hidden><option value="specializzando">Specializzando</option><option value="docente">Docente</option><option value="admin">Amministratore</option></select>
    <div class="inv-fondo"><button class="primary" type="submit">Invia invito</button><span id="inv-msg" class="muted small" role="status"></span></div>
  </form>
  <div class="acc-barra">
    <div class="acc-cerca"><span aria-hidden="true">🔍</span><input id="acc-filtro" type="search" placeholder="Cerca per nome, email, sede…" aria-label="Cerca"></div>
    <div id="acc-riepilogo" class="acc-chip" role="tablist" aria-label="Filtra per ruolo e stato"></div>
    <div class="riga acc-filtri">
      <select id="acc-vista" title="Ruolo e stato" hidden><option value="">Tutti</option><option value="iscritti">Iscritti</option><option value="docenti">Docenti</option>
        <option value="admin">Amministratori</option><option value="senza">Iscritti senza docente</option><option value="inattivi">Mai un caso</option>
        <option value="attesa">Email da confermare</option><option value="off">Disattivati</option></select>
      <select id="acc-cat" title="Chi è" aria-label="Categoria"><option value="">Ogni categoria</option></select>
      <select id="acc-doc" title="Studenti di un docente" aria-label="Studenti di un docente"><option value="">Ogni docente</option></select>
      <span class="spacer"></span><span id="acc-conta" class="muted small"></span>
      <button type="button" class="ghost" id="acc-csv" title="Scarica l'elenco filtrato (per uso interno: contiene dati personali)">⤓ CSV</button>
    </div>
  </div>
  <div class="scorri-x acc-tabella"><table class="tab-account">
    <thead><tr><th data-ord="nome">Persona</th><th data-ord="ruolo">Ruolo e stato</th><th>Docenti / studenti</th>
      <th data-ord="casi" title="Casi diversi svolti · punteggio medio al primo tentativo">Attività</th><th data-ord="accesso">Ultimo accesso</th><th><span class="sr-only">Azioni</span></th></tr></thead>
    <tbody id="acc-lista"></tbody>
  </table>
  <div id="acc-vuoto" class="acc-vuoto" hidden><span aria-hidden="true">🔎</span><b>Nessuna persona trovata</b><span class="muted small">Cambia la ricerca o i filtri, oppure invita qualcuno.</span></div></div>
  <p id="acc-msg" class="muted" role="status"></p>''' + T[H][j:]

# ---------------- app.js: riepilogo come filtri a pillola, righe più leggere, azioni in un menù
sost(A, """  $('#acc-riepilogo').innerHTML = [[ACCOUNT.length, 'account'], [isc.length, AZIENDA() ? 'specializzandi' : 'iscritti'], [nDoc, 'docenti'],
    [isc.filter((a) => !(a.docenti || []).length).length, 'iscritti senza docente'],
    [ACCOUNT.filter((a) => (a.attivita?.ultima || '') >= mese).length, 'attivi negli ultimi 30 giorni'],
    AZIENDA() ? [ACCOUNT.filter((a) => a.invitoInAttesa).length, 'inviti in attesa'] : [ACCOUNT.filter((a) => !a.confermato).length, 'email da confermare']]
    .map(([n, t], i) => { const f = ['', 'iscritti', 'docenti', 'senza', '', AZIENDA() ? '' : 'attesa'][i];
      return `<button type="button" class="acc-tile t${i}${f && $('#acc-vista').value === f ? ' on' : ''}"${f ? ` data-f="${f}"` : ' data-f=""'}><b>${n}</b><small>${t}</small></button>`; }).join('');
  $('#acc-riepilogo').querySelectorAll('.acc-tile').forEach((b) => b.onclick = () => { $('#acc-vista').value = $('#acc-vista').value === b.dataset.f ? '' : b.dataset.f; disegnaAccount(); });
  $('#acc-conta').textContent = l.length === ACCOUNT.length ? `${l.length} account` : `${l.length} di ${ACCOUNT.length}`;
  $('#acc-msg').textContent = l.length ? '' : 'Nessun account.';""",
"""  // filtri a pillola con il numero di persone (le pillole vuote non compaiono, «Tutti» sì)
  const v = $('#acc-vista').value, nAdmin = ACCOUNT.filter((a) => a.ruolo === 'admin').length;
  const pillole = [['', 'Tutti', ACCOUNT.length, '👥'], ['iscritti', AZIENDA() ? 'Specializzandi' : 'Iscritti', isc.length, '🎓'], ['docenti', 'Docenti', nDoc, '🧑‍🏫'],
    ['admin', 'Amministratori', nAdmin, '🛡'], ['senza', 'Senza docente', isc.filter((a) => !(a.docenti || []).length).length, '⚠'],
    ['attesa', AZIENDA() ? 'Da attivare' : 'Email da confermare', ACCOUNT.filter((a) => !a.confermato).length, '✉'],
    ['inattivi', 'Mai un caso', ACCOUNT.filter((a) => !a.attivita?.risposte && a.ruolo !== 'admin').length, '💤'], ['off', 'Disattivati', ACCOUNT.filter((a) => !a.attivo).length, '⏸']]
    .filter(([f, , n]) => !f || n || f === v);
  $('#acc-riepilogo').innerHTML = pillole.map(([f, t, n, ic]) => `<button type="button" role="tab" aria-selected="${v === f}" class="acc-pill${v === f ? ' on' : ''}${f === 'senza' || f === 'attesa' ? ' avviso' : ''}" data-f="${f}"><span aria-hidden="true">${ic}</span>${t}<b>${n}</b></button>`).join('');
  $('#acc-riepilogo').querySelectorAll('.acc-pill').forEach((b) => b.onclick = () => { $('#acc-vista').value = b.dataset.f; disegnaAccount(); });
  const attivi = ACCOUNT.filter((a) => (a.attivita?.ultima || '') >= mese).length;
  $('#acc-stat').textContent = ACCOUNT.length ? `${ACCOUNT.length} ${ACCOUNT.length === 1 ? 'persona' : 'persone'} · ${attivi} ${attivi === 1 ? 'attiva' : 'attive'} negli ultimi 30 giorni` : '';
  $('#acc-conta').textContent = l.length === ACCOUNT.length ? `${l.length} ${l.length === 1 ? 'persona' : 'persone'}` : `${l.length} di ${ACCOUNT.length}`;
  $('#acc-msg').textContent = ''; $('#acc-vuoto').hidden = !!l.length; $('.tab-account').hidden = !l.length;
  // prima volta (nessuno da gestire): il modulo dell'invito è già aperto
  if (ACCOUNT.filter((a) => a.id !== UTENTE?.id).length === 0 && !ACC_INVITO_VISTO) { ACC_INVITO_VISTO = true; apriInvito(true); }""")
sost(A, "let ACCOUNT = [], ACC_ORD = { k: '', su: true }, ACC_APERTO = '';",
"""let ACCOUNT = [], ACC_ORD = { k: '', su: true }, ACC_APERTO = '', ACC_INVITO_VISTO = false;
// «＋ Invita una persona»: il modulo si apre sotto il titolo
function apriInvito(si = $('#form-invito').hidden) {
  $('#form-invito').hidden = !si; $('#acc-invita-apri').setAttribute('aria-expanded', String(si));
  $('#acc-invita-apri').classList.toggle('on', si); if (si) setTimeout(() => $('#inv-nome').focus(), 30);
}
$('#acc-invita-apri').addEventListener('click', () => apriInvito());
$('#inv-chiudi').addEventListener('click', () => apriInvito(false));
qsAll('#form-invito input[name="inv-r"]').forEach((r) => r.addEventListener('change', () => { $('#inv-ruolo').value = r.value; }));
// quanto tempo fa (oggi, ieri, 3 giorni fa…), con la data completa nel suggerimento
function quandoFa(t) {
  if (!t || !/^\\d{4}-\\d{2}-\\d{2}/.test(t)) return '—';
  const d = new Date(t.length > 10 ? t : t + 'T12:00:00'), g = Math.floor((Date.now() - d) / 864e5);
  return g <= 0 ? 'oggi' : g === 1 ? 'ieri' : g < 30 ? `${g} giorni fa` : g < 365 ? (Math.round(g / 30.4) <= 1 ? '1 mese fa' : `${Math.round(g / 30.4)} mesi fa`) : (Math.round(g / 365) <= 1 ? '1 anno fa' : `${Math.round(g / 365)} anni fa`);
}
const dataLunga = (t) => (t && /^\\d{4}-\\d{2}-\\d{2}/.test(t) ? new Date(t.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + (t.length > 10 ? ' ' + t.slice(11, 16) : '') : '');
// menù «Azioni» di ogni persona: si apre in posizione fissa (la tabella scorre in orizzontale e lo taglierebbe)
function posizionaMenuAcc(d) {
  const r = d.querySelector('summary').getBoundingClientRect(), pop = d.querySelector('.acc-menu-pop');
  const h = pop.offsetHeight, w = pop.offsetWidth, sotto = r.bottom + 6 + h < innerHeight;
  pop.style.top = `${sotto ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`; pop.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
}
document.addEventListener('pointerdown', (e) => { for (const d of qsAll('#acc-lista details.acc-menu[open]')) if (!d.contains(e.target)) d.open = false; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') for (const d of qsAll('#acc-lista details.acc-menu[open]')) { d.open = false; d.querySelector('summary').focus(); } });
addEventListener('scroll', () => { for (const d of qsAll('#acc-lista details.acc-menu[open]')) posizionaMenuAcc(d); }, { passive: true, capture: true });""")
sost(A, "  const dataBreve = (t) =>", "  const dataBreveVecchia = (t) =>")
# righe della tabella
i = T[A].index("  $('#acc-lista').innerHTML = l.map((a) => `<tr class=\"${a.attivo ? '' : 'off'}\" data-id=\"${esc(a.id)}\">")
j = T[A].index("  qsAll('#acc-lista button').forEach((b) => b.onclick = async () => {", i)
T[A] = T[A][:i] + """  const voce = (az, ic, t, tit = '', cl = '') => `<button type="button" role="menuitem" data-az="${az}"${tit ? ` title="${tit}"` : ''}${cl ? ` class="${cl}"` : ''}><span class="mi" aria-hidden="true">${ic}</span><span class="mt">${t}</span></button>`;
  const azioni = (a) => {
    const ruoloV = a.ruolo === 'admin' ? (a.id === UTENTE?.id ? '' : voce('noadmin', '🛡', 'Togli amministratore', 'Toglie i permessi di amministratore: l\\'account resta docente'))
      : a.ruolo === 'docente' ? voce('autore', '✎', a.autore ? 'Togli autore' : 'Rendi autore', a.autore ? '' : 'Può scrivere e modificare i casi (riceve un\\'email)') + voce('togli', '🚫', 'Togli docente', 'Toglie la funzione docente e impedisce di riattivarla')
      : a.noDocente ? voce('sblocca', '🔓', 'Sblocca docente') : voce('docente', '🧑‍🏫', 'Rendi docente', 'Riceve un\\'email');
    const adm = a.ruolo !== 'admin' && a.attivo && a.confermato ? voce('admin', '🛡', 'Rendi amministratore', 'Gestisce account, casi, percorsi e statistiche. Riceve un\\'email') : '';
    const acc = (a.confermato ? '' : voce('conferma', '✔', 'Conferma l\\'account', 'Attiva l\\'account senza aspettare la conferma via email'))
      + (a.conPassword && a.email && a.attivo ? voce('reset', '🔑', 'Invia link password', 'Email con il link per scegliere una nuova password (valido 24 ore)') : '')
      + (a.invitoInAttesa ? voce('invito', '✉', 'Reinvia invito', 'Nuova email con il link per scegliere la password (7 giorni)') : '')
      + (a.conCodice ? voce('codice', '#', 'Nuovo codice') : '');
    const gr = (t, x) => (x ? `<div class="mg-tit">${t}</div>${x}` : '');
    return `<details class="acc-menu"><summary class="btn ghost" aria-label="Azioni per ${esc(a.nome)}" title="Azioni">⋯</summary><div class="acc-menu-pop" role="menu">
      ${gr('Ruolo', ruoloV + adm)}${gr('Accesso', acc)}${gr('Account', voce('attivo', a.attivo ? '⏸' : '▶', a.attivo ? 'Disattiva' : 'Riattiva', a.attivo ? 'Non può più entrare finché non lo riattivi' : '') + voce('elimina', '🗑', 'Elimina', 'Elimina l\\'account e i suoi dati (premi due volte)', 'pericolo'))}</div></details>`;
  };
  $('#acc-lista').innerHTML = l.map((a) => `<tr class="${a.attivo ? '' : 'off'}" data-id="${esc(a.id)}">
    <td><div class="acc-chi"><span class="acc-avatar" style="--h:${tinta(a.id)}">${iniziali(a.nome)}</span><div class="acc-nome"><b>${esc(a.nome)}</b>
      <span class="small muted">${a.email ? esc(a.email) : 'nessuna email'}</span>
      <span class="small muted">${[CATEGORIE[a.categoria], a.anno ? `${esc(a.anno)}° anno` : '', a.sede].filter(Boolean).map(esc).join(' · ')}</span></div></div></td>
    <td><div class="acc-ruoli">${ruolo(a)}</div>${stato(a)}</td>
    <td class="small">${colDocenti(a)}</td>
    <td class="small">${att(a)}${a.attivita?.ultima ? `<br><span class="muted" title="Ultimo caso: ${esc(dataLunga(a.attivita.ultima))}">ultimo ${quandoFa(a.attivita.ultima)}</span>` : ''}</td>
    <td class="small"><span title="${esc(dataLunga(a.ultimoAccesso))}${a.ultimoAccesso ? '' : 'mai'}">${a.ultimoAccesso ? quandoFa(a.ultimoAccesso) : '<span class="muted">mai</span>'}</span><br><span class="muted" title="Iscritto il ${esc(dataLunga(a.creato))} · accesso con ${accesso(a)}">iscritto ${quandoFa(a.creato)}</span></td>
    <td class="acc-azioni">${azioni(a)}</td></tr>`).join('');
  qsAll('#acc-lista details.acc-menu').forEach((d) => d.addEventListener('toggle', () => {
    if (!d.open) return; for (const x of qsAll('#acc-lista details.acc-menu[open]')) if (x !== d) x.open = false; posizionaMenuAcc(d);
  }));
""" + T[A][j:]
# la conferma «Confermi?» resta leggibile nel menù
sost(A, "      b.dataset.conferma = '1'; const t = b.textContent; b.textContent = 'Confermi?';\n      setTimeout(() => { b.dataset.conferma = ''; b.textContent = t; }, 4000); return;",
        "      b.dataset.conferma = '1'; const t = b.innerHTML; b.innerHTML = '<span class=\"mi\" aria-hidden=\"true\">❓</span><span class=\"mt\">Confermi? Premi di nuovo</span>'; b.classList.add('conferma');\n      setTimeout(() => { b.dataset.conferma = ''; b.innerHTML = t; b.classList.remove('conferma'); }, 4000); return;")
# dopo l'invito il modulo si chiude e resta il messaggio
sost(A, "    m.textContent = `Invito inviato a ${r.account.email} ✓`; $('#inv-nome').value = ''; $('#inv-email').value = ''; await apriAccount();",
        "    $('#inv-nome').value = ''; $('#inv-email').value = ''; await apriAccount(); apriInvito(false); $('#acc-msg').textContent = `✓ Invito inviato a ${r.account.email}`;")

# ---------------- CSS
T[C] += """
/* ===== Iscritti e docenti (9/11): invito a scomparsa, filtri a pillola, righe leggere, azioni in un menù ===== */
#vista-account .eroe-azioni{display:flex;gap:8px;align-self:center}
#vista-account .acc-stat{margin-top:6px;color:var(--mut)}
#acc-invita-apri.on{box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 30%,transparent)}
#vista-account .acc-invito{display:grid;gap:12px;padding:16px 18px;margin:0 0 14px;border-radius:16px;background:var(--pan);border:1px solid color-mix(in srgb,var(--acc) 35%,var(--bord));box-shadow:0 8px 24px color-mix(in srgb,var(--acc) 10%,transparent);animation:mg-apri .14s ease-out}
#vista-account .acc-invito[hidden]{display:none}
.inv-testa{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.inv-testa b{font-size:1.05rem}.inv-chiudi{margin-left:auto;padding:4px 10px}
.inv-campi{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.inv-campi label{display:flex;flex-direction:column;gap:4px;font-size:.85rem;color:var(--mut);font-weight:600}
.inv-campi input{padding:10px 12px;border-radius:10px;font-size:1rem;color:var(--txt);font-weight:400}
.inv-ruoli{border:0;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.inv-ruoli legend{font-size:.85rem;color:var(--mut);font-weight:600;margin-bottom:4px;padding:0}
.inv-ruolo{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;border:1.5px solid var(--bord);cursor:pointer;background:var(--pan2);transition:border-color .12s,background .12s}
.inv-ruolo:hover{border-color:color-mix(in srgb,var(--acc) 55%,var(--bord))}
.inv-ruolo:has(input:checked){border-color:var(--acc);background:color-mix(in srgb,var(--acc) 9%,var(--pan))}
.inv-ruolo input{position:absolute;opacity:0;pointer-events:none}
.inv-ruolo:has(input:focus-visible){outline:2px solid var(--acc);outline-offset:2px}
.inv-ic{font-size:22px;width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:10px;background:var(--pan)}
.inv-ruolo b{display:block}.inv-ruolo small{color:var(--mut);display:block;line-height:1.3}
.inv-fondo{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.acc-barra{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:16px;background:var(--pan);border:1px solid var(--bord)}
.acc-cerca{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:12px;border:1px solid var(--bord);background:var(--pan2)}
.acc-cerca:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 18%,transparent)}
.acc-cerca input{flex:1;border:0!important;background:transparent!important;padding:10px 0!important;font-size:1rem;outline:none;box-shadow:none!important}
.acc-chip{display:flex;flex-wrap:wrap;gap:6px;margin:0}
.acc-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--bord);background:var(--pan2);font-size:.9rem;cursor:pointer;color:var(--txt)}
.acc-pill b{font-variant-numeric:tabular-nums;font-size:.8rem;padding:1px 7px;border-radius:999px;background:var(--pan);color:var(--mut)}
.acc-pill:hover{border-color:var(--acc)}
.acc-pill.avviso b{background:color-mix(in srgb,var(--warn) 22%,transparent);color:#9a5d00}
.acc-pill.on{background:var(--acc);border-color:var(--acc);color:#fff}.acc-pill.on b{background:#ffffff33;color:#fff}
#vista-account .acc-filtri{gap:8px;align-items:center}
#vista-account .acc-tabella{margin-top:12px}
#vista-account .tab-account td:last-child{min-width:0;width:52px;text-align:right}
.acc-nome{display:flex;flex-direction:column;gap:1px;min-width:0}.acc-nome b{font-size:1rem}
.acc-ruoli{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}
.acc-menu{position:relative;display:inline-block}
.acc-menu>summary{list-style:none;cursor:pointer;width:34px;height:34px;padding:0;display:grid;place-items:center;border-radius:10px;font-size:1.2rem;line-height:1}
.acc-menu>summary::-webkit-details-marker{display:none}
.acc-menu[open]>summary{background:color-mix(in srgb,var(--acc) 12%,transparent);border-color:var(--acc)}
.acc-menu-pop{position:fixed;z-index:70;min-width:240px;padding:6px;background:var(--pan);border:1px solid var(--bord);border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.22);display:flex;flex-direction:column;gap:1px;text-align:left;animation:mg-apri .12s ease-out}
.acc-menu-pop .mg-tit{padding:6px 10px 2px}
.acc-menu-pop button{display:flex!important;align-items:center;gap:10px;width:100%;margin:0!important;padding:7px 10px!important;border:0!important;border-radius:9px!important;background:transparent;font-size:.92rem!important;text-align:left;color:var(--txt);white-space:nowrap}
.acc-menu-pop button:hover,.acc-menu-pop button:focus-visible{background:color-mix(in srgb,var(--acc) 10%,transparent);outline:none}
.acc-menu-pop .mi{width:22px;text-align:center;flex:none}
.acc-menu-pop button.pericolo{color:var(--ko)}.acc-menu-pop button.pericolo:hover{background:color-mix(in srgb,var(--ko) 10%,transparent)}
.acc-menu-pop button.conferma{background:color-mix(in srgb,var(--warn) 18%,transparent);font-weight:700}
.acc-vuoto{display:flex;flex-direction:column;align-items:center;gap:4px;padding:34px 10px;text-align:center}.acc-vuoto>span:first-child{font-size:30px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:700px){
  #vista-account .tab-account th:nth-child(3),#vista-account .tab-account td:nth-child(3),#vista-account .tab-account th:nth-child(5),#vista-account .tab-account td:nth-child(5){display:none}
  #vista-account .tab-account th:nth-child(4),#vista-account .tab-account td:nth-child(4){display:table-cell}
  .inv-ruoli{grid-template-columns:1fr}
}
"""
# vecchie regole del cellulare per la tabella: valevano per 10 colonne
T[C] = T[C].replace("#vista-account .tab-account th:nth-child(n+7):not(:last-child),#vista-account .tab-account td:nth-child(n+7):not(:last-child),", "")

# ---------------- inglese
E = json.loads(T['lingua/en.json'])
E.update({
  "Chi si iscrive attiva l'account confermando l'email. Da qui scegli il ruolo di ognuno, assegni i docenti di riferimento, disattivi o elimini.": "People who sign up activate their account by confirming their email. Here you choose each person's role, assign reference teachers, deactivate or delete.",
  "Gli account li crei tu con un invito per email: ognuno sceglie la propria password dal link (valido 7 giorni).": "You create the accounts with an email invitation: each person chooses their password from the link (valid 7 days).",
  '＋ Invita una persona': '＋ Invite a person', '✉ Invita una persona': '✉ Invite a person',
  "riceve un'email con il link per scegliere la password (valido 7 giorni)": 'receives an email with the link to choose the password (valid 7 days)',
  'Nome e cognome': 'Full name', 'Ruolo': 'Role', 'Specializzando': 'Resident', 'Docente': 'Teacher', 'Amministratore': 'Administrator',
  'svolge i casi e vede i propri progressi': 'works through the cases and sees their own progress',
  'segue i suoi studenti, crea classi e compiti': 'follows their students, creates classes and assignments',
  'gestisce account, casi, percorsi e statistiche': 'manages accounts, cases, paths and statistics',
  'Invia invito': 'Send invitation', 'Cerca per nome, email, sede…': 'Search by name, email, site…', 'Cerca': 'Search',
  'Filtra per ruolo e stato': 'Filter by role and status', 'Tutti': 'All', 'Iscritti': 'Members', 'Specializzandi': 'Residents', 'Docenti': 'Teachers', 'Amministratori': 'Administrators',
  'Senza docente': 'No teacher', 'Da attivare': 'To activate', 'Email da confermare': 'Email to confirm', 'Mai un caso': 'Never a case', 'Disattivati': 'Deactivated',
  'Persona': 'Person', 'Ruolo e stato': 'Role and status', 'Docenti / studenti': 'Teachers / students', 'Attività': 'Activity', 'Ultimo accesso': 'Last login', 'Azioni': 'Actions',
  'Nessuna persona trovata': 'No one found', 'Cambia la ricerca o i filtri, oppure invita qualcuno.': 'Change the search or the filters, or invite someone.',
  '{x} persone · {x} attive negli ultimi 30 giorni': '{x} people · {x} active in the last 30 days', '{x} persona · {x} attiva negli ultimi 30 giorni': '{x} person · {x} active in the last 30 days',
  '{x} persone · {x} attiva negli ultimi 30 giorni': '{x} people · {x} active in the last 30 days', '{x} persona · {x} attive negli ultimi 30 giorni': '{x} person · {x} active in the last 30 days',
  '{x} persone': '{x} people', '{x} persona': '{x} person', '{x} di {x}': '{x} of {x}',
  'oggi': 'today', 'ieri': 'yesterday', '{x} giorni fa': '{x} days ago', '1 mese fa': '1 month ago', '{x} mesi fa': '{x} months ago', '1 anno fa': '1 year ago', '{x} anni fa': '{x} years ago',
  'ultimo oggi': 'last today', 'ultimo ieri': 'last yesterday', 'ultimo {x} giorni fa': 'last {x} days ago', 'ultimo {x} mesi fa': 'last {x} months ago', 'ultimo 1 mese fa': 'last 1 month ago',
  'iscritto oggi': 'joined today', 'iscritto ieri': 'joined yesterday', 'iscritto {x} giorni fa': 'joined {x} days ago', 'iscritto {x} mesi fa': 'joined {x} months ago', 'iscritto 1 mese fa': 'joined 1 month ago', 'iscritto {x} anni fa': 'joined {x} years ago', 'iscritto 1 anno fa': 'joined 1 year ago',
  'mai': 'never', 'Accesso': 'Access', 'Account': 'Account',
  'Togli amministratore': 'Remove administrator', 'Togli autore': 'Remove author', 'Rendi autore': 'Make author', 'Togli docente': 'Remove teacher', 'Sblocca docente': 'Unblock teacher', 'Rendi docente': 'Make teacher',
  'Rendi amministratore': 'Make administrator', "Conferma l'account": 'Confirm the account', 'Invia link password': 'Send password link', 'Reinvia invito': 'Resend invitation', 'Nuovo codice': 'New code',
  'Disattiva': 'Deactivate', 'Riattiva': 'Reactivate', 'Elimina': 'Delete', 'Confermi? Premi di nuovo': 'Confirm? Press again',
  'Azioni per {x}': 'Actions for {x}', "✓ Invito inviato a {x}": '✓ Invitation sent to {x}', '⤓ CSV': '⤓ CSV', 'Categoria': 'Category', 'Studenti di un docente': "A teacher's students",
})
T['lingua/en.json'] = json.dumps(E, ensure_ascii=False, separators=(',', ':'))
for n in N: open(W + n, 'w', encoding='utf-8').write(T[n])
print('ok')
