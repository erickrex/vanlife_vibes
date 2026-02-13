import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

const MINI_CARD_MEET_PREFERENCE_OPTIONS = [
  { value: 'open_to_it', label: 'Open to meeting up' },
  { value: 'coffee', label: 'Coffee nearby' },
  { value: 'hike', label: 'Trail hike' },
  { value: 'campfire', label: 'Campfire hang' },
];

function firstName(value, fallback = 'there') {
  if (!value) return fallback;
  const name = String(value).trim().split(' ')[0];
  return name || fallback;
}

function buildIcebreakerSuggestions({ me, otherUser, match }) {
  const peerName = firstName(otherUser?.display_name);
  const myCity = me?.now_in_city || me?.current_location;
  const peerCity = otherUser?.now_in_city || otherUser?.current_location;
  const relationshipType = match?.relationship_type || 'dating';
  const pet = otherUser?.pet_name || me?.pet_name;
  const suggestions = [];

  if (myCity || peerCity) {
    const city = peerCity || myCity;
    suggestions.push({
      id: 'location-sync',
      text: `Hey ${peerName}, how long are you around ${city}? I am planning my next stop and would love to sync routes.`,
      reason: city
        ? `Relevant because location is part of this match context (${city}).`
        : 'Relevant because travel timing usually drives vanlife plans.',
    });
  }

  if (relationshipType === 'friends') {
    suggestions.push({
      id: 'friends-plan',
      text: `Hey ${peerName}, want to trade favorite boondocking spots for this month?`,
      reason: 'Relevant because this is a friends match and activity ideas work well.',
    });
  } else {
    suggestions.push({
      id: 'dating-vibe',
      text: `Hey ${peerName}, what does your ideal vanlife date look like this week?`,
      reason: 'Relevant because this is a dating match and sets a playful tone.',
    });
  }

  if (pet) {
    suggestions.push({
      id: 'pet-opener',
      text: `I saw a mention of ${pet} vibes in profiles. What is the best pet-friendly stop you have found lately?`,
      reason: 'Relevant because pet-friendly travel is a strong shared context.',
    });
  }

  suggestions.push({
    id: 'practical-opener',
    text: `Quick one: what is one thing you always check before choosing a new camp spot?`,
    reason: 'Relevant because practical travel questions are easy to answer and keep chat moving.',
  });

  return suggestions.slice(0, 4);
}

function buildMiniCardPresets({ me, otherUser }) {
  const myCity = me?.now_in_city || me?.current_location || '';
  const myUntil = me?.now_in_end_date || '';
  const peerCity = otherUser?.now_in_city || otherUser?.current_location || '';

  return [
    {
      id: 'local-coffee',
      label: 'Coffee check-in',
      reason: peerCity
        ? `Relevant because they appear to be around ${peerCity}.`
        : 'Relevant as a low-pressure first meetup option.',
      payload: {
        current_location: myCity,
        in_town_until: myUntil,
        meet_preference: 'coffee',
      },
    },
    {
      id: 'trail-plan',
      label: 'Trail + timing',
      reason: 'Relevant for coordinating time windows before routes diverge.',
      payload: {
        current_location: myCity,
        in_town_until: myUntil,
        meet_preference: 'hike',
      },
    },
    {
      id: 'open-intro',
      label: 'Open mini-card',
      reason: 'Relevant when you want to share your situation without pushing a specific plan.',
      payload: {
        current_location: myCity,
        in_town_until: myUntil,
        meet_preference: 'open_to_it',
      },
    },
  ];
}

