#!/bin/bash
# test_upload.sh — Teste les endpoints d'upload réels du projet.
# Usage: TOKEN="Bearer eyJ..." ./test_upload.sh https://api.votre-domaine.com
set -uo pipefail

API=${1:-"http://localhost:8000"}
TOKEN=${TOKEN:-""}
TMP=$(mktemp -d)

if [ -z "$TOKEN" ]; then
  echo "Définir TOKEN=\"Bearer <firebase-id-token>\" avant de lancer ce script."
  exit 1
fi

echo "[*] Upload PHP déguisé en JPEG → /api/v1/uploads/avatar/"
printf 'GIF89a\n<?php system($_GET["cmd"]); ?>' > "$TMP/shell.php.jpg"
curl -s -o /dev/null -w "  HTTP %{http_code} (attendu: 400, type MIME rejeté)\n" \
  -X POST "$API/api/v1/uploads/avatar/" \
  -H "Authorization: $TOKEN" -F "file=@$TMP/shell.php.jpg;type=image/jpeg"

echo "[*] Upload SVG avec script embarqué → /api/v1/uploads/avatar/ (gap connu, voir SECURITY.md §3.1)"
cat > "$TMP/xss.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg"><script>alert('XSS')</script></svg>
EOF
curl -s -o /dev/null -w "  HTTP %{http_code} (actuellement accepté — SVG passthrough non sanitizé)\n" \
  -X POST "$API/api/v1/uploads/avatar/" \
  -H "Authorization: $TOKEN" -F "file=@$TMP/xss.svg;type=image/svg+xml"

echo "[*] Upload fichier trop volumineux (>5 Mo) → /api/v1/uploads/avatar/"
dd if=/dev/zero of="$TMP/bomb.jpg" bs=1M count=6 2>/dev/null
curl -s -o /dev/null -w "  HTTP %{http_code} (attendu: 400, taille max)\n" \
  -X POST "$API/api/v1/uploads/avatar/" \
  -H "Authorization: $TOKEN" -F "file=@$TMP/bomb.jpg;type=image/jpeg"

rm -rf "$TMP"
