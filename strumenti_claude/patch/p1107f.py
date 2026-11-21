# 1.215: client — collegamento al PACS con DICOMweb (QIDO-RS ricerca, WADO-RS apertura, STOW-RS invio di SR e GSPS);
# spento di base, solo nel client; credenziali solo in memoria
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

a = open(R + 'web/app.js', encoding='utf-8').read()
FUNZ = r'''// ---- client: collegamento al PACS con DICOMweb (spento di base; si accende nelle impostazioni del client).
// Ricerca QIDO-RS, apertura WADO-RS (multipart), invio STOW-RS di misure (SR) e annotazioni (GSPS). I dati passano solo tra
// questo computer e il PACS. Nome utente e password restano in memoria (si chiedono a ogni sessione).
const pacsAttivo = () => { try { return localStorage.getItem('rq-cl-pacs') === '1'; } catch { return false; } };
const pacsBase = () => { try { return (localStorage.getItem('rq-cl-pacs-url') || '').trim().replace(/\/+$/, ''); } catch { return ''; } };
const PACS = { utente: '', password: '' };
const pacsIntest = (extra = {}) => ({ ...(PACS.utente ? { Authorization: 'Basic ' + btoa(unescape(encodeURIComponent(`${PACS.utente}:${PACS.password}`))) } : {}), ...extra });
const jv = (o, tag) => { const v = o?.[tag]?.Value?.[0]; return v == null ? '' : typeof v === 'object' ? (v.Alphabetic || '') : String(v); };
async function qidoPacs(param) {
  const base = pacsBase(); if (!base) throw new Error('indirizzo del PACS non impostato');
  const q = new URLSearchParams({ limit: '100', includefield: '00081030,00080061,00201206,00100030', ...param });
  let r; try { r = await fetch(`${base}/studies?${q}`, { headers: pacsIntest({ Accept: 'application/dicom+json' }) }); }
  catch { throw new Error('PACS non raggiungibile (indirizzo, rete o permesso CORS del PACS)'); }
  if (r.status === 204) return []; if (r.status === 401 || r.status === 403) throw new Error('accesso al PACS negato: controlla utente e password');
  if (!r.ok) throw new Error(`il PACS ha risposto ${r.status}`);
  return (await r.json()).map((o) => ({ uid: jv(o, '0020000D'), nome: jv(o, '00100010').replace(/\^+/g, ' ').trim(), pid: jv(o, '00100020'), nascita: jv(o, '00100030'),
    data: jv(o, '00080020'), descrizione: jv(o, '00081030'), modalita: (o['00080061']?.Value || []).join('/'), nSerie: jv(o, '00201206'), fonte: 'pacs', pacs: true })).filter((s) => s.uid);
}
async function cercaPacs() {
  const p = {}, nome = $('#cl-pacs-nome').value.trim(), id = $('#cl-pacs-id').value.trim(), da = $('#cl-pacs-da').value.replace(/-/g, ''), al = $('#cl-pacs-a').value.replace(/-/g, ''), mod = $('#cl-pacs-mod').value;
  if (nome) p.PatientName = `*${nome.replace(/\s+/g, '*')}*`; if (id) p.PatientID = id; if (da || al) p.StudyDate = `${da}-${al}`; if (mod) p.ModalitiesInStudy = mod;
  if (!Object.keys(p).length) throw new Error('scrivi almeno un criterio (nome, ID, date o metodica)');
  return qidoPacs(p);
}
// risposta multipart/related di WADO-RS: un file DICOM per parte
function dividiMultipart(buf, tipo) {
  const m = /boundary="?([^";,]+)"?/i.exec(tipo || ''); if (!m) throw new Error('risposta del PACS non multipart');
  const b = new TextEncoder().encode('--' + m[1]), u = new Uint8Array(buf), parti = [];
  const trova = (da) => { let i = da; while ((i = u.indexOf(b[0], i)) !== -1 && i <= u.length - b.length) { let k = 1; while (k < b.length && u[i + k] === b[k]) k++; if (k === b.length) return i; i++; } return -1; };
  let i = trova(0);
  while (i >= 0) {
    const s = i + b.length; if (u[s] === 45 && u[s + 1] === 45) break;
    let h = s; while (h < u.length - 3 && !(u[h] === 13 && u[h + 1] === 10 && u[h + 2] === 13 && u[h + 3] === 10)) h++;
    const inizio = h + 4, j = trova(inizio); if (j < 0) break;
    parti.push(u.slice(inizio, u[j - 2] === 13 && u[j - 1] === 10 ? j - 2 : j)); i = j;
  }
  return parti;
}
async function apriDaPacs(st, aggiungi = false) {
  const base = pacsBase(), s = $('#cl-stato'); s.textContent = 'Chiedo le serie al PACS…';
  const rs = await fetch(`${base}/studies/${st.uid}/series`, { headers: pacsIntest({ Accept: 'application/dicom+json' }) }).catch(() => null);
  const serie = rs?.ok ? (await rs.json()).map((o) => jv(o, '0020000E')).filter(Boolean) : [];
  const files = []; let n = 0;
  const scarica = async (url) => {
    const r = await fetch(url, { headers: pacsIntest({ Accept: 'multipart/related; type="application/dicom"; transfer-syntax=*' }) });
    if (!r.ok) throw new Error(`il PACS ha risposto ${r.status}`);
    for (const p of dividiMultipart(await r.arrayBuffer(), r.headers.get('content-type'))) files.push(new File([p], `pacs_${String(++n).padStart(5, '0')}.dcm`, { type: 'application/dicom' }));
  };
  if (serie.length) for (let i = 0; i < serie.length; i++) { s.textContent = `Scarico dal PACS: serie ${i + 1} di ${serie.length}…`; await scarica(`${base}/studies/${st.uid}/series/${serie[i]}`); }
  else { s.textContent = 'Scarico lo studio dal PACS…'; await scarica(`${base}/studies/${st.uid}`); }
  if (!files.length) throw new Error('lo studio non contiene immagini');
  if (!aggiungi) { dimenticaManiglie(); CL.daPacs = { uid: st.uid }; }
  return aggiungi ? caricaClient(files, { aggiungi: true }) : caricaClient(files);
}
async function inviaAlPacs(lista) {
  const base = pacsBase(); if (!base) throw new Error('PACS non impostato');
  const conf = 'rq' + Math.random().toString(36).slice(2), enc = new TextEncoder(), parti = [];
  for (const f of lista) parti.push(enc.encode(`--${conf}\r\nContent-Type: application/dicom\r\n\r\n`), f.dati, enc.encode('\r\n'));
  parti.push(enc.encode(`--${conf}--\r\n`));
  let r; try { r = await fetch(`${base}/studies`, { method: 'POST', headers: pacsIntest({ 'Content-Type': `multipart/related; type="application/dicom"; boundary=${conf}`, Accept: 'application/dicom+json' }), body: new Blob(parti) }); }
  catch { throw new Error('PACS non raggiungibile'); }
  if (!r.ok) throw new Error(`il PACS ha risposto ${r.status}`);
  return lista.length;
}
async function mostraPacs(risultati = null) {
  const box = $('#cl-pacs'); if (!box || !CLIENT) return;
  box.hidden = !pacsAttivo() || !pacsBase();
  if (!risultati) return;
  $('#cl-pacs-lista').innerHTML = risultati.length ? `<table class="cl-rec-tab"><thead><tr><th>Paziente</th><th>Data</th><th>Esame</th><th></th></tr></thead><tbody>${risultati.map((v, i) => `<tr>
      <td><b>${esc(v.nome || '—')}</b>${v.pid ? `<span class="muted small"> · ID ${esc(v.pid)}</span>` : ''}</td><td class="num">${dataDicom(v.data) || '—'}</td>
      <td>${esc([nomeModalita(v.modalita), v.descrizione].filter(Boolean).join(' · '))}${v.nSerie ? ` <span class="muted small">(${esc(v.nSerie)} serie)</span>` : ''}</td>
      <td class="cl-rec-az"><button type="button" class="primary piccolo" data-pacs="${i}">Apri</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Nessuno studio trovato.</p>';
  box.querySelectorAll('[data-pacs]').forEach((b) => { b.onclick = () => apriDaPacs(risultati[+b.dataset.pacs]).catch((e) => { $('#cl-stato').textContent = 'Studio non aperto dal PACS: ' + e.message; }); });
}
function initPacs() {
  if (!CLIENT || !$('#cl-imp-pacs')) return;
  const c = $('#cl-imp-pacs'), box = $('#cl-pacs-box'), url = $('#cl-pacs-url');
  c.checked = pacsAttivo(); box.hidden = !c.checked; url.value = pacsBase();
  c.onchange = () => { try { localStorage.setItem('rq-cl-pacs', c.checked ? '1' : '0'); if (!c.checked) { localStorage.removeItem('rq-cl-pacs-url'); url.value = ''; PACS.utente = PACS.password = ''; } } catch {} box.hidden = !c.checked; mostraPacs(); aggiornaVociPacs(); };
  url.onchange = () => { try { localStorage.setItem('rq-cl-pacs-url', url.value.trim()); } catch {} mostraPacs(); aggiornaVociPacs(); };
  $('#cl-pacs-utente').oninput = (e) => { PACS.utente = e.target.value; };
  $('#cl-pacs-password').oninput = (e) => { PACS.password = e.target.value; };
  $('#cl-pacs-prova').onclick = async () => { const st = $('#cl-pacs-prova-stato'); st.textContent = 'Provo…'; try { url.onchange(); await qidoPacs({ limit: '1' }); st.textContent = '✓ PACS raggiungibile'; } catch (e) { st.textContent = '✗ ' + e.message; } };
  $('#cl-pacs-cerca').onclick = async () => { const st = $('#cl-pacs-stato'); st.textContent = 'Cerco…'; try { const r = await cercaPacs(); st.textContent = `${r.length} ${r.length === 1 ? 'studio' : 'studi'}`; mostraPacs(r); } catch (e) { st.textContent = e.message; } };
  for (const id of ['#cl-pacs-nome', '#cl-pacs-id']) $(id).onkeydown = (e) => { if (e.key === 'Enter') $('#cl-pacs-cerca').click(); };
  mostraPacs(); aggiornaVociPacs();
}
function aggiornaVociPacs() { const x = qs1('input[name="ex-cosa"][value="pacs"]')?.closest('label'); if (x) x.hidden = !(pacsAttivo() && pacsBase()); }
'''
a = sost(a, "async function fileDaManiglie(lista) {", FUNZ + "async function fileDaManiglie(lista) {", 'funzioni')
# archivio: voci dal PACS (riaperte con WADO-RS) e precedenti cercati anche nel PACS
a = sost(a, "  await pausa(500); const man = ULTIMO.maniglie; if (!man?.length) return;",
  "  await pausa(500); const man = ULTIMO.maniglie, pacs = CL.daPacs; if (!man?.length && !pacs) return;", 'arch pacs 1')
