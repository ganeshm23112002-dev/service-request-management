from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OverdueCheckState
from service_requests.models import ServiceRequest
from service_requests.tasks import check_overdue_requests


User = get_user_model()


class AdminDashboardAPITests(APITestCase):
    summary_url = "/api/dashboard/summary/"
    admin_user_create_url = "/api/admin/users/"
    employee_list_url = "/api/admin/employees/"

    def setUp(self):
        self.admin = User.objects.create_user(
            username="dashboard-admin",
            email="admin@example.com",
            password="StrongPass!482",
            role=User.Role.ADMIN,
        )
        self.employee = User.objects.create_user(
            username="dashboard-employee",
            email="employee@example.com",
            password="StrongPass!482",
        )
        self.other_employee = User.objects.create_user(
            username="second-employee",
            email="second@example.com",
            password="StrongPass!482",
        )

    def authenticate_as(self, user):
        access_token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def make_request(self, owner, **overrides):
        values = {
            "title": "Network support request",
            "description": "The office network needs immediate support.",
            "category": ServiceRequest.Category.IT,
            "priority": ServiceRequest.Priority.MEDIUM,
            "status": ServiceRequest.Status.OPEN,
            "created_by": owner,
        }
        values.update(overrides)
        created_at = values.pop("created_at", None)
        request = ServiceRequest.objects.create(**values)
        if created_at is not None:
            ServiceRequest.objects.filter(pk=request.pk).update(created_at=created_at)
            request.refresh_from_db()
        return request

    def assert_envelope(self, response, success):
        self.assertEqual(
            set(response.data),
            {"status", "statusCode", "data"},
        )
        self.assertEqual(response.data["status"], success)
        self.assertEqual(response.data["statusCode"], response.status_code)
        return response.data["data"]

    def test_dashboard_summary_aggregates_requests_and_overdue_rules(self):
        old_time = timezone.now() - timedelta(hours=25)
        open_request = self.make_request(
            self.employee,
            priority=ServiceRequest.Priority.HIGH,
            created_at=old_time,
        )
        in_progress_request = self.make_request(
            self.other_employee,
            status=ServiceRequest.Status.IN_PROGRESS,
            created_at=old_time,
        )
        self.make_request(
            self.employee,
            status=ServiceRequest.Status.RESOLVED,
            priority=ServiceRequest.Priority.HIGH,
            created_at=old_time,
        )
        self.make_request(self.employee)
        check_overdue_requests.run()
        self.authenticate_as(self.admin)

        response = self.client.get(self.summary_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.assert_envelope(response, True), {
            "total_requests": 4,
            "open_requests": 2,
            "in_progress_requests": 1,
            "resolved_requests": 1,
            "high_priority_requests": 2,
            "overdue_requests": 2,
            "last_overdue_check_at": OverdueCheckState.objects.get(
                pk=1
            ).last_checked_at.isoformat(),
        })
        self.assertTrue(open_request.created_at < timezone.now() - timedelta(hours=24))
        self.assertTrue(in_progress_request.created_at < timezone.now() - timedelta(hours=24))

    def test_employees_are_denied_dashboard_and_employee_management(self):
        self.authenticate_as(self.employee)
        for url in (self.summary_url, self.employee_list_url):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assert_envelope(response, False)

    def test_unauthenticated_dashboard_access_is_denied(self):
        response = self.client.get(self.summary_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assert_envelope(response, False)

    def test_admin_can_search_and_view_employee_without_sensitive_fields(self):
        self.authenticate_as(self.admin)
        response = self.client.get(
            self.employee_list_url,
            {"search": "employee@example.com"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.assert_envelope(response, True)
        self.assertEqual(data["count"], 1)
        employee_data = data["results"][0]
        self.assertEqual(employee_data["id"], self.employee.id)
        self.assertEqual(employee_data["role"], User.Role.EMPLOYEE)
        self.assertNotIn("password", employee_data)
        self.assertNotIn("last_login", employee_data)

        detail_response = self.client.get(
            f"{self.employee_list_url}{self.employee.id}/"
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.assert_envelope(detail_response, True)["username"],
            self.employee.username,
        )

    def test_admin_employee_detail_hides_missing_and_admin_accounts(self):
        self.authenticate_as(self.admin)

        for user_id in (self.admin.id, 999999):
            with self.subTest(user_id=user_id):
                response = self.client.get(f"{self.employee_list_url}{user_id}/")
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                self.assert_envelope(response, False)

    def test_admin_can_create_admin_user_with_hashed_password(self):
        self.authenticate_as(self.admin)
        response = self.client.post(
            self.admin_user_create_url,
            {
                "username": "new-admin",
                "email": "new-admin@example.com",
                "password": "AdminPass!482",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = self.assert_envelope(response, True)
        created_user = User.objects.get(username="new-admin")
        self.assertEqual(created_user.role, User.Role.ADMIN)
        self.assertTrue(created_user.check_password("AdminPass!482"))
        self.assertEqual(data["role"], User.Role.ADMIN)
        self.assertNotIn("password", data)

    def test_admin_create_user_rejects_role_assignment_and_weak_password(self):
        self.authenticate_as(self.admin)
        base_payload = {
            "username": "not-created",
            "email": "not-created@example.com",
            "password": "AdminPass!482",
        }
        for override, field in (
            ({"role": User.Role.EMPLOYEE}, "role"),
            ({"password": "password"}, "password"),
        ):
            with self.subTest(field=field):
                response = self.client.post(
                    self.admin_user_create_url,
                    {**base_payload, **override},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, self.assert_envelope(response, False))

    def test_only_authenticated_admin_can_create_admin_user(self):
        response = self.client.post(
            self.admin_user_create_url,
            {
                "username": "blocked-admin",
                "email": "blocked@example.com",
                "password": "AdminPass!482",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assert_envelope(response, False)

        self.authenticate_as(self.employee)
        response = self.client.post(
            self.admin_user_create_url,
            {
                "username": "blocked-admin",
                "email": "blocked@example.com",
                "password": "AdminPass!482",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assert_envelope(response, False)
        self.assertFalse(User.objects.filter(username="blocked-admin").exists())
