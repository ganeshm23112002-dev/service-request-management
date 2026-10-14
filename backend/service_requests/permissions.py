from rest_framework.permissions import BasePermission

from accounts.models import User


class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return (
            request.user.role == User.Role.ADMIN
            or obj.created_by_id == request.user.id
        )
