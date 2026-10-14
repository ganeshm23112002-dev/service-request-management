from django.db.models import BooleanField, Case, Q, Value, When
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import User
from config.api import APIResponseMixin

from .models import ServiceRequest
from .overdue import overdue_condition
from .pagination import ServiceRequestPagination
from .permissions import IsOwnerOrAdmin
from .serializers import ServiceRequestSerializer


class ServiceRequestViewSet(APIResponseMixin, viewsets.ModelViewSet):
    serializer_class = ServiceRequestSerializer
    permission_classes = (permissions.IsAuthenticated, IsOwnerOrAdmin)
    pagination_class = ServiceRequestPagination

    def get_queryset(self):
        queryset = ServiceRequest.objects.select_related("created_by").annotate(
            is_overdue_now=Case(
                When(overdue_condition(), then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            ),
            priority_order=Case(
                When(priority=ServiceRequest.Priority.LOW, then=Value(1)),
                When(priority=ServiceRequest.Priority.MEDIUM, then=Value(2)),
                When(priority=ServiceRequest.Priority.HIGH, then=Value(3)),
                default=Value(0),
            ),
            status_order=Case(
                When(status=ServiceRequest.Status.OPEN, then=Value(1)),
                When(status=ServiceRequest.Status.IN_PROGRESS, then=Value(2)),
                When(status=ServiceRequest.Status.RESOLVED, then=Value(3)),
                default=Value(0),
            ),
        )
        if self.request.user.role != User.Role.ADMIN:
            queryset = queryset.filter(created_by=self.request.user)

        query_params = self.request.query_params
        filter_choices = (
            ("status", ServiceRequest.Status.choices),
            ("priority", ServiceRequest.Priority.choices),
            ("category", ServiceRequest.Category.choices),
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

        if "employee" in query_params:
            try:
                employee_id = int(query_params["employee"])
            except (TypeError, ValueError) as error:
                raise ValidationError({
                    "employee": "Enter a valid employee ID."
                }) from error
            if employee_id < 1:
                raise ValidationError({
                    "employee": "Enter a valid employee ID."
                })
            queryset = queryset.filter(created_by_id=employee_id)

        if "overdue" in query_params and "is_overdue" in query_params:
            raise ValidationError({
                "overdue": "Use either overdue or is_overdue, not both."
            })
        overdue_value = query_params.get(
            "overdue",
            query_params.get("is_overdue"),
        )
        if overdue_value is not None:
            normalized_value = overdue_value.lower()
            if normalized_value not in {"true", "false"}:
                raise ValidationError({
                    "overdue": "Choose either true or false."
                })
            queryset = queryset.filter(is_overdue_now=normalized_value == "true")

        search = query_params.get("search")
        if search is not None:
            if len(search) > 100:
                raise ValidationError({
                    "search": "Search text must be 100 characters or fewer."
                })
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
            )

        ordering = query_params.get("ordering", "-created_at")
        allowed_ordering = {
            "created_at",
            "-created_at",
            "priority",
            "-priority",
            "status",
            "-status",
        }
        if ordering not in allowed_ordering:
            raise ValidationError({
                "ordering": (
                    "Choose from created_at, -created_at, priority, "
                    "-priority, status, or -status."
                )
            })
        ordering_field = ordering.lstrip("-")
        ordering_fields = {
            "priority": "priority_order",
            "status": "status_order",
            "created_at": "created_at",
        }
        ordering_expression = ordering_fields[ordering_field]
        if ordering.startswith("-"):
            ordering_expression = f"-{ordering_expression}"
        queryset = queryset.order_by(ordering_expression, "id")
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_200_OK)
