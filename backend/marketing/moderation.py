"""Filtre automatique des commentaires publics du blog — première ligne de
défense avant relecture humaine (Responsable Marketing/Super-Admin, voir
BlogCommentModerationViewSet dans marketing/views.py).

Volontairement permissif dans les deux sens : ce n'est PAS un modérateur
IA (aucun service de type Perspective API n'est branché ici), seulement une
liste de motifs qui bascule un commentaire en file d'attente au lieu de le
publier tout de suite. Un faux négatif reste rattrapable par le
signalement des lecteurs (report_blog_comment) ; un faux positif ne fait
que retarder une publication légitime jusqu'à la relecture manuelle — dans
les deux cas, rien n'est jamais supprimé automatiquement.
"""
import re

_BANNED_PATTERNS = [
    # Insultes courantes (français)
    r"\bconnard\b", r"\bconnasse\b", r"\bencul[ée]s?\b", r"\bsalope\b", r"\bpute\b",
    r"\bfils\s+de\s+pute\b", r"\bbâtard\b", r"\bcrève\b", r"\bpd\b",
    # Haine / discrimination
    r"\bn[eè]gre\b", r"\bbougnoule\b", r"\bsale\s+(arabe|noir|juif|juive|blanc|chinois)\b",
    r"\bnazi\b", r"\bsous-race\b",
    # Menaces / incitation à la violence ou au suicide
    r"\bje\s+vais\s+te\s+tuer\b", r"\bva\s+mourir\b", r"\bva\s+te\s+suicider\b", r"\bsuicide[- ]toi\b",
    r"\bviole(r|é|e)?\b",
    # Insultes/haine (anglais, contenu international possible)
    r"\bfuck\b", r"\bbitch\b", r"\bnigger\b", r"\bfaggot\b", r"\bkill\s+yourself\b",
    # Spam : lien brut ou numéro de téléphone/WhatsApp collé dans un commentaire
    r"https?://", r"www\.",
    r"\bwhatsapp\b.{0,20}\+?\d{6,}",
]
_COMPILED = [re.compile(pattern, re.IGNORECASE) for pattern in _BANNED_PATTERNS]


def screen_comment(text: str) -> bool:
    """True si `text` doit être mis en file d'attente de modération avant
    d'apparaître publiquement (insulte, propos haineux, menace, spam)."""
    if not text:
        return False
    return any(pattern.search(text) for pattern in _COMPILED)
