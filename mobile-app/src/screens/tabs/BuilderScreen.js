import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import AppButton from '../../components/AppButton';
import PaywallModal from '../../components/PaywallModal';
import Screen from '../../components/Screen';
import { builderAPI, subscriptionAPI } from '../../services/api';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/tokens';
import { normalizeImageUrl } from '../../utils/imageUrl';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'electrical', label: '⚡ Electrical' },
  { value: 'plumbing', label: '🚿 Plumbing' },
  { value: 'carpentry', label: '🪚 Carpentry' },
  { value: 'mechanical', label: '🔧 Mechanical' },
  { value: 'painting', label: '🎨 Painting' },
  { value: 'insulation', label: '🧱 Insulation' },
  { value: 'solar', label: '☀️ Solar' },
  { value: 'general', label: '🛠️ General' },
];

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'offering', label: 'Offering Help' },
  { value: 'requesting', label: 'Need Help' },
];

const MARKETPLACE_BENEFITS = [
  'Browse builder listings by location relevance',
  'Post your own service or project request',
  'Message listing owners and helpers',
  'Plus 20 daily discovery swipes',
];

function ListingCard({ item, onPress }) {
  const isOffering = item.listing_type === 'offering';
  const categoryLabel = CATEGORIES.find((option) => option.value === item.category)?.label || '🛠️ General';
  const categoryEmoji = categoryLabel.split(' ')[0] || '🛠️';
  const normalizedPhotoUrl = useMemo(() => normalizeImageUrl(item?.photo_url || ''), [item?.photo_url]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!normalizedPhotoUrl && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
  }, [normalizedPhotoUrl]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.photoWrap}>
        {showPhoto ? (
          <Image
            source={{ uri: normalizedPhotoUrl }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoFallbackEmoji}>{categoryEmoji}</Text>
            <Text style={styles.photoFallbackText}>No photo</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.typeBadge, isOffering ? styles.offeringBadge : styles.requestingBadge]}>
            {isOffering ? 'Offering' : 'Requesting'}
          </Text>
          {item.price != null ? (
            <Text style={styles.price}>${Number(item.price).toFixed(0)}</Text>
          ) : (
            <Text style={styles.negotiable}>Negotiable</Text>
          )}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : (
          <Text style={styles.cardDescMuted} numberOfLines={2}>No description provided.</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta} numberOfLines={1}>{item.display_name || item.username}</Text>
          {item.city_name ? <Text style={styles.cardMeta} numberOfLines={1}>📍 {item.city_name}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function BuilderScreen() {
  const navigation = useNavigation();
  const [viewMode, setViewMode] = useState('browse'); // 'browse' | 'my-listings'
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPremium, setIsPremium] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialError, setTrialError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [category, setCategory] = useState('');
  const [listingType, setListingType] = useState('');

  const loadBrowse = useCallback(async () => {
    const params = {};
    if (category) params.category = category;
    if (listingType) params.listing_type = listingType;
    const res = await builderAPI.list(params);
    const data = res?.data?.results ?? res?.data ?? [];
    setListings(Array.isArray(data) ? data : []);
  }, [category, listingType]);

  const loadMyListings = useCallback(async () => {
    const res = await builderAPI.myListings();
    const data = res?.data?.data ?? res?.data?.results ?? res?.data ?? [];
    setMyListings(Array.isArray(data) ? data : []);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const subRes = await subscriptionAPI.getStatus();
      const subscriptionData = subRes?.data?.data ?? subRes?.data ?? {};
      const premium = subscriptionData?.is_premium ?? false;
      setSubscriptionStatus(subscriptionData);
      setIsPremium(premium);

      if (!premium) {
        setShowPaywall(true);
        setListings([]);
        setMyListings([]);
        return;
      }

      if (viewMode === 'browse') {
        await loadBrowse();
      } else {
        await loadMyListings();
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [viewMode, loadBrowse, loadMyListings]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleSubscribed = () => {
    setShowPaywall(false);
    setIsPremium(true);
    loadData();
  };

  const handleStartTrial = async () => {
    if (startingTrial) return;
    setStartingTrial(true);
    setTrialError('');
    try {
      await subscriptionAPI.startTrial();
      setShowPaywall(false);
      await loadData();
    } catch (trialErr) {
      setTrialError(trialErr.message || 'Unable to start free trial right now.');
    } finally {
      setStartingTrial(false);
    }
  };

  const currentData = viewMode === 'browse' ? listings : myListings;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Builder Marketplace</Text>
          <View style={styles.headerActions}>
            {isPremium ? (
              <AppButton title="+ Post" onPress={() => navigation.navigate('CreateBuilderListing')} variant="primary" />
            ) : null}
            <Pressable
              onPress={() => navigation.getParent()?.navigate('Profile')}
              style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <Text style={styles.profileIcon}>👤</Text>
            </Pressable>
          </View>
        </View>

        {/* View mode tabs */}
        <View style={styles.viewTabs}>
          <Pressable
            onPress={() => setViewMode('browse')}
            style={[styles.viewTab, viewMode === 'browse' && styles.viewTabActive]}
          >
            <Text style={[styles.viewTabText, viewMode === 'browse' && styles.viewTabTextActive]}>Browse</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('my-listings')}
            style={[styles.viewTab, viewMode === 'my-listings' && styles.viewTabActive]}
          >
            <Text style={[styles.viewTabText, viewMode === 'my-listings' && styles.viewTabTextActive]}>My Listings</Text>
          </Pressable>
        </View>

        {/* Filters (browse mode only) */}
        {viewMode === 'browse' ? (
          <>
            <View style={styles.typeTabs}>
              {TYPE_TABS.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setListingType(t.value)}
                  style={({ pressed }) => [
                    styles.typeTab,
                    listingType === t.value && styles.typeTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.typeTabText, listingType === t.value && styles.typeTabTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    category === c.value && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Content */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <AppButton title="Retry" onPress={loadData} variant="primary" />
          </View>
        ) : !isPremium ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Builder Marketplace is Premium</Text>
            <Text style={styles.emptyBody}>
              Upgrade to Premium to browse listings, post offers/requests, and message builders.
            </Text>
            {subscriptionStatus?.requires_billing_details ? (
              <Text style={styles.trialReminder}>
                Your trial has ended. Add billing details to keep Premium access.
              </Text>
            ) : null}
            <AppButton
              title={
                subscriptionStatus?.trial_used
                  ? '7-day Trial Used'
                  : (startingTrial ? 'Starting free trial…' : 'Start 7-day Free Trial')
              }
              onPress={handleStartTrial}
              disabled={startingTrial || !!subscriptionStatus?.trial_used}
              variant="secondary"
            />
            <AppButton title="Upgrade to Premium" onPress={() => setShowPaywall(true)} variant="primary" />
            {trialError ? <Text style={styles.errorText}>{trialError}</Text> : null}
            <Text style={styles.poweredBy}>Powered by RevenueCat</Text>
          </View>
        ) : currentData.length === 0 && isPremium ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>
              {viewMode === 'browse' ? 'No listings yet' : 'No listings posted'}
            </Text>
            <Text style={styles.emptyBody}>
              {viewMode === 'browse'
                ? 'Be the first to post a builder service or request.'
                : 'Post a listing to offer or request van build help.'}
            </Text>
            <AppButton title="Post a Listing" onPress={() => navigation.navigate('CreateBuilderListing')} variant="primary" />
          </View>
        ) : (
          <FlatList
            key={`builder-grid-${viewMode}`}
            data={currentData}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <View style={styles.cardCell}>
                <ListingCard item={item} onPress={() => navigation.navigate('BuilderListingDetail', { listing: item })} />
              </View>
            )}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={loadData}
          />
        )}
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribed={handleSubscribed}
        title="Unlock Builder Marketplace"
        subtitle="Builder is a Premium-only marketplace. Upgrade to browse listings, post your own, and chat with owners."
        benefits={MARKETPLACE_BENEFITS}
        ctaLabel="Upgrade to Premium"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.text, fontSize: 21, fontWeight: '900', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileButton: {
    borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: colors.surface, borderColor: colors.borderStrong,
  },
  profileIcon: { fontSize: 18 },
  viewTabs: { flexDirection: 'row', gap: 8 },
  viewTab: {
    flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panel,
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
  },
  viewTabActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}26` },
  viewTabText: { color: colors.muted, fontWeight: '900', fontSize: 13 },
  viewTabTextActive: { color: colors.primary },
  typeTabs: { flexDirection: 'row', gap: 8 },
  typeTab: {
    flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panel,
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
  },
  typeTabActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}26` },
  typeTabText: { color: colors.muted, fontWeight: '900', fontSize: 12 },
  typeTabTextActive: { color: colors.primary },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panel,
    borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}38` },
  chipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: colors.text },
  list: { paddingTop: 6, paddingBottom: 16, gap: 10 },
  gridRow: { gap: 10, marginBottom: 10 },
  cardCell: { flex: 1, maxWidth: '49%' },
  card: {
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card,
    borderRadius: radius.xl, overflow: 'hidden',
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: colors.panel,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoFallbackEmoji: { fontSize: 26 },
  photoFallbackText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  cardBody: {
    padding: 12,
    gap: 7,
    minHeight: 152,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  offeringBadge: { backgroundColor: `${colors.emerald}33`, color: colors.emerald },
  requestingBadge: { backgroundColor: `${colors.blue}33`, color: colors.blue },
  price: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  negotiable: { color: colors.muted, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  cardDesc: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  cardDescMuted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cardFooter: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginTop: 4 },
  cardMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  errorText: { color: colors.danger, textAlign: 'center', fontWeight: '800' },
  trialReminder: { color: colors.danger, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  poweredBy: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  pressed: { opacity: 0.9 },
});
