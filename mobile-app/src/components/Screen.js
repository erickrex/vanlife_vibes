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
        <View style={styles.ambientContour} />
        <View style={styles.ambientContourSecond} />
        <View style={styles.ambientContourThird} />
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
    top: -96,
    left: -90,
    right: -90,
    height: 270,
    backgroundColor: componentTokens.screen.ambientTop,
    borderRadius: 200,
  },
  ambientContour: {
    position: 'absolute',
    top: 90,
    left: -120,
    right: -120,
    height: 1,
    backgroundColor: componentTokens.screen.contour || colors.borderStrong,
    opacity: 0.28,
  },
  ambientContourSecond: {
    position: 'absolute',
    top: 134,
    left: -120,
    right: -90,
    height: 1,
    backgroundColor: componentTokens.screen.contour || colors.borderStrong,
    opacity: 0.18,
  },
  ambientContourThird: {
    position: 'absolute',
    top: 178,
    left: -140,
    right: -70,
    height: 1,
    backgroundColor: componentTokens.screen.contour || colors.borderStrong,
    opacity: 0.12,
  },
  ambientLeft: {
    position: 'absolute',
    left: -90,
    top: 240,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: componentTokens.screen.ambientLeft,
  },
  ambientRight: {
    position: 'absolute',
    right: -120,
    bottom: 46,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: componentTokens.screen.ambientRight,
  },
  inner: {
    flex: 1,
  },
});
