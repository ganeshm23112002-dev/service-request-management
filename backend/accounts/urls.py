from django.urls import path
from .views import (
    CurrentUserView,
    EmployeeLogoutView,
    EmployeeLoginView,
    EmployeeRegistrationView,
    RefreshTokenView,
)

app_name = "accounts"

urlpatterns = [
    path("register/", EmployeeRegistrationView.as_view(), name="register"),
    path("login/", EmployeeLoginView.as_view(), name="login"),
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("logout/", EmployeeLogoutView.as_view(), name="logout"),
]
