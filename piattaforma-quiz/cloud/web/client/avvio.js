// primo avvio della versione client: registra il service worker (che poi serve il visualizzatore anche offline) e ricarica
(async () => {
  // lingua come in i18n.js: ?lang, poi la scelta salvata, poi quella del browser
  const q = new URLSearchParams(location.search).get('lang');
  let pref = null; try { pref = localStorage.getItem('rq-lingua'); } catch {}
  const EN = (q === 'en' || q === 'it' ? q : (pref || ((navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'))) === 'en';
  const t = (it, en) => (EN ? en : it);
  if (EN) {
    document.documentElement.lang = 'en'; document.title = 'DICOM viewer · radio-quiz';
    const h = document.querySelector('h1'); if (h) h.textContent = 'DICOM viewer';
    const a = document.querySelector('.avv'); if (a) a.textContent = '⚠ Not for medical use: a teaching tool, not a medical device.';
    const p = document.getElementById('m'); if (p) p.textContent = 'Preparing the DICOM viewer…';
  }
  const m0 = document.getElementById('m');
  const m = { set textContent(t) { m0.textContent = t; document.querySelector('.giro')?.remove(); } };
  if (!('serviceWorker' in navigator)) { m.textContent = t('Questo browser non può installare il visualizzatore: usa Chrome, Edge, Firefox o Safari aggiornati.', 'This browser cannot install the viewer: use an up-to-date Chrome, Edge, Firefox or Safari.'); return; }
  try {
    await navigator.serviceWorker.register('/client/sw.js', { scope: '/client/' });
    await navigator.serviceWorker.ready;
    let n = 0; try { n = +(sessionStorage.getItem('rq-avvio') || 0); sessionStorage.setItem('rq-avvio', String(n + 1)); } catch {}
    if (n > 2) { m.textContent = t('Il visualizzatore non si avvia: ricarica la pagina; se il problema resta, svuota la cache del sito.', 'The viewer does not start: reload the page; if the problem persists, clear the site cache.'); return; }
    location.reload();
  } catch (e) { m.textContent = t('Avvio non riuscito: ', 'Start-up failed: ') + e.message; }
})();