a = sost(a, "  const voce = { id: String(CL.chiave || Date.now()).slice(0, 400), maniglie: man, quando: Date.now(), cartella: man.map((x) => x.name).join(', '), titolo: CL.studio.caso.titolo, ...(h || {}) };",
  "  const voce = { id: String(CL.chiave || Date.now()).slice(0, 400), ...(man?.length ? { maniglie: man } : { daPacs: true }), quando: Date.now(), cartella: man?.length ? man.map((x) => x.name).join(', ') : 'PACS', titolo: CL.studio.caso.titolo, ...(h || {}) };", 'arch pacs 2')
a = sost(a, "async function apriDaArchivio(v, aggiungi = false) {\n",
  "async function apriDaArchivio(v, aggiungi = false) {\n  if ((v.daPacs || v.pacs) && v.uid && !v.maniglie?.length) { if (!pacsAttivo() || !pacsBase()) throw new Error('lo studio viene dal PACS: accendi il collegamento nelle impostazioni'); return apriDaPacs(v, aggiungi); }\n", 'arch pacs 3')
a = sost(a, "  const cand = (await vociArchivio()).filter(stesso)",
  "  const dalPacs = pacsAttivo() && pacsBase() && h.pid ? await qidoPacs({ PatientID: h.pid }).catch(() => []) : [];\n  const cand = [...(await vociArchivio()), ...dalPacs].filter(stesso)", 'precedenti pacs')
