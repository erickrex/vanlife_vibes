import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import AppButton from '../components/AppButton';
import ProfileAvatar from '../components/ProfileAvatar';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI, discoveryAPI, eventsAPI } from '../services/api';
import { colors } from '../theme/colors';
import { formatEventDate, getEventTypeEmoji, getEventTypeInfo } from '../utils/events';
import { buildCompatibilityChips } from '../utils/compatibility';

function getResponseList(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function getPrimaryTab(profile) {
  if (profile?.looking_for_dating) return 'Dating';
  if (profile?.looking_for_friends) return 'Feed';
  return 'Feed';
}

function PeopleCard({ person, currentProfile, onPress }) {
  const chips = useMemo(() => buildCompatibilityChips(currentProfile, person, 3), [currentProfile, person]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.itemCard, pressed ? styles.pressed : null]}>
      <View style={styles.personHead}>
        <ProfileAvatar uri={person?.avatar_url} name={person?.display_name} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{person?.display_name || 'Anonymous'}</Text>
          <Text style={styles.itemMeta}>
            {person?.mode === 'dating' ? 'Dating' : 'Friends'}
            {person?.now_in_city ? ` · ${person.now_in_city}` : ''}
          </Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={`${person?.id}-${chip}`} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function EventCard({ event, onOpen, ctaLabel }) {
  const eventTypeInfo = getEventTypeInfo(event?.event_type);
  const eventTypeEmoji = getEventTypeEmoji(event?.event_type);

  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemTitle}>{event?.title || 'Event'}</Text>
      <Text style={styles.itemMeta}>{`${eventTypeEmoji} ${eventTypeInfo.label}`}</Text>
      <Text style={styles.itemMeta}>{`📅 ${formatEventDate(event?.event_date)} · 📍 ${event?.location || 'TBD'}`}</Text>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.linkButton, pressed ? styles.pressed : null]}>
        <Text style={styles.linkButtonText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [people, setPeople] = useState([]);
  const [activity, setActivity] = useState(null);
  const [plan, setPlan] = useState(null);
  const trackedRef = useRef(false);

  const primaryTab = useMemo(() => getPrimaryTab(profile), [profile]);

  const trackEvent = useCallback((eventName, metadata = {}) => {
    analyticsAPI
      .trackEvent(eventName, {
        page: 'welcome',
        ...metadata,
      })
      .catch(() => {});
  }, []);

  const loadRecommendations = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const requests = [];
      if (profile.looking_for_dating) requests.push(discoveryAPI.getDatingProfiles());
      if (profile.looking_for_friends) requests.push(discoveryAPI.getFriendsProfiles());
      requests.push(eventsAPI.list({ join_mode: 'swipe' }));
      requests.push(eventsAPI.list({ join_mode: 'direct' }));

      const results = await Promise.allSettled(requests);
      let index = 0;

      const peopleCandidates = [];
      if (profile.looking_for_dating) {
        const datingResult = results[index++];
        if (datingResult.status === 'fulfilled') {
          getResponseList(datingResult.value).forEach((candidate) => {
            peopleCandidates.push({ ...candidate, mode: 'dating' });
          });
        }
      }
      if (profile.looking_for_friends) {
        const friendsResult = results[index++];
        if (friendsResult.status === 'fulfilled') {
          getResponseList(friendsResult.value).forEach((candidate) => {
            peopleCandidates.push({ ...candidate, mode: 'friends' });
          });
        }
      }

      const swipeEventsResult = results[index++];
      const directEventsResult = results[index++];

      const uniquePeople = [];
      const seen = new Set();
      peopleCandidates.forEach((candidate) => {
        const candidateId = String(candidate?.id || '');
        if (!candidateId || seen.has(candidateId)) return;
        seen.add(candidateId);
        if (uniquePeople.length < 3) uniquePeople.push(candidate);
      });
      setPeople(uniquePeople);

      if (swipeEventsResult.status === 'fulfilled') {
        const activityEvents = getResponseList(swipeEventsResult.value);
        setActivity(activityEvents[0] || null);
      } else {
        setActivity(null);
      }

      if (directEventsResult.status === 'fulfilled') {
        const planEvents = getResponseList(directEventsResult.value);
        setPlan(planEvents[0] || null);
      } else {
        setPlan(null);
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    if (!profile?.id || trackedRef.current) return;
    trackedRef.current = true;
    trackEvent('welcome_viewed', {
      looking_for_dating: !!profile.looking_for_dating,
      looking_for_friends: !!profile.looking_for_friends,
    });
  }, [profile?.id, profile?.looking_for_dating, profile?.looking_for_friends, trackEvent]);

  const openTab = (tabName) => {
    navigation.navigate('Tabs', { screen: tabName });
  };

  const openPrimaryDiscovery = () => {
    openTab(primaryTab);
  };

  const openMatches = () => {
    navigation.navigate('Matches');
  };

  const openBrowseEvents = () => {
    openTab('Campfire');
  };

  const openCreateEvent = () => {
    navigation.navigate('CreateEvent', { joinMode: 'direct' });
  };

  const handleStart = () => {
    trackEvent('welcome_start_swiping', { destination_tab: primaryTab.toLowerCase() });
    openPrimaryDiscovery();
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.loadingText}>Preparing your recommendations…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Your first roadmap</Text>
          <Text style={styles.heroTitle}>You are ready to connect</Text>
          <Text style={styles.heroBody}>
            Start with high-fit people, one activity, and one meetup plan.
          </Text>
          <View style={styles.heroActions}>
            <AppButton title="Start Swiping" onPress={handleStart} variant="primary" style={styles.flexButton} />
            <AppButton title="Open Feed" onPress={() => openTab('Feed')} variant="secondary" style={styles.flexButton} />
          </View>
        </View>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top People</Text>
          {people.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No profiles are available right now. Open discovery or check your matches.
              </Text>
              <View style={styles.inlineActions}>
                <AppButton title={primaryTab === 'Dating' ? 'Open Dating' : 'Find Friends'} onPress={openPrimaryDiscovery} variant="primary" />
                <AppButton title="View Matches" onPress={openMatches} variant="secondary" />
              </View>
            </View>
          ) : (
            people.map((person) => (
              <PeopleCard
                key={person.id}
                person={person}
                currentProfile={profile}
                onPress={() => navigation.navigate('Profile', { profileId: person.id })}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>One Activity To Join</Text>
          {activity ? (
            <EventCard
              event={activity}
              onOpen={() => navigation.navigate('EventDetail', { eventId: activity.id })}
              ctaLabel="Open Activity"
            />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No swipe-mode activities right now.</Text>
              <View style={styles.inlineActions}>
                <AppButton title="Browse Events" onPress={openBrowseEvents} variant="secondary" />
                <AppButton title="Create Event" onPress={openCreateEvent} variant="primary" />
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>One Plan To Join</Text>
          {plan ? (
            <EventCard
              event={plan}
              onOpen={() => navigation.navigate('EventDetail', { eventId: plan.id })}
              ctaLabel="Open Plan"
            />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No direct-join plans right now.</Text>
              <View style={styles.inlineActions}>
                <AppButton title="Browse Events" onPress={openBrowseEvents} variant="secondary" />
                <AppButton title="Create Event" onPress={openCreateEvent} variant="primary" />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    paddingBottom: 26,
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
  hero: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  heroEyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  heroBody: {
    color: colors.muted,
    lineHeight: 19,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
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
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  personHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  linkButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  linkButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 18,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pressed: {
    opacity: 0.9,
  },
});
