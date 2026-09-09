#!/bin/bash
# test_idor.sh — Teste l'accès croisé aux ressources d'autres utilisateurs.
# Nécessite un token Firebase valide (obtenu via le frontend, DevTools →
# Application → IndexedDB, ou un compte de test).
# Usage:
#   TOKEN="Bearer eyJ..." ./test_idor.sh https://api.votre-domaine.com
set -uo pipefail

API=${1:-"http://localhost:8000"}
TOKEN=${TOKEN:-""}

if [ -z "$TOKEN" ]; then
  echo "Définir TOKEN=\"Bearer <firebase-id-token>\" avant de lancer ce script."
  exit 1
fi

echo "[*] IDOR — devis d'un autre commercial (QuoteViewSet filtre par owner sauf collaborateur/marketing)"
for id in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: $TOKEN" "$API/api/v1/marketing/quotes/$id/")
  echo "  quote $id: HTTP $code"
done

echo "[*] IDOR — décaissement d'un autre projet (finance, get_queryset filtré par rôle)"
for id in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: $TOKEN" "$API/api/v1/finance/disbursement-requests/$id/")
  echo "  disbursement $id: HTTP $code"
done

echo "[*] Escalade — auto-promotion via /auth/me/ (doit ignorer role/is_staff : voir MeUpdateSerializer)"
curl -s -X PATCH "$API/api/v1/auth/me/" \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"is_staff": true, "role": "SUPER_ADMIN"}' | head -c 500
echo
echo "  → vérifier que la réponse ne reflète PAS is_staff/role modifiés."