# caricamento da file: non viene dal PACS
a = sost(a, "  CL.chiave = [...perSerie.values()].map((s) => s.uid).sort().join('|');",
  "  CL.chiave = [...perSerie.values()].map((s) => s.uid).sort().join('|');\n  if (!aggiungi && !files.every((f) => /^pacs_\\d+\\.dcm$/.test(f.name || ''))) CL.daPacs = null;", 'daPacs reset')
# esporta: invio al PACS
a = sost(a, "  } else if (cosa === 'sr') {",
  "  } else if (cosa === 'pacs') {\n"
  "    st('Preparo misure (SR) e annotazioni (GSPS)…'); const da = [];\n"
  "    try { da.push(...(await esportaGSPS({ sr: true }))); } catch {}\n"
  "    try { da.push(...(await esportaGSPS())); } catch {}\n"
  "    if (!da.length) throw new Error('nessuna misura o annotazione da inviare');\n"
  "    st('Invio al PACS…'); const n = await inviaAlPacs(da);\n"
  "    st(`Inviati al PACS ${n} ${n === 1 ? 'oggetto' : 'oggetti'} DICOM (misure SR e annotazioni GSPS), collegati alle immagini originali dello studio.`);\n"
  "  } else if (cosa === 'sr') {", 'esporta pacs')
