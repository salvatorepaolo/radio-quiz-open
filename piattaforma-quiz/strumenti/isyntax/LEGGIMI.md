# libisyntax in WebAssembly (vetrini Philips iSyntax)

`web/lib/isyntax.mjs` è libisyntax (https://github.com/amspath/libisyntax, BSD-2-Clause, Pieter Valkema) compilata con
Emscripten 7 per un web worker, con l'interfaccia `rq_isyntax.c`.

Per ricompilarla:
1. `git clone https://github.com/amspath/libisyntax.git` accanto a questi file;
2. `cd libisyntax && git apply ../libisyntax-modifiche.patch` (nel browser un solo filo; posizione nel file con fseeko/ftello);
3. `bash build.sh worker` (oppure `bash build.sh node` per le prove) e copiare `out/isyntax.mjs` in `cloud/web/lib/`.
