# patch_server_1127.py: casi di prova senza accesso (parte 2), revisione dei casi, email «caso della settimana»,
# conteggi senza robot e imbuto nella dashboard. Applicato a cloud/api/logica.mjs e cloud/api/lambda.mjs.
import sys
B = '/Volumes/Caloggero/piattaforma-quiz/cloud/api/'
f = B + 'logica.mjs'; s = open(f).read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:80], s.count(a))
    s = s.replace(a, b)


# --- account: revisore dei casi (lo decide l'amministratore) e caso della settimana per email (lo decide la persona)
rep("""  noDocente: !!a.noDocente, docenti: Array.isArray(a.docenti) ? a.docenti : [], conPassword: !!a.pw, conCodice: !!a.hash,""",
    """  noDocente: !!a.noDocente, docenti: Array.isArray(a.docenti) ? a.docenti : [], conPassword: !!a.pw, conCodice: !!a.hash, revisore: !!a.revisore,""")
rep("""      if (typeof dati.autore === 'boolean') nuovo.autore = dati.autore && nuovo.ruolo === 'docente';
      // docenti di riferimento""",
    """      if (typeof dati.autore === 'boolean') nuovo.autore = dati.autore && nuovo.ruolo === 'docente';
      // 27/11: revisore dei casi (pagina «Casi da rivedere», conferma della revisione): solo un docente autore dei casi
      if (typeof dati.revisore === 'boolean') nuovo.revisore = dati.revisore;
      nuovo.revisore = !!nuovo.revisore && nuovo.ruolo === 'docente' && !!nuovo.autore;
      // docenti di riferimento""")
rep("""    email: a.email || '', categoria: a.categoria || '', sede: a.sede || '', anno: a.anno || '', docenti, avvisi: a.avvisi !== false,""",
    """    email: a.email || '', categoria: a.categoria || '', sede: a.sede || '', anno: a.anno || '', docenti, avvisi: a.avvisi !== false,
    settimana: a.settimana === true, revisore: a.ruolo === 'admin' || (a.ruolo === 'docente' && !!a.autore && !!a.revisore), creato: a.creato || '',""")
rep("""  if (typeof d.avvisi === 'boolean') out.avvisi = d.avvisi;
  return out;""",
    """  if (typeof d.avvisi === 'boolean') out.avvisi = d.avvisi;
  if (typeof d.settimana === 'boolean') out.settimana = d.settimana;   // 27/11: caso della settimana per email (spento di base)
  return out;""")

# --- caso: «prova» (solo l'amministratore) e «revisione» (solo dal pulsante del revisore) sopravvivono al salvataggio
rep("""  // acquisizione sbagliata (posizionamento, artefatti, protocollo): percorso per TSRM e radiologi""",
    """  // 27/11: caso aperto anche senza accesso (prova e caso del giorno); lo decide l'amministratore
  ...(d.prova === true ? { prova: true } : {}),
  // acquisizione sbagliata (posizionamento, artefatti, protocollo): percorso per TSRM e radiologi""")
rep("""    if (!admin) for (const f of ['anatomia', 'scelte', 'score']) { delete nuovo[f]; if (caso[f] === false) nuovo[f] = false; }""",
    """    if (!admin) for (const f of ['anatomia', 'scelte', 'score']) { delete nuovo[f]; if (caso[f] === false) nuovo[f] = false; }
    if (!admin) { delete nuovo.prova; if (caso.prova === true) nuovo.prova = true; }
    if (caso.revisione) nuovo.revisione = caso.revisione;   // la revisione la scrive solo POST /api/casi/<id>/revisione""")

# --- visite: niente conteggi dai browser automatici (controllo quotidiano, test, motori di ricerca)
rep("""  if (parti[1] === 'visita' && metodo === 'POST') {
    const p = String(dati.p || ''), c = String(dati.c || '');""",
    """  if (parti[1] === 'visita' && metodo === 'POST') {
    if (ROBOT.test(String(req.headers?.['user-agent'] || ''))) return json(200, { ok: true, robot: true });
    const p = String(dati.p || ''), c = String(dati.c || '');""")
rep("""const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;""",
    """const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;
// 27/11: browser automatici (controllo quotidiano e test con Playwright, motori di ricerca): non contano nelle visite
export const ROBOT = /HeadlessChrome|Playwright|bot\\b|crawler|spider|Lighthouse|PTST|curl\\//i;""")

# --- ospite: conteggio dei casi di prova aperti
rep("""  if (metodo === 'GET' && azione === '') {
    const { spiegazione, opzioni, vista,""",
    """  if (metodo === 'GET' && azione === '') {
    if (ospite) await conta('_provaApri');
    const { spiegazione, opzioni, vista,""")

# --- dashboard: nuove voci per giorno e imbuto (visite → prova → iscrizione → primo caso → ritorno)
rep("""    for (let k = n - 1; k >= 0; k--) perGiorno[giorno(k)] = { giorno: giorno(k), pagine: 0, utenti: 0, login: 0, sessioni: 0, mobile: 0, iscrizioni: 0 };""",
    """    for (let k = n - 1; k >= 0; k--) perGiorno[giorno(k)] = { giorno: giorno(k), pagine: 0, utenti: 0, login: 0, sessioni: 0, mobile: 0, iscrizioni: 0, provaApri: 0, prova: 0 };""")
