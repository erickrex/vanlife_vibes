import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

const CATEGORY_EMOJI = {
  electrical: '⚡', plumbing: '🚿', carpentry: '🪚', mechanical: '🔧',
  painting: '🎨', insulation: '🧱', solar: '☀️', general: '🛠️',
};

export default function BuilderListingDetailScreen() {
  const navigation = useNavigation();
  const { listing } = useRoute().params;
  const { user } = useAuth();
  const isOffering = listing.listing_type === 'offering';
  const emoji = CATEGORY_EMOJI[listing.category] || '🛠️';
  const isOwner = user?.id === listing.user_id;

  const openChat = () => {
    navigation.navigate('BuilderChat', {
      listingId: listing.id,
      listingTitle: listing.title,
      listingOwnerUserId: listing.user_id,
      recipientId: null, // inquirer → owner; backend resolves recipient
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.typeBadge, isOffering ? styles.offeringBadge : styles.requestingBadge]}>
            {isOffering ? 'Offering Help' : 'Requesting Help'}
          </Text>
          <Text style={styles.category}>{emoji} {listing.category}</Text>
        </View>

        <Text style={styles.title}>{listing.title}</Text>

        {listing.price != null ? (
          <Text style={styles.price}>${Number(listing.price).toFixed(0)}</Text>
        ) : (
          <Text style={styles.negotiable}>Price negotiable</Text>
        )}

        {listing.description ? (
          <Text style={styles.description}>{listing.description}</Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.sellerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(listing.display_name || listing.username || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sellerName}>{listing.display_name || listing.username}</Text>
            {listing.city_name ? <Text style={styles.sellerLocation}>📍 {listing.city_name}</Text> : null}
          </View>
        </View>

        {!isOwner ? (
          <AppButton
            title={isOffering ? 'Message Builder' : 'Offer Your Help'}
            onPress={openChat}
            variant="primary"
          />
        ) : (
          <AppButton
            title="View Conversations"
            onPress={() => navigation.navigate('BuilderChat', {
              listingId: listing.id,
              listingTitle: listing.title,
              listingOwnerUserId: listing.user_id,
              recipientId: null,
            })}
            variant="secondary"
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: {
    fontSize: 12, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, overflow: 'hidden',
  },
  offeringBadge: { backgroundColor: `${colors.emerald}33`, color: colors.emerald },
  requestingBadge: { backgroundColor: `${colors.blue}33`, color: colors.blue },
  category: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  price: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  negotiable: { color: colors.muted, fontSize: 16, fontWeight: '700', fontStyle: 'italic' },
  description: { color: colors.secondary, fontSize: 15, lineHeight: 22 },
  divider: { height: 1, backgroundColor: colors.borderStrong, marginVertical: 4 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sellerName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sellerLocation: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
