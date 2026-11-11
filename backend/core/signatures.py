"""Signatures manuscrites (pad de signature côté navigateur, PNG base64)."""
import base64
import binascii

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

MAX_SIGNATURE_BYTES = 512 * 1024


def decode_signature_image(data_url: str) -> SimpleUploadedFile:
    """`canvas.toDataURL('image/png')` -> fichier consommable par
    core.storage.upload_image (même validation que toute image)."""
    if not isinstance(data_url, str) or not data_url.startswith('data:image/'):
        raise ValidationError('Signature invalide.')
    try:
        header, encoded = data_url.split(',', 1)
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError, binascii.Error):
        raise ValidationError('Signature invalide.')
    if not raw or len(raw) > MAX_SIGNATURE_BYTES:
        raise ValidationError('Signature invalide.')
    content_type = 'image/png' if 'image/png' in header else 'image/jpeg'
    return SimpleUploadedFile('signature.png', raw, content_type=content_type)
