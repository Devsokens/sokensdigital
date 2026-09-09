#!/bin/bash
# test_headers.sh — Vérifie les headers de sécurité sur l'API Django et le
# site Next.js. Usage:
#   ./test_headers.sh https://api.votre-domaine.com https://votre-domaine.com
set -uo pipefail

API=${1:-"http://localhost:8000"}
SITE=${2:-"http://localhost:3000"}

check_target() {
  local label="$1" url="$2"
  echo "== $label ($url) =="
  headers=$(curl -s -I "$url")
  for h in "x-frame-options" "x-content-type-options" "content-security-policy" \
           "referrer-policy" "strict-transport-security"; do
    if echo "$headers" | grep -qi "^$h:"; then
      echo "  [OK]   $h"
    else
      echo "  [FAIL] $h manquant"
    fi
  done
  echo
}

# API Django — headers actifs uniquement quand DEBUG=False (voir settings.py).
check_target "API Django (/api/v1/health/)" "$API/api/v1/health/"

# Site Next.js — headers ajoutés via next.config.ts (headers()).
check_target "Frontend Next.js (/)" "$SITE/"
