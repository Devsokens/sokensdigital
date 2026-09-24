from django.core.cache import cache


def get_client_ip(request) -> str:
    """Cloudflare fronte ce backend (vérifié en production — chaque réponse
    porte `Server: cloudflare`, y compris sur le domaine Render direct).
    `CF-Connecting-IP` est posé par l'edge Cloudflare lui-même à partir de
    la vraie connexion TCP entrante : un client ne peut pas l'écraser,
    Cloudflare remplace toute valeur du même nom avant que Django ne la
    voie.

    Pentest du 24/09/2026 : cette fonction lisait auparavant la PREMIÈRE
    entrée de X-Forwarded-For (`.split(',')[0]`) — un en-tête entièrement
    fourni par le client, qui peut y écrire n'importe quoi. Un
    `X-Forwarded-For` changé à chaque appel suffisait à contourner toute
    limite anti-abus par IP (formulaires publics marketing ET support, qui
    partagent cette même fonction) — sans même qu'un vrai proxy en chaîne
    soit nécessaire pour l'exploiter. X-Forwarded-For n'est donc plus
    utilisé du tout ici : sans certitude sur le nombre de sauts avant
    Django, aucune position dans cette liste n'est fiable. Sans
    CF-Connecting-IP (hors Cloudflare : dev local, tests), on retombe sur
    REMOTE_ADDR — non falsifiable lui non plus, au prix d'un unique
    compteur partagé par tout le trafic derrière un même proxy amont non
    identifié.
    """
    cf_connecting_ip = request.META.get('HTTP_CF_CONNECTING_IP')
    if cf_connecting_ip:
        return cf_connecting_ip.strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def is_rate_limited(key: str, limit: int, window_seconds: int) -> bool:
    """Fixed-window counter in Redis (via Django's cache framework).
    Small race on the very first request in a window (two concurrent
    callers can both initialize count=1) — acceptable for abuse
    prevention, not a security boundary.

    Fails open if the cache backend itself is unreachable (Redis down/
    unconfigured) — this guards a public form, and a hard 500 on every
    single submission because of a cache outage is a worse failure mode
    than briefly skipping rate limiting."""
    try:
        try:
            count = cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=window_seconds)
            count = 1
        return count > limit
    except Exception:
        return False
