import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabNavigator from '../tabs/MainTabNavigator';
import MatchesScreen from '../../screens/MatchesScreen';
import MatchChatScreen from '../../screens/MatchChatScreen';
import DiscoverySettingsScreen from '../../screens/DiscoverySettingsScreen';
import EventDetailScreen from '../../screens/EventDetailScreen';
import EventChatScreen from '../../screens/EventChatScreen';
import CreateEventScreen from '../../screens/CreateEventScreen';
import WelcomeScreen from '../../screens/WelcomeScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import ProfileEditScreen from '../../screens/ProfileEditScreen';
import SubscriptionScreen from '../../screens/SubscriptionScreen';
import { colors } from '../../theme/colors';

const Stack = createNativeStackNavigator();

export default function AppStackNavigator({ initialRouteName = 'Tabs' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
        statusBarStyle: 'light',
        statusBarTranslucent: false,
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Matches" component={MatchesScreen} options={{ title: 'Matches' }} />
      <Stack.Screen name="Chat" component={MatchChatScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
      <Stack.Screen name="EventChat" component={EventChatScreen} options={{ title: 'Group Chat' }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Create Event' }} />
      <Stack.Screen
        name="DiscoverySettings"
        component={DiscoverySettingsScreen}
        options={{ title: 'Discovery Settings' }}
      />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
    </Stack.Navigator>
  );
}
