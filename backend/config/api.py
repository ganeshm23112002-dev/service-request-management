from rest_framework.response import Response
from rest_framework.views import exception_handler


def envelope_response(data, status_code, success):
    return {
        "status": success,
        "statusCode": status_code,
        "data": data,
    }


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = envelope_response(
            response.data,
            response.status_code,
            False,
        )
    return response


class APIResponseMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(
            request,
            response,
            *args,
            **kwargs,
        )
        if isinstance(response, Response):
            data = response.data
            is_enveloped = (
                isinstance(data, dict)
                and {"status", "statusCode", "data"}.issubset(data)
            )
            if not is_enveloped:
                response.data = envelope_response(
                    data,
                    response.status_code,
                    response.status_code < 400,
                )
        return response
