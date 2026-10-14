from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class AuthenticationAPITests(APITestCase):
    registration_url = "/api/auth/register/"
    login_url = "/api/auth/login/"
    refresh_url = "/api/auth/refresh/"
    current_user_url = "/api/auth/me/"
    logout_url = "/api/auth/logout/"

    def assert_envelope(self, response, success):
        self.assertEqual(
            set(response.data),
            {"status", "statusCode", "data"},
        )
        self.assertEqual(response.data["status"], success)
        self.assertEqual(response.data["statusCode"], response.status_code)
        return response.data["data"]

    def setUp(self):
        self.password = "StrongPass!482"
        self.user = User.objects.create_user(
            username="existing.employee",
            email="existing@example.com",
            password=self.password,
        )

    def registration_payload(self, **overrides):
        payload = {
            "username": "new.employee",
            "email": "new@example.com",
            "password": "AnotherStrong!825",
        }
        payload.update(overrides)
        return payload

    def test_registers_employee_with_hashed_password(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = self.assert_envelope(response, True)
        registered_user = User.objects.get(username="new.employee")
        self.assertEqual(registered_user.role, User.Role.EMPLOYEE)
        self.assertTrue(registered_user.check_password("AnotherStrong!825"))
        self.assertNotIn("password", data)

    def test_rejects_admin_role_assignment(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(role=User.Role.ADMIN),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_envelope(response, False)
        self.assertFalse(User.objects.filter(username="new.employee").exists())

    def test_rejects_duplicate_username(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(username=self.user.username),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", self.assert_envelope(response, False))

    def test_rejects_invalid_email(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(email="not-an-email"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_envelope(response, False)

    def test_rejects_weak_password(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(password="short"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", self.assert_envelope(response, False))

    def test_login_returns_access_and_refresh_tokens(self):
        response = self.client.post(
            self.login_url,
            {"username": self.user.username, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.assert_envelope(response, True)
        self.assertIn("access", data)
        self.assertIn("refresh", data)

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post(
            self.login_url,
            {"username": self.user.username, "password": "incorrect-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assert_envelope(response, False)

    def test_current_user_requires_authentication(self):
        response = self.client.get(self.current_user_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assert_envelope(response, False)

    def test_current_user_returns_authenticated_user(self):
        access_token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        response = self.client.get(self.current_user_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.assert_envelope(response, True), {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "role": User.Role.EMPLOYEE,
        })

    def test_refresh_returns_a_new_access_token(self):
        refresh_token = str(RefreshToken.for_user(self.user))

        response = self.client.post(
            self.refresh_url,
            {"refresh": refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", self.assert_envelope(response, True))

    def test_logout_blacklists_refresh_token(self):
        refresh_token = str(RefreshToken.for_user(self.user))
        access_token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        logout_response = self.client.post(
            self.logout_url,
            {"refresh": refresh_token},
            format="json",
        )

        self.assertEqual(
            logout_response.status_code,
            status.HTTP_200_OK,
        )
        self.assert_envelope(logout_response, True)
        refresh_response = self.client.post(
            self.refresh_url,
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(
            refresh_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assert_envelope(refresh_response, False)

    def test_logout_rejects_invalid_refresh_token(self):
        access_token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        response = self.client.post(
            self.logout_url,
            {"refresh": "not-a-valid-refresh-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assert_envelope(response, False)
