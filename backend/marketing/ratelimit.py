from django.core.cache import cache


def get_client_ip(request) -> str:
    """Render (like most PaaS) sits behind a reverse proxy — the real
    client IP is in X-Forwarded-For, not REMOTE_ADDR (that's the proxy)."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
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
