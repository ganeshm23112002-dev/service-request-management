from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ServiceRequest


User = get_user_model()


class ServiceRequestAPITests(APITestCase):
    list_url = "/api/requests/"

    def setUp(self):
        self.employee = User.objects.create_user(
            username="employee",
            email="employee@example.com",
            password="StrongPass!482",
        )
        self.other_employee = User.objects.create_user(
            username="other.employee",
            email="other@example.com",
            password="StrongPass!482",
        )
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="StrongPass!482",
            role=User.Role.ADMIN,
        )

    def authenticate_as(self, user):
        access_token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def request_payload(self, **overrides):
        payload = {
            "title": "Laptop cannot connect to Wi-Fi",
            "description": "Connection drops every few minutes.",
            "category": ServiceRequest.Category.IT,
            "priority": ServiceRequest.Priority.HIGH,
        }
        payload.update(overrides)
        return payload

    def make_request(self, created_by=None, **overrides):
        attributes = {
            "title": "Network outage",
            "description": "The office network is unavailable.",
            "category": ServiceRequest.Category.IT,
            "priority": ServiceRequest.Priority.HIGH,
            "created_by": created_by or self.employee,
        }
        attributes.update(overrides)
        return ServiceRequest.objects.create(**attributes)

    def test_employee_creates_request_with_server_assigned_creator(self):
        self.authenticate_as(self.employee)
        response = self.client.post(
            self.list_url,
            self.request_payload(
                created_by=self.other_employee.id,
                is_overdue=True,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_request = ServiceRequest.objects.get(id=response.data["id"])
        self.assertEqual(created_request.created_by, self.employee)
        self.assertFalse(created_request.is_overdue)
        self.assertEqual(created_request.status, ServiceRequest.Status.OPEN)
        self.assertEqual(response.data["created_by"], self.employee.id)
        self.assertNotIn("email", response.data)

    def test_employee_lists_only_own_requests(self):
        own_request = self.make_request()
        self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.employee)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [own_request.id],
        )

    def test_admin_lists_all_requests(self):
        self.make_request()
        self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.admin)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_employee_cannot_view_another_employees_request(self):
        other_request = self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.employee)

        response = self.client.get(f"{self.list_url}{other_request.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_employee_cannot_change_request_status(self):
        service_request = self.make_request()
        self.authenticate_as(self.employee)

        response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"status": ServiceRequest.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.OPEN)

    def test_admin_can_change_request_status(self):
        service_request = self.make_request()
        self.authenticate_as(self.admin)

        response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"status": ServiceRequest.Status.RESOLVED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.RESOLVED)

    def test_invalid_category_priority_and_status_are_rejected(self):
        self.authenticate_as(self.employee)
        invalid_payloads = (
            {"category": "INVALID"},
            {"priority": "URGENT"},
            {"status": "INVALID"},
        )

        for invalid_values in invalid_payloads:
            with self.subTest(field=next(iter(invalid_values))):
                response = self.client.post(
                    self.list_url,
                    self.request_payload(**invalid_values),
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn(next(iter(invalid_values)), response.data)

    def test_filters_by_status_and_priority(self):
        matching_request = self.make_request(
            status=ServiceRequest.Status.OPEN,
            priority=ServiceRequest.Priority.HIGH,
        )
        self.make_request(
            status=ServiceRequest.Status.OPEN,
            priority=ServiceRequest.Priority.LOW,
        )
        self.make_request(
            created_by=self.other_employee,
            status=ServiceRequest.Status.RESOLVED,
            priority=ServiceRequest.Priority.HIGH,
        )
        self.authenticate_as(self.admin)

        response = self.client.get(
            self.list_url,
            {"status": "OPEN", "priority": "HIGH"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [matching_request.id],
        )

    def test_invalid_filter_values_are_rejected(self):
        self.authenticate_as(self.employee)

        for query_params, field_name in (
            ({"status": "WAITING"}, "status"),
            ({"priority": "URGENT"}, "priority"),
        ):
            with self.subTest(field=field_name):
                response = self.client.get(self.list_url, query_params)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn(field_name, response.data)

    def test_employee_can_update_and_delete_own_request(self):
        service_request = self.make_request()
        self.authenticate_as(self.employee)

        update_response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"title": "Updated title"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        service_request.refresh_from_db()
        self.assertEqual(service_request.title, "Updated title")

        delete_response = self.client.delete(
            f"{self.list_url}{service_request.id}/"
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            ServiceRequest.objects.filter(id=service_request.id).exists()
        )

    def test_unauthenticated_requests_are_rejected(self):
        list_response = self.client.get(self.list_url)
        create_response = self.client.post(
            self.list_url,
            self.request_payload(),
            format="json",
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            create_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
