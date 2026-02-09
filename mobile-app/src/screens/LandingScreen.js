import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import { colors } from '../theme/colors';

export default function LandingScreen({ navigation }) {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.kicker}>VanlifeVibes · Connect with nomads</Text>
        <Text style={styles.title}>Find your tribe on the road</Text>
        <Text style={styles.body}>
          Discover who is nearby, plan meetups, and build lasting friendships with people who share your love for life
          on the road.
        </Text>

        <View style={styles.actions}>
          <AppButton title="Get Started" onPress={() => navigation.navigate('Signup')} />
          <AppButton title="Sign In" variant="secondary" onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  actions: {
    gap: 12,
  },
});

