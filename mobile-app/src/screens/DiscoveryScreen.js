import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import DiscoveryFilters from '../components/DiscoveryFilters';
import DiscoverySwipeDeck from '../components/DiscoverySwipeDeck';
import PaywallModal from '../components/PaywallModal';
import SwipeCounter from '../components/SwipeCounter';
import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { discoveryAPI, matchesAPI, profilesAPI } from '../services/api';
import { colors } from '../theme/colors';

function normalizeListResponse(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.profiles && Array.isArray(data.profiles)) return data.profiles;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function extractSubscriptionMeta(response) {
  const data = response?.data?.data ?? response?.data;
  return {
    remainingSwipes: data?.remaining_swipes ?? null,
    isPremium: data?.is_premium ?? false,
  };
}

export default function DiscoveryScreen({ mode = 'dating' }) {
  const navigation = useNavigation();
  const { profile: currentProfile } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [enabled, setEnabled] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [remainingSwipes, setRemainingSwipes] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const filtersRef = useRef(filters);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const accent = mode === 'dating' ? colors.rose : colors.blue;
  const title = mode === 'dating' ? 'Dating' : 'Friends';
  const icon = mode === 'dating' ? '💕' : '🤝';
  const subtitle = mode === 'dating' ? 'Swipe right to like, left to pass.' : 'Swipe right to connect, left to pass.';

  const loadMatchCount = useCallback(async () => {
    try {
      const response = await matchesAPI.list();
      const matchList = normalizeListResponse(response);
      setMatchCount(matchList.filter((match) => match.mode === mode).length);
    } catch {
      // Keep previous count.
    }
  }, [mode]);

  const checkEnabled = useCallback(async () => {
    try {
      const response = await profilesAPI.getMyProfile();
      const data = response?.data?.data ?? response?.data;
      const isEnabled = mode === 'dating' ? data?.looking_for_dating === true : data?.looking_for_friends === true;
      setEnabled(isEnabled);
    } catch {
      setEnabled(false);
    }
  }, [mode]);

  const loadProfiles = useCallback(async (overrideFilters) => {
    const requestId = ++loadRequestIdRef.current;
    try {
      setLoading(true);
      setError('');
      setExhausted(false);

      const applied = overrideFilters ?? filtersRef.current ?? {};
      const params = {};
      if (applied.travel_pace) params.travel_pace = applied.travel_pace;
      if (applied.profile_type) params.profile_type = applied.profile_type;
      if (applied.pet_compatible) params.pet_compatible = applied.pet_compatible;

      const response =
        mode === 'dating' ? await discoveryAPI.getDatingProfiles(params) : await discoveryAPI.getFriendsProfiles(params);
      const list = normalizeListResponse(response);
      if (requestId !== loadRequestIdRef.current) return;
      setProfiles(list);

      const meta = extractSubscriptionMeta(response);
      if (meta.remainingSwipes !== null) setRemainingSwipes(meta.remainingSwipes);
      setIsPremium(meta.isPremium);
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(err.message || 'Failed to load profiles');
      setProfiles([]);
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
    }
  }, [mode]);

  const bootstrap = useCallback(async () => {
    await Promise.all([checkEnabled(), loadMatchCount()]);
    await loadProfiles();
  }, [checkEnabled, loadMatchCount, loadProfiles]);

  useFocusEffect(
    useCallback(() => {
      bootstrap();
    }, [bootstrap]),
  );

  const headerMatchesLabel = useMemo(() => {
    if (matchCount > 99) return '99+';
    return String(matchCount);
  }, [matchCount]);

  const handleNavigateToChat = (matchId) => {
    navigation.navigate('Chat', { matchId });
  };

  const handleMatch = () => {
    loadMatchCount();
  };

  const openMatches = () => {
    navigation.navigate('Matches', { initialFilter: mode });
  };

  const handleFilterChange = (nextFilters) => {
    setFilters(nextFilters);
    loadProfiles(nextFilters);
  };

  const handleSwipe = useCallback((direction, profile, data) => {
    if (data?.error) {
      // Detect swipe limit 403 — the backend message contains "swipe limit"
      if (typeof data.error === 'string' && data.error.toLowerCase().includes('swipe limit')) {
        setRemainingSwipes(0);
        setPaywallVisible(true);
      }
      return;
    }
    if (data?.remaining_swipes !== undefined) {
      setRemainingSwipes(data.remaining_swipes);
    }
    if (data?.is_premium !== undefined) {
      setIsPremium(data.is_premium);
    }
  }, []);

  const handleSubscribed = useCallback(() => {
    setPaywallVisible(false);
    setIsPremium(true);
    setRemainingSwipes(null);
    loadProfiles();
  }, [loadProfiles]);

  const swipesDisabled = remainingSwipes === 0 && !isPremium;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: accent }]}>{mode === 'dating' ? 'DISCOVERY' : 'COMMUNITY'}</Text>
            <Text style={styles.headerTitle}>
              {title} <Text style={{ color: accent }}>{icon}</Text>
            </Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
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

        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setFiltersOpen((prev) => !prev)}
            style={({ pressed }) => [styles.toolbarButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Toggle filters"
          >
            <Text style={styles.toolbarIcon}>🔎</Text>
            <Text style={styles.toolbarText}>{filtersOpen ? 'Hide Filters' : 'Filters'}</Text>
          </Pressable>
          <Pressable
            onPress={openMatches}
            style={({ pressed }) => [styles.matchesButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Open matches"
          >
            <Text style={[styles.matchesIcon, { color: accent }]}>{mode === 'dating' ? '💌' : '💬'}</Text>
            <Text style={styles.matchesText}>Matches</Text>
            <View style={[styles.matchesBadge, { backgroundColor: accent }]}>
              <Text style={styles.matchesBadgeText}>{headerMatchesLabel}</Text>
            </View>
          </Pressable>
          <SwipeCounter remainingSwipes={remainingSwipes} isPremium={isPremium} />
        </View>

        {loading && enabled === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.muted} />
            <Text style={styles.loadingText}>Preparing your queue…</Text>
          </View>
        ) : null}

        {enabled === false ? (
          <View style={styles.center}>
            <Text style={styles.disabledTitle}>{`Enable ${title} to start swiping`}</Text>
            <Text style={styles.disabledBody}>
              {mode === 'dating'
                ? 'You have not enabled dating in your profile yet. Turn it on to discover people looking for romantic connections.'
                : 'You have not enabled friends discovery yet. Turn it on to meet other nomads and build travel connections.'}
            </Text>
            <AppButton
              title={`Enable ${title}`}
              onPress={() => navigation.navigate('DiscoverySettings', { focusMode: mode })}
              variant="primary"
            />
          </View>
        ) : null}

        {enabled !== false ? (
          <>
            {filtersOpen ? (
              <DiscoveryFilters
                mode={mode}
                filters={filters}
                onFilterChange={handleFilterChange}
                disabled={loading}
                showHeader={false}
              />
            ) : null}

            {error && profiles.length > 0 ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{error}</Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.muted} />
                <Text style={styles.loadingText}>Finding people…</Text>
              </View>
            ) : null}

            {!loading && error && profiles.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <AppButton title="Try Again" onPress={loadProfiles} variant="primary" />
              </View>
            ) : null}

            {!loading && !error && (profiles.length === 0 || exhausted) ? (
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>{mode === 'dating' ? '💔' : '🤷'}</Text>
                <Text style={styles.disabledTitle}>{exhausted ? 'No more profiles' : 'No profiles found'}</Text>
                <Text style={styles.disabledBody}>
                  {exhausted ? 'That’s everyone in your queue for now.' : 'Check back later, or loosen your filters.'}
                </Text>
                <AppButton title="Refresh" onPress={loadProfiles} variant="primary" />
              </View>
            ) : null}

            {!loading && profiles.length > 0 && !exhausted ? (
              <View style={styles.deckWrap}>
                <DiscoverySwipeDeck
                  profiles={profiles}
                  mode={mode}
                  currentProfile={currentProfile}
                  accentColor={accent}
                  onMatch={handleMatch}
                  onSwipe={handleSwipe}
                  onNavigateToChat={handleNavigateToChat}
                  onEmpty={() => setExhausted(true)}
                  swipesDisabled={swipesDisabled}
                  onSwipeLimitReached={() => setPaywallVisible(true)}
                />
              </View>
            ) : null}
          </>
        ) : null}

        <Pressable onPress={bootstrap} style={styles.refreshLink} disabled={loading} accessibilityRole="button">
          <Text style={styles.refreshText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSubscribed={handleSubscribed}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerSubtitle: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 14,
  },
  profileButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#14161c',
    borderColor: '#2a2e37',
  },
  profileIcon: {
    fontSize: 18,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: '#151821',
    borderColor: '#2c3240',
  },
  toolbarIcon: {
    fontSize: 14,
  },
  toolbarText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  matchesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: '#151821',
    borderColor: '#2c3240',
  },
  matchesIcon: {
    fontSize: 14,
  },
  matchesText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  matchesBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchesBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  deckWrap: {
    flex: 1,
    paddingTop: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
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
  errorText: {
    color: colors.danger,
    fontWeight: '800',
    textAlign: 'center',
  },
  disabledTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  disabledBody: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  refreshLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  refreshText: {
    color: colors.muted,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
  },
});
