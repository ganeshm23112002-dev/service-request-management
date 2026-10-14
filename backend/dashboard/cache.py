import logging

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q
from redis.exceptions import RedisError

from service_requests.models import ServiceRequest

from .models import OverdueCheckState


logger = logging.getLogger(__name__)
SUMMARY_CACHE_KEY = "dashboard:summary:v1"


def invalidate_dashboard_summary():
    try:
        cache.delete(SUMMARY_CACHE_KEY)
    except RedisError:
        logger.warning(
            "Dashboard summary cache invalidation failed; the next read "
            "will use database-derived values.",
            exc_info=True,
        )


def get_dashboard_summary():
    try:
        cached_summary = cache.get(SUMMARY_CACHE_KEY)
    except RedisError:
        logger.warning(
            "Dashboard summary cache is unavailable; computing from the database.",
            exc_info=True,
        )
        cached_summary = None

    if isinstance(cached_summary, dict):
        return cached_summary

    summary = ServiceRequest.objects.aggregate(
        total_requests=Count("id"),
        open_requests=Count(
            "id",
            filter=Q(
                status=ServiceRequest.Status.OPEN
            ),
        ),
        in_progress_requests=Count(
            "id",
            filter=Q(
                status=ServiceRequest.Status.IN_PROGRESS
            ),
        ),
        resolved_requests=Count(
            "id",
            filter=Q(
                status=ServiceRequest.Status.RESOLVED
            ),
        ),
        high_priority_requests=Count(
            "id",
            filter=Q(
                priority=ServiceRequest.Priority.HIGH
            ),
        ),
        overdue_requests=Count(
            "id",
            filter=Q(
                is_overdue=True,
                status__in=(
                    ServiceRequest.Status.OPEN,
                    ServiceRequest.Status.IN_PROGRESS,
                ),
            ),
        ),
    )
    last_check = OverdueCheckState.objects.filter(pk=1).values_list(
        "last_checked_at",
        flat=True,
    ).first()
    summary["last_overdue_check_at"] = (
        last_check.isoformat() if last_check else None
    )

    try:
        cache.set(
            SUMMARY_CACHE_KEY,
            summary,
            timeout=settings.DASHBOARD_SUMMARY_CACHE_TIMEOUT,
        )
    except RedisError:
        logger.warning(
            "Dashboard summary could not be cached; database values were returned.",
            exc_info=True,
        )
    return summary