rep("""    const titoli = Object.fromEntries(casi.map((c) => [c.id, c.titolo || c.id]));
    return json(200, { generato: new Date().toISOString(), da, giorni: Object.values(perGiorno),""",
    """    const titoli = Object.fromEntries(casi.map((c) => [c.id, c.titolo || c.id]));
    // imbuto del periodo: visite (sessioni) → casi di prova aperti e risolti da ospiti → iscrizioni → iscritti del periodo
    // che hanno risolto almeno un caso → tornati in un giorno diverso da quello dell'iscrizione
    const tot = (k) => Object.values(perGiorno).reduce((t, g) => t + (g[k] || 0), 0);
    const nuovi = iscritti.filter((a) => String(a.creato || '') >= da && a.ruolo !== 'docente');
    const risolti = new Set((await M.risultati().catch(() => [])).map((r) => r.account));
    const imbuto = { visite: tot('sessioni'), provaApri: tot('provaApri'), prova: tot('prova'), iscrizioni: nuovi.length,
      primoCaso: nuovi.filter((a) => risolti.has(a.id)).length,
      tornati: nuovi.filter((a) => String(a.ultimoAccesso || '').slice(0, 10) > String(a.creato || '').slice(0, 10)).length };
    return json(200, { generato: new Date().toISOString(), da, giorni: Object.values(perGiorno), imbuto,""")

# --- revisione dei casi: elenco per il revisore e conferma
rep("""  // ---------------- casi
  if (parti[1] !== 'casi') return json(404, { errore: 'non trovato' });""",
    """  // ---------------- revisione dei casi (27/11): il revisore (docente autore scelto dall'amministratore) vede i casi da
  // rivedere (scritti da Claude o con dubbi aperti nella nota) e conferma o chiede correzioni; tutto resta nel caso
  const revisore = admin || (io.ruolo === 'docente' && !!io.autore && !!io.revisore);
  if (parti[1] === 'revisione' && parti[2] === 'casi' && parti.length === 3 && metodo === 'GET') {
    if (!revisore) return json(403, { errore: 'solo il revisore dei casi' });
    const l = (await M.elencoCasi()).filter(visibile).map((c) => ({ id: c.id, titolo: c.titolo || c.id, titolo_interno: c.titolo_interno || '', modalita: c.modalita || '',
      distretto: c.distretto || '', motivo: motivoRevisione(c), ...(c.revisione ? { revisione: c.revisione } : {}) }));
    const ord = (a, b) => (a.id < b.id ? -1 : 1);
    return json(200, { daRivedere: l.filter((c) => c.motivo && c.revisione?.esito !== 'confermato').sort(ord),
      rivisti: l.filter((c) => c.revisione).sort((a, b) => String(b.revisione.data).localeCompare(String(a.revisione.data))).slice(0, 200) });
  }

  // ---------------- casi
  if (parti[1] !== 'casi') return json(404, { errore: 'non trovato' });""")
rep("""  if (metodo === 'GET' && azione === 'completo') {
    if (!autore) return json(403, { errore: 'solo autori dei casi' });""",
    """  if (metodo === 'POST' && azione === 'revisione') {
    if (!revisore) return json(403, { errore: 'solo il revisore dei casi' });
    if (!caso) return json(404, { errore: 'caso non trovato' });
    const esito = dati.esito === 'confermato' ? 'confermato' : dati.esito === 'da-correggere' ? 'da-correggere' : '';
    if (!esito) return json(400, { errore: 'esito non valido' });
    const nota = pulisciTesto(dati.nota, 1000);
    if (esito === 'da-correggere' && nota.length < 3) return json(400, { errore: 'Scrivi che cosa va corretto.' });
    const data = ora16(), chi = io.nome || 'Revisore';
    await M.scriviCaso(id, { ...caso, revisione: { esito, da: chi, account: io.id, data, ...(nota ? { nota } : {}) },
      nota_docente: notaDopoRevisione(caso.nota_docente, esito, chi, data, nota) });
    return json(200, { ok: true, esito, data });
  }
  if (metodo === 'GET' && azione === 'completo') {
    if (!autore) return json(403, { errore: 'solo autori dei casi' });""")
rep("""export function controlliCaso(c) {""",
    """// 27/11: perché un caso va rivisto da un medico (vuoto = non serve): scritto da Claude e non ancora rivisto, o dubbi nella nota
export function motivoRevisione(c) {
  const n = String(c.nota_docente || '');
  if (c.revisione?.esito === 'confermato') return '';
  if (c.revisione?.esito === 'da-correggere') return 'correzioni chieste dal revisore';
  if (/NON ancora rivist/i.test(n)) return 'non ancora rivisto dal medico';
  if (/verificar|da controllare/i.test(n) && !/confermat\\w* dal docente/i.test(n)) return 'dubbi aperti nella nota';
  return '';
}
export function notaDopoRevisione(nota, esito, chi, data, testo = '') {
  let n = String(nota || '');
  const quando = `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
  if (esito === 'confermato') n = n.replace(/NON ancora rivist\\w* dal medico\\.?/gi, `Rivisto dal medico (${chi}) il ${quando}.`);
  const riga = esito === 'confermato' ? `[revisione ${quando}] Confermato dal docente ${chi}${testo ? ': ' + testo : '.'}`
    : `[revisione ${quando}] ${chi}: da correggere: ${testo}`;
  n = (n ? n.trimEnd() + '\\n' : '') + riga;
  return n.length > 5000 ? n.slice(n.length - 5000) : n;
}
export function controlliCaso(c) {""")

