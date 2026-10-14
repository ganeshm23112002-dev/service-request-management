from django.apps import AppConfig


class ServiceRequestsConfig(AppConfig):
    name = 'service_requests'

    def ready(self):
        from . import signals
