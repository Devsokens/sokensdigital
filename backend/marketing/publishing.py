"""The publishing engine flagged as not-implemented in
docs/backend-specifications.md §7.4 — actually posting a SCHEDULED
SocialPost to its target platform. Facebook and Instagram are the only
two platforms this app supports (see SocialPost.Platform) — both go
through the same Facebook Graph API, authenticated with the Page's own
access token (Instagram Business publishing is tied to its linked Page,
it has no separate credentials of its own).

Credentials come from marketing.models.SocialMediaCredentials (configured
visually from Paramètres > Réseaux sociaux), not from environment
variables — rotating a token is an admin action, not a deploy. Nothing
here talks to either platform until that config is filled in;
run_scheduled_publishing() just leaves posts SCHEDULED and skips them
until then, so turning this on later is a config change, not a code
change.
"""

import logging

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = 'v21.0'
GRAPH_API_BASE = f'https://graph.facebook.com/{GRAPH_API_VERSION}'


class PublishingNotConfiguredError(Exception):
    """Raised when the target platform's credentials aren't set yet (see
    Paramètres > Réseaux sociaux, marketing.models.SocialMediaCredentials)."""


class PublishingError(Exception):
    """Raised when the platform's API rejected the publish request."""


def _graph_request(method: str, url: str, **kwargs) -> dict:
    response = getattr(requests, method)(url, timeout=15, **kwargs)
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 400 or 'error' in data:
        message = data.get('error', {}).get('message') or response.text
        raise PublishingError(message)
    return data


def _post_images(post) -> list[str]:
    """The cover image plus any additional ones, in order, deduped — this
    is the full carousel when there's more than one."""
    images = [post.image_path, *(post.additional_images or [])]
    seen = set()
    ordered = []
    for url in images:
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def publish_to_facebook(post) -> str:
    """Publishes one SocialPost to the configured Facebook Page. Returns the
    published post's URL. A post with an image uses /{page-id}/photos (the
    image is fetched by Facebook from its existing public Cloudinary URL,
    not uploaded as bytes); otherwise /{page-id}/feed with just the text."""
    from marketing.models import SocialMediaCredentials

    credentials = SocialMediaCredentials.load()
    if not credentials.facebook_configured:
        raise PublishingNotConfiguredError(
            'Les identifiants Facebook ne sont pas configurés (Paramètres > Réseaux sociaux).'
        )
    page_id = credentials.facebook_page_id
    access_token = credentials.facebook_access_token

    if post.image_path:
        url = f'{GRAPH_API_BASE}/{page_id}/photos'
        payload = {'url': post.image_path, 'caption': post.content, 'access_token': access_token}
    else:
        url = f'{GRAPH_API_BASE}/{page_id}/feed'
        payload = {'message': post.content, 'access_token': access_token}

    data = _graph_request('post', url, data=payload)
    post_id = data.get('post_id') or data.get('id')
    return f'https://www.facebook.com/{post_id}'


def publish_to_instagram(post) -> str:
    """Publishes to the configured Instagram Business account — same Graph
    API as Facebook, authenticated with the linked Page's access token.
    A single image posts directly; more than one posts as a real
    carousel: each image becomes its own child media container
    (is_carousel_item=true), a parent CAROUSEL container references all
    of them, and that parent is what gets published."""
    from marketing.models import SocialMediaCredentials

    credentials = SocialMediaCredentials.load()
    if not credentials.instagram_configured:
        raise PublishingNotConfiguredError(
            "Les identifiants Instagram ne sont pas configurés (Paramètres > Réseaux sociaux)."
        )
    ig_user_id = credentials.instagram_business_account_id
    access_token = credentials.facebook_access_token
    images = _post_images(post)
    if not images:
        raise PublishingError('Instagram nécessite au moins une image.')

    if len(images) == 1:
        container = _graph_request('post', f'{GRAPH_API_BASE}/{ig_user_id}/media', data={
            'image_url': images[0], 'caption': post.content, 'access_token': access_token,
        })
    else:
        child_ids = []
        for image_url in images:
            child = _graph_request('post', f'{GRAPH_API_BASE}/{ig_user_id}/media', data={
                'image_url': image_url, 'is_carousel_item': 'true', 'access_token': access_token,
            })
            child_ids.append(child['id'])
        container = _graph_request('post', f'{GRAPH_API_BASE}/{ig_user_id}/media', data={
            'media_type': 'CAROUSEL', 'children': ','.join(child_ids),
            'caption': post.content, 'access_token': access_token,
        })

    published = _graph_request('post', f'{GRAPH_API_BASE}/{ig_user_id}/media_publish', data={
        'creation_id': container['id'], 'access_token': access_token,
    })
    permalink = _graph_request('get', f"{GRAPH_API_BASE}/{published['id']}", params={
        'fields': 'permalink', 'access_token': access_token,
    })
    return permalink.get('permalink') or f"https://www.instagram.com/p/{published['id']}/"


# platform -> publish function.
PUBLISHERS = {
    'FACEBOOK': publish_to_facebook,
    'INSTAGRAM': publish_to_instagram,
}


def run_scheduled_publishing():
    """Finds due SCHEDULED posts and publishes them. Returns a list of
    (post, success) pairs for whichever caller wants to report on it
    (management command, the future cron-triggered endpoint, ...). Posts
    whose platform's credentials aren't configured yet are left
    untouched — this is meant to be called repeatedly, not to fail loudly
    when nothing's wired up yet."""
    from marketing.models import SocialPost

    due = SocialPost.objects.filter(
        status=SocialPost.Status.SCHEDULED,
        scheduled_at__lte=timezone.now(),
        platform__in=PUBLISHERS.keys(),
    )

    results = []
    for post in due:
        publish = PUBLISHERS[post.platform]
        try:
            post_url = publish(post)
        except PublishingNotConfiguredError:
            continue
        except Exception as exc:
            logger.exception('Failed to publish SocialPost %s to %s', post.id, post.platform)
            note = f'[Échec publication {timezone.now():%d/%m/%Y %H:%M}] {exc}'
            post.status = SocialPost.Status.FAILED
            post.notes = f'{post.notes}\n{note}'.strip()
            post.save(update_fields=['status', 'notes'])
            results.append((post, False))
            continue

        post.status = SocialPost.Status.PUBLISHED
        post.published_at = timezone.now()
        post.post_url = post_url
        post.save(update_fields=['status', 'published_at', 'post_url'])
        results.append((post, True))

    return results
