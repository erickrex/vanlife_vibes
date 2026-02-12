import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { profilesAPI } from '../services/api';
import { colors } from '../theme/colors';

function ToggleRow({ label, value, onChange, color = colors.primary, disabled = false, helper }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.toggle,
        { borderColor: value ? color : colors.borderStrong, backgroundColor: value ? `${color}22` : colors.panel },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.toggleLabel, { color: value ? colors.text : colors.muted }]}>{label}</Text>
        {helper ? <Text style={styles.toggleHelper}>{helper}</Text> : null}
      </View>
      <Text style={[styles.toggleValue, { color: value ? color : colors.muted }]}>{value ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}

export default function DiscoverySettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile, refreshProfile } = useAuth();

  const focusMode = route.params?.focusMode;

  const [lookingForFriends, setLookingForFriends] = useState(true);
  const [lookingForDating, setLookingForDating] = useState(false);
  const [interestedInMen, setInterestedInMen] = useState(false);
  const [interestedInWomen, setInterestedInWomen] = useState(false);
  const [interestedInNonbinary, setInterestedInNonbinary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLookingForFriends(profile?.looking_for_friends !== false);
    setLookingForDating(!!profile?.looking_for_dating);
    setInterestedInMen(!!profile?.interested_in_men);
    setInterestedInWomen(!!profile?.interested_in_women);
    setInterestedInNonbinary(!!profile?.interested_in_nonbinary);
  }, [profile]);

  const accent = useMemo(() => {
    return focusMode === 'friends' ? colors.blue : colors.rose;
  }, [focusMode]);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      await profilesAPI.updateMyProfile({
        looking_for_friends: !!lookingForFriends,
        looking_for_dating: !!lookingForDating,
        interested_in_men: !!interestedInMen,
        interested_in_women: !!interestedInWomen,
        interested_in_nonbinary: !!interestedInNonbinary,
      });
      await refreshProfile();
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Discovery Settings</Text>
        <Text style={styles.subtitle}>Control whether you show up in Dating and Friends discovery.</Text>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Intent</Text>
          <ToggleRow
            label="Friends discovery"
            value={lookingForFriends}
            onChange={setLookingForFriends}
            color={colors.blue}
            disabled={saving}
            helper="Swipe to connect with other travelers."
          />
          <ToggleRow
            label="Dating discovery"
            value={lookingForDating}
            onChange={setLookingForDating}
            color={colors.rose}
            disabled={saving}
            helper="Swipe to find romantic connections."
          />
        </View>

        {lookingForDating ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dating preferences</Text>
            <ToggleRow
              label="Interested in men"
              value={interestedInMen}
              onChange={setInterestedInMen}
              color={accent}
              disabled={saving}
            />
            <ToggleRow
              label="Interested in women"
              value={interestedInWomen}
              onChange={setInterestedInWomen}
              color={accent}
              disabled={saving}
            />
            <ToggleRow
              label="Interested in non-binary"
              value={interestedInNonbinary}
              onChange={setInterestedInNonbinary}
              color={accent}
              disabled={saving}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} variant="primary" />
        </View>
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
  banner: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 14,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  toggle: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  toggleHelper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  toggleValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
