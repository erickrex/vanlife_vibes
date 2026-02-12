import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import DatingScreen from '../../screens/tabs/DatingScreen';
import EventsScreen from '../../screens/tabs/EventsScreen';
import FriendsFeedScreen from '../../screens/tabs/FriendsFeedScreen';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator();

const iconForRoute = (routeName, focused) => {
  if (routeName === 'Feed') return focused ? '🧭' : '🧭';
  if (routeName === 'Dating') return focused ? '💕' : '♡';
  if (routeName === 'Campfire') return focused ? '🔥' : '🗓️';
  return '•';
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
        },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused, color }) => (
          <Text style={{ fontSize: 18, color }}>{iconForRoute(route.name, focused)}</Text>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FriendsFeedScreen} options={{ title: 'Friends' }} />
      <Tab.Screen name="Dating" component={DatingScreen} options={{ title: 'Dating' }} />
      <Tab.Screen name="Campfire" component={EventsScreen} options={{ title: 'Campfire' }} />
    </Tab.Navigator>
  );
}
