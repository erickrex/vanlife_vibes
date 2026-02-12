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
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
        statusBarStyle: 'light',
        statusBarTranslucent: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Onboarding' }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
    </Stack.Navigator>
  );
}
