"""converti_vetrino.py: vetrino in un formato del produttore (Aperio SVS, Hamamatsu NDPI, Philips TIFF, Zeiss CZI, MRXS,
Leica SCN, Ventana BIF, …) → cartella di file DICOM VL Whole Slide Microscopy, da passare poi ad anonimizza_vetrino.py
per metterlo in un caso. Usa wsidicomizer (Apache-2.0, https://github.com/imi-bigpicture/wsidicomizer): conversione senza
ricompressione per SVS, NDPI e Philips TIFF; per gli altri formati le tessere si ricomprimono.
Il visualizzatore client legge questi formati anche senza conversione; sulla piattaforma i casi sono sempre in DICOM.
Uso: python converti_vetrino.py <file del vetrino> <cartella di uscita> [--tessera 512]
(installazione: python3 -m venv venv && venv/bin/pip install wsidicomizer; per MRXS, SCN, BIF anche "wsidicomizer[openslide]")
"""
import sys, os, argparse

def main():
    a = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    a.add_argument('vetrino'); a.add_argument('uscita'); a.add_argument('--tessera', type=int, default=512)
    o = a.parse_args()
    from wsidicomizer import WsiDicomizer
    os.makedirs(o.uscita, exist_ok=True)
    # etichetta e panoramica (possono mostrare dati del paziente) non si convertono: niente da scartare dopo
    creati = WsiDicomizer.convert(o.vetrino, o.uscita, tile_size=o.tessera, include_label=False, include_overview=False)
    print(f'{len(creati)} file DICOM in {o.uscita}')
    print('Ora: python anonimizza_vetrino.py', o.uscita, '<cartella del caso> "<descrizione>"')

if __name__ == '__main__':
    main()
