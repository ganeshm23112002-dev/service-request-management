from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from config.api import APIResponseMixin
from service_requests.pagination import EmployeePagination

from .cache import get_dashboard_summary
from .permissions import IsAdminUser
from .serializers import AdminUserCreateSerializer, EmployeeSerializer


class DashboardSummaryView(APIResponseMixin, APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get(self, request):
        return Response(get_dashboard_summary())


class EmployeeListView(
    APIResponseMixin,
    generics.ListAPIView,
):
    serializer_class = EmployeeSerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)
    pagination_class = EmployeePagination
    filter_backends = (SearchFilter,)
    search_fields = ("username", "email")

    def filter_queryset(self, queryset):
        search = self.request.query_params.get("search", "")
        if len(search) > 100:
            raise ValidationError({
                "search": "Search text must be 100 characters or fewer."
            })
        return super().filter_queryset(queryset)

    def get_queryset(self):
        return User.objects.filter(role=User.Role.EMPLOYEE).order_by("username")


class EmployeeDetailView(APIResponseMixin, generics.RetrieveAPIView):
    serializer_class = EmployeeSerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)

    def get_queryset(self):
        return User.objects.filter(role=User.Role.EMPLOYEE)


class AdminUserCreateView(APIResponseMixin, generics.CreateAPIView):
    serializer_class = AdminUserCreateSerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)
