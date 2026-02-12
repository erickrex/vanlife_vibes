import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

function ListingCard({ item, onPress }) {
  const isOffering = item.listing_type === 'offering';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>{item.display_name || item.username}</Text>
        {item.city_name ? <Text style={styles.cardMeta}>📍 {item.city_name}</Text> : null}
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
      const premium = subRes?.data?.data?.is_premium ?? false;
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
            data={currentData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ListingCard item={item} onPress={() => navigation.navigate('BuilderListingDetail', { listing: item })} />
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
  list: { paddingTop: 6, paddingBottom: 12, gap: 10 },
  card: {
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card,
    borderRadius: radius.xl, padding: 14, gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  offeringBadge: { backgroundColor: `${colors.emerald}33`, color: colors.emerald },
  requestingBadge: { backgroundColor: `${colors.blue}33`, color: colors.blue },
  price: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  negotiable: { color: colors.muted, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cardDesc: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  errorText: { color: colors.danger, textAlign: 'center', fontWeight: '800' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  pressed: { opacity: 0.9 },
});
