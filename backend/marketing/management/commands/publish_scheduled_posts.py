"""Run periodically (e.g. every 5-15 min) by an external scheduler — a
Render Cron Job, GitHub Actions scheduled workflow, or any cron hitting
`python manage.py publish_scheduled_posts` in the container. Deliberately
NOT a Celery Beat task: Celery is configured in this project (see
sokens_backend/celery.py) but no worker/beat process is deployed anywhere
(render.yaml only runs the web service), and standing one up just for this
would be a real infra/cost commitment. A plain management command needs
nothing extra to run — see marketing/publishing.py for the actual logic."""

from django.core.management.base import BaseCommand

from marketing.publishing import run_scheduled_publishing


class Command(BaseCommand):
    help = "Publie les publications programmées (SocialPost) dont l'heure est passée."

    def handle(self, *args, **options):
        results = run_scheduled_publishing()
        if not results:
            self.stdout.write('Aucune publication à traiter.')
            return
        for post, success in results:
            label = self.style.SUCCESS('OK') if success else self.style.ERROR('ÉCHEC')
            self.stdout.write(f'{label} — {post.title} ({post.platform}, {post.id})')
