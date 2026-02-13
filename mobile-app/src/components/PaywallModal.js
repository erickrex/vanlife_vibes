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
import { radius } from '../theme/tokens';

const BENEFITS = [
  '20 daily swipes',
  'See who liked you',
  'Priority in discovery',
  'Advanced filters',
];

export default function PaywallModal({
  visible,
  onClose,
  onSubscribed,
  title = "You've hit your daily limit",
  subtitle = 'Free accounts get 5 swipes per day. Upgrade to Premium for 20 swipes per day.',
  benefits = BENEFITS,
  showTrialCta = true,
  trialCtaLabel = 'Start 7-day free trial',
  ctaLabel = 'Subscribe to Premium',
  dismissLabel = 'Not now',
  poweredByLabel = 'Powered by RevenueCat',
}) {
  const [pkg, setPkg] = useState(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [requiresBillingDetails, setRequiresBillingDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingTrial, setStartingTrial] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);

  const fetchOfferings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [offerings, statusRes] = await Promise.all([
        revenueCatClient.getOfferings(),
        subscriptionAPI.getStatus().catch(() => null),
      ]);
      const defaultPkg = offerings?.current?.availablePackages?.[0] ?? null;
      const statusData = statusRes?.data?.data ?? statusRes?.data ?? {};
      setPkg(defaultPkg);
      setTrialUsed(!!statusData?.trial_used);
      setRequiresBillingDetails(!!statusData?.requires_billing_details);
    } catch {
      setPkg(null);
      setTrialUsed(false);
      setRequiresBillingDetails(false);
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
          // Non-blocking fallback
        }
        onSubscribed?.();
        onClose?.();
      } else if (result.error === 'cancelled') {
        // User dismissed — keep paywall open
      } else {
        setError(result.error || 'Purchase failed. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleStartTrial = async () => {
    if (trialUsed) {
      setError('Free trial already used. Subscribe to keep Premium access.');
      return;
    }
    setStartingTrial(true);
    setError(null);
    try {
      const response = await subscriptionAPI.startTrial();
      const statusData = response?.data?.data ?? response?.data ?? {};
      if (statusData?.is_premium) {
        setTrialUsed(true);
        setRequiresBillingDetails(!!statusData?.requires_billing_details);
        onSubscribed?.(statusData);
        onClose?.();
      } else {
        setError('Unable to start free trial right now.');
      }
    } catch (trialErr) {
      setError(trialErr.message || 'Unable to start free trial right now.');
    } finally {
      setStartingTrial(false);
    }
  };

  const priceLabel = pkg?.product?.priceString ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.benefitsList}>
            {benefits.map((b) => (
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
              {requiresBillingDetails ? (
                <Text style={styles.reminder}>
                  Your trial ended. Add billing details to continue Premium.
                </Text>
              ) : null}

              {showTrialCta ? (
                <Pressable
                  onPress={handleStartTrial}
                  disabled={startingTrial || purchasing || trialUsed}
                  style={({ pressed }) => [
                    styles.trialButton,
                    (startingTrial || purchasing || trialUsed) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {startingTrial ? (
                    <ActivityIndicator color={colors.primaryText} size="small" />
                  ) : (
                    <Text style={styles.trialText}>
                      {trialUsed ? '7-day Trial Used' : trialCtaLabel}
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleSubscribe}
                disabled={purchasing || startingTrial || !pkg}
                style={({ pressed }) => [
                  styles.subscribeButton,
                  showTrialCta ? styles.subscribeButtonSecondary : null,
                  (purchasing || startingTrial || !pkg) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                {purchasing ? (
                  <ActivityIndicator color={showTrialCta ? colors.text : colors.primaryText} size="small" />
                ) : (
                  <Text style={[styles.subscribeText, showTrialCta ? styles.subscribeTextSecondary : null]}>
                    {ctaLabel}
                  </Text>
                )}
              </Pressable>
              <Text style={styles.poweredBy}>{poweredByLabel}</Text>
            </>
          )}

          <Pressable onPress={onClose} style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}>
            <Text style={styles.dismissText}>{dismissLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
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
  reminder: {
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  loader: {
    marginVertical: 12,
  },
  trialButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  subscribeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonSecondary: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  subscribeText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  subscribeTextSecondary: {
    color: colors.text,
  },
  poweredBy: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
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
