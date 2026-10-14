from rest_framework import serializers

from accounts.models import User

from .models import ServiceRequest


class ServiceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "title",
            "description",
            "category",
            "priority",
            "status",
            "created_at",
            "updated_at",
            "created_by",
            "is_overdue",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "is_overdue",
        )

    def validate_status(self, status):
        request = self.context.get("request")
        if self.instance is None or request.user.role != User.Role.ADMIN:
            raise serializers.ValidationError(
                "Only admins can change the status of an existing request."
            )
        return status
