import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

const VARIANTS = {
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    textColor: '#001018',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    textColor: colors.text,
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor: colors.danger,
    textColor: colors.danger,
  },
};

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
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});

