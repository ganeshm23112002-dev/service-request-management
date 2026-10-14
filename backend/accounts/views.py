from rest_framework import generics, permissions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from .serializers import CurrentUserSerializer, EmployeeRegistrationSerializer


class EmployeeRegistrationView(generics.CreateAPIView):
    serializer_class = EmployeeRegistrationSerializer
    permission_classes = (permissions.AllowAny,)


class EmployeeLoginView(TokenObtainPairView):
    permission_classes = (permissions.AllowAny,)


class RefreshTokenView(TokenRefreshView):
    permission_classes = (permissions.AllowAny,)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user


class EmployeeLogoutView(TokenBlacklistView):
    permission_classes = (permissions.IsAuthenticated,)
    authentication_classes = (JWTAuthentication,)
