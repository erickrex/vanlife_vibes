import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { componentTokens } from '../theme/tokens';

export default function Screen({ children, style }) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <View pointerEvents="none" style={styles.ambientWrap}>
        <View style={styles.ambientTop} />
        <View style={styles.ambientLeft} />
        <View style={styles.ambientRight} />
      </View>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  ambientWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientTop: {
    position: 'absolute',
    top: -40,
    left: -30,
    right: -30,
    height: 180,
    backgroundColor: componentTokens.screen.ambientTop,
    borderRadius: 120,
  },
  ambientLeft: {
    position: 'absolute',
    left: -90,
    top: 180,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: componentTokens.screen.ambientLeft,
  },
  ambientRight: {
    position: 'absolute',
    right: -100,
    bottom: 120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: componentTokens.screen.ambientRight,
  },
  inner: {
    flex: 1,
  },
});
