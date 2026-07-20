from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from core.models import User
from marketing.models import BlogPost, Lead


class PublicLeadCreateTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def valid_payload(self, **overrides):
        payload = {
            'first_name': 'Ada',
            'last_name': 'Lovelace',
            'company_name': 'Analytical Engines Inc.',
            'email': 'ada@example.com',
            'phone': '+33612345678',
            'source': 'FORMULAIRE_CONTACT',
            'message': 'Intéressée par vos services.',
        }
        payload.update(overrides)
        return payload

    def test_public_can_create_lead(self):
        response = self.client.post('/api/v1/public/leads/', self.valid_payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(Lead.objects.first().status, 'NOUVEAU')

    def test_public_cannot_set_status_or_assignment(self):
        response = self.client.post(
            '/api/v1/public/leads/',
            self.valid_payload(status='CONVERTI', qualification_score=100),
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.first()
        self.assertEqual(lead.status, 'NOUVEAU')
        self.assertEqual(lead.qualification_score, 0)

    def test_rate_limit_blocks_after_three_per_minute(self):
        for _ in range(3):
            response = self.client.post('/api/v1/public/leads/', self.valid_payload(), format='json')
            self.assertEqual(response.status_code, 201)
        response = self.client.post('/api/v1/public/leads/', self.valid_payload(), format='json')
        self.assertEqual(response.status_code, 429)

    def test_rate_limit_is_per_ip(self):
        for _ in range(3):
            self.client.post('/api/v1/public/leads/', self.valid_payload(), format='json', REMOTE_ADDR='1.1.1.1')
        blocked = self.client.post('/api/v1/public/leads/', self.valid_payload(), format='json', REMOTE_ADDR='1.1.1.1')
        self.assertEqual(blocked.status_code, 429)
        still_ok = self.client.post('/api/v1/public/leads/', self.valid_payload(), format='json', REMOTE_ADDR='2.2.2.2')
        self.assertEqual(still_ok.status_code, 201)


class LeadViewSetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.marketing_user = User.objects.create(email='marketing@sokensdigital.com', first_name='Marketing')
        self.marketing_user.firestore_role = 'RESPONSABLE_MARKETING'

        self.commercial_a = User.objects.create(email='commercial-a@sokensdigital.com', first_name='CommercialA')
        self.commercial_a.firestore_role = 'COMMERCIAL'

        self.commercial_b = User.objects.create(email='commercial-b@sokensdigital.com', first_name='CommercialB')
        self.commercial_b.firestore_role = 'COMMERCIAL'

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

        self.lead_a = Lead.objects.create(
            first_name='Ada', last_name='Lovelace', email='ada@example.com',
            source='SITE_WEB', assigned_to=self.commercial_a,
        )
        self.lead_b = Lead.objects.create(
            first_name='Grace', last_name='Hopper', email='grace@example.com',
            source='SITE_WEB', assigned_to=self.commercial_b,
        )

        self.client_marketing = APIClient()
        self.client_marketing.force_authenticate(user=self.marketing_user)

        self.client_commercial_a = APIClient()
        self.client_commercial_a.force_authenticate(user=self.commercial_a)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_marketing_sees_all_leads(self):
        ids = [l['id'] for l in self.client_marketing.get('/api/v1/marketing/leads/').json()['results']]
        self.assertIn(str(self.lead_a.id), ids)
        self.assertIn(str(self.lead_b.id), ids)

    def test_commercial_sees_only_own_leads(self):
        ids = [l['id'] for l in self.client_commercial_a.get('/api/v1/marketing/leads/').json()['results']]
        self.assertEqual(ids, [str(self.lead_a.id)])

    def test_outsider_forbidden(self):
        response = self.client_outsider.get('/api/v1/marketing/leads/')
        self.assertEqual(response.status_code, 403)

    def test_commercial_cannot_access_other_commercials_lead(self):
        response = self.client_commercial_a.get(f'/api/v1/marketing/leads/{self.lead_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_marketing_can_qualify_and_reassign(self):
        response = self.client_marketing.patch(
            f'/api/v1/marketing/leads/{self.lead_a.id}/',
            {'status': 'QUALIFIE', 'qualification_score': 80, 'assigned_to_id': str(self.commercial_b.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.lead_a.refresh_from_db()
        self.assertEqual(self.lead_a.status, 'QUALIFIE')
        self.assertEqual(self.lead_a.qualification_score, 80)
        self.assertEqual(self.lead_a.assigned_to_id, self.commercial_b.id)

    def test_invalid_qualification_score_rejected(self):
        response = self.client_marketing.patch(
            f'/api/v1/marketing/leads/{self.lead_a.id}/',
            {'qualification_score': 150},
            format='json',
        )
        self.assertEqual(response.status_code, 400)


class BlogPostViewSetTests(APITestCase):
    def setUp(self):
        self.marketing_user = User.objects.create(email='marketing@sokensdigital.com', first_name='Marketing')
        self.marketing_user.firestore_role = 'RESPONSABLE_MARKETING'

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

        self.client_marketing = APIClient()
        self.client_marketing.force_authenticate(user=self.marketing_user)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.draft_payload = {
            'title': "L'avenir de la Cyber-Sécurité",
            'excerpt': 'Un aperçu.',
            'content': [{'type': 'p', 'text': 'Bonjour le monde.'}],
            'visual_icon': 'ShieldCheck',
            'visual_label': 'Global Digital Security Network',
            'visual_sublabel': 'Advanced Cybersecurity Visualization',
            'tags': ['AI Defense', 'Cloud Security'],
        }

    def test_marketing_can_create_draft(self):
        response = self.client_marketing.post('/api/v1/marketing/cms/blog/', self.draft_payload, format='json')
        self.assertEqual(response.status_code, 201)
        post = BlogPost.objects.get()
        self.assertEqual(post.slug, 'lavenir-de-la-cyber-securite')
        self.assertEqual(post.author, self.marketing_user)
        self.assertEqual(post.status, 'BROUILLON')
        self.assertIsNone(post.published_at)

    def test_publishing_sets_published_at(self):
        post = BlogPost.objects.create(title='Test', content=[])
        response = self.client_marketing.patch(
            f'/api/v1/marketing/cms/blog/{post.id}/', {'status': 'PUBLIE'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.status, 'PUBLIE')
        self.assertIsNotNone(post.published_at)

    def test_outsider_cannot_manage_cms(self):
        response = self.client_outsider.post('/api/v1/marketing/cms/blog/', self.draft_payload, format='json')
        self.assertEqual(response.status_code, 403)

    def test_public_list_only_shows_published(self):
        BlogPost.objects.create(title='Brouillon', status='BROUILLON', content=[])
        published = BlogPost.objects.create(title='Publié', status='PUBLIE', content=[])

        anon = APIClient()
        response = anon.get('/api/v1/public/cms/blog/')
        self.assertEqual(response.status_code, 200)
        slugs = [p['slug'] for p in response.json()['results']]
        self.assertEqual(slugs, [published.slug])

    def test_public_detail_404s_on_draft(self):
        draft = BlogPost.objects.create(title='Brouillon', status='BROUILLON', content=[])
        anon = APIClient()
        response = anon.get(f'/api/v1/public/cms/blog/{draft.slug}/')
        self.assertEqual(response.status_code, 404)

    def test_public_detail_returns_published_post_content(self):
        post = BlogPost.objects.create(
            title='Publié', status='PUBLIE', content=[{'type': 'p', 'text': 'Salut'}],
        )
        anon = APIClient()
        response = anon.get(f'/api/v1/public/cms/blog/{post.slug}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['content'], [{'type': 'p', 'text': 'Salut'}])
