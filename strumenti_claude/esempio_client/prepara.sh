#!/bin/bash
# Rifà web/esempi/tc-addome-esempio.zip: TC addome con mdc, fase arteriosa, da TCIA, collezione TCGA-KICH (CC BY 3.0),
# soggetto TCGA-KM-8441. File DICOM non modificati; nello zip LEGGIMI.txt con fonte, licenza e citazioni (1.244).
set -e
U=1.3.6.1.4.1.14519.5.2.1.1357.4011.695542752526394056938750221511
D=/Volumes/Caloggero/_tcia_grezzi/esempio_client/kich; mkdir -p "$D"; cd "$D"
curl -s -o $U.zip "https://services.cancerimagingarchive.net/nbia-api/services/v1/getImage?SeriesInstanceUID=$U"
rm -rf $U; mkdir $U; unzip -q $U.zip -d $U
echo "Ora crea lo zip con lo script python della 1.244 (LEGGIMI.txt + LICENSE-TCIA.txt + file .dcm)."
