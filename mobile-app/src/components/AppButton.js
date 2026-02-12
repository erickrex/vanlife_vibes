import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { componentTokens, radius } from '../theme/tokens';

const VARIANTS = componentTokens.button.variants;

export default function AppButton({ title, onPress, disabled, variant = 'primary', style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.backgroundColor, borderColor: v.borderColor },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.title, { color: v.textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
