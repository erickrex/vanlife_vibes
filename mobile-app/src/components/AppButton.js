import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { componentTokens, radius } from '../theme/tokens';

const VARIANTS = componentTokens.button.variants;
const BUTTON_BASE = componentTokens.button.base || {};
const BUTTON_TEXT = componentTokens.button.text || {};

export default function AppButton({ title, onPress, disabled, variant = 'primary', style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isPrimary = v === VARIANTS.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        BUTTON_BASE,
        { backgroundColor: v.backgroundColor, borderColor: v.borderColor },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {isPrimary ? (
        <>
          <View pointerEvents="none" style={[styles.primaryTopGlow, { backgroundColor: v.topGlow || 'transparent' }]} />
          <View pointerEvents="none" style={[styles.primaryBottomGlow, { backgroundColor: v.bottomGlow || 'transparent' }]} />
        </>
      ) : null}
      <Text style={[styles.title, BUTTON_TEXT, { color: v.textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    zIndex: 1,
  },
  primaryTopGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
  },
  primaryBottomGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '44%',
  },
});
