"""Aspetto «sala refertazione» (27/11/2026): apertura scura con un'immagine vera nella pagina iniziale e nell'elenco dei
casi, zona delle immagini del caso scura come una workstation. index.html, app.js, style.css, lingua/en.json."""
import json, re, sys
W = "/Volumes/Caloggero/piattaforma-quiz/cloud/web/"
def sost(t, a, b, n=1):
    if t.count(a) != n: sys.exit(f"atteso {n}, trovato {t.count(a)}: {a[:90]!r}")
    return t.replace(a, b)
def estrai(t, inizio, fine):
    i = t.index(inizio); j = t.index(fine, i) + len(fine); return t[:i] + t[j:], t[i:j]

h = open(W + "index.html", encoding="utf-8").read()
assert 'id="hv-eroe"' not in h
# --- pagina iniziale: titolo, pulsanti e numeri escono dalla colonna e vanno nell'apertura scura
pezzi = {}
for nome, ini, fin in [("kicker", '<p class="hv-kicker">', "</p>\n"), ("h1", "<h1>Impara a refertare su casi veri</h1>", "\n"),
                       ("sub", '<p class="hv-sub">', "</p>\n"), ("cta", '<div class="hv-cta">', "</div>\n"),
                       ("video", '<p class="hv-video">', "</p>\n"), ("fiducia", '<p class="hv-fiducia">', "</p>\n"),
                       ("numeri", '<ul class="hv-numeri"', "</ul>\n")]:
    h, pezzi[nome] = estrai(h, ini, fin)
pezzi["h1"] = pezzi["h1"].replace("<h1>", '<h1 id="hv-eroe-tit">')
LOBI = [("frontale", "72,120,230"), ("parietale", "236,190,50"), ("temporale", "70,190,110"), ("occipitale", "228,82,82"), ("insula", "170,110,220"), ("cervelletto", "150,200,150")]
eroe = f"""  <section id="hv-eroe" class="hv-eroe solo-vetrina" aria-labelledby="hv-eroe-tit">
    <div class="hv-eroe-in">
      <div class="hv-eroe-testo">
        {pezzi['kicker'].strip()}
        {pezzi['h1'].strip()}
        {pezzi['sub'].strip()}
        {pezzi['cta'].strip()}
        {pezzi['video'].strip()}
        {pezzi['numeri'].strip()}
        {pezzi['fiducia'].strip()}
      </div>
      <figure class="hv-monitor">
        <a class="hv-mon-nuovo" href="/client/index.html" target="_blank" rel="noopener"><b>Nuovo</b> Atlante dell'encefalo: giri, lobi e territori arteriosi</a>
        <div class="hv-mon-schermo">
          <picture><source type="image/webp" srcset="img/eroe/rm-lobi-560.webp 560w, img/eroe/rm-lobi.webp 868w" sizes="(max-width: 900px) 92vw, 560px"><img src="img/eroe/rm-lobi.jpg" alt="RM dell'encefalo in sagittale con i lobi colorati dall'atlante del visualizzatore" width="868" height="745" fetchpriority="high" decoding="async"></picture>
          <span class="hv-mon-alto" aria-hidden="true">RM · T1 3D · sagittale<br>Atlante: lobi</span>
          <span class="hv-mon-alto-dx" aria-hidden="true">1 mm<br>Zoom 100%</span>
          <span class="hv-mon-punto" aria-hidden="true"><i></i><b>lobo temporale dx</b></span>
          <ul class="hv-mon-leg" aria-label="Legenda dei lobi">{''.join(f'<li><i style="background:rgb({c})"></i>{t}</li>' for t, c in LOBI)}</ul>
        </div>
        <figcaption>RM vera e anonima, con l'atlante dei lobi del visualizzatore. Immagini: The Cancer Imaging Archive, ReMIND, CC BY 4.0.</figcaption>
      </figure>
    </div>
  </section>
"""
h = sost(h, '  <aside id="acc-presenta" class="acc-presenta" hidden>', eroe + '  <aside id="acc-presenta" class="acc-presenta" hidden>')
# --- elenco dei casi: un'immagine vera al posto del disegno, nell'intestazione scura
h = sost(h, '    <svg class="home-arte" viewBox="0 0 200 200" aria-hidden="true">',
         '    <picture class="home-foto" aria-hidden="true"><source type="image/webp" srcset="img/eroe/rm-lobi-560.webp"><img src="img/eroe/rm-lobi-560.jpg" alt="" width="560" height="481" decoding="async"></picture>\n    <svg class="home-arte" viewBox="0 0 200 200" aria-hidden="true">')
