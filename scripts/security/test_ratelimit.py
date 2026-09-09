"""test_ratelimit.py — Vérifie le rate limiting sur les endpoints publics
réels du projet (leads, tickets, devis).

Usage: python test_ratelimit.py [api_base_url]
"""
import sys
import requests

API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

# (label, method, path, body, limite attendue)
ENDPOINTS = [
    ("Lead capture (marketing.ratelimit, limite basse par IP)",
     "POST", "/api/v1/public/leads/",
     {"name": "Test", "email": "test@example.com", "message": "test"}),
    ("Création ticket support (PUBLIC_TICKET_RATE_LIMIT = 5/60s)",
     "POST", "/api/v1/public/tickets/",
     {"subject": "Test", "message": "test", "email": "test@example.com"}),
]


def hammer(label, method, path, body, attempts=12):
    print(f"[*] {label}")
    url = f"{API}{path}"
    blocked_at = None
    for i in range(1, attempts + 1):
        r = requests.request(method, url, json=body, timeout=10)
        if r.status_code == 429:
            blocked_at = i
            break
    if blocked_at:
        print(f"    [OK] Rate limit déclenché à la tentative {blocked_at}")
    else:
        print(f"    [!] Pas de 429 après {attempts} tentatives — vérifier manuellement")
    print()


if __name__ == "__main__":
    for label, method, path, body in ENDPOINTS:
        hammer(label, method, path, body)