a = sost(a, "  initArchivio().catch((e) => console.warn('archivio', e));", "  initArchivio().catch((e) => console.warn('archivio', e)); initPacs();", 'init')
a = sost(a, "mostraUltimo(); mostraArchivio(); if ($('#cl-precedente'))", "mostraUltimo(); mostraArchivio(); mostraPacs(); if ($('#cl-precedente'))", 'home')
open(R + 'web/app.js', 'w', encoding='utf-8').write(a)

h = open(R + 'web/index.html', encoding='utf-8').read()
h = sost(h, '      <p id="cl-cartella-no" class="muted small" hidden>La cartella predefinita funziona in Chrome ed Edge sul computer.</p>\n',
  '      <p id="cl-cartella-no" class="muted small" hidden>La cartella predefinita funziona in Chrome ed Edge sul computer.</p>\n'
  '      <label class="check"><input type="checkbox" id="cl-imp-pacs"> Collegamento al PACS (DICOMweb): cerca e apre gli studi dal PACS e vi rimanda misure e annotazioni (spento di base)</label>\n'
  '      <div id="cl-pacs-box" class="cl-cartella-box cl-pacs-box" hidden>\n'
  '        <label>Indirizzo DICOMweb <input type="url" id="cl-pacs-url" placeholder="http://localhost:8042/dicom-web" size="34"></label>\n'
  '        <label>Utente <input type="text" id="cl-pacs-utente" autocomplete="off" size="10"></label> <label>Password <input type="password" id="cl-pacs-password" autocomplete="off" size="10"></label>\n'
  '        <button type="button" id="cl-pacs-prova" class="ghost">Prova il collegamento</button> <span id="cl-pacs-prova-stato" class="muted small"></span>\n'
  '        <p class="muted small">Utente e password restano solo in memoria e si chiedono a ogni sessione. Il PACS deve permettere le richieste da questa pagina (CORS); dal sito sono ammessi gli indirizzi su questo computer (localhost), per esempio Orthanc o un proxy verso il PACS dell\'ospedale.</p>\n'
  '      </div>\n', 'impostazioni pacs')
h = sost(h, '    <section id="cl-recenti" class="cl-recenti" hidden aria-label="Esami recenti">',
  '    <section id="cl-pacs" class="cl-recenti" hidden aria-label="Cerca nel PACS">\n'
  '      <div class="cl-rec-testa"><h2>Cerca nel PACS</h2></div>\n'
  '      <div class="cl-pacs-filtri"><input type="search" id="cl-pacs-nome" placeholder="Cognome e nome" aria-label="Nome del paziente"><input type="search" id="cl-pacs-id" placeholder="ID paziente" aria-label="ID del paziente">\n'
  '        <label>dal <input type="date" id="cl-pacs-da"></label><label>al <input type="date" id="cl-pacs-a"></label>\n'
  '        <select id="cl-pacs-mod" aria-label="Metodica"><option value="">tutte le metodiche</option><option value="CT">TC</option><option value="MR">RM</option><option value="CR">RX (CR)</option><option value="DX">RX (DX)</option><option value="MG">Mammografia</option><option value="US">Ecografia</option><option value="PT">PET</option><option value="NM">Medicina nucleare</option><option value="XA">Angiografia</option></select>\n'
  '        <button type="button" id="cl-pacs-cerca" class="primary">Cerca</button> <span id="cl-pacs-stato" class="muted small"></span></div>\n'
  '      <div id="cl-pacs-lista"></div>\n'
  '    </section>\n'
  '    <section id="cl-recenti" class="cl-recenti" hidden aria-label="Esami recenti">', 'sezione pacs')