open(W + "index.html", "w", encoding="utf-8").write(h)

# --- app.js: l'apertura si mostra e si nasconde con la presentazione
s = open(W + "app.js", encoding="utf-8").read()
s = sost(s, "  $('#acc-presenta').hidden = nome !== 'iscriviti' && nome !== 'entra';",
         "  $('#acc-presenta').hidden = nome !== 'iscriviti' && nome !== 'entra';\n  if ($('#hv-eroe')) $('#hv-eroe').hidden = $('#acc-presenta').hidden;")
open(W + "app.js", "w", encoding="utf-8").write(s)

# --- stile
CSS = r"""
/* ============================================================ aspetto «sala refertazione» (27/11/2026)
   apertura scura con un'immagine vera, accento azzurro elettrico; zona delle immagini del caso scura come una
   workstation in entrambi i temi; il resto resta chiaro (o scuro col tema scuro). */
:root{--sala:#060a12;--sala2:#0c1320;--sala-bord:#1d2a3d;--sala-txt:#e8eef6;--sala-mut:#9fb0c4;--elettrico:#38bdf8;--elettrico2:#7dd3fc}
/* pagina iniziale: l'apertura occupa tutta la larghezza, sopra presentazione e accesso */
.accesso:has(> .hv-eroe:not([hidden])){padding-top:0}
.hv-eroe{flex:1 1 100%;order:-1;position:relative;margin:0 -16px 8px;padding:64px 24px 56px;color:var(--sala-txt);overflow:hidden;
  background:radial-gradient(900px 520px at 78% 38%,rgba(56,189,248,.20),transparent 62%),radial-gradient(700px 460px at 6% 100%,rgba(122,92,255,.20),transparent 60%),linear-gradient(180deg,#05080f,#0a1120)}
.hv-eroe::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;
  background-image:linear-gradient(rgba(125,211,252,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.06) 1px,transparent 1px);background-size:44px 44px;
  mask-image:radial-gradient(ellipse at 60% 40%,#000 30%,transparent 75%)}
.hv-eroe-in{position:relative;max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:56px;align-items:center}
.hv-eroe .hv-kicker{color:var(--elettrico2);font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:0 0 14px}
.hv-eroe .hv-kicker a{color:inherit}
.hv-eroe h1{margin:0 0 18px;font-size:clamp(2.4rem,4.8vw,3.9rem);line-height:1.04;letter-spacing:-.035em;font-weight:800;color:#fff;
  background:linear-gradient(120deg,#fff 0%,#fff 45%,var(--elettrico2) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hv-eroe .hv-sub{font-size:1.15rem;line-height:1.55;color:var(--sala-mut);max-width:560px;margin:0 0 28px}
.hv-eroe .hv-cta{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 14px}
.hv-eroe .hv-cta .btn{border-radius:12px;padding:14px 22px;font-size:1.05rem;font-weight:700;text-decoration:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#fff;box-shadow:none}
.hv-eroe .hv-cta .btn:hover{border-color:var(--elettrico);background:rgba(56,189,248,.10);transform:translateY(-1px)}
.hv-eroe .hv-cta .hv-prova{background:var(--elettrico);border-color:var(--elettrico);color:#04111f;box-shadow:0 10px 30px rgba(56,189,248,.35)}
.hv-eroe .hv-cta .hv-prova:hover{background:var(--elettrico2);border-color:var(--elettrico2);color:#04111f}
.hv-eroe .hv-cta .primario{background:#fff;border-color:#fff;color:#0a1426}
.hv-eroe .hv-cta .primario:hover{background:#e6f6ff;color:#0a1426}
.hv-eroe .hv-cta .hv-sec{background:transparent;border-color:transparent;color:var(--elettrico2);padding-left:8px;padding-right:8px}
.hv-eroe .hv-video{margin:0 0 30px}.hv-eroe .hv-video a{color:var(--sala-mut)}.hv-eroe .hv-video a:hover{color:#fff}
.hv-eroe .hv-numeri{display:flex;flex-wrap:wrap;gap:0;margin:0 0 18px;padding:0;list-style:none;border:0;background:none;box-shadow:none}
.hv-eroe .hv-numeri li{background:none;border:0;border-left:1px solid var(--sala-bord);padding:2px 22px;margin:0;box-shadow:none;min-width:0}
.hv-eroe .hv-numeri li:first-child{border-left:0;padding-left:0}
.hv-eroe .hv-numeri b{display:block;font-size:2rem;font-weight:800;letter-spacing:-.02em;color:#fff;line-height:1.1}
.hv-eroe .hv-numeri span{color:var(--sala-mut);font-size:.85rem}
.hv-eroe .hv-fiducia{color:var(--sala-mut);font-size:.85rem;margin:0;display:flex;flex-wrap:wrap;gap:6px 16px}
.hv-eroe .hv-fiducia span{display:inline-flex;align-items:center;gap:6px}
.hv-eroe .hv-fiducia a{color:var(--sala-mut)}
.hv-monitor{margin:0;position:relative}
.hv-mon-nuovo{display:inline-flex;gap:8px;align-items:center;margin:0 0 12px;padding:6px 12px 6px 6px;border-radius:999px;font-size:.85rem;text-decoration:none;
  color:var(--sala-txt);background:rgba(56,189,248,.10);border:1px solid rgba(56,189,248,.35)}
.hv-mon-nuovo b{background:var(--elettrico);color:#04111f;border-radius:999px;padding:2px 9px;font-size:.75rem;letter-spacing:.04em;text-transform:uppercase}
.hv-mon-nuovo:hover{border-color:var(--elettrico2);color:#fff}
.hv-mon-schermo{position:relative;border-radius:18px;overflow:hidden;background:#000;
  box-shadow:0 40px 90px rgba(0,0,0,.65),0 0 0 1px rgba(125,211,252,.22),0 0 80px rgba(56,189,248,.18)}
.hv-mon-schermo img{display:block;width:100%;height:auto}
.hv-mon-alto,.hv-mon-alto-dx{position:absolute;top:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e9f4ff;text-shadow:0 1px 2px #000}
.hv-mon-alto{left:14px}.hv-mon-alto-dx{right:14px;text-align:right}
.hv-mon-punto{position:absolute;left:55%;top:63%;display:flex;align-items:center;gap:8px;pointer-events:none}
.hv-mon-punto i{width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 18px rgba(255,255,255,.6)}
.hv-mon-punto b{font:600 13px system-ui,sans-serif;color:#fff;background:rgba(6,10,18,.78);border:1px solid rgba(255,255,255,.18);padding:3px 8px;border-radius:7px;white-space:nowrap}
.hv-mon-leg{position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.hv-mon-leg li{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#f1f6fb;background:rgba(6,10,18,.72);border:1px solid rgba(255,255,255,.12);padding:3px 9px;border-radius:999px}
.hv-mon-leg i{width:9px;height:9px;border-radius:3px}
.hv-monitor figcaption{margin-top:12px;font-size:.78rem;color:#8193a8}
@media (prefers-reduced-motion:no-preference){
  .hv-mon-punto i{animation:hv-polso 2.4s ease-in-out infinite}
  @keyframes hv-polso{0%,100%{box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 10px rgba(255,255,255,.4)}50%{box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 26px rgba(125,211,252,.9)}}
  .hv-eroe-testo>*{animation:hv-entra .7s cubic-bezier(.2,.7,.2,1) both}
  .hv-eroe-testo>:nth-child(2){animation-delay:.05s}.hv-eroe-testo>:nth-child(3){animation-delay:.1s}.hv-eroe-testo>:nth-child(4){animation-delay:.15s}
  .hv-monitor{animation:hv-entra .9s .1s cubic-bezier(.2,.7,.2,1) both}
  @keyframes hv-entra{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
}
@media (max-width:900px){
  .hv-eroe{padding:34px 18px 30px}
  .hv-eroe-in{grid-template-columns:1fr;gap:28px}
  .hv-eroe .hv-cta .btn{flex:1 1 100%;text-align:center}
  .hv-eroe .hv-cta .hv-sec{flex:1 1 100%}
  .hv-eroe .hv-numeri li{padding:2px 14px}
  .hv-eroe .hv-numeri b{font-size:1.6rem}
  .hv-mon-alto-dx{display:none}
}
/* sotto l'apertura: presentazione più ariosa, titoli di sezione più decisi */
.home-v .hv-tit{font-size:1.6rem;letter-spacing:-.02em;margin-top:40px}
.home-v .hv-tit::before{content:"";display:block;width:36px;height:3px;border-radius:3px;background:var(--elettrico);margin-bottom:12px}

/* elenco dei casi: intestazione scura con un'immagine vera */
.home-hero{background:radial-gradient(700px 380px at 90% 20%,rgba(56,189,248,.22),transparent 60%),linear-gradient(135deg,#05080f,#0c1628)!important;
  border:1px solid #1d2a3d!important;color:var(--sala-txt);box-shadow:0 18px 40px rgba(6,10,18,.25)!important;min-height:220px}
.home-hero .home-kicker{color:var(--elettrico2)}
.home-hero h1{color:#fff}
.home-hero p{color:var(--sala-mut)!important}
.home-hero .home-numeri>*{background:rgba(255,255,255,.06)!important;border-color:rgba(255,255,255,.14)!important;color:var(--sala-txt)!important}
.home-hero .home-numeri b{color:#fff}
.home-hero .home-cta button{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff}
.home-hero .home-cta button:hover{border-color:var(--elettrico);background:rgba(56,189,248,.12)}
.home-hero .home-cta button.primary{background:var(--elettrico);border-color:var(--elettrico);color:#04111f;box-shadow:0 8px 24px rgba(56,189,248,.35)}
.home-hero .home-arte{display:none}
.home-foto{position:absolute;right:0;top:0;bottom:0;width:42%;pointer-events:none;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 45%);mask-image:linear-gradient(90deg,transparent,#000 45%);opacity:.9}
.home-foto img{width:100%;height:100%;object-fit:cover;object-position:30% 40%}
.home-hero-testo{max-width:62%}
@media (max-width:760px){.home-foto{width:100%;opacity:.22}.home-hero-testo{max-width:none}}

/* caso: la zona delle immagini è scura come una workstation, in entrambi i temi */
#vista-caso>.viewer,#vista-caso>aside.serie{--bg:#0b0f16;--pan:#121925;--pan2:#18212f;--bord:#263345;--txt:#e6edf5;--mut:#9aabbd;color:var(--txt);color-scheme:dark}
#vista-caso>.viewer{background:linear-gradient(180deg,#0b0f16,#070a10)}
#vista-caso>aside.serie{background:#0b0f16;border-color:#1b2533}
#vista-caso>.viewer .stage{border-radius:12px;box-shadow:0 0 0 1px #1b2533}
#vista-caso>.viewer>.barra-unica,#vista-caso>.viewer>.toolbar{background:#111824;border-color:#1f2b3b;box-shadow:none}
#vista-caso>.viewer .barra-unica button:hover,#vista-caso>.viewer .toolbar button:hover{background:#1a2433;border-color:#2b3a50}
#vista-caso>.viewer button.on{background:var(--elettrico);border-color:var(--elettrico);color:#04111f}
"""
c = open(W + "style.css", encoding="utf-8").read()
assert "sala refertazione" not in c
open(W + "style.css", "w", encoding="utf-8").write(c.rstrip("\n") + "\n" + CSS)

