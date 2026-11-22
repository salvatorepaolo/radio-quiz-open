# compila libisyntax (BSD-2, Pieter Valkema) in WebAssembly per il visualizzatore dei vetrini di radio-quiz
# uso: bash build.sh [node|worker]
set -e
export PATH="/opt/homebrew/bin:$PATH"; cd "$(dirname "$0")"
S=libisyntax/src; mkdir -p out
SRC="rq_isyntax.c $S/libisyntax.c $S/isyntax/isyntax.c $S/isyntax/isyntax_reader.c $S/utils/timerutils.c $S/utils/block_allocator.c $S/platform/platform_mutex.c $S/platform/platform.c $S/platform/work_queue.c $S/third_party/yxml.c $S/platform/linux_utils.c"
INC="-I$S -I$S/platform -I$S/utils -I$S/isyntax -I$S/third_party"
FN="_rq_apri,_rq_verboso,_rq_tw,_rq_th,_rq_mpp,_rq_livelli,_rq_liv_w,_rq_liv_h,_rq_liv_tx,_rq_liv_ty,_rq_liv_ds,_rq_tessera,_rq_jpeg,_rq_jpeg_n,_malloc,_free"
if [ "${1:-worker}" = node ]; then
  emcc -O2 $INC $SRC -lnodefs.js -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=node -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=268435456 -sEXPORTED_FUNCTIONS=$FN -sEXPORTED_RUNTIME_METHODS=FS,ccall,HEAPU8,NODEFS -o out/isyntax-node.mjs
else
  emcc -O3 $INC $SRC -lworkerfs.js -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=268435456 -sEXPORTED_FUNCTIONS=$FN -sEXPORTED_RUNTIME_METHODS=FS,ccall,HEAPU8,WORKERFS -sSINGLE_FILE=1 -o out/isyntax.mjs
fi
