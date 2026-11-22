// rq_isyntax.c — interfaccia minima di libisyntax per il browser (radio-quiz): apre un file iSyntax montato in WORKERFS e
// legge tessere RGBA, dimensioni dei livelli, µm/pixel, etichetta e panoramica in JPEG.
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "libisyntax.h"
extern bool is_verbose_mode;
EMSCRIPTEN_KEEPALIVE void rq_verboso(int v) { is_verbose_mode = v; }
static isyntax_t* S = NULL; static isyntax_cache_t* C = NULL; static uint32_t* BUF = NULL;
EMSCRIPTEN_KEEPALIVE int rq_apri(const char* path) {
  if (libisyntax_init() != LIBISYNTAX_OK) return -1;
  if (libisyntax_open(path, (enum libisyntax_open_flags_t)0, &S) != LIBISYNTAX_OK) return -2;
  if (libisyntax_cache_create("rq", 2000, &C) != LIBISYNTAX_OK) return -3;
  if (libisyntax_cache_inject(C, S) != LIBISYNTAX_OK) return -4;
  BUF = malloc((size_t)libisyntax_get_tile_width(S) * libisyntax_get_tile_height(S) * 4);
  return 0;
}
EMSCRIPTEN_KEEPALIVE int rq_tw(void) { return libisyntax_get_tile_width(S); }
EMSCRIPTEN_KEEPALIVE int rq_th(void) { return libisyntax_get_tile_height(S); }
EMSCRIPTEN_KEEPALIVE double rq_mpp(void) { return libisyntax_get_is_mpp_known(S) ? libisyntax_get_mpp_x(S) : 0; }
EMSCRIPTEN_KEEPALIVE int rq_livelli(void) { return libisyntax_image_get_level_count(libisyntax_get_wsi_image(S)); }
static const isyntax_level_t* liv(int l) { return libisyntax_image_get_level(libisyntax_get_wsi_image(S), l); }
EMSCRIPTEN_KEEPALIVE int rq_liv_w(int l) { return libisyntax_level_get_width(liv(l)); }
EMSCRIPTEN_KEEPALIVE int rq_liv_h(int l) { return libisyntax_level_get_height(liv(l)); }
EMSCRIPTEN_KEEPALIVE int rq_liv_tx(int l) { return libisyntax_level_get_width_in_tiles(liv(l)); }
EMSCRIPTEN_KEEPALIVE int rq_liv_ty(int l) { return libisyntax_level_get_height_in_tiles(liv(l)); }
EMSCRIPTEN_KEEPALIVE double rq_liv_ds(int l) { return libisyntax_level_get_downsample_factor(liv(l)); }
EMSCRIPTEN_KEEPALIVE uint32_t* rq_tessera(int l, int x, int y) {
  if (libisyntax_tile_read(S, C, l, x, y, BUF, LIBISYNTAX_PIXEL_FORMAT_RGBA) != LIBISYNTAX_OK) return NULL;
  return BUF;
}
static uint8_t* JB = NULL; static uint32_t JN = 0;
EMSCRIPTEN_KEEPALIVE uint8_t* rq_jpeg(int quale) {   // 0 etichetta, 1 panoramica
  if (JB) { free(JB); JB = NULL; } JN = 0;
  isyntax_error_t e = quale ? libisyntax_read_macro_image_jpeg(S, &JB, &JN) : libisyntax_read_label_image_jpeg(S, &JB, &JN);
  return e == LIBISYNTAX_OK ? JB : NULL;
}
EMSCRIPTEN_KEEPALIVE int rq_jpeg_n(void) { return (int)JN; }
