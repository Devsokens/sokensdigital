"""
Sanitization HTML serveur — défense contre XSS stockée sur tout champ HTML
admin-saisi et rendu publiquement (ex: BlogPost.content, injecté tel quel
via dangerouslySetInnerHTML côté frontend).

Ne jamais faire confiance à une restriction côté client (éditeur Tiptap,
validation JS) comme frontière de sécurité — un appel API direct (curl,
Postman) contourne totalement l'UI. La sanitization doit vivre ici, au
plus près du stockage, pour couvrir tous les chemins d'écriture présents
et futurs.
"""
import nh3

# Allowlist volontairement restreinte au strict nécessaire pour du contenu
# éditorial (gras, listes, liens, images, titres) — tout ce qui n'est pas
# listé ici (script, iframe, on*, style inline...) est retiré silencieusement.
ALLOWED_TAGS = {
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'img',
}
ALLOWED_ATTRIBUTES = {
    # 'rel' volontairement absent : nh3 gère cet attribut lui-même sur les
    # liens (ajoute noopener/noreferrer automatiquement contre le reverse
    # tabnabbing) — le déclarer nous-même entre en conflit avec ce défaut.
    'a': {'href', 'title', 'target'},
    'img': {'src', 'alt', 'title', 'width', 'height'},
}
# Bloque javascript:/data: sur href/src — seuls ces schémas passent.
ALLOWED_URL_SCHEMES = {'http', 'https', 'mailto'}


def sanitize_html(raw_html: str) -> str:
    """Nettoie un champ HTML admin-saisi avant stockage. Idempotent —
    ré-appliquer sur du contenu déjà nettoyé ne change rien."""
    if not raw_html:
        return raw_html
    return nh3.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
    )


def sanitize_plain_text(raw: str) -> str:
    """Nettoie un champ texte libre saisi par le public (pseudo, commentaire
    de blog) : aucune balise autorisée, contrairement à sanitize_html — ce
    contenu n'est jamais injecté en HTML côté client (texte brut React, pas
    de dangerouslySetInnerHTML), donc pas besoin d'allowlist éditoriale,
    seulement d'empêcher toute balise de survivre au stockage, en défense
    en profondeur si un futur affichage venait à changer."""
    if not raw:
        return raw
    return nh3.clean(raw, tags=set(), attributes={}).strip()
