import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { revenueCatClient } from '../services/revenuecat';
import { subscriptionAPI } from '../services/api';
import { colors } from '../theme/colors';

const BENEFITS = [
  'Unlimited daily swipes',
  'See who liked you',
  'Priority in discovery',
  'Advanced filters',
];

export default function PaywallModal({ visible, onClose, onSubscribed }) {
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);

  const fetchOfferings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offerings = await revenueCatClient.getOfferings();
      const defaultPkg = offerings?.current?.availablePackages?.[0] ?? null;
      setPkg(defaultPkg);
    } catch {
      setPkg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchOfferings();
    }
  }, [visible, fetchOfferings]);

  const handleSubscribe = async () => {
    if (!pkg) return;
    setPurchasing(true);
    setError(null);
    try {
      const result = await revenueCatClient.purchase(pkg);
      if (result.success) {
        try {
          await subscriptionAPI.sync(result.customerInfo);
        } catch {
          // Non-blocking fallback: webhook may still update shortly after purchase.
        }
        onSubscribed?.();
        onClose?.();
      } else if (result.error === 'cancelled') {
        // User dismissed the billing sheet — keep paywall open so they can retry
      } else {
        setError(result.error || 'Purchase failed. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const priceLabel = pkg?.product?.priceString ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>You've hit your daily limit</Text>
          <Text style={styles.subtitle}>
            Free accounts get 3 swipes per day. Upgrade to Premium for unlimited access.
          </Text>

          <View style={styles.benefitsList}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <Text style={styles.benefitCheck}>✦</Text>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <>
              {priceLabel ? (
                <Text style={styles.price}>{priceLabel}/month</Text>
              ) : (
                <Text style={styles.noPlan}>No plans available</Text>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

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
                  <ActivityIndicator color="#001018" size="small" />
                ) : (
                  <Text style={styles.subscribeText}>Subscribe to Premium</Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable onPress={onClose} style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}>
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
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
    gap: 10,
    marginVertical: 6,
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
    fontSize: 14,
    fontWeight: '600',
  },
  price: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  noPlan: {
    color: colors.muted,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  loader: {
    marginVertical: 12,
  },
  subscribeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeText: {
    color: '#001018',
    fontSize: 16,
    fontWeight: '900',
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
