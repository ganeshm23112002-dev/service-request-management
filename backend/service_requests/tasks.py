import logging

from celery import shared_task

from .overdue import update_overdue_requests


logger = logging.getLogger(__name__)


@shared_task(name="service_requests.tasks.check_overdue_requests")
def check_overdue_requests():
    try:
        result = update_overdue_requests()
    except Exception:
        logger.exception("The overdue request check failed.")
        raise
    logger.info(
        "Overdue check completed: %s newly overdue, %s no longer overdue.",
        result["newly_overdue"],
        result["no_longer_overdue"],
    )
    return result
