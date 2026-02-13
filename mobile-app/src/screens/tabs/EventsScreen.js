import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import AppButton from '../../components/AppButton';
import DatePickerField from '../../components/DatePickerField';
import EventSwipeDeck from '../../components/EventSwipeDeck';
import Screen from '../../components/Screen';
import { eventsAPI } from '../../services/api';
import { colors } from '../../theme/colors';
import { componentTokens, radius } from '../../theme/tokens';
import {
  EVENT_STATUS,
  EVENT_TYPES,
  formatEventDate,
  getEventTypeEmoji,
  getEventTypeInfo,
  getTimeWindowEmoji,
  getTimeWindowInfo,
} from '../../utils/events';

const FILTER_BAR = componentTokens.filter?.bar || {};
const FILTER_ACTIVE = componentTokens.filter?.active || {};
const CARD_SHELL = componentTokens.card?.shell || {};

function normalizeListResponse(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function ModeTab({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.modeTab, active ? styles.modeTabActive : null, pressed ? styles.pressed : null]}>
      <Text style={[styles.modeTabText, active ? styles.modeTabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function EventRow({ event, onPress }) {
  const typeInfo = getEventTypeInfo(event?.event_type);
  const typeEmoji = getEventTypeEmoji(event?.event_type);
  const timeInfo = getTimeWindowInfo(event?.time_window);
  const timeEmoji = getTimeWindowEmoji(event?.time_window);
  const attendeeCount = event?.attendee_count || 0;
  const spotsRemaining = event?.spots_remaining ?? Math.max((event?.spots || 0) - attendeeCount, 0);
  const status = EVENT_STATUS[event?.status]?.label || event?.status || 'open';
  const isHosted = !!event?.is_platform_hosted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCard,
        isHosted ? styles.eventCardHosted : null,
        pressed ? styles.eventCardPressed : null,
      ]}
    >
      <View style={styles.eventCardHeader}>
        <View style={styles.eventTypeWrap}>
          <Text style={styles.eventType}>{`${typeEmoji} ${typeInfo.label}`}</Text>
          {isHosted ? (
            <Text style={styles.hostedBadge}>Vanlife Vibes Host</Text>
          ) : null}
        </View>
        <Text style={styles.eventStatus}>{status}</Text>
      </View>

      <Text style={styles.eventTitle} numberOfLines={2}>
        {event?.title || 'Event'}
      </Text>

      <View style={styles.eventMeta}>
        <Text style={styles.eventMetaText}>{`📅 ${formatEventDate(event?.event_date)}`}</Text>
        <Text style={styles.eventMetaText}>{`${timeEmoji} ${timeInfo.label}`}</Text>
        <Text style={styles.eventMetaText}>{`📍 ${event?.location || 'Location TBD'}`}</Text>
        <Text style={styles.eventMetaText}>{`👥 ${attendeeCount}/${event?.spots || 0} (${spotsRemaining} left)`}</Text>
      </View>

      {event?.description ? (
        <Text style={styles.eventDescription} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function EventsScreen() {
  const navigation = useNavigation();

  const [joinMode, setJoinMode] = useState('direct');
  const [directViewMode, setDirectViewMode] = useState('browse');
  const [swipeViewMode, setSwipeViewMode] = useState('discover');

  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [myMatches, setMyMatches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    event_type: '',
    date: '',
    location: '',
  });
  const [exhausted, setExhausted] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return Boolean(filters.event_type || filters.date || filters.location);
  }, [filters.date, filters.event_type, filters.location]);

  const shouldShowFilterToggle = useMemo(() => {
    if (joinMode === 'direct') return directViewMode === 'browse';
    return swipeViewMode === 'discover';
  }, [directViewMode, joinMode, swipeViewMode]);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setExhausted(false);

      const params = { join_mode: joinMode };
      if (filters.event_type) params.event_type = filters.event_type;
      if (filters.date) {
        params.from_date = filters.date;
        params.to_date = filters.date;
      }
      if (filters.location) params.location = filters.location;

      const response = await eventsAPI.list(params);
      setEvents(normalizeListResponse(response));
    } catch (err) {
      setError(err.message || 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filters.date, filters.event_type, filters.location, joinMode]);

  const loadMyEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await eventsAPI.getMyEvents();
      const list = normalizeListResponse(response);
      setMyEvents(list.filter((event) => event.join_mode === joinMode));
    } catch (err) {
      setError(err.message || 'Failed to load your events');
      setMyEvents([]);
    } finally {
      setLoading(false);
    }
  }, [joinMode]);

  const loadMyMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await eventsAPI.getMyMatches();
      setMyMatches(normalizeListResponse(response));
    } catch (err) {
      setError(err.message || 'Failed to load your matched events');
      setMyMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentView = useCallback(async () => {
    if (joinMode === 'direct') {
      if (directViewMode === 'browse') {
        await loadEvents();
      } else {
        await loadMyEvents();
      }
      return;
    }

    if (swipeViewMode === 'discover') {
      await loadEvents();
      return;
    }
    if (swipeViewMode === 'my-events') {
      await loadMyEvents();
      return;
    }
    await loadMyMatches();
  }, [directViewMode, joinMode, loadEvents, loadMyEvents, loadMyMatches, swipeViewMode]);

  useFocusEffect(
    useCallback(() => {
      loadCurrentView();
    }, [loadCurrentView]),
  );

  const openCreate = () => {
    navigation.navigate('CreateEvent', { joinMode });
  };

  const openDetail = (eventId) => {
    navigation.navigate('EventDetail', { eventId });
  };

  const openChat = (eventId) => {
    navigation.navigate('EventChat', { eventId });
  };

  const onFilterChange = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
  };

  const clearFilters = () => {
    setFilters({ event_type: '', date: '', location: '' });
  };

  const applyFilters = () => {
    loadEvents();
  };

  const handleSwipe = useCallback(async (direction, event, payload) => {
    if (payload?.error) {
      setError(payload.error);
      setNotice('');
      await loadEvents();
      return;
    }

    const title = event?.title || 'event';
    setError('');
    setNotice(direction === 'right' ? `Liked ${title}.` : `Passed ${title}.`);
  }, [loadEvents]);

  const handleMatch = useCallback(async (event) => {
    const title = event?.title || 'Event';
    setNotice(`${title} is matched. Group chat is now available.`);
    try {
      const response = await eventsAPI.getMyMatches();
      setMyMatches(normalizeListResponse(response));
    } catch {
      // Non-blocking best-effort refresh.
    }
  }, []);

  const listData = useMemo(() => {
    if (joinMode === 'direct') {
      return directViewMode === 'browse' ? events : myEvents;
    }
    if (swipeViewMode === 'discover') return events;
    if (swipeViewMode === 'my-events') return myEvents;
    return myMatches;
  }, [directViewMode, events, joinMode, myEvents, myMatches, swipeViewMode]);

  const emptyMessage = useMemo(() => {
    if (joinMode === 'direct' && directViewMode === 'browse') {
      if (hasActiveFilters) return 'No events match your filters.';
      return 'No direct-join events nearby right now.';
    }
    if (joinMode === 'direct' && directViewMode === 'my-events') {
      return 'You have not joined or created direct events yet.';
    }
    if (joinMode === 'swipe' && swipeViewMode === 'discover') {
      if (exhausted) return 'No more swipe events in your queue.';
      if (hasActiveFilters) return 'No swipe events match your filters.';
      return 'No swipe events nearby right now.';
    }
    if (joinMode === 'swipe' && swipeViewMode === 'my-events') {
      return 'You have not created or joined swipe events yet.';
    }
    return 'You do not have matched swipe events yet.';
  }, [directViewMode, exhausted, hasActiveFilters, joinMode, swipeViewMode]);

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Campfire</Text>
        </View>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Profile')}
          style={({ pressed }) => [styles.profileButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={styles.profileIcon}>👤</Text>
        </Pressable>
      </View>

      <View style={styles.headerActionRow}>
        {shouldShowFilterToggle ? (
          <Pressable
            onPress={() => setShowFilters((prev) => !prev)}
            style={({ pressed }) => [
              styles.iconButton,
              showFilters || hasActiveFilters ? styles.iconButtonActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.iconButtonText}>Filters</Text>
          </Pressable>
        ) : null}
        <AppButton title="Create" onPress={openCreate} variant="primary" style={styles.createButton} />
      </View>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filters}>
      <Text style={styles.filterLabel}>Event type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
        <Pressable
          onPress={() => onFilterChange('event_type', '')}
          style={({ pressed }) => [styles.typeChip, filters.event_type === '' ? styles.typeChipActive : null, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.typeChipText, filters.event_type === '' ? styles.typeChipTextActive : null]}>Any</Text>
        </Pressable>
        {Object.values(EVENT_TYPES).map((type) => (
          <Pressable
            key={type.value}
            onPress={() => onFilterChange('event_type', type.value)}
            style={({ pressed }) => [
              styles.typeChip,
              filters.event_type === type.value ? styles.typeChipActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.typeChipText, filters.event_type === type.value ? styles.typeChipTextActive : null]}>
              {`${getEventTypeEmoji(type.value)} ${type.label}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <DatePickerField
        label="Date (YYYY-MM-DD)"
        value={filters.date}
        onChange={(value) => onFilterChange('date', value)}
        placeholder="Any date"
        clearable
      />

      <Text style={styles.filterLabel}>Location</Text>
      <TextInput
        value={filters.location}
        onChangeText={(value) => onFilterChange('location', value)}
        placeholder="Search by location"
        placeholderTextColor={colors.muted}
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
      />

      <View style={styles.filterActions}>
        {hasActiveFilters ? <AppButton title="Clear" onPress={clearFilters} variant="secondary" style={styles.actionFlex} /> : null}
        <AppButton title="Apply" onPress={applyFilters} variant="primary" style={styles.actionFlex} />
      </View>
    </View>
  );

  const renderSubTabs = () => {
    if (joinMode === 'direct') {
      return (
        <View style={styles.subTabs}>
          <ModeTab label="Browse" active={directViewMode === 'browse'} onPress={() => setDirectViewMode('browse')} />
          <ModeTab label="My Events" active={directViewMode === 'my-events'} onPress={() => setDirectViewMode('my-events')} />
        </View>
      );
    }

    return (
      <View style={styles.subTabs}>
        <ModeTab label="Discover" active={swipeViewMode === 'discover'} onPress={() => setSwipeViewMode('discover')} />
        <ModeTab label="My Events" active={swipeViewMode === 'my-events'} onPress={() => setSwipeViewMode('my-events')} />
        <ModeTab label="Joined" active={swipeViewMode === 'my-matches'} onPress={() => setSwipeViewMode('my-matches')} />
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.loadingText}>Loading events…</Text>
        </View>
      );
    }

    if (error && listData.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Try Again" onPress={loadCurrentView} variant="primary" />
        </View>
      );
    }

    if (joinMode === 'swipe' && swipeViewMode === 'discover' && listData.length > 0 && !exhausted) {
      return (
        <View style={styles.deckWrap}>
          <EventSwipeDeck
            events={listData}
            onSwipe={handleSwipe}
            onMatch={handleMatch}
            onEmpty={() => setExhausted(true)}
            onOpenEvent={openDetail}
            onOpenChat={openChat}
          />
        </View>
      );
    }

    if (listData.length === 0 || exhausted) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No events found</Text>
          <Text style={styles.emptyBody}>{emptyMessage}</Text>
          <View style={styles.emptyActions}>
            {hasActiveFilters ? <AppButton title="Clear Filters" onPress={clearFilters} variant="secondary" /> : null}
            {exhausted ? <AppButton title="Refresh Queue" onPress={loadEvents} variant="secondary" /> : null}
            <AppButton title="Create Event" onPress={openCreate} variant="primary" />
          </View>
        </View>
      );
    }

    return (
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        refreshing={loading}
        onRefresh={loadCurrentView}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <EventRow event={item} onPress={() => openDetail(item.id)} />}
      />
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {renderHeader()}

          <View style={styles.joinTabs}>
            <ModeTab label="Direct Join" active={joinMode === 'direct'} onPress={() => setJoinMode('direct')} />
            <ModeTab label="Swipe to Join" active={joinMode === 'swipe'} onPress={() => setJoinMode('swipe')} />
          </View>

          {renderSubTabs()}
          {shouldShowFilterToggle && showFilters ? renderFilters() : null}

          {error && listData.length > 0 ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          {notice ? (
            <Pressable onPress={() => setNotice('')} style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{notice}</Text>
            </Pressable>
          ) : null}

          {renderContent()}

          <Pressable onPress={loadCurrentView} style={styles.refreshLink} disabled={loading}>
            <Text style={styles.refreshText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
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
  headerSection: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButton: {
    minWidth: 116,
  },
  profileButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 11,
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
    ...FILTER_BAR,
  },
  profileIcon: {
    fontSize: 18,
  },
  iconButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    minHeight: 42,
    paddingVertical: 9,
    paddingHorizontal: 12,
    justifyContent: 'center',
    ...FILTER_BAR,
  },
  iconButtonActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: `${colors.primary}24`,
    ...FILTER_ACTIVE,
  },
  iconButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  joinTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  subTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...FILTER_BAR,
  },
  modeTabActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: `${colors.primary}24`,
    ...FILTER_ACTIVE,
  },
  modeTabText: {
    color: colors.muted,
    fontWeight: '900',
    fontSize: 12,
  },
  modeTabTextActive: {
    color: colors.text,
  },
  filters: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
    ...CARD_SHELL,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  typeRow: {
    gap: 8,
    paddingVertical: 4,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...FILTER_BAR,
  },
  typeChipActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: `${colors.primary}28`,
    ...FILTER_ACTIVE,
  },
  typeChipText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  typeChipTextActive: {
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionFlex: {
    flex: 1,
  },
  banner: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 14,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  noticeBanner: {
    borderWidth: 1,
    borderColor: `${colors.emerald}66`,
    backgroundColor: `${colors.emerald}18`,
    padding: 12,
    borderRadius: 14,
  },
  noticeText: {
    color: colors.emerald,
    fontSize: 13,
    fontWeight: '700',
  },
  deckWrap: {
    flex: 1,
    paddingTop: 4,
  },
  list: {
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
    ...CARD_SHELL,
  },
  eventCardHosted: {
    borderColor: colors.blue,
    backgroundColor: `${colors.blue}22`,
  },
  eventCardPressed: {
    opacity: 0.9,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 8,
  },
  eventType: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 12,
  },
  hostedBadge: {
    color: colors.blue,
    borderWidth: 1,
    borderColor: `${colors.blue}88`,
    backgroundColor: `${colors.blue}1f`,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  eventStatus: {
    color: colors.muted,
    textTransform: 'capitalize',
    fontWeight: '800',
    fontSize: 12,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  eventMeta: {
    gap: 3,
  },
  eventMetaText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  eventDescription: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
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
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  refreshLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  refreshText: {
    color: colors.muted,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
  },
});
