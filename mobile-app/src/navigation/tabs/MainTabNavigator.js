import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import DatingScreen from '../../screens/tabs/DatingScreen';
import EventsScreen from '../../screens/tabs/EventsScreen';
import FriendsFeedScreen from '../../screens/tabs/FriendsFeedScreen';
import BuilderScreen from '../../screens/tabs/BuilderScreen';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator();

const iconForRoute = (routeName, focused) => {
  if (routeName === 'Feed') return focused ? '🧭' : '🧭';
  if (routeName === 'Dating') return focused ? '💕' : '♡';
  if (routeName === 'Campfire') return focused ? '🔥' : '🗓️';
  if (routeName === 'Builder') return focused ? '🔧' : '🔧';
  return '•';
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
          shadowColor: colors.rose,
          shadowOpacity: 0.16,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.3,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarIcon: ({ focused, color }) => (
          <Text style={{ fontSize: 17, color }}>{iconForRoute(route.name, focused)}</Text>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FriendsFeedScreen} options={{ title: 'Friends' }} />
      <Tab.Screen name="Dating" component={DatingScreen} options={{ title: 'Dating' }} />
      <Tab.Screen name="Campfire" component={EventsScreen} options={{ title: 'Campfire' }} />
      <Tab.Screen name="Builder" component={BuilderScreen} options={{ title: 'Marketplace' }} />
    </Tab.Navigator>
  );
}
