from rest_framework import serializers

from accounts.models import User

from .models import ServiceRequest
from .overdue import is_request_overdue


class ServiceRequestSerializer(serializers.ModelSerializer):
    is_overdue = serializers.SerializerMethodField()
    employee = serializers.CharField(source="created_by.username", read_only=True)

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
            "employee",
            "is_overdue",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "created_by",
        )

    def get_is_overdue(self, instance):
        return is_request_overdue(instance)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.is_overdue = is_request_overdue(instance)
        instance.save()
        return instance

    def validate_status(self, status):
        request = self.context.get("request")
        if self.instance is None or request.user.role != User.Role.ADMIN:
            raise serializers.ValidationError(
                "Only admins can change the status of an existing request."
            )
        return status