# --- traduzioni dei testi nuovi della pagina
p = W + "lingua/en.json"; t = open(p, encoding="utf-8").read().rstrip(); d = json.loads(t)
nuove = {"Nuovo": "New", "Atlante dell'encefalo: giri, lobi e territori arteriosi": "Brain atlas: gyri, lobes and arterial territories",
         "RM · T1 3D · sagittale": "MRI · 3D T1 · sagittal", "Atlante: lobi": "Atlas: lobes", "Zoom 100%": "Zoom 100%", "1 mm": "1 mm",
         "lobo temporale dx": "right temporal lobe", "frontale": "frontal", "parietale": "parietal", "temporale": "temporal", "occipitale": "occipital",
         "insula": "insula", "Legenda dei lobi": "Lobe legend",
         "RM vera e anonima, con l'atlante dei lobi del visualizzatore. Immagini: The Cancer Imaging Archive, ReMIND, CC BY 4.0.": "Real, de-identified MRI with the viewer's lobe atlas. Images: The Cancer Imaging Archive, ReMIND, CC BY 4.0.",
         "RM dell'encefalo in sagittale con i lobi colorati dall'atlante del visualizzatore": "Sagittal brain MRI with the lobes coloured by the viewer's atlas"}
nuove = {k: v for k, v in nuove.items() if k not in d}
if nuove:
    t = t[:-1] + "".join(", " + json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) for k, v in nuove.items()) + "}\n"
    json.loads(t); open(p, "w", encoding="utf-8").write(t)
print("ok", len(nuove), "traduzioni")
