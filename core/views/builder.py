"""Builder marketplace views."""

from datetime import timedelta

from django.db.models import Case, Exists, IntegerField, OuterRef, Q, Value, When
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.serializers.builder import (
    BuilderListingCreateSerializer,
    BuilderListingSerializer,
    BuilderMessageSerializer,
    BuilderMessageCreateSerializer,
)
from core.models import BuilderListing, BuilderMessage, InTownWindow
from core.services.subscription import SubscriptionService
from .mixins import MessageMixin


class BuilderListingViewSet(MessageMixin, viewsets.ModelViewSet):
    """CRUD for builder marketplace listings. Premium-only."""
    permission_classes = [IsAuthenticated]
    message_model = BuilderMessage
    message_serializer_class = BuilderMessageSerializer
    message_create_serializer_class = BuilderMessageCreateSerializer

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return BuilderListingCreateSerializer
        return BuilderListingSerializer

    @staticmethod
    def _location_windows(profile):
        """Return user's current + future city buckets from in-town windows."""
        today = timezone.now().date()
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        month_start_monday = next_sunday + timedelta(days=1)
        month_end_sunday = month_start_monday + timedelta(weeks=4) - timedelta(days=1)

        now_window = profile.in_town_windows.filter(
            start_date__lte=today,
            end_date__gte=today,
        ).first()
        next_week_window = profile.in_town_windows.filter(
            start_date__gte=next_monday,
            start_date__lte=next_sunday,
        ).first()
        next_month_window = profile.in_town_windows.filter(
            start_date__gte=month_start_monday,
            start_date__lte=month_end_sunday,
        ).first()

        return {
            'today': today,
            'next_monday': next_monday,
            'next_sunday': next_sunday,
            'month_start_monday': month_start_monday,
            'month_end_sunday': month_end_sunday,
            'now_city': now_window.city_area if now_window else (profile.current_location or '').strip() or None,
            'next_week_city': next_week_window.city_area if next_week_window else None,
            'next_month_city': next_month_window.city_area if next_month_window else None,
        }

    def _annotate_location_relevance(self, qs):
        """Rank listings by viewer/location overlap for current + future travel windows."""
        viewer_profile = self.request.user.profile
        windows = self._location_windows(viewer_profile)

        score_expr = Value(0, output_field=IntegerField())

        if windows['now_city']:
            score_expr += Case(
                When(city__display_name__iexact=windows['now_city'], then=Value(45)),
                default=Value(0),
                output_field=IntegerField(),
            )
            owner_now_match = Exists(
                InTownWindow.objects.filter(
                    profile_id=OuterRef('user__profile__id'),
                    start_date__lte=windows['today'],
                    end_date__gte=windows['today'],
                    city_area__iexact=windows['now_city'],
                )
            )
            score_expr += Case(
                When(owner_now_match, then=Value(35)),
                default=Value(0),
                output_field=IntegerField(),
            )

        if windows['next_week_city']:
            score_expr += Case(
                When(city__display_name__iexact=windows['next_week_city'], then=Value(30)),
                default=Value(0),
                output_field=IntegerField(),
            )
            owner_next_week_match = Exists(
                InTownWindow.objects.filter(
                    profile_id=OuterRef('user__profile__id'),
                    start_date__gte=windows['next_monday'],
                    start_date__lte=windows['next_sunday'],
                    city_area__iexact=windows['next_week_city'],
                )
            )
            score_expr += Case(
                When(owner_next_week_match, then=Value(25)),
                default=Value(0),
                output_field=IntegerField(),
            )

        if windows['next_month_city']:
            score_expr += Case(
                When(city__display_name__iexact=windows['next_month_city'], then=Value(20)),
                default=Value(0),
                output_field=IntegerField(),
            )
            owner_next_month_match = Exists(
                InTownWindow.objects.filter(
                    profile_id=OuterRef('user__profile__id'),
                    start_date__gte=windows['month_start_monday'],
                    start_date__lte=windows['month_end_sunday'],
                    city_area__iexact=windows['next_month_city'],
                )
            )
            score_expr += Case(
                When(owner_next_month_match, then=Value(18)),
                default=Value(0),
                output_field=IntegerField(),
            )

        return qs.annotate(location_relevance=score_expr).order_by('-location_relevance', '-created_at')

    def get_queryset(self):
        qs = BuilderListing.objects.filter(is_active=True).select_related(
            'user', 'user__profile', 'city'
        )
        category = self.request.query_params.get('category')
        listing_type = self.request.query_params.get('listing_type')
        if category:
            qs = qs.filter(category=category)
        if listing_type:
            qs = qs.filter(listing_type=listing_type)
        return self._annotate_location_relevance(qs)

    def _check_premium(self, request):
        sub = SubscriptionService.get_subscription_status(request.user.profile)
        if not sub['is_premium']:
            return Response(
                {'status': 'error', 'message': 'Premium subscription required'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def list(self, request, *args, **kwargs):
        denied = self._check_premium(request)
        if denied:
            return denied
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        denied = self._check_premium(request)
        if denied:
            return denied
        return super().messages(request, pk=pk)

    def retrieve(self, request, *args, **kwargs):
        denied = self._check_premium(request)
        if denied:
            return denied
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        denied = self._check_premium(request)
        if denied:
            return denied
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        out = BuilderListingSerializer(serializer.instance, context={'request': request})
        return Response(
            {'status': 'success', 'data': out.data},
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        denied = self._check_premium(request)
        if denied:
            return denied
        instance = self.get_object()
        if instance.user != request.user:
            return Response(
                {'status': 'error', 'message': 'You can only edit your own listings'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        denied = self._check_premium(request)
        if denied:
            return denied
        instance = self.get_object()
        if instance.user != request.user:
            return Response(
                {'status': 'error', 'message': 'You can only edit your own listings'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._check_premium(request)
        if denied:
            return denied
        instance = self.get_object()
        if instance.user != request.user:
            return Response(
                {'status': 'error', 'message': 'You can only delete your own listings'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -------------------------------------------------------------------------
    # MessageMixin hook implementations
    # -------------------------------------------------------------------------
    def get_message_parent(self, pk):
        try:
            listing = BuilderListing.objects.filter(
                is_active=True
            ).select_related(
                'user', 'user__profile', 'city'
            ).get(pk=pk)
            return listing, None
        except BuilderListing.DoesNotExist:
            return None, Response(
                {'status': 'error', 'message': 'Listing not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get_message_queryset(self, parent):
        profile = self.request.user.profile
        owner_profile = parent.user.profile
        qs = BuilderMessage.objects.filter(
            listing=parent
        ).select_related(
            'sender', 'recipient'
        ).order_by('created_at')

        if profile == owner_profile:
            recipient_id = self.request.query_params.get('recipient_id')
            if recipient_id:
                qs = qs.filter(Q(sender_id=recipient_id) | Q(recipient_id=recipient_id))
            return qs

        return qs.filter(Q(sender=profile) | Q(recipient=profile))

    def _list_messages(self, parent):
        profile = self.request.user.profile
        messages = self.get_message_queryset(parent)
        messages.filter(recipient=profile, is_read=False).update(is_read=True)
        serializer = self.message_serializer_class(messages, many=True)
        return Response(
            {'status': 'success', 'data': serializer.data},
            status=status.HTTP_200_OK,
        )

    def check_message_access(self, parent, profile):
        # Premium users may start a new inquirer thread directly from a listing.
        return True, None

    def get_message_create_serializer_context(self, request, parent, profile):
        return {
            'sender_profile': profile,
            'owner_profile': parent.user.profile,
        }

    def create_message(self, parent, profile, validated_data):
        owner_profile = parent.user.profile
        if profile == owner_profile:
            recipient = validated_data.get('recipient_profile')
            if recipient is None:
                raise ValidationError(
                    {'recipient_id': ['recipient_id is required when replying as owner.']}
                )
        else:
            recipient = owner_profile

        return BuilderMessage.objects.create(
            listing=parent,
            sender=profile,
            recipient=recipient,
            content=validated_data['content'],
        )

    # ── My Listings ──────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='my-listings')
    def my_listings(self, request):
        """Return the current user's own listings (active and inactive)."""
        denied = self._check_premium(request)
        if denied:
            return denied
        qs = BuilderListing.objects.filter(user=request.user).select_related(
            'user', 'user__profile', 'city'
        ).order_by('-created_at')
        serializer = BuilderListingSerializer(qs, many=True)
        return Response({'status': 'success', 'data': serializer.data})

    # ── Conversations list (for listing owner) ───────────────────────
    @action(detail=True, methods=['get'], url_path='conversations')
    def conversations(self, request, pk=None):
        """List unique conversation threads on a listing (for the owner)."""
        denied = self._check_premium(request)
        if denied:
            return denied

        listing = self.get_object()
        profile = request.user.profile

        # Get distinct users who have messaged on this listing (excluding owner)
        msg_qs = BuilderMessage.objects.filter(listing=listing)
        if profile == listing.user.profile:
            # Owner: find all unique inquirers
            inquirer_ids = set(
                msg_qs.exclude(sender=profile).values_list('sender_id', flat=True)
            ) | set(
                msg_qs.exclude(recipient=profile).values_list('recipient_id', flat=True)
            )
        else:
            inquirer_ids = set()

        from core.models import Profile as ProfileModel
        threads = []
        for pid in inquirer_ids:
            try:
                p = ProfileModel.objects.get(id=pid)
            except ProfileModel.DoesNotExist:
                continue
            last_msg = msg_qs.filter(
                Q(sender=p) | Q(recipient=p)
            ).order_by('-created_at').first()
            unread = msg_qs.filter(sender=p, recipient=profile, is_read=False).count()
            threads.append({
                'profile_id': str(p.id),
                'display_name': p.display_name,
                'avatar_url': p.avatar_url,
                'last_message': last_msg.content if last_msg else None,
                'last_message_at': last_msg.created_at.isoformat() if last_msg else None,
                'unread_count': unread,
            })

        threads.sort(key=lambda t: t['last_message_at'] or '', reverse=True)
        return Response({'status': 'success', 'data': threads})
