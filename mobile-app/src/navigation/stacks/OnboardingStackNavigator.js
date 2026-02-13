import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingScreen from '../../screens/OnboardingScreen';
import SubscriptionScreen from '../../screens/SubscriptionScreen';
import { colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function OnboardingStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgElevated,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderStrong,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '900',
          letterSpacing: 0.2,
        },
        headerTintColor: colors.text,
        statusBarStyle: 'dark',
        statusBarTranslucent: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Onboarding' }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
    </Stack.Navigator>
  );
}
