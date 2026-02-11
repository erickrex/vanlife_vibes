"""Health check endpoint for Elastic Beanstalk monitoring."""

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Return application health status based on database connectivity."""
    try:
        connection.ensure_connection()
        return Response({"status": "healthy"}, status=200)
    except Exception:
        return Response(
            {"status": "unhealthy", "reason": "database connection failed"},
            status=503,
        )
