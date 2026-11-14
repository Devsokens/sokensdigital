"""Passage lead <-> client.

Deux règles métier, symétriques :

- un lead qui passe en CONVERTI devient un client CRM (``convert_lead_to_client``) ;
- un client créé directement dans le CRM apparaît comme un lead déjà
  converti dans le tunnel commercial (``create_converted_lead_for_client``).

Appelées explicitement par les vues (LeadViewSet, ClientViewSet) plutôt que
par un signal : un client créé par la conversion d'un lead ne doit pas
générer un second lead, et un signal post_save ne sait pas distinguer les
deux origines.
"""

from django.db import transaction

from administration.models import Client, Contact

from .models import Lead


def _lead_contacts(lead):
    """Contacts du lead sous forme de dicts — le JSON `contacts` s'il est
    renseigné, sinon le demandeur principal (champs historiques du lead)."""
    contacts = [c for c in (lead.contacts or []) if isinstance(c, dict)]
    if contacts:
        return contacts
    if lead.first_name or lead.last_name:
        return [{
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'email': lead.email,
            'phone': lead.phone,
            'role': 'Contact principal',
            'is_primary': True,
        }]
    return []


@transaction.atomic
def convert_lead_to_client(lead):
    """Rattache le lead à un client, en le créant au besoin.

    Un client existant portant le même nom d'entreprise est réutilisé plutôt
    que dupliqué. Les contacts du lead sont recopiés sur la fiche client
    (sans doublon d'e-mail). Idempotent : un lead déjà rattaché n'est pas
    reconverti.
    """
    if lead.client_id:
        return lead.client

    company = (lead.company_name or '').strip()
    client = Client.objects.filter(company_name__iexact=company).first() if company else None
    created = client is None
    if created:
        client = Client.objects.create(
            company_name=company or f'{lead.first_name} {lead.last_name}'.strip() or lead.email,
            email=lead.email or '',
            phone=lead.phone or '',
            assigned_to=lead.assigned_to,
        )

    known_emails = {e.lower() for e in client.contacts.values_list('email', flat=True) if e}
    for index, contact in enumerate(_lead_contacts(lead)):
        first_name = (contact.get('first_name') or '').strip()
        last_name = (contact.get('last_name') or '').strip()
        email = (contact.get('email') or '').strip()
        if not (first_name or last_name):
            continue
        if email and email.lower() in known_emails:
            continue
        Contact.objects.create(
            client=client,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=(contact.get('phone') or '').strip(),
            role=(contact.get('role') or '').strip(),
            is_primary=bool(contact.get('is_primary')) or (created and index == 0),
        )
        if email:
            known_emails.add(email.lower())

    lead.client = client
    lead.save(update_fields=['client'])
    return client


def create_converted_lead_for_client(client, source=None, qualification_score=None, estimated_value=None):
    """Inscrit un client créé directement dans le tunnel, colonne « Converti ».

    Les champs « lead » du formulaire client (source, score, valeur estimée)
    sont reportés sur ce lead ; à défaut, source « client créé directement »
    et score 100.
    """
    if client.leads.exists():
        return client.leads.first()

    primary = client.contacts.order_by('-is_primary', 'created_at').first()
    return Lead.objects.create(
        client=client,
        company_name=client.company_name,
        first_name=primary.first_name if primary else '',
        last_name=primary.last_name if primary else '',
        email=(primary.email if primary and primary.email else client.email) or '',
        phone=(primary.phone if primary and primary.phone else client.phone) or '',
        message=client.notes or '',
        created_from_client=True,
        source=source or Lead.Source.CREATION_CLIENT,
        status=Lead.Status.CONVERTI,
        qualification_score=100 if qualification_score is None else qualification_score,
        estimated_value=estimated_value,
        assigned_to=client.assigned_to,
    )
