import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import AppButton from '../components/AppButton';
import ProfileAvatar from '../components/ProfileAvatar';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { eventsAPI } from '../services/api';
import { colors } from '../theme/colors';
import { formatEventDateLong, getEventTypeEmoji, getEventTypeInfo, getTimeWindowEmoji, getTimeWindowInfo } from '../utils/events';

function normalizeEvent(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function getAttendeeProfile(attendee) {
  return attendee?.user_profile || attendee?.user || attendee || {};
}

export default function EventDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile: myProfile } = useAuth();

  const eventId = route.params?.eventId;

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError('');
      const response = await eventsAPI.get(eventId);
      setEvent(normalizeEvent(response));
    } catch (err) {
      setError(err.message || 'Failed to load event');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent]),
  );

  const typeInfo = useMemo(() => getEventTypeInfo(event?.event_type), [event?.event_type]);
  const typeEmoji = useMemo(() => getEventTypeEmoji(event?.event_type), [event?.event_type]);
  const timeInfo = useMemo(() => getTimeWindowInfo(event?.time_window), [event?.time_window]);
  const timeEmoji = useMemo(() => getTimeWindowEmoji(event?.time_window), [event?.time_window]);

  const isDirectMode = event?.join_mode === 'direct';
  const isSwipeMode = event?.join_mode === 'swipe';
  const myProfileId = myProfile?.id ? String(myProfile.id) : null;
  const isCreator = event?.created_by?.id ? String(event.created_by.id) === myProfileId : false;

  const attendees = event?.attendees || [];
  const attendeeCount = event?.attendee_count || attendees.length;
  const spotsRemaining = event?.spots_remaining ?? Math.max((event?.spots || 0) - attendeeCount, 0);
  const myAttendee = attendees.find((item) => String(item?.user) === myProfileId);
  const isAttendee = Boolean(myAttendee && myAttendee.status !== 'declined');

  const hasMatch = event?.status === 'matched';
  const canOpenChat = (isDirectMode && attendees.length > 1) || (isSwipeMode && hasMatch);

  const openChat = () => {
    if (!event?.id) return;
    navigation.navigate('EventChat', { eventId: event.id });
  };

  const runAction = async (name, fn) => {
    try {
      setActionLoading(name);
      setError('');
      await fn();
      await loadEvent();
    } catch (err) {
      setError(err.message || `Failed to ${name}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleJoin = () => runAction('join', () => eventsAPI.join(eventId));
  const handleLeave = () => runAction('leave', () => eventsAPI.leave(eventId));
  const handleConfirm = () => runAction('confirm', () => eventsAPI.confirm(eventId));

  if (!eventId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>Missing event id.</Text>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.loadingText}>Loading event…</Text>
        </View>
      </Screen>
    );
  }

  if (error && !event) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Try Again" onPress={loadEvent} variant="primary" />
        </View>
      </Screen>
    );
  }

  if (!event) return null;

  const interestedCount = Math.max(0, (event.spots || 0) - spotsRemaining - 1);
  const requiredLikes = Math.max(1, (event.spots || 1) - 1);
  const progressPercent = Math.max(0, Math.min(100, (interestedCount / requiredLikes) * 100));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.typeBadge}>{`${typeEmoji} ${typeInfo.label}`}</Text>
            <Text style={styles.status}>{event.status}</Text>
          </View>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Date</Text>
              <Text style={styles.gridValue}>{formatEventDateLong(event.event_date)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Time</Text>
              <Text style={styles.gridValue}>{`${timeEmoji} ${timeInfo.label}`}</Text>
            </View>
            <View style={[styles.gridItem, styles.gridFull]}>
              <Text style={styles.gridLabel}>Location</Text>
              <Text style={styles.gridValue}>{event.location}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Spots</Text>
              <Text style={styles.gridValue}>{event.spots}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Attending</Text>
              <Text style={styles.gridValue}>{`${attendeeCount}/${event.spots}`}</Text>
            </View>
          </View>

          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this event</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          ) : null}

          <View style={styles.hostRow}>
            <Text style={styles.hostLabel}>Hosted by</Text>
            <ProfileAvatar uri={event.created_by?.avatar_url} name={event.created_by?.display_name} size={30} />
            <Text style={styles.hostName}>{event.created_by?.display_name || 'Anonymous'}</Text>
          </View>
        </View>

        {isDirectMode ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Attendees</Text>
              <Text style={styles.sectionMeta}>{`${attendeeCount}/${event.spots}`}</Text>
            </View>

            {attendees.length > 0 ? (
              <FlatList
                data={attendees}
                keyExtractor={(item) => item.id || `${item.user}-${item.status}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => {
                  const attendeeProfile = getAttendeeProfile(item);
                  const attendeeProfileId = attendeeProfile?.id ? String(attendeeProfile.id) : String(item?.user || '');
                  return (
                    <View style={styles.attendeeRow}>
                      <ProfileAvatar uri={attendeeProfile.avatar_url} name={attendeeProfile.display_name} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attendeeName}>{attendeeProfile.display_name || 'Anonymous'}</Text>
                        <Text style={styles.attendeeMeta}>
                          {attendeeProfileId === String(event.created_by?.id) ? 'Host · ' : ''}
                          {item.status === 'confirmed' ? 'Confirmed' : item.status === 'joined' ? 'Joined' : 'Declined'}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            ) : (
              <Text style={styles.muted}>No attendees yet.</Text>
            )}

            {event.status === 'open' && !isCreator ? (
              <View style={styles.actions}>
                {!isAttendee ? (
                  <AppButton
                    title={actionLoading === 'join' ? 'Joining…' : spotsRemaining === 0 ? 'Event Full' : 'Join Event'}
                    onPress={handleJoin}
                    disabled={Boolean(actionLoading) || spotsRemaining === 0}
                    variant="primary"
                  />
                ) : (
                  <>
                    {myAttendee?.status === 'joined' ? (
                      <AppButton
                        title={actionLoading === 'confirm' ? 'Confirming…' : 'Confirm Attendance'}
                        onPress={handleConfirm}
                        disabled={Boolean(actionLoading)}
                        variant="primary"
                      />
                    ) : null}
                    <AppButton
                      title={actionLoading === 'leave' ? 'Leaving…' : 'Leave Event'}
                      onPress={handleLeave}
                      disabled={Boolean(actionLoading)}
                      variant="secondary"
                    />
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {isSwipeMode ? (
          <View style={styles.card}>
            {hasMatch ? (
              <>
                <Text style={styles.sectionTitle}>Matched group</Text>
                <Text style={styles.muted}>{`${attendeeCount}/${event.spots} attendees`}</Text>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Waiting for more swipes</Text>
                <Text style={styles.muted}>
                  {`${spotsRemaining} more ${spotsRemaining === 1 ? 'person needs' : 'people need'} to swipe right.`}
                </Text>
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                  </View>
                  <Text style={styles.progressMeta}>{`${interestedCount}/${requiredLikes} interested`}</Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        {canOpenChat ? (
          <AppButton title="Open Group Chat" onPress={openChat} variant="primary" />
        ) : null}

        <View style={styles.safety}>
          <Text style={styles.safetyText}>
            Safety tip: Meet in public places for first meetups and share your plans with someone you trust.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '800',
  },
  banner: {
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 14,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  status: {
    color: colors.muted,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  gridFull: {
    width: '100%',
  },
  gridLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  gridValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontWeight: '800',
  },
  description: {
    color: colors.secondary,
    lineHeight: 19,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  hostLabel: {
    color: colors.muted,
    fontWeight: '700',
    marginRight: 2,
  },
  hostName: {
    color: colors.text,
    fontWeight: '800',
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  attendeeName: {
    color: colors.text,
    fontWeight: '800',
  },
  attendeeMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  actions: {
    gap: 8,
    marginTop: 6,
  },
  muted: {
    color: colors.muted,
    lineHeight: 18,
  },
  progressWrap: {
    gap: 6,
    marginTop: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.emerald,
  },
  progressMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  safety: {
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    padding: 10,
  },
  safetyText: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});

