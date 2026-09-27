#!/bin/bash
# security_scan.sh — Scan rapide global. À lancer avant chaque mise en prod.
# Usage: ./security_scan.sh https://api.votre-domaine.com https://votre-domaine.com
set -uo pipefail

API=${1:-"http://localhost:8000"}
SITE=${2:-"http://localhost:3000"}
REPORT="security_report_$(date +%Y%m%d_%H%M%S).txt"

{
echo "🔒 Soken's Digital — Security Scan"
echo "API: $API | Site: $SITE"
echo "Date: $(date)"
echo "======================================"

echo -e "\n[1/6] Headers de sécurité"
"$(dirname "$0")/test_headers.sh" "$API" "$SITE"

echo -e "\n[2/6] Endpoint santé API"
curl -s -o /dev/null -w "  /api/v1/health/: HTTP %{http_code}\n" "$API/api/v1/health/"

echo -e "\n[3/6] CORS — Origin non whitelisté doit être refusé"
cors=$(curl -s -I -X OPTIONS -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" "$API/api/v1/public/leads/")
if echo "$cors" | grep -qi "access-control-allow-origin: https://evil.com"; then
  echo "  [FAIL] CORS accepte n'importe quelle origine"
else
  echo "  [OK] CORS restrictif"
fi

echo -e "\n[4/6] Rate limiting endpoints publics (voir test_ratelimit.py pour le détail)"
codes=$(for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$API/api/v1/public/leads/" -H "Content-Type: application/json" \
  -d '{"name":"x","email":"x@x.com","message":"x"}'; done | sort | uniq -c)
echo "$codes"

echo -e "\n[5/6] Secrets dans le repo (hors .venv/node_modules)"
if command -v git >/dev/null; then
  n=$(git grep -inE "SECRET_KEY *= *['\"]|api_key *= *['\"][a-zA-Z0-9]{16}|AKIA[0-9A-Z]{16}" \
    -- '*.py' '*.ts' '*.tsx' 2>/dev/null | grep -v "os.environ\|process.env" | wc -l)
  echo "  Occurrences suspectes (hors lecture d'env var): $n"
fi

echo -e "\n[6/6] HTTPS"
[[ "$API" == https* ]] && echo "  [OK] API en HTTPS" || echo "  [FAIL] API pas en HTTPS"
[[ "$SITE" == https* ]] && echo "  [OK] Site en HTTPS" || echo "  [FAIL] Site pas en HTTPS"

} | tee "$REPORT"

echo -e "\n📄 Rapport: $REPORT"
