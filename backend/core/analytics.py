"""Lecture des données PostHog pour les tableaux de bord Marketing et Technique.

Architecture (décision du 14/09/2026) :

- **Collecte** côté navigateur uniquement (`posthog-js`), et seulement après
  consentement « analytique » dans le bandeau cookies — voir
  frontend/lib/analytics/posthog.ts. Rien ne part vers PostHog depuis ce
  backend.
- **Lecture** ici, côté serveur, via l'API Query (HogQL) avec une clé
  personnelle (`POSTHOG_PERSONAL_API_KEY`). Cette clé donne accès en lecture
  à tout le projet PostHog : elle ne doit jamais atteindre le navigateur,
  d'où ce proxy authentifié plutôt qu'un appel direct depuis le frontend.
- **Cache** : chaque requête agrégée est mise en cache `ANALYTICS_CACHE_TTL`
  secondes. Un tableau de bord rechargé dix fois par dix personnes ne coûte
  qu'un appel PostHog par fenêtre — la donnée d'audience n'a de toute façon
  aucun intérêt à la seconde près, et l'API Query est limitée en débit.

Sans configuration (`POSTHOG_PERSONAL_API_KEY` ou `POSTHOG_PROJECT_ID`
absents), `is_configured()` renvoie False et les vues répondent un état
« non configuré » explicite plutôt qu'une erreur — même logique que Firebase
et Supabase ailleurs dans ce projet.
"""

import hashlib
import logging
import os

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

ANALYTICS_CACHE_TTL = 600  # 10 minutes
QUERY_TIMEOUT = 20  # secondes — HogQL sur 30 jours reste sous la seconde en pratique
ALLOWED_PERIODS = {7, 30, 90}

_session = requests.Session()


class AnalyticsNotConfigured(Exception):
    pass


class AnalyticsUnavailable(Exception):
    """PostHog injoignable ou réponse invalide — distinct de « non configuré »
    pour que l'écran puisse dire « réessayez » plutôt que « à configurer »."""


def _config() -> tuple[str, str, str]:
    key = os.environ.get('POSTHOG_PERSONAL_API_KEY', '').strip()
    project_id = os.environ.get('POSTHOG_PROJECT_ID', '').strip()
    # Hôte d'API (lecture), pas d'ingestion : eu.posthog.com, pas eu.i.posthog.com.
    host = os.environ.get('POSTHOG_API_HOST', 'https://eu.posthog.com').strip().rstrip('/')
    if not key or not project_id:
        raise AnalyticsNotConfigured()
    return key, project_id, host


def is_configured() -> bool:
    try:
        _config()
        return True
    except AnalyticsNotConfigured:
        return False


