# core/serializers/analytics.py
"""
Analytics-related serializers for event tracking.

This module contains serializers for:
- AnalyticsEventCreateSerializer: Creating analytics events from authenticated clients
- AnalyticsEventSerializer: Returning stored analytics events

Requirements: 2.2 (Backend File Organization)
"""

from rest_framework import serializers

from core.models import AnalyticsEvent


class AnalyticsEventCreateSerializer(serializers.Serializer):
    """
    Serializer for analytics event ingestion from authenticated clients.
    """

    event_name = serializers.CharField(max_length=80)
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_event_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("event_name is required.")
        return normalized

    def validate_metadata(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("metadata must be a JSON object.")
        return value


class AnalyticsEventSerializer(serializers.ModelSerializer):
    """
    Serializer for returning stored analytics events.
    """

    class Meta:
        model = AnalyticsEvent
        fields = ['id', 'event_name', 'metadata', 'created_at', 'user', 'profile']
        read_only_fields = ['id', 'created_at', 'user', 'profile']
