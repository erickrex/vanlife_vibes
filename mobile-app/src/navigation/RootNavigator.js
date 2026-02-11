import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import AuthStackNavigator from './stacks/AuthStackNavigator';
import AppStackNavigator from './stacks/AppStackNavigator';
import OnboardingStackNavigator from './stacks/OnboardingStackNavigator';
import { colors } from '../theme/colors';

function FullScreenLoading({ label = 'Loading…' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.muted} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, loading, profile, profileLoading } = useAuth();
  const previousNeedsOnboardingRef = useRef(null);
  const [showWelcomeAfterOnboarding, setShowWelcomeAfterOnboarding] = useState(false);
  const needsOnboarding = !!profile && !profile.has_completed_onboarding;

  useEffect(() => {
    if (isAuthenticated) return;
    previousNeedsOnboardingRef.current = null;
    setShowWelcomeAfterOnboarding(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const previousNeedsOnboarding = previousNeedsOnboardingRef.current;
    if (previousNeedsOnboarding === true && needsOnboarding === false) {
      setShowWelcomeAfterOnboarding(true);
    }
    previousNeedsOnboardingRef.current = needsOnboarding;
  }, [isAuthenticated, needsOnboarding]);

  useEffect(() => {
    if (!showWelcomeAfterOnboarding) return undefined;
    const timeout = setTimeout(() => {
      setShowWelcomeAfterOnboarding(false);
    }, 0);
    return () => clearTimeout(timeout);
  }, [showWelcomeAfterOnboarding]);

  if (loading || (isAuthenticated && profileLoading && !profile)) {
    return <FullScreenLoading label="Starting up…" />;
  }

  if (!isAuthenticated) {
    return <AuthStackNavigator />;
  }

  if (needsOnboarding) {
    return <OnboardingStackNavigator />;
  }

  return (
    <AppStackNavigator
      initialRouteName={showWelcomeAfterOnboarding ? 'Welcome' : 'Tabs'}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
});
