from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError

from accounts.models import User

from .models import ServiceRequest
from .permissions import IsOwnerOrAdmin
from .serializers import ServiceRequestSerializer


class ServiceRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceRequestSerializer
    permission_classes = (permissions.IsAuthenticated, IsOwnerOrAdmin)

    def get_queryset(self):
        queryset = ServiceRequest.objects.select_related("created_by")
        if self.request.user.role != User.Role.ADMIN:
            queryset = queryset.filter(created_by=self.request.user)

        query_params = self.request.query_params
        filter_choices = (
            ("status", ServiceRequest.Status.choices),
            ("priority", ServiceRequest.Priority.choices),
        )
        for field_name, choices in filter_choices:
            if field_name not in query_params:
                continue
            value = query_params[field_name]
            valid_values = [choice for choice, _label in choices]
            if value not in valid_values:
                allowed = ", ".join(valid_values)
                raise ValidationError({
                    field_name: f"Invalid filter value. Choose from: {allowed}."
                })
            queryset = queryset.filter(**{field_name: value})
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
