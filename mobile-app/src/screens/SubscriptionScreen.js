import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Screen from '../components/Screen';
import { subscriptionAPI } from '../services/api';
import { revenueCatClient } from '../services/revenuecat';
import { colors } from '../theme/colors';

const BENEFITS = [
  'Unlimited daily swipes',
  'Future-location matching boosts',
  'See who liked you',
  'Priority in discovery',
  'Advanced filters',
];

function formatRenewalDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SubscriptionScreen() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await subscriptionAPI.getStatus();
      setStatus(response.data?.data ?? response.data);
    } catch {
      setError('Failed to load subscription status.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOfferings = useCallback(async () => {
    setLoadingOfferings(true);
    try {
      const offerings = await revenueCatClient.getOfferings();
      const defaultPkg = offerings?.current?.availablePackages?.[0] ?? null;
      setPkg(defaultPkg);
    } catch {
      setPkg(null);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status && !status.is_premium) {
      fetchOfferings();
    }
  }, [status, fetchOfferings]);

  const handleManageSubscription = async () => {
    try {
      const url = await revenueCatClient.getManagementURL();
      if (url) {
        await Linking.openURL(url);
      } else {
        setError('Unable to open subscription settings. Please manage your subscription through your device settings.');
      }
    } catch {
      setError('Unable to open subscription settings. Please manage your subscription through your device settings.');
    }
  };

  const handleSubscribe = async () => {
    if (!pkg) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await revenueCatClient.purchase(pkg);
      if (result.success) {
        try {
          await subscriptionAPI.sync(result.customerInfo);
        } catch {
          // Non-blocking fallback: webhook may still update shortly after purchase.
        }
        fetchStatus();
      } else if (result.error === 'cancelled') {
        // User cancelled — do nothing
      } else {
        setPurchaseError(result.error || 'Purchase failed. Please try again.');
      }
    } catch {
      setPurchaseError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (error && !status) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchStatus} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const isPremium = status?.is_premium ?? false;
  const planName = status?.plan ?? 'free';
  const renewalDate = formatRenewalDate(status?.current_period_end);
  const priceLabel = pkg?.product?.priceString ?? null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        {isPremium ? (
          <View style={styles.section}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✦ Premium</Text>
            </View>
            <Text style={styles.planLabel}>
              {planName.charAt(0).toUpperCase() + planName.slice(1)} Plan
            </Text>
            {renewalDate && (
              <Text style={styles.renewalText}>Renews on {renewalDate}</Text>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              onPress={handleManageSubscription}
              style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
            >
              <Text style={styles.manageText}>Manage Subscription</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.subtitle}>
              Get the most out of VanlifeVibes with unlimited swipes and exclusive features.
            </Text>

            <View style={styles.benefitsList}>
              {BENEFITS.map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <Text style={styles.benefitCheck}>✦</Text>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            {loadingOfferings ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <>
                {priceLabel && (
                  <Text style={styles.price}>{priceLabel}/month</Text>
                )}

                {purchaseError && <Text style={styles.errorText}>{purchaseError}</Text>}

                <Pressable
                  onPress={handleSubscribe}
                  disabled={purchasing || !pkg}
                  style={({ pressed }) => [
                    styles.subscribeButton,
                    (purchasing || !pkg) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {purchasing ? (
                    <ActivityIndicator color={colors.primaryText} size="small" />
                  ) : (
                    <Text style={styles.subscribeText}>Subscribe to Premium</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 4,
  },
  badgeText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  planLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  renewalText: {
    color: colors.muted,
    fontSize: 14,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  benefitsList: {
    width: '100%',
    gap: 12,
    marginVertical: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitCheck: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  benefitText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  price: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  subscribeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  subscribeText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  manageButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  manageText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  retryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  loader: {
    marginVertical: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
