from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination


class ServiceRequestPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_page_number(self, request, paginator):
        raw_page = request.query_params.get(self.page_query_param, "1")
        if raw_page not in self.last_page_strings:
            try:
                page_number = int(raw_page)
            except (TypeError, ValueError) as error:
                raise ValidationError({"page": "Enter a valid positive integer."}) from error
            if page_number < 1:
                raise ValidationError({"page": "Enter a valid positive integer."})
        return super().get_page_number(request, paginator)

    def get_page_size(self, request):
        raw_page_size = request.query_params.get(self.page_size_query_param)
        if raw_page_size is None:
            return self.page_size
        try:
            page_size = int(raw_page_size)
        except (TypeError, ValueError) as error:
            raise ValidationError(
                {"page_size": "Enter a valid positive integer."}
            ) from error
        if not 1 <= page_size <= self.max_page_size:
            raise ValidationError({
                "page_size": f"Choose a value between 1 and {self.max_page_size}."
            })
        return page_size


class EmployeePagination(ServiceRequestPagination):
    page_size = 20
