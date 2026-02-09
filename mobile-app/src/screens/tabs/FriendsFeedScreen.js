import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '../../components/AppButton';
import Screen from '../../components/Screen';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';

export default function FriendsFeedScreen() {
  const { profile, logout } = useAuth();

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.subtitle}>Feed migration placeholder (web: `FriendsPage`).</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed in as</Text>
          <Text style={styles.cardBody}>{profile?.display_name || '—'}</Text>
          <Text style={styles.cardMeta}>{profile?.now_in_city || '—'}</Text>
        </View>
        <AppButton title="Log out" variant="danger" onPress={logout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    marginTop: -8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardBody: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardMeta: {
    color: colors.muted,
  },
});

