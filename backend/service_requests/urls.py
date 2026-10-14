from rest_framework.routers import DefaultRouter

from .views import ServiceRequestViewSet

app_name = "service_requests"

router = DefaultRouter()
router.register("requests", ServiceRequestViewSet, basename="service-request")

urlpatterns = router.urls
