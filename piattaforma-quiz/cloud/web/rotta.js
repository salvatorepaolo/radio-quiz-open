// 1.293: aprendo direttamente un caso (#/caso/…) l'elenco dei casi non si mostra mentre app.js arriva: prima si vedeva,
// si riassestava e poi lasciava il posto al caso (sul telefono lenta, tutta la pagina saltava: CLS 0,25).
// File a parte e non nella pagina: la Content Security Policy del sito non permette script scritti dentro l'HTML.
// app.js toglie la classe appena sceglie la vista (vista() in app.js), e comunque dopo 20 secondi.
if (/^#\/caso\//.test(location.hash) && location.pathname.indexOf('/client/') !== 0) document.documentElement.classList.add('apre-caso');
