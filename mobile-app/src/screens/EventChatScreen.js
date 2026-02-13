import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '../components/AppButton';
import ProfileAvatar from '../components/ProfileAvatar';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { eventsAPI } from '../services/api';
import { colors } from '../theme/colors';
import { formatEventDate, getEventTypeEmoji, getEventTypeInfo, getTimeWindowEmoji, getTimeWindowInfo } from '../utils/events';

function normalizeListResponse(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function normalizeEvent(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildDateLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function buildTimeline(messages) {
  const sorted = [...messages].sort((a, b) => {
    const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return at - bt;
  });

  const timeline = [];
  let currentDate = '';

  sorted.forEach((message) => {
    const messageDate = message?.created_at ? new Date(message.created_at).toDateString() : '';
    if (messageDate && messageDate !== currentDate) {
      currentDate = messageDate;
      timeline.push({
        type: 'date',
        id: `date-${messageDate}`,
        label: buildDateLabel(message.created_at),
      });
    }
    timeline.push({ type: 'message', id: `message-${message.id}`, message });
  });

  return timeline;
}

function getAttendeeCount(event) {
  if (!event) return 0;
  if (typeof event.attendee_count === 'number') return event.attendee_count;
  if (Array.isArray(event.attendees)) return event.attendees.length;
  return 0;
}

export default function EventChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const eventId = route.params?.eventId;
  const myProfileId = profile?.id ? String(profile.id) : '';

  const [event, setEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoadingEvent(true);
      setError('');
      const response = await eventsAPI.get(eventId);
      setEvent(normalizeEvent(response));
    } catch (err) {
      setError(err.message || 'Failed to load event');
      setEvent(null);
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId]);

  const loadMessages = useCallback(
    async (options = {}) => {
      if (!eventId) return;
      try {
        if (!options.silent) {
          setLoadingMessages(true);
        }
        const response = await eventsAPI.getMessages(eventId);
        setMessages(normalizeListResponse(response));
      } catch (err) {
        if (!options.silent) {
          setError(err.message || 'Failed to load messages');
        }
      } finally {
        if (!options.silent) {
          setLoadingMessages(false);
        }
      }
    },
    [eventId],
  );

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent]),
  );

  useEffect(() => {
    if (!event?.id) return;
    loadMessages();
  }, [event?.id, loadMessages]);

  useEffect(() => {
    if (!event?.id) return undefined;
    const timer = setInterval(() => {
      loadMessages({ silent: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [event?.id, loadMessages]);

  useEffect(() => {
    if (!event?.title) return;
    navigation.setOptions({ title: event.title.length > 24 ? `${event.title.slice(0, 24)}…` : event.title });
  }, [event?.title, navigation]);

  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const attendeeCount = getAttendeeCount(event);
  const typeInfo = useMemo(() => getEventTypeInfo(event?.event_type), [event?.event_type]);
  const typeEmoji = useMemo(() => getEventTypeEmoji(event?.event_type), [event?.event_type]);
  const timeInfo = useMemo(() => getTimeWindowInfo(event?.time_window), [event?.time_window]);
  const timeEmoji = useMemo(() => getTimeWindowEmoji(event?.time_window), [event?.time_window]);

  const blockedReason = useMemo(() => {
    if (!event) return '';
    if (!event.is_attendee) return 'Join this event first to access the group chat.';
    if (event.join_mode === 'swipe' && event.status !== 'matched') {
      return 'Chat unlocks after this swipe event becomes matched.';
    }
    if (event.join_mode === 'direct' && attendeeCount < 2) {
      return 'Chat becomes available once there are at least two attendees.';
    }
    return '';
  }, [attendeeCount, event]);

  useEffect(() => {
    if (!listRef.current || timeline.length === 0) return;
    setTimeout(() => {
      try {
        listRef.current.scrollToEnd({ animated: true });
      } catch {
        // no-op
      }
    }, 40);
  }, [timeline.length]);

  const sendMessage = async () => {
    if (!eventId || sending || blockedReason) return;
    const content = input.trim();
    if (!content) return;

    try {
      setSending(true);
      setError('');
      setInput('');
      const response = await eventsAPI.sendMessage(eventId, content);
      const data = normalizeEvent(response);
      if (data?.id) {
        setMessages((prev) => [...prev, data]);
      } else {
        await loadMessages();
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const openEvent = () => {
    if (!eventId) return;
    navigation.navigate('EventDetail', { eventId });
  };

  if (!eventId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>Missing event id.</Text>
        </View>
      </Screen>
    );
  }

  if (loadingEvent) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.loadingText}>Loading group chat…</Text>
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

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <View style={styles.eventMeta}>
            <View style={styles.metaTop}>
              <Text style={styles.eventType}>{`${typeEmoji} ${typeInfo.label}`}</Text>
              <Text style={styles.eventAttendees}>{`${attendeeCount}/${event.spots}`}</Text>
            </View>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.eventInfo}>{`📅 ${formatEventDate(event.event_date)} · ${timeEmoji} ${timeInfo.label}`}</Text>
            <Text style={styles.eventInfo}>{`📍 ${event.location}`}</Text>
            <Pressable onPress={openEvent} style={({ pressed }) => [styles.eventLink, pressed ? styles.pressed : null]}>
              <Text style={styles.eventLinkText}>View event details</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          {blockedReason ? (
            <View style={[styles.center, { flex: 1 }]}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Chat not available yet</Text>
              <Text style={styles.emptyBody}>{blockedReason}</Text>
              <AppButton title="Open Event" onPress={openEvent} variant="primary" />
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={timeline}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={styles.messageList}
                onRefresh={loadMessages}
                refreshing={loadingMessages}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                renderItem={({ item }) => {
                  if (item.type === 'date') {
                    return (
                      <View style={styles.dateRow}>
                        <Text style={styles.dateText}>{item.label}</Text>
                      </View>
                    );
                  }

                  const message = item.message;
                  const senderProfile = message?.sender_profile || {};
                  const senderId = senderProfile?.id ? String(senderProfile.id) : String(message?.sender || '');
                  const mine = !!myProfileId && senderId === myProfileId;

                  return (
                    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                      {!mine ? (
                        <ProfileAvatar
                          uri={senderProfile?.avatar_url}
                          name={senderProfile?.display_name}
                          size={28}
                        />
                      ) : null}
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        {!mine ? (
                          <Text style={styles.senderName}>{senderProfile?.display_name || 'Anonymous'}</Text>
                        ) : null}
                        <Text style={styles.bubbleText}>{message?.content || ''}</Text>
                        <Text style={styles.timeText}>{formatMessageTime(message?.created_at)}</Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={styles.emptyEmoji}>🗨️</Text>
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptyBody}>Start the conversation to coordinate this meetup.</Text>
                  </View>
                }
              />

              <View style={styles.composer}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type a message…"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  editable={!sending}
                  multiline
                  maxLength={500}
                  onFocus={() => {
                    setTimeout(() => {
                      listRef.current?.scrollToEnd?.({ animated: true });
                    }, 40);
                  }}
                />
                <Pressable
                  onPress={sendMessage}
                  disabled={sending || !input.trim()}
                  style={({ pressed }) => [
                    styles.sendButton,
                    sending || !input.trim() ? styles.disabled : null,
                    pressed && !sending ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  eventMeta: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  metaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventType: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 12,
  },
  eventAttendees: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  eventTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
    marginTop: 2,
  },
  eventInfo: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  eventLink: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 4,
  },
  eventLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  banner: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    padding: 10,
    borderRadius: 14,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  messageList: {
    paddingBottom: 8,
    paddingTop: 2,
    gap: 10,
  },
  dateRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  dateText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  bubbleMine: {
    backgroundColor: `${colors.primary}22`,
    borderColor: `${colors.primary}44`,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
  },
  senderName: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  timeText: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    padding: 8,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    borderRadius: 999,
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  sendText: {
    color: colors.primaryText,
    fontWeight: '900',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
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
  emptyEmoji: {
    fontSize: 28,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
});