# --- caso della settimana per email: chi lo chiede nel profilo; una volta per caso; disiscrizione con un clic
rep("""  if (!cfg.inviaEmail || !M.elencoClassi) return { inviati: 0, cancellati };""",
    """  const settimana = await emailSettimana(cfg, oggi).catch((e) => { console.error('settimana', e?.message || e); return 0; });
  if (!cfg.inviaEmail || !M.elencoClassi) return { inviati: 0, cancellati, settimana };""")
rep("""  return { inviati, cancellati, riepiloghi };
}""",
    """  return { inviati, cancellati, riepiloghi, settimana };
}
export const firmaSettimana = (segreto, id) => createHmac('sha256', String(segreto || '')).update('settimana:' + id).digest('hex').slice(0, 24);
/** Caso della settimana per email (27/11): dal file pubblico settimana.json, a chi l'ha chiesto (settimana: true),
 *  al più una volta per caso, solo nella sua settimana (7 giorni dalla data «da»). */
export async function emailSettimana(cfg, oggi = new Date(), leggi = null) {
  const M = cfg.magazzino;
  if (!cfg.inviaEmail || istanzaDi(cfg).modo === 'azienda') return 0;
  const sito = radice(cfg.indirizzo);
  let l = null; try { l = leggi ? await leggi() : await fetch(sito + '/settimana.json').then((r) => (r.ok ? r.json() : null)); } catch { return 0; }
  const g = giornoItalia(oggi);
  const c = (Array.isArray(l) ? l : []).filter((x) => x && /^\\d{4}-\\d{2}-\\d{2}$/.test(x.da || '') && x.da <= g && ID_OK.test(x.id || '')).sort((x, y) => (x.da < y.da ? 1 : -1))[0];
  if (!c || piuGiorni(c.da, 6) < g) return 0;
  let n = 0;
  for (const a of await M.elencoAccount()) {
    if (a.settimana !== true || !a.email || a.attivo === false || a.stato === 'attesa' || a.settimanaInviata === c.da) continue;
    const esci = `${sito}/api/settimana/esci?u=${encodeURIComponent(a.id)}&t=${firmaSettimana(cfg.segreto, a.id)}`;
    try {
      await cfg.inviaEmail(a.email, `Caso della settimana: ${c.titolo || 'nuovo caso'}`, corpoEmail([`Ciao ${a.nome},`,
        `il caso di questa settimana è «${c.titolo || 'un nuovo caso'}». Ci vogliono pochi minuti: apri le immagini e dai la tua diagnosi.`],
        `${sito}/#/caso/${c.id}`, { pulsante: 'Apri il caso', piede: `Ricevi questa email perché l'hai chiesta nel tuo profilo. Per non riceverla più: ${esci}` }));
      await M.scriviAccount({ ...a, settimanaInviata: c.da }); n++;
    } catch (e) { console.error('settimana', e?.message || e); }
  }
  return n;
}""")
# disiscrizione (senza accesso, dal link nell'email)
rep("""  // ---------------- prova senza registrazione (27/11)""",
    """  if (parti[1] === 'settimana' && parti[2] === 'esci' && parti.length === 3 && metodo === 'GET') {
    const u = String(req.query?.u || ''), t = String(req.query?.t || '');
    const ok = ID_OK.test(u) && t.length === 24 && timingSafeEqual(Buffer.from(t), Buffer.from(firmaSettimana(cfg.segreto, u)));
    const a = ok ? await M.leggiAccount(u) : null;
    if (a && a.settimana === true) await M.scriviAccount({ ...a, settimana: false });
    const testo = a ? 'Non riceverai più il caso della settimana per email. Puoi riattivarlo dal tuo profilo.' : 'Link non valido o scaduto.';
    return { stato: a ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      corpo: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiz Radiologia</title><body style="font-family:system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem"><h1>Quiz Radiologia</h1><p>${testo}</p><p><a href="/">Vai al sito</a></p>` };
  }
  // ---------------- prova senza registrazione (27/11)""")
open(f, 'w').write(s)

# lambda: anche lo user-agent (per non contare i robot nelle visite)
f2 = B + 'lambda.mjs'; t = open(f2).read()
a = "      headers: { cookie: cookieHeader },"
assert t.count(a) == 1
t = t.replace(a, "      headers: { cookie: cookieHeader, 'user-agent': event.headers?.['user-agent'] || '' },")
open(f2, 'w').write(t)
print('ok')
