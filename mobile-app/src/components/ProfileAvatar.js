import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

function initialsForName(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  const raw = `${first}${last}` || first;
  return raw.toUpperCase().slice(0, 2);
}

export default function ProfileAvatar({ uri, name, size = 44, style }) {
  const initials = useMemo(() => initialsForName(name), [name]);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, dimension, style]}
        accessibilityLabel={name ? `${name} avatar` : 'Profile avatar'}
      />
    );
  }

  return (
    <View style={[styles.fallback, dimension, style]} accessibilityLabel={name ? `${name} avatar` : 'Profile avatar'}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surface,
  },
  fallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.muted,
    fontWeight: '900',
  },
});
