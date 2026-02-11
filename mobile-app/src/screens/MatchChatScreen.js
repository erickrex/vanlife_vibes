import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '../components/AppButton';
import ProfileAvatar from '../components/ProfileAvatar';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { matchesAPI } from '../services/api';
import { createRealtimeSocket } from '../services/realtime';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

const REPORT_REASON_OPTIONS = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'fake_profile', label: 'Fake Profile' },
  { value: 'scam', label: 'Scam' },
  { value: 'other', label: 'Other' },
];

function normalizeListResponse(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function normalizeObjectResponse(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
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
    const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });

  const timeline = [];
  let currentDate = '';
  sorted.forEach((message) => {
    const messageDate = message?.created_at ? new Date(message.created_at).toDateString() : '';
    if (messageDate && messageDate !== currentDate) {
      currentDate = messageDate;
      timeline.push({ type: 'date', id: `date-${messageDate}`, label: buildDateLabel(message.created_at) });
    }
    timeline.push({ type: 'message', id: `message-${message.id}`, message });
  });
  return timeline;
}

export default function MatchChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile: me } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const matchId = route.params?.matchId;
  const matchFromRoute = route.params?.match;

  const [match, setMatch] = useState(matchFromRoute || null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASON_OPTIONS[0].value);
  const [reportDescription, setReportDescription] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [windowHeight, setWindowHeight] = useState(Dimensions.get('window').height);

  const listRef = useRef(null);
  const baseWindowHeightRef = useRef(Dimensions.get('window').height);

  const otherUser = match?.other_user || match?.user2_profile || match?.user1_profile;

  useEffect(() => {
    if (otherUser?.display_name) {
      navigation.setOptions({ title: otherUser.display_name });
    }
  }, [navigation, otherUser?.display_name]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowHeight(window.height);
      if (keyboardHeight === 0) {
        baseWindowHeightRef.current = window.height;
      }
    });
    return () => subscription?.remove?.();
  }, [keyboardHeight]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      baseWindowHeightRef.current = Dimensions.get('window').height;
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadMatch = useCallback(async () => {
    if (!matchId) return;
    try {
      const response = await matchesAPI.get(matchId);
      setMatch(normalizeObjectResponse(response));
    } catch {
      // keep match from route params
    }
  }, [matchId]);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!matchId) return;
    try {
      if (!silent) setError('');
      const response = await matchesAPI.getMessages(matchId);
      setMessages(normalizeListResponse(response));
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load messages');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    setLoading(true);
    setNotice('');
    loadMatch();
    loadMessages();
  }, [loadMatch, loadMessages]);

  useEffect(() => {
    if (!matchId) return undefined;
    const realtimeSocket = createRealtimeSocket({
      path: `/ws/matches/${matchId}/`,
      onOpen: () => {
        setSocketConnected(true);
        loadMessages({ silent: true });
      },
      onClose: () => setSocketConnected(false),
      onMessage: (payload) => {
        if (payload?.type !== 'chat_message') return;
        const message = payload?.message;
        if (!message?.id) return;
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          return [...prev, message];
        });
      },
    });
    realtimeSocket.connect();
    return () => realtimeSocket.disconnect();
  }, [loadMessages, matchId]);

  useEffect(() => {
    if (!matchId) return undefined;
    const intervalMs = 1000;
    const interval = setInterval(() => {
      loadMessages({ silent: true });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [loadMessages, matchId]);

  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const androidWindowShrink = Math.max(0, baseWindowHeightRef.current - windowHeight);
  const androidKeyboardCompensation =
    Platform.OS === 'android' ? Math.max(0, keyboardHeight - androidWindowShrink) : 0;

  useEffect(() => {
    if (!listRef.current || timeline.length === 0) return;
    setTimeout(() => {
      try {
        listRef.current.scrollToEnd({ animated: true });
      } catch {
        // ignore
      }
    }, 40);
  }, [timeline.length]);

  const sendMessage = async () => {
    if (!matchId) return;
    const content = input.trim();
    if (!content) return;
    try {
      setSending(true);
      setError('');
      setNotice('');
      setInput('');
      const response = await matchesAPI.sendMessage(matchId, content);
      const data = normalizeObjectResponse(response);
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

  const sendIcebreaker = async () => {
    if (!matchId || actionLoading) return;
    const firstName = otherUser?.display_name ? String(otherUser.display_name).split(' ')[0] : 'there';
    const content = `Hey ${firstName}, what does your ideal vanlife day look like this week?`;
    try {
      setActionLoading('icebreaker');
      setError('');
      setNotice('');
      const response = await matchesAPI.sendIcebreaker(matchId, content);
      const data = normalizeObjectResponse(response);
      if (data?.id) {
        setMessages((prev) => [...prev, data]);
      } else {
        await loadMessages();
      }
      setNotice('Icebreaker sent.');
    } catch (err) {
      setError(err.message || 'Failed to send icebreaker');
    } finally {
      setActionLoading('');
    }
  };

  const shareMiniCard = async () => {
    if (!matchId || actionLoading) return;
    const payload = {};
    if (me?.current_location || me?.now_in_city) {
      payload.current_location = me?.current_location || me?.now_in_city;
    }
    if (me?.now_in_end_date) {
      payload.in_town_until = me.now_in_end_date;
    }
    payload.meet_preference = me?.meetup_interest || 'open_to_it';
    try {
      setActionLoading('mini-card');
      setError('');
      setNotice('');
      const response = await matchesAPI.shareMiniCard(matchId, payload);
      const data = normalizeObjectResponse(response);
      if (data?.id) {
        setMessages((prev) => [...prev, data]);
      } else {
        await loadMessages();
      }
      setNotice('Mini-card shared.');
    } catch (err) {
      setError(err.message || 'Failed to share mini-card');
    } finally {
      setActionLoading('');
    }
  };

  const unmatch = async () => {
    if (!matchId || actionLoading) return;
    try {
      setActionLoading('unmatch');
      setError('');
      await matchesAPI.unmatch(matchId);
      navigation.replace('Matches');
    } catch (err) {
      setError(err.message || 'Failed to unmatch');
    } finally {
      setActionLoading('');
    }
  };

  const submitReport = async () => {
    if (!matchId || actionLoading) return;
    try {
      setActionLoading('report');
      setError('');
      await matchesAPI.report(matchId, {
        reason: reportReason,
        description: reportDescription.trim(),
      });
      setReportVisible(false);
      setReportDescription('');
      setNotice('Report submitted.');
    } catch (err) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setActionLoading('');
    }
  };

  if (!matchId) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>Missing match id.</Text>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading chat…</Text>
        </View>
      </Screen>
    );
  }

  if (error && timeline.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Try Again" onPress={loadMessages} variant="primary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 10) + androidKeyboardCompensation },
          ]}
        >
          <View style={styles.topMeta}>
            <Pressable
              onPress={() => {
                if (!otherUser?.id) return;
                navigation.navigate('Profile', { profileId: otherUser.id });
              }}
              style={({ pressed }) => [styles.peerRow, pressed ? styles.pressed : null]}
            >
              <ProfileAvatar uri={otherUser?.avatar_url} name={otherUser?.display_name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.peerName} numberOfLines={1}>
                  {otherUser?.display_name || 'Chat'}
                </Text>
                <Text style={styles.peerMeta}>{socketConnected ? 'Live' : 'Syncing…'}</Text>
              </View>
            </Pressable>

            <View style={styles.quickActions}>
              <Pressable
                onPress={sendIcebreaker}
                disabled={!!actionLoading}
                style={({ pressed }) => [styles.quickActionChip, pressed ? styles.pressed : null, actionLoading ? styles.disabled : null]}
              >
                <Text style={styles.quickActionText}>Icebreaker</Text>
              </Pressable>
              <Pressable
                onPress={shareMiniCard}
                disabled={!!actionLoading}
                style={({ pressed }) => [styles.quickActionChip, pressed ? styles.pressed : null, actionLoading ? styles.disabled : null]}
              >
                <Text style={styles.quickActionText}>Mini-card</Text>
              </Pressable>
              <Pressable
                onPress={() => setReportVisible(true)}
                disabled={!!actionLoading}
                style={({ pressed }) => [styles.quickActionChip, pressed ? styles.pressed : null, actionLoading ? styles.disabled : null]}
              >
                <Text style={styles.quickActionText}>Report</Text>
              </Pressable>
              <Pressable
                onPress={unmatch}
                disabled={!!actionLoading}
                style={({ pressed }) => [
                  styles.quickActionChip,
                  styles.quickActionDanger,
                  pressed ? styles.pressed : null,
                  actionLoading ? styles.disabled : null,
                ]}
              >
                <Text style={styles.quickActionDangerText}>
                  {actionLoading === 'unmatch' ? 'Unmatching…' : 'Unmatch'}
                </Text>
              </Pressable>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={timeline}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => {
              if (item.type === 'date') {
                return (
                  <View style={styles.dateRow}>
                    <Text style={styles.dateText}>{item.label}</Text>
                  </View>
                );
              }

              const message = item.message;
              const mine = me?.id && message?.sender && String(message.sender) === String(me.id);
              const isMiniCard = message?.message_type === 'mini_card';
              const bubbleStyle = mine ? styles.bubbleMine : styles.bubbleTheirs;
              const textStyle = mine ? styles.bubbleTextMine : styles.bubbleTextTheirs;
              const time = formatTime(message?.created_at);

              return (
                <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
                  <View style={[styles.bubble, bubbleStyle]}>
                    <Text style={textStyle}>{message?.content || (isMiniCard ? 'Mini-card shared' : '')}</Text>
                    {time ? <Text style={styles.timeText}>{time}</Text> : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyBody}>Start the conversation to break the ice.</Text>
              </View>
            }
          />

          {notice ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message…"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              editable={!sending}
              multiline
            />
            <Pressable
              onPress={sendMessage}
              disabled={sending || !input.trim()}
              style={({ pressed }) => [
                styles.send,
                sending || !input.trim() ? styles.sendDisabled : null,
                pressed && !sending ? styles.pressed : null,
              ]}
            >
              <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>

        <Modal visible={reportVisible} animationType="slide" transparent onRequestClose={() => setReportVisible(false)}>
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Report User</Text>
                <Text style={styles.modalBody}>
                  Report {otherUser?.display_name || 'this user'} for policy violations.
                </Text>

                <View style={styles.reasonRow}>
                  {REPORT_REASON_OPTIONS.map((option) => {
                    const selected = reportReason === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setReportReason(option.value)}
                        style={({ pressed }) => [
                          styles.reasonChip,
                          selected ? styles.reasonChipActive : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text style={[styles.reasonText, selected ? styles.reasonTextActive : null]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  placeholder="Optional details"
                  placeholderTextColor={colors.placeholder}
                  style={styles.reportInput}
                  maxLength={500}
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.modalActions}>
                  <AppButton
                    title={actionLoading === 'report' ? 'Submitting…' : 'Submit Report'}
                    onPress={submitReport}
                    disabled={actionLoading === 'report'}
                    variant="danger"
                    style={styles.flexButton}
                  />
                  <AppButton
                    title="Cancel"
                    onPress={() => setReportVisible(false)}
                    disabled={actionLoading === 'report'}
                    variant="secondary"
                    style={styles.flexButton}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 16, gap: 10 },
  topMeta: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 12,
    gap: 10,
  },
  peerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peerName: { color: colors.text, fontWeight: '900', fontSize: 15 },
  peerMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  quickActionText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  quickActionDanger: {
    borderColor: `${colors.danger}55`,
    backgroundColor: `${colors.danger}18`,
  },
  quickActionDangerText: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  list: { paddingVertical: 6, paddingBottom: 10, gap: 10 },
  dateRow: { alignItems: 'center', marginVertical: 3 },
  dateText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  messageRow: { flexDirection: 'row' },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: `${colors.primary}22`,
    borderColor: `${colors.primary}44`,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  bubbleTextMine: { color: colors.text, fontWeight: '700' },
  bubbleTextTheirs: { color: colors.text, fontWeight: '700' },
  timeText: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: 'right' },
  noticeBanner: {
    borderWidth: 1,
    borderColor: `${colors.emerald}66`,
    backgroundColor: `${colors.emerald}18`,
    padding: 10,
    borderRadius: radius.lg,
  },
  noticeText: { color: '#6ee7b7', fontSize: 12, fontWeight: '700' },
  banner: {
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
    backgroundColor: `${colors.danger}18`,
    padding: 10,
    borderRadius: radius.lg,
  },
  bannerText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 8,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 110,
  },
  send: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.primaryText, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  loadingText: { color: colors.muted, fontWeight: '900' },
  errorText: { color: colors.danger, fontWeight: '900', textAlign: 'center' },
  emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 18, textAlign: 'center' },
  emptyBody: { color: colors.muted, textAlign: 'center', lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', padding: 20 },
  modalFlex: { flex: 1 },
  modalCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  modalBody: { color: colors.muted, lineHeight: 18 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reasonChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  reasonText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  reasonTextActive: { color: colors.text, fontWeight: '800' },
  reportInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 88,
    maxHeight: 130,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  flexButton: { flex: 1 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});
