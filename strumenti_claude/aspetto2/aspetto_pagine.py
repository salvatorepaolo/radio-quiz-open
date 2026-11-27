"""Aspetto «sala refertazione» per le pagine statiche: fascia scura in cima alle schede /argomenti/ (nel generatore)
e alla pagina inglese /en/."""
import sys
def sost(t, a, b):
    if t.count(a) != 1: sys.exit(f"non trovato una volta: {a[:80]!r}")
    return t.replace(a, b)
CSS_EROE = """
.eroe{background:radial-gradient(700px 360px at 85% 15%,rgba(56,189,248,.22),transparent 60%),radial-gradient(500px 300px at 0% 100%,rgba(122,92,255,.18),transparent 60%),linear-gradient(135deg,#05080f,#0c1628);color:#e8eef6;border-bottom:1px solid #1d2a3d}
.eroe-in{max-width:860px;margin:0 auto;padding:22px 16px 34px}
.eroe nav.briciole{color:#9fb0c4;margin-bottom:18px}.eroe nav.briciole a{color:#7dd3fc}
.eroe .eroe-kicker{margin:0 0 8px;color:#7dd3fc;font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.eroe header{margin:0}.eroe header img{width:48px;height:48px;filter:drop-shadow(0 6px 18px rgba(56,189,248,.35))}
.eroe h1{color:#fff;font-size:clamp(1.7rem,3.6vw,2.5rem);letter-spacing:-.025em;line-height:1.12}
main{padding-top:26px}
h2{position:relative}h2::before{content:"";display:block;width:30px;height:3px;border-radius:3px;background:#38bdf8;margin-bottom:8px}
.prova{border-color:#1d2a3d;background:linear-gradient(135deg,#05080f,#0c1628);color:#e8eef6}
.prova .muto{color:#9fb0c4}.prova a{color:#7dd3fc}
.prova a.btn{background:#38bdf8;color:#04111f;border-radius:12px;box-shadow:0 8px 24px rgba(56,189,248,.35)}"""

# generatore delle schede
p = "/Volumes/Caloggero/strumenti_claude/argomenti/genera_pagine.py"; s = open(p, encoding="utf-8").read()
if "class=\"eroe\"" not in s:
    s = sost(s, 'ul{padding-left:22px}li{margin:3px 0}footer{margin-top:36px;font-size:.88rem;color:var(--muto);border-top:1px solid var(--bord);padding-top:12px}"""',
             'ul{padding-left:22px}li{margin:3px 0}footer{margin-top:36px;font-size:.88rem;color:var(--muto);border-top:1px solid var(--bord);padding-top:12px}' + CSS_EROE + '"""')
    s = sost(s, """<body>
<main>
<nav class="briciole"><a href="/">Quiz Radiologia</a> › <a href="/argomenti/">Argomenti</a></nav>
<header><img src="/logo.svg" alt=""><h1>{html.escape(h1)}</h1></header>
""", """<body>
<div class="eroe"><div class="eroe-in">
<nav class="briciole"><a href="/">Quiz Radiologia</a> › <a href="/argomenti/">Argomenti</a></nav>
<p class="eroe-kicker">Scheda di ripasso · radiologia</p>
<header><img src="/logo.svg" alt=""><h1>{html.escape(h1)}</h1></header>
</div></div>
<main>
""")
    open(p, "w", encoding="utf-8").write(s)

# pagina inglese
p = "/Volumes/Caloggero/piattaforma-quiz/cloud/web/en/index.html"; h = open(p, encoding="utf-8").read()
if "class=\"eroe\"" not in h:
    h = sost(h, "</style>\n</head>", CSS_EROE.replace(".eroe-in{max-width:860px", ".eroe-in{max-width:860px") + "\n.eroe .sommario{color:#c8d4e2;margin:18px 0 0}.eroe .cta{margin-top:20px}\n.eroe .cta a.btn.sec{color:#7dd3fc;border-color:#7dd3fc}\n.eroe .prova{background:none;border:0;padding:0;margin:20px 0 0;box-shadow:none}\n</style>\n</head>")
    a = h.index("<main>\n<nav class=\"briciole\">"); b = h.index('<p class="hero">')
    testa = h[a + len("<main>\n"):b]
    h = h[:a] + '<div class="eroe"><div class="eroe-in">\n' + testa.replace('<p class="sommario">', '<p class="eroe-kicker">Free · open source · in your browser</p>\n<p class="sommario">', 1).replace('<header>', '<header>', 1) + '</div></div>\n<main>\n' + h[b:]
    # il kicker va prima del titolo
    h = h.replace('<header><img src="/logo.svg" alt="">', '<p class="eroe-kicker">Free · open source · in your browser</p>\n<header><img src="/logo.svg" alt="">', 1)
    h = h.replace('<p class="eroe-kicker">Free · open source · in your browser</p>\n<p class="sommario">', '<p class="sommario">', 1)
    open(p, "w", encoding="utf-8").write(h)
print("ok")
