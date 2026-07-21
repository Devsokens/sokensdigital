import logging
import os
import uuid

import requests
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

BUCKET_NAME = 'site-content'
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 Mo
ALLOWED_CONTENT_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'}

MAX_VIDEO_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 Mo — short demo clips only, not full-length video
ALLOWED_VIDEO_CONTENT_TYPES = {'video/mp4', 'video/webm', 'video/quicktime'}

_bucket_ensured = False


def _supabase_config() -> tuple[str, str]:
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ne sont pas configurées.')
    return url.rstrip('/'), key


def _ensure_bucket() -> None:
    """Idempotent, once per process — creates the public bucket if it
    doesn't exist yet. Public: these are marketing-site assets (partner
    logos, team photos) meant to be served directly to site visitors, same
    trust level as a static image in the frontend repo."""
    global _bucket_ensured
    if _bucket_ensured:
        return
    url, key = _supabase_config()
    headers = {'Authorization': f'Bearer {key}', 'apikey': key}
    response = requests.post(
        f'{url}/storage/v1/bucket',
        json={'id': BUCKET_NAME, 'name': BUCKET_NAME, 'public': True},
        headers=headers, timeout=10,
    )
    if response.status_code not in (200, 201) and 'already exists' not in response.text:
        logger.warning('Could not ensure Supabase bucket %s: %s', BUCKET_NAME, response.text)
    _bucket_ensured = True


def upload_image(file, folder: str) -> str:
    """Uploads an image to Supabase Storage, returns its public URL.
    `file` is a Django UploadedFile (request.FILES['file']). Raises
    django.core.exceptions.ValidationError for oversized/wrong-type files
    (the view turns that into a 400) — never silently accepts a bad file."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (5 Mo).')
    return _upload(file, folder)


def upload_video(file, folder: str) -> str:
    """Same as upload_image, but for the short demo clips used as a
    project's video_src — bigger size cap, video content-types only."""
    if file.content_type not in ALLOWED_VIDEO_CONTENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_VIDEO_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (25 Mo).')
    return _upload(file, folder)


def _upload(file, folder: str) -> str:
    _ensure_bucket()
    url, key = _supabase_config()
    extension = os.path.splitext(file.name)[1] or '.jpg'
    path = f'{folder}/{uuid.uuid4()}{extension}'

    response = requests.post(
        f'{url}/storage/v1/object/{BUCKET_NAME}/{path}',
        headers={
            'Authorization': f'Bearer {key}',
            'apikey': key,
            'Content-Type': file.content_type,
        },
        data=file.read(),
        timeout=30,
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Échec de l'upload vers Supabase Storage : {response.text}")

    return f'{url}/storage/v1/object/public/{BUCKET_NAME}/{path}'
