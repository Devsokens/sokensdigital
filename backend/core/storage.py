import io
import logging
import os
import uuid

import cloudinary
import cloudinary.uploader
import requests
from django.core.exceptions import ValidationError
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

BUCKET_NAME = 'site-content'
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 Mo — pre-compression, checked on the raw upload
ALLOWED_CONTENT_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'}
# Uploaded screenshots/photos routinely arrive at several megabytes and
# full camera resolution — nothing on this site is ever displayed larger
# than this, and serving the original made every page agonizingly slow.
MAX_IMAGE_DIMENSION = 1920
# Formats Pillow would silently mangle if we tried to recompress them —
# SVG isn't a raster format at all, GIF loses its animation to a single
# frame. Both pass through untouched.
PASSTHROUGH_CONTENT_TYPES = {'image/svg+xml', 'image/gif'}

MAX_VIDEO_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 Mo — short demo clips only, not full-length video
ALLOWED_VIDEO_CONTENT_TYPES = {'video/mp4', 'video/webm', 'video/quicktime'}

MAX_FILE_UPLOAD_SIZE = 20 * 1024 * 1024  # 20 Mo — matches the chat-attachment cap from the (now unused) storage.rules
# Pièces jointes chat — documents/images usuels uniquement. Pas d'exécutables,
# scripts, HTML (vecteur XSS/malware si le lien Cloudinary est cliqué par un
# collègue qui fait confiance au domaine). Étendre à la demande plutôt que
# l'inverse si un usage légitime bloqué est signalé.
ALLOWED_CHAT_ATTACHMENT_TYPES = {
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip',
}

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


def _resize_and_compress(file) -> tuple[bytes, str, str]:
    """Downscales to MAX_IMAGE_DIMENSION and recompresses. Images with
    transparency stay PNG (optimized); everything else becomes JPEG, by
    far the biggest win on typical photo/screenshot uploads."""
    try:
        image = Image.open(file)
        image = ImageOps.exif_transpose(image)  # respect the camera's rotation
    except Exception as exc:
        raise ValidationError(f'Image invalide ou corrompue : {exc}')

    has_alpha = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)

    if image.width > MAX_IMAGE_DIMENSION or image.height > MAX_IMAGE_DIMENSION:
        image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)

    buffer = io.BytesIO()
    if has_alpha:
        image.save(buffer, format='PNG', optimize=True)
        content_type, extension = 'image/png', '.png'
    else:
        image.convert('RGB').save(buffer, format='JPEG', quality=82, optimize=True)
        content_type, extension = 'image/jpeg', '.jpg'
    return buffer.getvalue(), content_type, extension


def _cloudinary_configure() -> None:
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME')
    api_key = os.environ.get('CLOUDINARY_API_KEY')
    api_secret = os.environ.get('CLOUDINARY_API_SECRET')
    if not all([cloud_name, api_key, api_secret]):
        raise RuntimeError('CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET ne sont pas configurées.')
    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)


def _upload_to_cloudinary(data: bytes, folder: str) -> str:
    """Uploads to Cloudinary, returns its public (secure) URL. Kept separate
    from Supabase's _upload_bytes — user-driven traffic (avatars, chat
    attachments) is deliberately routed here instead, since the Supabase
    project is already over its free-tier egress quota. resource_type='auto'
    lets Cloudinary route images/videos/arbitrary files correctly without
    us tracking the distinction here."""
    _cloudinary_configure()
    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(data), folder=folder, public_id=str(uuid.uuid4()), resource_type='auto',
        )
    except Exception as exc:
        raise RuntimeError(f"Échec de l'upload vers Cloudinary : {exc}")
    return result['secure_url']


def upload_avatar(file) -> str:
    """Uploads a profile photo to Cloudinary, returns its public URL.
    Same validation/resize pipeline as upload_image (see ALLOWED_CONTENT_TYPES,
    _resize_and_compress) — only the destination differs."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (5 Mo).')

    if file.content_type in PASSTHROUGH_CONTENT_TYPES:
        return _upload_to_cloudinary(file.read(), 'avatars')

    data, _content_type, _extension = _resize_and_compress(file)
    return _upload_to_cloudinary(data, 'avatars')


def upload_image(file, folder: str) -> str:
    """Uploads an image to Supabase Storage, returns its public URL.
    `file` is a Django UploadedFile (request.FILES['file']). Raises
    django.core.exceptions.ValidationError for oversized/wrong-type/corrupt
    files (the view turns that into a 400) — never silently accepts a bad
    file. Resized/recompressed before upload — see _resize_and_compress."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (5 Mo).')

    if file.content_type in PASSTHROUGH_CONTENT_TYPES:
        extension = os.path.splitext(file.name)[1] or '.png'
        return _upload_bytes(file.read(), file.content_type, extension, folder)

    data, content_type, extension = _resize_and_compress(file)
    return _upload_bytes(data, content_type, extension, folder)


def upload_video(file, folder: str) -> str:
    """Same as upload_image, but for the short demo clips used as a
    project's video_src — bigger size cap, video content-types only."""
    if file.content_type not in ALLOWED_VIDEO_CONTENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_VIDEO_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (25 Mo).')
    extension = os.path.splitext(file.name)[1] or '.mp4'
    return _upload_bytes(file.read(), file.content_type, extension, folder)


def upload_file(file, folder: str) -> str:
    """Uploads a chat attachment (documents/images, not arbitrary files) to
    Cloudinary and returns its public URL. Type-restricted to
    ALLOWED_CHAT_ATTACHMENT_TYPES — un fichier authentifié uploadé n'est pas
    pour autant un fichier de confiance ; un exécutable/script partagé en
    pièce jointe piège les collègues qui font confiance au lien."""
    if file.content_type not in ALLOWED_CHAT_ATTACHMENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_FILE_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (20 Mo).')
    return _upload_to_cloudinary(file.read(), folder)


def _upload_bytes(data: bytes, content_type: str, extension: str, folder: str) -> str:
    _ensure_bucket()
    url, key = _supabase_config()
    path = f'{folder}/{uuid.uuid4()}{extension}'

    response = requests.post(
        f'{url}/storage/v1/object/{BUCKET_NAME}/{path}',
        headers={
            'Authorization': f'Bearer {key}',
            'apikey': key,
            'Content-Type': content_type,
        },
        data=data,
        timeout=30,
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Échec de l'upload vers Supabase Storage : {response.text}")

    return f'{url}/storage/v1/object/public/{BUCKET_NAME}/{path}'
