from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


class EmployeeRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        required=False,
        write_only=True,
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "role")
        read_only_fields = ("id",)
        extra_kwargs = {
            "email": {"required": True, "allow_blank": False},
        }

    def validate_role(self, role):
        if role != User.Role.EMPLOYEE:
            raise serializers.ValidationError(
                "Public registration is limited to the employee role."
            )
        return role

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
        validated_data.pop("role", None)
        return User.objects.create_user(
            **validated_data,
            role=User.Role.EMPLOYEE,
        )


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role")
        read_only_fields = fields