h = sost(h, '  <label class="check"><input type="radio" name="ex-cosa" value="sr">',
  '  <label class="check" hidden><input type="radio" name="ex-cosa" value="pacs"> Invia al PACS misure (SR) e annotazioni (GSPS) di questo esame</label>\n  <label class="check"><input type="radio" name="ex-cosa" value="sr">', 'radio pacs')
open(R + 'web/index.html', 'w', encoding='utf-8').write(h)

s = open(R + 'web/style.css', encoding='utf-8').read()
if '.cl-pacs-filtri' not in s:
    s += '''
/* 1.215 client: PACS DICOMweb */
.cl-pacs-filtri{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.cl-pacs-filtri input[type=search]{flex:1 1 160px;max-width:240px}
.cl-pacs-box{flex-direction:column;align-items:flex-start}
.cl-pacs-box label{display:inline-flex;gap:6px;align-items:center}
'''
    open(R + 'web/style.css', 'w', encoding='utf-8').write(s)

# CSP: il client può collegarsi a un PACS (o proxy) su questo computer
st = open(R + 'lib/stack.mjs', encoding='utf-8').read()
if 'http://localhost:*' not in st:
    st = sost(st, "`connect-src 'self' https://*.s3.${this.region}.amazonaws.com https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com`",
      "`connect-src 'self' https://*.s3.${this.region}.amazonaws.com https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*`", 'csp')
    open(R + 'lib/stack.mjs', 'w', encoding='utf-8').write(st)

en = json.load(open(R + 'web/lingua/en.json', encoding='utf-8'))
for k, v in {
  'Collegamento al PACS (DICOMweb): cerca e apre gli studi dal PACS e vi rimanda misure e annotazioni (spento di base)': 'PACS connection (DICOMweb): searches and opens studies from the PACS and sends measurements and annotations back (off by default)',
  'Indirizzo DICOMweb': 'DICOMweb address', 'Utente': 'User', 'Password': 'Password', 'Prova il collegamento': 'Test connection',
  "Utente e password restano solo in memoria e si chiedono a ogni sessione. Il PACS deve permettere le richieste da questa pagina (CORS); dal sito sono ammessi gli indirizzi su questo computer (localhost), per esempio Orthanc o un proxy verso il PACS dell'ospedale.": "User and password stay in memory only and are asked at every session. The PACS must allow requests from this page (CORS); from the site, addresses on this computer (localhost) are allowed, for example Orthanc or a proxy to the hospital PACS.",
  'Cerca nel PACS': 'Search the PACS', 'Cognome e nome': 'Last and first name', 'ID paziente': 'Patient ID', 'dal': 'from', 'al': 'to', 'tutte le metodiche': 'all modalities', 'Cerca': 'Search',
  'Nessuno studio trovato.': 'No study found.', 'Invia al PACS misure (SR) e annotazioni (GSPS) di questo esame': 'Send this exam\'s measurements (SR) and annotations (GSPS) to the PACS',
  'Chiedo le serie al PACS…': 'Asking the PACS for the series…', 'Scarico dal PACS: serie {x} di {x}…': 'Downloading from the PACS: series {x} of {x}…', 'Scarico lo studio dal PACS…': 'Downloading the study from the PACS…',
  '✓ PACS raggiungibile': '✓ PACS reachable', 'Provo…': 'Testing…', 'Cerco…': 'Searching…', 'Invio al PACS…': 'Sending to the PACS…',
  'Inviati al PACS {x} {x} DICOM (misure SR e annotazioni GSPS), collegati alle immagini originali dello studio.': 'Sent {x} DICOM {x} to the PACS (SR measurements and GSPS annotations), linked to the original images of the study.',
  'Studio non aperto dal PACS: {x}': 'Study not opened from the PACS: {x}',
}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'web/lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('PACS OK')
