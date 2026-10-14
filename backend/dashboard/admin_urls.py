from django.urls import path

from .views import AdminUserCreateView, EmployeeDetailView, EmployeeListView

app_name = "admin_dashboard"

urlpatterns = [
    path("users/", AdminUserCreateView.as_view(), name="admin-user-create"),
    path("employees/", EmployeeListView.as_view(), name="employee-list"),
    path("employees/<int:pk>/", EmployeeDetailView.as_view(), name="employee-detail"),
]
