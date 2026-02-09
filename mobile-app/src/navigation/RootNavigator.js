import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import AuthStackNavigator from './stacks/AuthStackNavigator';
import OnboardingStackNavigator from './stacks/OnboardingStackNavigator';
import MainTabNavigator from './tabs/MainTabNavigator';
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

  if (loading || (isAuthenticated && profileLoading)) {
    return <FullScreenLoading label="Starting up…" />;
  }

  if (!isAuthenticated) {
    return <AuthStackNavigator />;
  }

  const needsOnboarding = !!profile && !profile.has_completed_onboarding;
  if (needsOnboarding) {
    return <OnboardingStackNavigator />;
  }

  return <MainTabNavigator />;
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

