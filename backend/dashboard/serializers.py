from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "role",
            "date_joined",
        )
        read_only_fields = ("id", "role", "date_joined")
        extra_kwargs = {
            "email": {"required": True, "allow_blank": False},
        }

    def to_internal_value(self, data):
        allowed_fields = {"username", "email", "password"}
        if hasattr(data, "keys"):
            unexpected_fields = set(data.keys()) - allowed_fields
            if unexpected_fields:
                raise serializers.ValidationError({
                    field: "This field is not accepted."
                    for field in unexpected_fields
                })
        return super().to_internal_value(data)

    def validate(self, attrs):
        user = User(username=attrs.get("username"), email=attrs.get("email"))
        try:
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {"password": error.messages}
            ) from error
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            **validated_data,
            role=User.Role.ADMIN,
        )


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role", "date_joined")
        read_only_fields = fields
