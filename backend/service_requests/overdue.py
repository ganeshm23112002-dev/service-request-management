from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from dashboard.cache import invalidate_dashboard_summary
from dashboard.models import OverdueCheckState

from .models import ServiceRequest


OVERDUE_AFTER = timedelta(hours=24)
ACTIVE_STATUSES = (
    ServiceRequest.Status.OPEN,
    ServiceRequest.Status.IN_PROGRESS,
)


def overdue_condition(checked_at=None):
    checked_at = checked_at or timezone.now()
    return Q(
        status__in=ACTIVE_STATUSES,
        created_at__lt=checked_at - OVERDUE_AFTER,
    )


def is_request_overdue(service_request, checked_at=None):
    checked_at = checked_at or timezone.now()
    return (
        service_request.status in ACTIVE_STATUSES
        and service_request.created_at < checked_at - OVERDUE_AFTER
    )


def update_overdue_requests():
    checked_at = timezone.now()
    overdue_filter = overdue_condition(checked_at)

    with transaction.atomic():
        newly_overdue = ServiceRequest.objects.filter(
            overdue_filter,
            is_overdue=False,
        ).update(is_overdue=True)
        no_longer_overdue = ServiceRequest.objects.filter(
            is_overdue=True,
        ).exclude(overdue_filter).update(is_overdue=False)
        state, _created = OverdueCheckState.objects.update_or_create(
            pk=1,
            defaults={"last_checked_at": checked_at},
        )

    result = {
        "newly_overdue": newly_overdue,
        "no_longer_overdue": no_longer_overdue,
        "last_overdue_check_at": state.last_checked_at.isoformat(),
    }
    invalidate_dashboard_summary()
    return result
