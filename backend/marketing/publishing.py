"""The publishing engine flagged as not-implemented in
docs/backend-specifications.md §7.4 — actually posting a SCHEDULED
SocialPost to its target platform. Facebook is the first (only, for now)
platform wired up; the others (LinkedIn/X/Instagram/YouTube) each need
their own publish_to_X() here plus a branch in run_scheduled_publishing()
once credentials for them exist.

Nothing here talks to Facebook until FACEBOOK_PAGE_ID and
FACEBOOK_PAGE_ACCESS_TOKEN are both set (blank by default) — see the
setup checklist for how to obtain them. Until then,
run_scheduled_publishing() just leaves Facebook posts SCHEDULED and skips
them, so turning this on later is a config change, not a code change.
"""

import logging

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = 'v21.0'
GRAPH_API_BASE = f'https://graph.facebook.com/{GRAPH_API_VERSION}'


class PublishingNotConfiguredError(Exception):
    """Raised when the target platform's credentials aren't set yet."""


class PublishingError(Exception):
    """Raised when the platform's API rejected the publish request."""


def publish_to_facebook(post) -> str:
    """Publishes one SocialPost to the configured Facebook Page. Returns the
    published post's URL. A post with an image uses /{page-id}/photos (the
    image is fetched by Facebook from its existing public Supabase URL, not
    uploaded as bytes); otherwise /{page-id}/feed with just the text."""
    page_id = settings.FACEBOOK_PAGE_ID
    access_token = settings.FACEBOOK_PAGE_ACCESS_TOKEN
    if not page_id or not access_token:
        raise PublishingNotConfiguredError(
            'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN ne sont pas configurés.'
        )

    if post.image_path:
        url = f'{GRAPH_API_BASE}/{page_id}/photos'
        payload = {'url': post.image_path, 'caption': post.content, 'access_token': access_token}
    else:
        url = f'{GRAPH_API_BASE}/{page_id}/feed'
        payload = {'message': post.content, 'access_token': access_token}

    response = requests.post(url, data=payload, timeout=15)
    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code >= 400 or 'error' in data:
        message = data.get('error', {}).get('message') or response.text
        raise PublishingError(message)

    # /photos returns {id: <photo_id>, post_id: <feed_post_id>} when posted
    # with a caption; /feed just returns {id: <post_id>}.
    post_id = data.get('post_id') or data.get('id')
    return f'https://www.facebook.com/{post_id}'


# platform -> publish function. Add LinkedIn/X/Instagram/YouTube here once
# each has real credentials and its own publish_to_X().
PUBLISHERS = {
    'FACEBOOK': publish_to_facebook,
}


def run_scheduled_publishing():
    """Finds due SCHEDULED posts on platforms we can actually publish to
    and publishes them. Returns a list of (post, success) pairs for
    whichever caller wants to report on it (management command, Celery
    task, ...). Posts on a platform with no publisher yet, or whose
    platform is configured but credentials aren't, are left untouched —
    this is meant to be called repeatedly (cron/Beat), not to fail loudly
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
