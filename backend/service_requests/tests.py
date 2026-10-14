from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from redis.exceptions import RedisError
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from dashboard.models import OverdueCheckState

from .models import ServiceRequest
from .overdue import update_overdue_requests
from .tasks import check_overdue_requests


User = get_user_model()


class ServiceRequestAPITests(APITestCase):
    list_url = "/api/requests/"

    def assert_envelope(self, response, success):
        self.assertEqual(
            set(response.data),
            {"status", "statusCode", "data"},
        )
        self.assertEqual(response.data["status"], success)
        self.assertEqual(response.data["statusCode"], response.status_code)
        return response.data["data"]

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
        created_at = attributes.pop("created_at", None)
        service_request = ServiceRequest.objects.create(**attributes)
        if created_at is not None:
            ServiceRequest.objects.filter(pk=service_request.pk).update(
                created_at=created_at
            )
            service_request.refresh_from_db()
        return service_request

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
        data = self.assert_envelope(response, True)
        created_request = ServiceRequest.objects.get(id=data["id"])
        self.assertEqual(created_request.created_by, self.employee)
        self.assertFalse(created_request.is_overdue)
        self.assertEqual(created_request.status, ServiceRequest.Status.OPEN)
        self.assertEqual(data["created_by"], self.employee.id)
        self.assertNotIn("email", data)

    def test_employee_lists_only_own_requests(self):
        own_request = self.make_request()
        self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.employee)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.assert_envelope(response, True)
        self.assertEqual(
            [item["id"] for item in data["results"]],
            [own_request.id],
        )
        self.assertEqual(data["count"], 1)

    def test_admin_lists_all_requests(self):
        first_request = self.make_request()
        self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.admin)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.assert_envelope(response, True)
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["results"]), 2)
        self.assertEqual(
            {item["employee"] for item in data["results"]},
            {self.employee.username, self.other_employee.username},
        )

        detail_response = self.client.get(f"{self.list_url}{first_request.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.assert_envelope(detail_response, True)["id"],
            first_request.id,
        )

    def test_employee_cannot_view_another_employees_request(self):
        other_request = self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.employee)

        response = self.client.get(f"{self.list_url}{other_request.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assert_envelope(response, False)

    def test_employee_cannot_change_request_status(self):
        service_request = self.make_request()
        self.authenticate_as(self.employee)

        response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"status": ServiceRequest.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_envelope(response, False)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.OPEN)

    def test_admin_can_change_request_status(self):
        service_request = self.make_request(
            created_at=timezone.now() - timedelta(hours=25),
        )
        self.authenticate_as(self.admin)

        response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"status": ServiceRequest.Status.RESOLVED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_data = self.assert_envelope(response, True)
        self.assertFalse(response_data["is_overdue"])
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.RESOLVED)
        self.assertFalse(service_request.is_overdue)

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
                errors = self.assert_envelope(response, False)
                self.assertIn(next(iter(invalid_values)), errors)

    def test_title_and_description_length_limits_are_enforced(self):
        self.authenticate_as(self.employee)
        invalid_payloads = (
            ({"title": "ab"}, "title"),
            ({"title": "t" * 51}, "title"),
            ({"description": "d" * 14}, "description"),
            ({"description": "d" * 251}, "description"),
        )

        for overrides, field_name in invalid_payloads:
            with self.subTest(field=field_name, length=len(overrides[field_name])):
                response = self.client.post(
                    self.list_url,
                    self.request_payload(**overrides),
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                errors = self.assert_envelope(response, False)
                self.assertIn(field_name, errors)

    def test_title_and_description_length_boundaries_are_accepted(self):
        self.authenticate_as(self.employee)
        for title, description in (
            ("t" * 3, "d" * 15),
            ("t" * 50, "d" * 250),
        ):
            with self.subTest(title_length=len(title), description_length=len(description)):
                response = self.client.post(
                    self.list_url,
                    self.request_payload(title=title, description=description),
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assert_envelope(response, True)

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
        data = self.assert_envelope(response, True)
        self.assertEqual(
            [item["id"] for item in data["results"]],
            [matching_request.id],
        )

    def test_admin_request_filters_search_ordering_and_pagination(self):
        first = self.make_request(
            title="Printer not responding",
            description="The office printer is unavailable.",
            category=ServiceRequest.Category.GENERAL,
        )
        self.make_request(
            created_by=self.other_employee,
            title="Laptop setup needed",
            description="Prepare a laptop for a new starter.",
            category=ServiceRequest.Category.IT,
            priority=ServiceRequest.Priority.LOW,
        )
        self.authenticate_as(self.admin)

        response = self.client.get(
            self.list_url,
            {
                "category": "GENERAL",
                "employee": str(self.employee.id),
                "search": "printer",
                "ordering": "priority",
                "page_size": 1,
            },
        )

        data = self.assert_envelope(response, True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["id"], first.id)
        self.assertEqual(data["results"][0]["created_by"], self.employee.id)

    def test_filters_by_category_employee_and_dynamic_overdue_flag(self):
        overdue_request = self.make_request(
            created_by=self.employee,
            category=ServiceRequest.Category.GENERAL,
            status=ServiceRequest.Status.IN_PROGRESS,
            created_at=timezone.now() - timedelta(hours=25),
        )
        self.make_request(
            created_by=self.other_employee,
            category=ServiceRequest.Category.GENERAL,
            status=ServiceRequest.Status.OPEN,
            created_at=timezone.now() - timedelta(hours=25),
        )
        resolved_request = self.make_request(
            created_by=self.employee,
            category=ServiceRequest.Category.GENERAL,
            status=ServiceRequest.Status.RESOLVED,
            created_at=timezone.now() - timedelta(hours=25),
        )
        self.authenticate_as(self.admin)

        response = self.client.get(
            self.list_url,
            {
                "category": "GENERAL",
                "employee": str(self.employee.id),
                "overdue": "true",
            },
        )
        data = self.assert_envelope(response, True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in data["results"]], [overdue_request.id])
        self.assertTrue(data["results"][0]["is_overdue"])

        non_overdue_response = self.client.get(
            self.list_url,
            {
                "category": "GENERAL",
                "employee": str(self.employee.id),
                "overdue": "false",
            },
        )
        non_overdue_data = self.assert_envelope(non_overdue_response, True)
        self.assertEqual(
            [item["id"] for item in non_overdue_data["results"]],
            [resolved_request.id],
        )
        self.assertFalse(non_overdue_data["results"][0]["is_overdue"])

    def test_invalid_ordering_and_pagination_values_are_rejected(self):
        self.authenticate_as(self.admin)
        for params, field in (
            ({"ordering": "email"}, "ordering"),
            ({"page_size": "many"}, "page_size"),
            ({"page_size": "101"}, "page_size"),
        ):
            with self.subTest(field=field, params=params):
                response = self.client.get(self.list_url, params)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, self.assert_envelope(response, False))

    def test_invalid_filter_values_are_rejected(self):
        self.authenticate_as(self.employee)

        for query_params, field_name in (
            ({"status": "WAITING"}, "status"),
            ({"priority": "URGENT"}, "priority"),
            ({"category": "FINANCE"}, "category"),
            ({"employee": "abc"}, "employee"),
            ({"employee": "²"}, "employee"),
            ({"overdue": "sometimes"}, "overdue"),
        ):
            with self.subTest(field=field_name):
                response = self.client.get(self.list_url, query_params)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                errors = self.assert_envelope(response, False)
                self.assertIn(field_name, errors)

    def test_admin_can_update_and_delete_any_employee_request(self):
        service_request = self.make_request(created_by=self.other_employee)
        self.authenticate_as(self.admin)

        update_response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"title": "Updated by administrator"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assert_envelope(update_response, True)

        delete_response = self.client.delete(
            f"{self.list_url}{service_request.id}/"
        )
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(self.assert_envelope(delete_response, True))
        self.assertFalse(ServiceRequest.objects.filter(pk=service_request.pk).exists())

    def test_employee_can_update_and_delete_own_request(self):
        service_request = self.make_request()
        self.authenticate_as(self.employee)

        update_response = self.client.patch(
            f"{self.list_url}{service_request.id}/",
            {"title": "Updated title"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assert_envelope(update_response, True)
        service_request.refresh_from_db()
        self.assertEqual(service_request.title, "Updated title")

        delete_response = self.client.delete(
            f"{self.list_url}{service_request.id}/"
        )
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(self.assert_envelope(delete_response, True))
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
        self.assert_envelope(list_response, False)
        self.assertEqual(
            create_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assert_envelope(create_response, False)

    def test_overdue_check_updates_active_and_resolved_requests(self):
        old_time = timezone.now() - timedelta(hours=25)
        open_request = self.make_request(
            created_at=old_time,
            status=ServiceRequest.Status.OPEN,
        )
        in_progress_request = self.make_request(
            created_by=self.other_employee,
            created_at=old_time,
            status=ServiceRequest.Status.IN_PROGRESS,
        )
        recent_request = self.make_request(
            created_by=self.other_employee,
            status=ServiceRequest.Status.OPEN,
        )
        resolved_request = self.make_request(
            created_at=old_time,
            status=ServiceRequest.Status.RESOLVED,
            is_overdue=True,
        )

        result = check_overdue_requests.run()

        open_request.refresh_from_db()
        in_progress_request.refresh_from_db()
        recent_request.refresh_from_db()
        resolved_request.refresh_from_db()
        self.assertTrue(open_request.is_overdue)
        self.assertTrue(in_progress_request.is_overdue)
        self.assertFalse(recent_request.is_overdue)
        self.assertFalse(resolved_request.is_overdue)
        self.assertEqual(result["newly_overdue"], 2)
        self.assertEqual(result["no_longer_overdue"], 1)
        self.assertIsNotNone(result["last_overdue_check_at"])

    def test_request_at_exactly_24_hours_is_not_overdue(self):
        checked_at = timezone.now()
        service_request = self.make_request(
            created_at=checked_at - timedelta(hours=24),
        )

        with patch("service_requests.overdue.timezone.now", return_value=checked_at):
            result = update_overdue_requests()

        service_request.refresh_from_db()
        self.assertFalse(service_request.is_overdue)
        self.assertEqual(result["newly_overdue"], 0)

    def test_status_change_repairs_previously_overdue_request_on_next_check(self):
        service_request = self.make_request(
            created_at=timezone.now() - timedelta(hours=25),
            is_overdue=True,
        )
        ServiceRequest.objects.filter(pk=service_request.pk).update(
            status=ServiceRequest.Status.RESOLVED
        )

        update_overdue_requests()

        service_request.refresh_from_db()
        self.assertFalse(service_request.is_overdue)

    def test_overdue_check_timestamp_and_updates_are_atomic_on_failure(self):
        service_request = self.make_request(
            created_at=timezone.now() - timedelta(hours=25),
        )
        update_overdue_requests()
        original_check_time = OverdueCheckState.objects.get(pk=1).last_checked_at
        with patch.object(
            OverdueCheckState.objects,
            "update_or_create",
            side_effect=RuntimeError("state storage unavailable"),
        ):
            with self.assertRaises(RuntimeError):
                update_overdue_requests()

        service_request.refresh_from_db()
        self.assertTrue(service_request.is_overdue)
        self.assertEqual(
            OverdueCheckState.objects.get(pk=1).last_checked_at,
            original_check_time,
        )

    def test_overdue_task_invalidates_dashboard_summary_cache(self):
        from dashboard.cache import SUMMARY_CACHE_KEY

        cache.set(SUMMARY_CACHE_KEY, {"stale": True}, timeout=60)

        check_overdue_requests.run()

        self.assertIsNone(cache.get(SUMMARY_CACHE_KEY))

    def test_request_mutations_invalidate_dashboard_summary_cache(self):
        cache_key = "dashboard:summary:v1"
        self.authenticate_as(self.employee)

        cache.set(cache_key, {"stale": True}, timeout=60)
        create_response = self.client.post(
            self.list_url,
            self.request_payload(),
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_id = self.assert_envelope(create_response, True)["id"]
        self.assertIsNone(cache.get(cache_key))

        self.authenticate_as(self.admin)
        cache.set(cache_key, {"stale": True}, timeout=60)
        status_response = self.client.patch(
            f"{self.list_url}{created_id}/",
            {"status": ServiceRequest.Status.IN_PROGRESS},
            format="json",
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(cache.get(cache_key))

        cache.set(cache_key, {"stale": True}, timeout=60)
        update_response = self.client.patch(
            f"{self.list_url}{created_id}/",
            {"title": "Updated network request"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(cache.get(cache_key))

        cache.set(cache_key, {"stale": True}, timeout=60)
        delete_response = self.client.delete(f"{self.list_url}{created_id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(cache.get(cache_key))

    def test_summary_falls_back_to_database_when_redis_is_unavailable(self):
        from dashboard.cache import get_dashboard_summary

        self.make_request()
        with (
            patch("dashboard.cache.cache.get", side_effect=RedisError("offline")),
            patch("dashboard.cache.cache.set", side_effect=RedisError("offline")),
        ):
            summary = get_dashboard_summary()

        self.assertEqual(summary["total_requests"], 1)
        self.assertEqual(summary["open_requests"], 1)
