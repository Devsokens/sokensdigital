"""Endpoint des pieces justificatives (core/attachment_views.py).

L'enjeu teste ici n'est pas le CRUD mais l'autorisation : une
GenericForeignKey non bridee laisse rattacher un fichier a n'importe quelle
ligne de n'importe quelle table, puis la relire.
"""


from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase

from core.constants import ROLE_ADMIN, ROLE_COMPTABLE, ROLE_DEVELOPER
from core.models import DocumentAttachment, Role, User
from finance.models import Invoice


def _pdf(name='justificatif.pdf'):
    # En-tete PDF reel : le validateur d'extension seul ne dit rien du
    # contenu, autant que la fixture soit honnete.
    return SimpleUploadedFile(name, b'%PDF-1.4\n%%EOF\n', content_type='application/pdf')


class DocumentAttachmentTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='compta@sokens.test')
        self.comptable.roles.add(Role.objects.get_or_create(name=ROLE_COMPTABLE)[0])

        self.admin = User.objects.create(email='admin@sokens.test')
        self.admin.roles.add(Role.objects.get_or_create(name=ROLE_ADMIN)[0])

        self.dev = User.objects.create(email='dev@sokens.test')
        self.dev.roles.add(Role.objects.get_or_create(name=ROLE_DEVELOPER)[0])

        self.invoice = Invoice.objects.create(
            client_name='Client Test', amount_ht=100000, issue_date='2026-01-15',
        )
        self.list_url = reverse('attachment-list')

    def _payload(self, **overrides):
        data = {
            'content_type': 'finance.invoice',
            'object_id': str(self.invoice.pk),
            'document_type': 'INVOICE',
            'file': _pdf(),
        }
        data.update(overrides)
        return data

    def test_accountant_uploads_and_lists(self):
        self.client.force_authenticate(user=self.comptable)

        response = self.client.post(self.list_url, self._payload(), format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['file_name'], 'justificatif.pdf')
        # Le chemin brut dans le bucket ne doit jamais sortir.
        self.assertNotIn('file', response.data)

        listing = self.client.get(
            self.list_url,
            {'content_type': 'finance.invoice', 'object_id': str(self.invoice.pk)},
        )
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data['count'], 1)

    def test_developer_cannot_attach_to_an_invoice(self):
        self.client.force_authenticate(user=self.dev)
        response = self.client.post(self.list_url, self._payload(), format='multipart')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(DocumentAttachment.objects.count(), 0)

    def test_model_outside_the_allowlist_is_refused(self):
        # Sans allowlist, ceci accrocherait un fichier a un compte
        # utilisateur — et le relirait.
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.list_url,
            self._payload(content_type='core.user', object_id=str(self.dev.pk)),
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('content_type', response.data)
        self.assertEqual(DocumentAttachment.objects.count(), 0)

    def test_nonexistent_target_is_refused(self):
        self.client.force_authenticate(user=self.comptable)
        response = self.client.post(
            self.list_url,
            self._payload(object_id='00000000-0000-0000-0000-000000000000'),
            format='multipart',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(DocumentAttachment.objects.count(), 0)

    def test_disallowed_extension_is_refused(self):
        self.client.force_authenticate(user=self.comptable)
        executable = SimpleUploadedFile(
            'charge.exe', b'MZ\x90\x00', content_type='application/octet-stream',
        )
        response = self.client.post(
            self.list_url, self._payload(file=executable), format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('file', response.data)
        self.assertEqual(DocumentAttachment.objects.count(), 0)

    def test_unknown_document_type_is_refused(self):
        self.client.force_authenticate(user=self.comptable)
        response = self.client.post(
            self.list_url, self._payload(document_type='INVENTE'), format='multipart',
        )

        self.assertEqual(response.status_code, 400)

    def test_listing_requires_a_target(self):
        # Il ne doit pas exister de vue « toutes les pieces », qui reviendrait
        # a un acces global aux justificatifs comptables.
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, 400)

    def test_only_administration_deletes(self):
        self.client.force_authenticate(user=self.comptable)
        created = self.client.post(self.list_url, self._payload(), format='multipart')
        detail = reverse('attachment-detail', kwargs={'pk': created.data['id']})
        query = {'content_type': 'finance.invoice', 'object_id': str(self.invoice.pk)}

        refused = self.client.delete(detail, query)
        self.assertEqual(refused.status_code, 403)
        self.assertEqual(DocumentAttachment.objects.count(), 1)

        self.client.force_authenticate(user=self.admin)
        accepted = self.client.delete(detail, query)
        self.assertEqual(accepted.status_code, 204)
        self.assertEqual(DocumentAttachment.objects.count(), 0)