function isValidYyyyMmDd(value) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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
  const [icebreakerVisible, setIcebreakerVisible] = useState(false);
  const [miniCardVisible, setMiniCardVisible] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASON_OPTIONS[0].value);
  const [reportDescription, setReportDescription] = useState('');
  const [icebreakerDraft, setIcebreakerDraft] = useState('');
  const [selectedIcebreakerId, setSelectedIcebreakerId] = useState('');
  const [miniCardDraft, setMiniCardDraft] = useState({
    current_location: '',
    in_town_until: '',
    meet_preference: 'open_to_it',
  });
  const [selectedMiniCardPresetId, setSelectedMiniCardPresetId] = useState('');

  const listRef = useRef(null);

  const otherUser = match?.other_user || match?.user2_profile || match?.user1_profile;

  useEffect(() => {
    if (otherUser?.display_name) {
      navigation.setOptions({ title: otherUser.display_name });
    }
  }, [navigation, otherUser?.display_name]);

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
  const icebreakerSuggestions = useMemo(
    () => buildIcebreakerSuggestions({ me, otherUser, match }),
    [match, me, otherUser]
  );
  const miniCardPresets = useMemo(() => buildMiniCardPresets({ me, otherUser }), [me, otherUser]);
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

  const openIcebreakerComposer = () => {
    if (actionLoading) return;
    const firstSuggestion = icebreakerSuggestions[0];
    setSelectedIcebreakerId(firstSuggestion?.id || '');
    setIcebreakerDraft(firstSuggestion?.text || '');
    setIcebreakerVisible(true);
  };

  const sendIcebreaker = async () => {
    if (!matchId || actionLoading) return;
    const content = icebreakerDraft.trim();
    if (!content) {
      setError('Icebreaker message cannot be empty.');
      return;
    }
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
      setIcebreakerVisible(false);
      setIcebreakerDraft('');
      setSelectedIcebreakerId('');
    } catch (err) {
      setError(err.message || 'Failed to send icebreaker');
    } finally {
      setActionLoading('');
    }
  };

  const openMiniCardComposer = () => {
    if (actionLoading) return;
    const firstPreset = miniCardPresets[0];
    setSelectedMiniCardPresetId(firstPreset?.id || '');
    setMiniCardDraft({
      current_location: firstPreset?.payload?.current_location || me?.current_location || me?.now_in_city || '',
      in_town_until: firstPreset?.payload?.in_town_until || me?.now_in_end_date || '',
      meet_preference: firstPreset?.payload?.meet_preference || 'open_to_it',
    });
    setMiniCardVisible(true);
  };

  const shareMiniCard = async () => {
    if (!matchId || actionLoading) return;
    const payload = {};
    const currentLocation = miniCardDraft.current_location.trim();
    const inTownUntil = miniCardDraft.in_town_until.trim();
    const meetPreference = miniCardDraft.meet_preference.trim();

    if (currentLocation) {
      payload.current_location = currentLocation;
    }
    if (inTownUntil) {
      if (!isValidYyyyMmDd(inTownUntil)) {
        setError('Mini-card date must use YYYY-MM-DD format.');
        return;
      }
      payload.in_town_until = inTownUntil;
    }
    if (meetPreference) {
      payload.meet_preference = meetPreference;
    }

    if (!payload.current_location && !payload.in_town_until && !payload.meet_preference) {
      setError('Add at least one mini-card field before sending.');
      return;
    }

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
      setMiniCardVisible(false);
      setSelectedMiniCardPresetId('');
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 10) },
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
                onPress={openIcebreakerComposer}
                disabled={!!actionLoading}
                style={({ pressed }) => [styles.quickActionChip, pressed ? styles.pressed : null, actionLoading ? styles.disabled : null]}
              >
                <Text style={styles.quickActionText}>Icebreaker</Text>
              </Pressable>
              <Pressable
                onPress={openMiniCardComposer}
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

        <Modal
          visible={icebreakerVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIcebreakerVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Choose an icebreaker</Text>
                <Text style={styles.modalBody}>
                  Pick a suggestion, then edit it before sending.
                </Text>

                <ScrollView style={styles.optionScroll} contentContainerStyle={styles.optionScrollContent}>
                  {icebreakerSuggestions.map((item) => {
                    const selected = selectedIcebreakerId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setSelectedIcebreakerId(item.id);
                          setIcebreakerDraft(item.text);
                        }}
                        style={({ pressed }) => [
                          styles.optionCard,
                          selected ? styles.optionCardActive : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text style={styles.optionText}>{item.text}</Text>
                        <Text style={styles.optionReason}>{item.reason}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <TextInput
                  value={icebreakerDraft}
                  onChangeText={setIcebreakerDraft}
                  placeholder="Edit your icebreaker before sending"
                  placeholderTextColor={colors.placeholder}
                  style={styles.reportInput}
                  maxLength={1000}
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.modalActions}>
                  <AppButton
                    title={actionLoading === 'icebreaker' ? 'Sending…' : 'Send'}
                    onPress={sendIcebreaker}
                    disabled={actionLoading === 'icebreaker' || !icebreakerDraft.trim()}
                    variant="primary"
                    style={styles.flexButton}
                  />
                  <AppButton
                    title="Cancel"
                    onPress={() => setIcebreakerVisible(false)}
                    disabled={actionLoading === 'icebreaker'}
                    variant="secondary"
                    style={styles.flexButton}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={miniCardVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setMiniCardVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Build your mini-card</Text>
                <Text style={styles.modalBody}>
                  Choose a preset and adjust the fields before sending.
                </Text>

                <ScrollView style={styles.optionScroll} contentContainerStyle={styles.optionScrollContent}>
                  {miniCardPresets.map((preset) => {
                    const selected = selectedMiniCardPresetId === preset.id;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          setSelectedMiniCardPresetId(preset.id);
                          setMiniCardDraft({
                            current_location: preset.payload.current_location || '',
                            in_town_until: preset.payload.in_town_until || '',
                            meet_preference: preset.payload.meet_preference || 'open_to_it',
                          });
                        }}
                        style={({ pressed }) => [
                          styles.optionCard,
                          selected ? styles.optionCardActive : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text style={styles.optionLabel}>{preset.label}</Text>
                        <Text style={styles.optionReason}>{preset.reason}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <TextInput
                  value={miniCardDraft.current_location}
                  onChangeText={(value) =>
                    setMiniCardDraft((prev) => ({
                      ...prev,
                      current_location: value,
                    }))
                  }
                  placeholder="Current location"
                  placeholderTextColor={colors.placeholder}
                  style={styles.fieldInput}
                  maxLength={100}
                />

                <TextInput
                  value={miniCardDraft.in_town_until}
                  onChangeText={(value) =>
                    setMiniCardDraft((prev) => ({
                      ...prev,
                      in_town_until: value,
                    }))
                  }
                  placeholder="In town until (YYYY-MM-DD)"
                  placeholderTextColor={colors.placeholder}
                  style={styles.fieldInput}
                  maxLength={10}
                />

                <View style={styles.reasonRow}>
                  {MINI_CARD_MEET_PREFERENCE_OPTIONS.map((option) => {
                    const selected = miniCardDraft.meet_preference === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          setMiniCardDraft((prev) => ({
                            ...prev,
                            meet_preference: option.value,
                          }))
                        }
                        style={({ pressed }) => [
                          styles.reasonChip,
                          selected ? styles.reasonChipActive : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text style={[styles.reasonText, selected ? styles.reasonTextActive : null]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <AppButton
                    title={actionLoading === 'mini-card' ? 'Sending…' : 'Send'}
                    onPress={shareMiniCard}
                    disabled={actionLoading === 'mini-card'}
                    variant="primary"
                    style={styles.flexButton}
                  />
                  <AppButton
                    title="Cancel"
                    onPress={() => setMiniCardVisible(false)}
                    disabled={actionLoading === 'mini-card'}
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
    borderColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
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
  noticeText: { color: colors.emerald, fontSize: 12, fontWeight: '700' },
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
    borderColor: colors.borderStrong,
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
  modalBackdrop: { flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', padding: 20 },
  modalFlex: { flex: 1 },
  modalCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  modalBody: { color: colors.muted, lineHeight: 18 },
  optionScroll: { maxHeight: 220 },
  optionScrollContent: { gap: 8, paddingBottom: 4 },
  optionCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  optionCardActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}16`,
  },
  optionLabel: { color: colors.text, fontWeight: '800', fontSize: 13 },
  optionText: { color: colors.text, fontWeight: '700', lineHeight: 18 },
  optionReason: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 88,
    maxHeight: 130,
    fontSize: 14,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  flexButton: { flex: 1 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});
