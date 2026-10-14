from rest_framework import generics, permissions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from config.api import APIResponseMixin

from .serializers import CurrentUserSerializer, EmployeeRegistrationSerializer


class EmployeeRegistrationView(APIResponseMixin, generics.CreateAPIView):
    serializer_class = EmployeeRegistrationSerializer
    permission_classes = (permissions.AllowAny,)


class EmployeeLoginView(APIResponseMixin, TokenObtainPairView):
    permission_classes = (permissions.AllowAny,)


class RefreshTokenView(APIResponseMixin, TokenRefreshView):
    permission_classes = (permissions.AllowAny,)


class CurrentUserView(APIResponseMixin, generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user


class EmployeeLogoutView(APIResponseMixin, TokenBlacklistView):
    permission_classes = (permissions.IsAuthenticated,)
    authentication_classes = (JWTAuthentication,)
