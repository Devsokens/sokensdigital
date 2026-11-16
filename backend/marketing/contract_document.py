"""Texte du contrat de prestation de services, d'après le modèle de Soken's
Digital, découpé en blocs (titres, paragraphes, puces, signatures…).

Le PDF (marketing/contract_pdf.html) et l'aperçu de l'admin
(frontend/components/admin/contracts/contract-blocks.ts) construisent les
mêmes blocs à partir des mêmes données : modifier les deux ensemble.

Dans le texte, **gras** marque les passages en gras. Une donnée manquante
s'affiche entre crochets, comme dans le modèle (« [adresse] »)."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

MONTHS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
    'septembre', 'octobre', 'novembre', 'décembre',
]

_UNITS = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
]
_TENS = {2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante'}


def _below_100(n: int, final: bool) -> str:
    if n < 17:
        return _UNITS[n]
    if n < 20:
        return 'dix-' + _UNITS[n - 10]
    tens, unit = divmod(n, 10)
    if tens == 7:
        return 'soixante et onze' if unit == 1 else 'soixante-' + _below_100(10 + unit, final)
    if tens == 9:
        return 'quatre-vingt-' + _below_100(10 + unit, final)
    if tens == 8:
        if unit == 0:
            return 'quatre-vingts' if final else 'quatre-vingt'
        return 'quatre-vingt-' + _UNITS[unit]
    word = _TENS[tens]
    if unit == 0:
        return word
    if unit == 1:
        return word + ' et un'
    return word + '-' + _UNITS[unit]


def _below_1000(n: int, final: bool) -> str:
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        if hundreds == 1:
            parts.append('cent')
        else:
            parts.append(_UNITS[hundreds] + ' cent' + ('s' if rest == 0 and final else ''))
    if rest:
        parts.append(_below_100(rest, final))
    return ' '.join(parts)


def amount_in_words(value) -> str:
    """2 500 000 → « deux millions cinq cent mille » (orthographe
    traditionnelle : cents / quatre-vingts au pluriel en fin de nombre)."""
    n = int(Decimal(value or 0).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    if n == 0:
        return 'zéro'
    parts = []
    for size, name in ((10 ** 9, 'milliard'), (10 ** 6, 'million')):
        count, n = divmod(n, size)
        if count:
            parts.append(_below_1000(count, True) + ' ' + name + ('s' if count > 1 else ''))
    thousands, n = divmod(n, 1000)
    if thousands:
        parts.append('mille' if thousands == 1 else _below_1000(thousands, False) + ' mille')
    if n:
        parts.append(_below_1000(n, True))
    return ' '.join(parts)


def fcfa(value) -> str:
    amount = Decimal(value or 0).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return f'{amount:,.0f}'.replace(',', ' ')


def long_date(value) -> str:
    if not value:
        return ''
    if isinstance(value, str):
        value = date.fromisoformat(value[:10])
    day = '1er' if value.day == 1 else str(value.day)
    return f'{day} {MONTHS[value.month - 1]} {value.year}'


def _number(value) -> str:
    """2 → « 2 », 2.5 → « 2,5 »."""
    d = Decimal(str(value or 0)).normalize()
    return f'{d:f}'.replace('.', ',')


def _or(value, placeholder: str) -> str:
    value = (value or '').strip() if isinstance(value, str) else value
    return value if value else f'[{placeholder}]'


def _paragraphs(text: str) -> list[str]:
    return [block.strip() for block in (text or '').split('\n\n') if block.strip()]


def _text_blocks(text: str) -> list[dict]:
    """Texte libre : un paragraphe par bloc, les lignes « - … » en puces."""
    blocks = []
    for para in _paragraphs(text):
        lines = [line.strip() for line in para.split('\n') if line.strip()]
        if lines and all(line[:2] in ('- ', '• ') for line in lines):
            blocks.extend({'t': 'li', 'text': line[2:].strip()} for line in lines)
        else:
            blocks.append({'t': 'p', 'text': '\n'.join(lines)})
    return blocks


def contract_blocks(c: dict, settings: dict) -> list[dict]:
    """Blocs du contrat. `c` : champs du contrat (comme le sérialiseur) ;
    `settings` : identité du Prestataire, signataire, ville, adresse et
    e-mail de la société."""
    city = settings.get('city') or 'Libreville'
    ht = c.get('amount_basis') != 'TTC'
    amount = Decimal(str(c.get('amount') or 0))
    schedule = [t for t in (c.get('payment_schedule') or []) if isinstance(t, dict)]

    client_parts = [f"{_or(c.get('client_name'), 'Dénomination sociale ou nom et prénom')}"]
    client_parts.append(_or(c.get('client_legal_form'), 'forme juridique, capital social en FCFA'))
    client_text = (
        ', '.join(client_parts)
        + f", dont le siège est situé à {_or(c.get('client_address'), 'adresse complète, Gabon')}"
        + f", immatriculé(e) au RCCM sous le n° {_or(c.get('client_rccm'), 'numéro')}"
        + f", NIF n° {_or(c.get('client_nif'), 'numéro')}"
        + f", représenté(e) par {_or(c.get('client_representative'), 'nom, prénom et qualité du signataire')}"
        + ', dûment habilité(e) à cet effet.'
    )

    b: list[dict] = [
        {'t': 'title', 'text': 'CONTRAT DE PRESTATION DE SERVICES'},
        {'t': 'section', 'text': 'ENTRE LES SOUSSIGNÉS'},
        {'t': 'p', 'text': settings.get('provider_identity') or ''},
        {'t': 'p', 'text': 'Ci-après désigné « **le Prestataire** »,'},
        {'t': 'p', 'text': '**ET**'},
        {'t': 'p', 'text': client_text},
        {'t': 'p', 'text': 'Ci-après désigné « **le Client** »,'},
        {'t': 'p', 'text': 'Le Prestataire et le Client sont désignés ensemble « les Parties » et individuellement « une Partie ».'},
        {'t': 'section', 'text': 'PRÉAMBULE'},
    ]
    b += [{'t': 'p', 'text': p} for p in _paragraphs(c.get('preamble'))]
    b.append({'t': 'p', 'text': 'Les Parties se sont rapprochées et ont convenu ce qui suit.'})

    b += [
        {'t': 'article', 'text': 'Article 1 – Objet'},
        {'t': 'p', 'text': 'Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalise, au profit du Client, les prestations décrites à l’article 3 et à l’Annexe 1.'},
        {'t': 'article', 'text': 'Article 2 – Nature du contrat'},
        {'t': 'p', 'text': 'Le présent contrat est un contrat de louage d’ouvrage et d’industrie (contrat d’entreprise) régi par le Code civil gabonais. Il ne constitue ni un contrat de travail, ni un mandat, ni un contrat de société.'},
        {'t': 'p', 'text': 'Le Prestataire exécute les prestations en toute indépendance, avec ses propres moyens, et organise librement son travail. Il n’existe aucun lien de subordination entre les Parties. Le Prestataire reste seul responsable de ses obligations sociales, fiscales et déclaratives, ainsi que de celles de son personnel éventuel.'},
        {'t': 'article', 'text': 'Article 3 – Description des prestations'},
    ]
    services = _text_blocks(c.get('services_description'))
    if services:
        b.append({'t': 'p', 'text': 'Le Prestataire s’engage à réaliser les prestations suivantes :'})
        b += services
        b.append({'t': 'p', 'text': 'Le détail figure en Annexe 1.'})
    else:
        b.append({'t': 'p', 'text': 'Le Prestataire s’engage à réaliser les prestations suivantes : [description précise des tâches, livrables, normes de qualité attendues et critères de réception]. Le détail figure en Annexe 1.'})
    b.append({'t': 'p', 'text': 'Tout ajout ou modification de prestations fait l’objet d’un avenant écrit signé par les deux Parties.'})

    start = _or(long_date(c.get('start_date')), 'date')
    duration = (c.get('duration') or '').strip()
    term = f'pour une durée de {duration}' if duration else 'jusqu’à la réalisation complète des prestations'
    if c.get('renewal') == 'RENOUVELABLE':
        renewal = f"Il est renouvelable par accord écrit des Parties, au plus tard {c.get('renewal_notice_days') or 30} jours avant l’échéance."
    else:
        renewal = 'Il prend fin de plein droit à son terme.'
    b += [
        {'t': 'article', 'text': 'Article 4 – Durée'},
        {'t': 'p', 'text': f'Le contrat prend effet le {start} {term}. {renewal}'},
        {'t': 'section', 'text': 'OBLIGATIONS'},
        {'t': 'article', 'text': 'Article 5 – Obligations du Prestataire'},
        {'t': 'p', 'text': 'Le Prestataire s’engage à :'},
        {'t': 'li', 'text': 'Exécuter les prestations avec diligence, professionnalisme et dans les délais convenus ;'},
        {'t': 'li', 'text': 'Informer le Client de toute difficulté pouvant affecter l’exécution du contrat ;'},
        {'t': 'li', 'text': 'Respecter la réglementation gabonaise applicable à son activité, notamment en matière fiscale, sociale et professionnelle ;'},
        {'t': 'li', 'text': 'Remettre au Client les livrables conformes au cahier des charges.'},
        {'t': 'article', 'text': 'Article 6 – Obligations du Client'},
        {'t': 'p', 'text': 'Le Client s’engage à :'},
        {'t': 'li', 'text': 'Fournir au Prestataire les informations, documents et accès nécessaires à l’exécution des prestations ;'},
        {'t': 'li', 'text': 'Collaborer de bonne foi et répondre dans un délai raisonnable aux demandes du Prestataire ;'},
        {'t': 'li', 'text': 'Procéder à la réception des livrables et payer le prix dans les conditions de l’article 7.'},
    ]

    if amount > 0:
        price = f'{fcfa(amount)} ({amount_in_words(amount)}) francs CFA (FCFA)'
    else:
        price = '[montant en chiffres et en lettres] francs CFA (FCFA)'
    basis = 'hors taxes' if ht else 'toutes taxes comprises'
    if schedule:
        steps = ' ; '.join(
            f"{_number(t.get('percentage'))} % {(t.get('label') or '').strip()[:1].lower()}{(t.get('label') or '').strip()[1:]}"
            for t in schedule
        )
        first = schedule[0]
        first_pct = _number(first.get('percentage'))
        schedule_text = (
            f'Le règlement intégral du Prestataire est échelonné de la manière suivante : {steps}. '
            f"Le premier paiement, égal à {first_pct} % du montant à payer, intervient dans un délai de "
            f"{c.get('first_payment_days') or 30} jours à compter de la réception de la facture"
        )
    else:
        schedule_text = (
            'Le règlement intervient dans un délai de '
            f"{c.get('first_payment_days') or 30} jours à compter de la réception de la facture"
        )
    methods = (c.get('payment_methods') or '').strip()
    schedule_text += f', {methods}.' if methods else '.'
    taxes = (
        'Les montants s’entendent hors taxes, la TVA au taux en vigueur s’ajoutant au prix.'
        if ht else 'Les montants s’entendent toutes taxes comprises.'
    )
    b += [
        {'t': 'article', 'text': 'Article 7 – Prix et modalités de paiement'},
        {'t': 'p', 'text': f'**7.1 Prix.** En contrepartie des prestations, le Client verse au Prestataire la somme de {price} {basis}, selon l’échéancier de l’article 7.3, détaillé en Annexe 2.'},
        {'t': 'p', 'text': f'**7.2 Taxes.** {taxes} Chaque Partie supporte les impôts et taxes qui lui incombent selon la législation fiscale gabonaise. Si le Client est tenu d’opérer une retenue à la source, il la déduit du paiement et en remet justificatif au Prestataire.'},
        {'t': 'p', 'text': f'**7.3 Facturation et paiement.** Le Prestataire émet une facture mentionnant son identité, son NIF et son numéro RCCM, la désignation des prestations, le montant hors taxes, la TVA et le montant total. {schedule_text}'},
        {'t': 'p', 'text': f"**7.4 Retard de paiement.** Tout retard de paiement entraîne de plein droit, après mise en demeure restée sans effet pendant 8 jours, des pénalités de retard au taux de {_number(c.get('late_penalty_rate') or 2)} % par mois, sans préjudice de tous autres droits du Prestataire."},
    ]

    if c.get('expenses_covered'):
        expenses = 'Les frais de déplacement, d’hébergement et autres débours engagés pour l’exécution des prestations sont pris en charge par le Client, sur présentation de justificatifs'
        threshold = c.get('expenses_threshold')
        if threshold not in (None, '') and Decimal(str(threshold)) > 0:
            expenses += f' et après accord écrit préalable pour tout montant supérieur à {fcfa(threshold)} FCFA.'
        else:
            expenses += '.'
    else:
        expenses = 'Les frais de déplacement, d’hébergement et autres débours engagés pour l’exécution des prestations ne sont pas pris en charge par le Client.'
    years = c.get('confidentiality_years') or 5
    liability = (c.get('liability_cap') or '').strip() or 'au montant total du prix du contrat'
    insurance = (c.get('insurance') or '').strip()
    responsibility = (
        'Le Prestataire répond des dommages directs causés au Client par sa faute dans l’exécution des prestations. '
        f'Sauf faute lourde ou dolosive, sa responsabilité est limitée {liability} et ne couvre pas les dommages indirects.'
    )
    if insurance:
        responsibility += f' Le Prestataire déclare avoir souscrit {insurance} et en fournit l’attestation sur demande.'
    b += [
        {'t': 'article', 'text': 'Article 8 – Frais et débours'},
        {'t': 'p', 'text': expenses},
        {'t': 'article', 'text': 'Article 9 – Confidentialité'},
        {'t': 'p', 'text': f'Chaque Partie s’engage à garder strictement confidentielles les informations de toute nature (techniques, commerciales, financières, personnelles) dont elle a connaissance du fait du contrat, et à ne les utiliser que pour son exécution. Cette obligation s’applique pendant toute la durée du contrat et pendant {years} ans après son terme. Elle ne s’applique pas aux informations tombées dans le domaine public sans faute de la Partie qui les détient, ni à celles dont la loi ou une décision de justice impose la divulgation.'},
        {'t': 'sub', 'text': 'Protection des données à caractère personnel'},
        {'t': 'p', 'text': 'Lorsque l’exécution du contrat implique le traitement de données à caractère personnel, chaque Partie s’engage à respecter la législation gabonaise en vigueur sur la protection de ces données, à ne les traiter que sur instruction documentée du Client et pour les finalités du contrat, à en assurer la sécurité et à les restituer ou les détruire à la fin du contrat.'},
        {'t': 'article', 'text': 'Article 10 – Responsabilité et assurance'},
        {'t': 'p', 'text': responsibility},
        {'t': 'article', 'text': 'Article 11 – Force majeure'},
        {'t': 'p', 'text': 'Aucune Partie n’est responsable de l’inexécution de ses obligations lorsqu’elle résulte d’un événement imprévisible, irrésistible et extérieur à sa volonté. La Partie concernée informe l’autre sans délai. Si l’événement dure plus de 30 jours, chaque Partie peut résilier le contrat par lettre recommandée, sans indemnité.'},
        {'t': 'article', 'text': 'Article 12 – Résiliation'},
        {'t': 'p', 'text': '**12.1 Pour manquement.** En cas de manquement grave d’une Partie à ses obligations, non réparé dans un délai de 15 jours après mise en demeure par lettre recommandée avec accusé de réception ou par acte extrajudiciaire, l’autre Partie peut résilier le contrat de plein droit, sans préjudice de dommages et intérêts.'},
        {'t': 'p', 'text': '**12.2 Pour convenance.** Chaque Partie peut mettre fin au contrat, sans motif, moyennant un préavis écrit de 30 jours. Les prestations déjà réalisées sont alors payées au prorata de leur avancement.'},
        {'t': 'article', 'text': 'Article 13 – Sous-traitance et cession'},
        {'t': 'p', 'text': 'Le Prestataire ne peut sous-traiter tout ou partie des prestations, ni céder le contrat, sans l’accord écrit préalable du Client. Il reste, dans tous les cas, seul responsable envers le Client.'},
        {'t': 'article', 'text': 'Article 14 – Intégralité et modification'},
        {'t': 'p', 'text': 'Le contrat et ses annexes expriment l’intégralité de l’accord des Parties et remplacent tout accord antérieur sur le même objet. Toute modification doit faire l’objet d’un avenant écrit signé des deux Parties.'},
    ]

    client_contact = ', '.join(x for x in [(c.get('client_address') or '').strip(), (c.get('client_email') or '').strip()] if x)
    company_address = ', '.join(line.strip() for line in (settings.get('company_address') or '').split('\n') if line.strip())
    provider_contact = ', '.join(x for x in [company_address, (settings.get('company_email') or '').strip()] if x)
    b += [
        {'t': 'article', 'text': 'Article 15 – Notifications'},
        {'t': 'p', 'text': f"Toute notification est faite par écrit, par lettre recommandée avec accusé de réception, par remise en main propre contre décharge ou par courriel avec accusé de réception, aux adresses suivantes : Client : {_or(client_contact, 'adresse, courriel')} ; Prestataire : {_or(provider_contact, 'adresse, courriel')}. Tout changement d’adresse est notifié à l’autre Partie."},
        {'t': 'article', 'text': 'Article 16 – Loi applicable et règlement des litiges'},
        {'t': 'p', 'text': f'Le contrat est soumis au droit gabonais. Les Parties s’efforcent de régler à l’amiable tout différend relatif à sa formation, son interprétation ou son exécution, dans un délai de 30 jours à compter de la notification du différend. À défaut, le litige est soumis aux juridictions compétentes de {city}.'},
        {'t': 'article', 'text': 'Article 17 – Élection de domicile'},
        {'t': 'p', 'text': 'Pour l’exécution du contrat, les Parties font élection de domicile en leurs sièges ou adresses respectifs indiqués en tête des présentes.'},
        {'t': 'closing', 'text': f"Fait à {city}, le {_or(long_date(c.get('signing_date')), 'date')}, en deux exemplaires originaux, un pour chaque Partie."},
        {
            't': 'signatures',
            'client': (c.get('client_signatory') or '').strip(),
            'provider': (c.get('provider_signatory') or '').strip() or settings.get('provider_signatory') or '',
        },
    ]

    b.append({'t': 'annex', 'text': 'ANNEXE 1 – Cahier des charges', 'break': True})
    specs = _text_blocks(c.get('annex_specifications'))
    b += specs or [{'t': 'p', 'text': '[Description détaillée des prestations, livrables, délais, critères de réception.]'}]

    b.append({'t': 'annex', 'text': 'ANNEXE 2 – Tarifs et calendrier de paiement'})
    if schedule and amount > 0:
        rows = []
        for t in schedule:
            pct = Decimal(str(t.get('percentage') or 0))
            rows.append({
                'label': (t.get('label') or '').strip(),
                'percentage': f'{_number(pct)} %',
                'amount': f'{fcfa(amount * pct / 100)} FCFA',
            })
        share = sum((Decimal(str(t.get('percentage') or 0)) for t in schedule), Decimal('0'))
        b.append({
            't': 'schedule', 'rows': rows, 'total_percentage': f'{_number(share)} %',
            'total': f'{fcfa(amount * share / 100)} FCFA {"HT" if ht else "TTC"}',
        })
    pricing = _text_blocks(c.get('annex_pricing'))
    if pricing:
        b += pricing
    elif not (schedule and amount > 0):
        b.append({'t': 'p', 'text': '[Grille tarifaire, échéancier, jalons.]'})
    for block in b:
        if 'text' in block:
            block['text'] = typography(block['text'])
    return b


def typography(text: str) -> str:
    """Espaces insécables de la typographie française : « x », x :, x ;, 20 %."""
    for old, new in (
        ('« ', '«\u00a0'), (' »', '\u00a0»'), (' :', '\u00a0:'), (' ;', '\u00a0;'), (' %', '\u00a0%'),
    ):
        text = text.replace(old, new)
    return text
