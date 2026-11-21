p='/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'; s=open(p,encoding='utf-8').read()
i0=s.index('// ---- 14/11: piano orbito-meatale (OMP) dai punti di repere.'); i1=s.index("// ---- encefalo sul piano orbito-meatale (OMP), in automatico")
s=s[:i0]+open('/Volumes/Caloggero/strumenti_claude/omp/omp_js.txt',encoding='utf-8').read()+s[i1:]
open(p,'w',encoding='utf-8').write(s); print('ok')
