import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

export default function LandingScreen({ navigation }) {
  const highlights = [
    {
      emoji: '📍',
      title: 'Location-Based Discovery',
      body: 'See who is in your area now, next week, or next month and connect when paths cross.',
    },
    {
      emoji: '🚐',
      title: 'Show Off Your Rig',
      body: 'Share your van build, RV setup, and travel style with people who get this lifestyle.',
    },
    {
      emoji: '👋',
      title: 'Friends and Dating',
      body: 'Set your preferences and discover nomads for friendship, dating, or both.',
    },
  ];

  const whyCards = [
    {
      title: 'Built for Nomads',
      body: 'Location timing, travel pace, and camping preferences matter here.',
    },
    {
      title: 'Privacy First',
      body: 'Control who sees your profile and location, and share at your comfort level.',
    },
    {
      title: 'Real Connections',
      body: 'No algorithmic content feed. Just real travelers and real meetup opportunities.',
    },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>VanlifeVibes · Connect with nomads</Text>
          <Text style={styles.title}>Find your tribe on the road</Text>
          <Text style={styles.body}>
            Discover who is nearby, plan meetups, and build lasting friendships with people who share your love for
            life on the road.
          </Text>

          <View style={styles.actions}>
            <AppButton title="Get Started" onPress={() => navigation.navigate('Signup')} />
            <AppButton title="Sign In" variant="secondary" onPress={() => navigation.navigate('Login')} />
          </View>
        </View>

        <View style={styles.section}>
          {highlights.map((item) => (
            <View key={item.title} style={styles.card}>
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.whySection}>
          <Text style={styles.whyTitle}>Why VanlifeVibes?</Text>
          {whyCards.map((item) => (
            <View key={item.title} style={styles.whyCard}>
              <Text style={styles.whyCardTitle}>{item.title}</Text>
              <Text style={styles.whyCardBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  hero: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 },
  kicker: { color: colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 12 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 22 },
  actions: { gap: 12 },
  section: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardEmoji: { fontSize: 24, width: 30, textAlign: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  whySection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    marginTop: 20,
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  whyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  whyCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
  },
  whyCardTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  whyCardBody: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
