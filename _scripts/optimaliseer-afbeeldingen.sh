#!/bin/bash
# Maakt geoptimaliseerde kopieën van afbeeldingen in assets/ (originelen blijven ongewijzigd).
# Gebruik: bash _scripts/optimaliseer-afbeeldingen.sh
# Resultaat: _scripts/afbeeldingen-geoptimaliseerd/assets/ (zelfde mappenstructuur)

set -euo pipefail

BRON="assets"
DOEL="_scripts/afbeeldingen-geoptimaliseerd"
MAX_FOTO=2000
MAX_LOGO=800
KWALITEIT=75

rm -rf "$DOEL"

find "$BRON" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -print0 |
while IFS= read -r -d '' bestand; do
  uit="$DOEL/$bestand"
  mkdir -p "$(dirname "$uit")"
  case "$bestand" in
    *.png|*.PNG)
      sips -Z "$MAX_LOGO" "$bestand" --out "$uit" >/dev/null
      ;;
    *)
      sips -Z "$MAX_FOTO" -s format jpeg -s formatOptions "$KWALITEIT" "$bestand" --out "$uit" >/dev/null
      ;;
  esac
  if [ "$(stat -f%z "$uit")" -ge "$(stat -f%z "$bestand")" ]; then
    cp "$bestand" "$uit"
  fi
done

voor=$(find "$BRON" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -exec du -k {} + | awk '{s+=$1} END {print s}')
na=$(find "$DOEL" -type f -exec du -k {} + | awk '{s+=$1} END {print s}')
echo "Voor: ${voor} KB  ->  Na: ${na} KB"
echo "Controleer de kopieën in $DOEL voordat je ze overzet naar assets/."
