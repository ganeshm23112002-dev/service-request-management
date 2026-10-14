from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from dashboard.cache import invalidate_dashboard_summary

from .models import ServiceRequest


@receiver(post_save, sender=ServiceRequest, dispatch_uid="invalidate_summary_on_request_save")
@receiver(post_delete, sender=ServiceRequest, dispatch_uid="invalidate_summary_on_request_delete")
def invalidate_summary_for_request_change(**_kwargs):
    invalidate_dashboard_summary()