def run_hogql(query: str) -> list[list]:
    """Exécute une requête HogQL et renvoie les lignes brutes, avec cache.

    Les requêtes sont toutes construites dans ce module à partir de valeurs
    contrôlées (période validée contre ALLOWED_PERIODS) — aucune entrée
    utilisateur n'y est interpolée telle quelle.
    """
    key, project_id, host = _config()
    cache_key = 'posthog:' + hashlib.sha256(f'{project_id}:{query}'.encode()).hexdigest()
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None
    if cached is not None:
        return cached

    try:
        response = _session.post(
            f'{host}/api/projects/{project_id}/query/',
            headers={'Authorization': f'Bearer {key}'},
            json={'query': {'kind': 'HogQLQuery', 'query': query}},
            timeout=QUERY_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.warning('PostHog injoignable : %s', exc)
        raise AnalyticsUnavailable() from exc

    if response.status_code != 200:
        # Le corps peut contenir des détails de requête : journalisé, jamais renvoyé au client.
        logger.warning('PostHog a répondu %s : %s', response.status_code, response.text[:500])
        raise AnalyticsUnavailable()

    try:
        rows = response.json().get('results') or []
    except ValueError as exc:
        raise AnalyticsUnavailable() from exc

    try:
        cache.set(cache_key, rows, timeout=ANALYTICS_CACHE_TTL)
    except Exception:
        logger.exception('Mise en cache PostHog impossible')
    return rows


def _scalar(rows, default=0):
    try:
        return rows[0][0] if rows and rows[0][0] is not None else default
    except (IndexError, TypeError):
        return default


def _cell(row, index, default=None):
    """Lecture tolérante : une ligne HogQL plus courte que prévu (schéma
    PostHog modifié, propriété absente) ne doit pas faire tomber tout le
    tableau de bord sur une IndexError."""
    try:
        return row[index]
    except (IndexError, TypeError):
        return default


def _pairs(rows, label_key='label', value_key='value'):
    return [
        {label_key: _cell(row, 0) or '(inconnu)', value_key: _cell(row, 1, 0)}
        for row in rows
    ]


def _series(rows):
    return [{'date': str(_cell(row, 0, '')), 'value': _cell(row, 1, 0)} for row in rows]


def marketing_metrics(days: int) -> dict:
    """Audience, acquisition et conversion vers une demande de projet."""
    window = f"timestamp > now() - INTERVAL {int(days)} DAY"

    visitors = _scalar(run_hogql(
        f"SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' AND {window}"
    ))
    pageviews = _scalar(run_hogql(
        f"SELECT count() FROM events WHERE event = '$pageview' AND {window}"
    ))
    sessions = _scalar(run_hogql(
        f"SELECT count(DISTINCT properties.$session_id) FROM events WHERE event = '$pageview' AND {window}"
    ))
    leads = _scalar(run_hogql(
        f"SELECT count() FROM events WHERE event = 'lead_submitted' AND {window}"
    ))
    quotes_accepted = _scalar(run_hogql(
        f"SELECT count() FROM events WHERE event = 'quote_accepted' AND {window}"
    ))

    daily = run_hogql(
        f"SELECT toDate(timestamp) AS day, count(DISTINCT person_id) FROM events "
        f"WHERE event = '$pageview' AND {window} GROUP BY day ORDER BY day"
    )
    top_pages = run_hogql(
        f"SELECT properties.$pathname AS path, count() AS views FROM events "
        f"WHERE event = '$pageview' AND {window} GROUP BY path ORDER BY views DESC LIMIT 10"
    )
    sources = run_hogql(
        f"SELECT coalesce(nullIf(properties.$referring_domain, ''), '$direct') AS source, "
        f"count(DISTINCT person_id) AS visitors FROM events "
        f"WHERE event = '$pageview' AND {window} GROUP BY source ORDER BY visitors DESC LIMIT 8"
    )
    campaigns = run_hogql(
        f"SELECT properties.utm_campaign AS campaign, count(DISTINCT person_id) AS visitors FROM events "
        f"WHERE event = '$pageview' AND properties.utm_campaign IS NOT NULL AND {window} "
        f"GROUP BY campaign ORDER BY visitors DESC LIMIT 8"
    )
    # Entonnoir simplifié : visiteurs → ont ouvert le formulaire → ont soumis.
    wizard_openers = _scalar(run_hogql(
        f"SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' "
        f"AND properties.$pathname = '/demarrer-un-projet' AND {window}"
    ))

    return {
        'visitors': visitors,
        'pageviews': pageviews,
        'sessions': sessions,
        'leads': leads,
        'quotes_accepted': quotes_accepted,
        'conversion_rate': round(leads / visitors * 100, 2) if visitors else 0,
        'daily_visitors': _series(daily),
        'top_pages': _pairs(top_pages),
        'sources': _pairs(sources),
        'campaigns': _pairs(campaigns),
        'funnel': [
            {'label': 'Visiteurs', 'value': visitors},
            {'label': 'Formulaire ouvert', 'value': wizard_openers},
            {'label': 'Demande soumise', 'value': leads},
            {'label': 'Devis accepté', 'value': quotes_accepted},
        ],
    }


def technique_metrics(days: int) -> dict:
    """Santé et performance de la navigation réelle des visiteurs."""
    window = f"timestamp > now() - INTERVAL {int(days)} DAY"

    exceptions = _scalar(run_hogql(
        f"SELECT count() FROM events WHERE event = '$exception' AND {window}"
    ))
    affected = _scalar(run_hogql(
        f"SELECT count(DISTINCT person_id) FROM events WHERE event = '$exception' AND {window}"
    ))
    top_errors = run_hogql(
        f"SELECT coalesce(properties.$exception_message, properties.$exception_type) AS message, "
        f"count() AS occurrences FROM events WHERE event = '$exception' AND {window} "
        f"GROUP BY message ORDER BY occurrences DESC LIMIT 10"
    )
    # Web vitals : p75, le seuil retenu par Google pour qualifier une page.
    vitals = run_hogql(
        f"SELECT quantile(0.75)(properties.$web_vitals_LCP_value), "
        f"quantile(0.75)(properties.$web_vitals_INP_value), "
        f"quantile(0.75)(properties.$web_vitals_CLS_value) "
        f"FROM events WHERE event = '$web_vitals' AND {window}"
    )
    slow_pages = run_hogql(
        f"SELECT properties.$pathname AS path, quantile(0.75)(properties.$web_vitals_LCP_value) AS lcp "
        f"FROM events WHERE event = '$web_vitals' AND properties.$web_vitals_LCP_value IS NOT NULL "
        f"AND {window} GROUP BY path ORDER BY lcp DESC LIMIT 8"
    )
    devices = run_hogql(
        f"SELECT properties.$device_type AS device, count(DISTINCT person_id) FROM events "
        f"WHERE event = '$pageview' AND {window} GROUP BY device ORDER BY 2 DESC"
    )
    browsers = run_hogql(
        f"SELECT properties.$browser AS browser, count(DISTINCT person_id) FROM events "
        f"WHERE event = '$pageview' AND {window} GROUP BY browser ORDER BY 2 DESC LIMIT 8"
    )
    daily_errors = run_hogql(
        f"SELECT toDate(timestamp) AS day, count() FROM events "
        f"WHERE event = '$exception' AND {window} GROUP BY day ORDER BY day"
    )

    vitals_row = vitals[0] if vitals else []

    def _round(value, digits):
        return round(value, digits) if isinstance(value, (int, float)) else None

    return {
        'exceptions': exceptions,
        'affected_visitors': affected,
        'lcp_p75_ms': _round(_cell(vitals_row, 0), 0),
        'inp_p75_ms': _round(_cell(vitals_row, 1), 0),
        'cls_p75': _round(_cell(vitals_row, 2), 3),
        'top_errors': _pairs(top_errors),
        'slow_pages': [
            {'label': _cell(row, 0) or '(inconnu)', 'value': _round(_cell(row, 1), 0)} for row in slow_pages
        ],
        'devices': _pairs(devices),
        'browsers': _pairs(browsers),
        'daily_errors': _series(daily_errors),
    }
