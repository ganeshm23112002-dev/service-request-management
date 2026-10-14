from django.db import models


class OverdueCheckState(models.Model):
    id = models.PositiveSmallIntegerField(
        primary_key=True,
        default=1,
        editable=False,
    )
    last_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "overdue check state"
        verbose_name_plural = "overdue check state"

    def __str__(self):
        return f"Last overdue check: {self.last_checked_at or 'never'}"
