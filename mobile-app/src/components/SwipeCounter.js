import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export default function SwipeCounter({ remainingSwipes, isPremium }) {
  if (isPremium) {
    return (
      <View style={[styles.container, styles.premiumContainer]}>
        <Text style={[styles.text, { color: colors.primary }]}>Premium ✦</Text>
      </View>
    );
  }

  // Don't render until we have data from the API
  if (remainingSwipes === null || remainingSwipes === undefined) {
    return null;
  }

  const atZero = remainingSwipes === 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, atZero && { color: colors.danger }]}>
        {remainingSwipes}/3 swipes left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: '#151821',
    borderColor: '#2c3240',
  },
  premiumContainer: {
    borderColor: colors.primary,
  },
  text: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
});
