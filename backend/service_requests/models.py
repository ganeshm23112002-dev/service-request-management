from django.conf import settings
from django.db import models
from django.core.validators import MaxLengthValidator, MinLengthValidator


TITLE_MIN_LENGTH = 3
TITLE_MAX_LENGTH = 50
DESCRIPTION_MIN_LENGTH = 15
DESCRIPTION_MAX_LENGTH = 250


class ServiceRequest(models.Model):
    class Category(models.TextChoices):
        IT = "IT", "IT"
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        GENERAL = "GENERAL", "General"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        RESOLVED = "RESOLVED", "Resolved"

    title = models.TextField(
        validators=[
            MinLengthValidator(TITLE_MIN_LENGTH),
            MaxLengthValidator(TITLE_MAX_LENGTH),
        ],
    )
    description = models.TextField(
        validators=[
            MinLengthValidator(DESCRIPTION_MIN_LENGTH),
            MaxLengthValidator(DESCRIPTION_MAX_LENGTH),
        ],
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        db_index=True,
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="service_requests",
    )
    is_overdue = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.title
