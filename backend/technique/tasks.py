from celery import shared_task
from django.utils import timezone
from .models import Ticket, Project

@shared_task
def auto_close_ticket(ticket_id):
    try:
        ticket = Ticket.objects.get(pk=ticket_id)
        if ticket.status == 'RESOLVED':
            ticket.status = 'CLOSED'
            ticket.save()
    except Ticket.DoesNotExist:
        pass

@shared_task
def check_budget_alerts():
    projects = Project.objects.filter(status='EN_COURS')
    for project in projects:
        if project.is_over_budget:
            pass # Create alert notification

@shared_task
def send_ticket_resolution_email(ticket_id):
    pass # Placeholder
