import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

export default function SwipeCounter({ remainingSwipes, isPremium }) {
  if (isPremium) {
    return (
      <View style={[styles.container, styles.premiumContainer]}>
        <Text style={[styles.text, { color: colors.primary }]}>Premium ✦</Text>
      </View>
    );
  }

  if (remainingSwipes === null || remainingSwipes === undefined) {
    return null;
  }

  const atZero = remainingSwipes === 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, atZero && { color: colors.danger }]}>
        {remainingSwipes}/5 swipes left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
  },
  premiumContainer: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  text: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
});
