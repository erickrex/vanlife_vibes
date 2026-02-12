import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';

import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import { eventsAPI } from '../services/api';
import { colors } from '../theme/colors';
import {
  EVENT_TYPE_CATEGORIES,
  EVENT_TYPES,
  JOIN_MODES,
  TIME_WINDOWS,
  getEventTypeEmoji,
  getTimeWindowEmoji,
} from '../utils/events';

function normalizeEvent(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function isValidDateFormat(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const headerHeight = useHeaderHeight();
  const initialJoinMode = route.params?.joinMode === 'swipe' ? 'swipe' : 'direct';

  const [formData, setFormData] = useState({
    join_mode: initialJoinMode,
    event_type: '',
    title: '',
    description: '',
    image_url: '',
    event_date: '',
    time_window: 'flexible',
    location: '',
    spots: 6,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const accent = useMemo(
    () => (formData.join_mode === 'swipe' ? colors.emerald : colors.blue),
    [formData.join_mode],
  );

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const nextErrors = { ...errors };
      delete nextErrors[field];
      setErrors(nextErrors);
    }
    if (error) setError('');
  };

  const updateSpots = (delta) => {
    updateField('spots', Math.max(2, Math.min(20, Number(formData.spots || 2) + delta)));
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.join_mode) nextErrors.join_mode = 'Choose a join mode.';
    if (!formData.event_type) nextErrors.event_type = 'Choose an event type.';

    const title = formData.title.trim();
    if (!title) nextErrors.title = 'Title is required.';
    if (title.length > 100) nextErrors.title = 'Title must be 100 characters or fewer.';

    if (!formData.event_date) {
      nextErrors.event_date = 'Date is required.';
    } else if (!isValidDateFormat(formData.event_date)) {
      nextErrors.event_date = 'Use YYYY-MM-DD format.';
    } else {
      const selectedDate = new Date(`${formData.event_date}T00:00:00`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (Number.isNaN(selectedDate.getTime())) {
        nextErrors.event_date = 'Enter a valid date.';
      } else if (selectedDate < today) {
        nextErrors.event_date = 'Date cannot be in the past.';
      }
    }

    if (!formData.time_window) nextErrors.time_window = 'Choose a time window.';

    const location = formData.location.trim();
    if (!location) nextErrors.location = 'Location is required.';
    if (location.length > 100) nextErrors.location = 'Location must be 100 characters or fewer.';

    const spots = Number(formData.spots);
    if (!Number.isInteger(spots) || spots < 2 || spots > 20) {
      nextErrors.spots = 'Spots must be between 2 and 20.';
    }

    if (formData.description.length > 500) {
      nextErrors.description = 'Description must be 500 characters or fewer.';
    }

    if (formData.image_url.trim()) {
      try {
        new URL(formData.image_url.trim());
      } catch {
        nextErrors.image_url = 'Image URL must be valid.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (saving) return;
    if (!validate()) return;

    try {
      setSaving(true);
      setError('');

      const payload = {
        join_mode: formData.join_mode,
        event_type: formData.event_type,
        title: formData.title.trim(),
        description: formData.description.trim(),
        image_url: formData.image_url.trim() || null,
        event_date: formData.event_date.trim(),
        time_window: formData.time_window,
        location: formData.location.trim(),
        spots: Number(formData.spots),
      };

      const response = await eventsAPI.create(payload);
      const createdEvent = normalizeEvent(response);
      if (!createdEvent?.id) {
        throw new Error('Event created, but no event id was returned.');
      }

      navigation.replace('EventDetail', { eventId: createdEvent.id });
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Join mode</Text>
            <View style={styles.joinModeRow}>
              {JOIN_MODES.map((mode) => {
                const selected = formData.join_mode === mode.value;
                return (
                  <Pressable
                    key={mode.value}
                    onPress={() => updateField('join_mode', mode.value)}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.joinModeCard,
                      selected ? { borderColor: accent, backgroundColor: `${accent}22` } : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={[styles.joinModeTitle, selected ? styles.textStrong : null]}>{mode.label}</Text>
                    <Text style={styles.joinModeHelp}>{mode.description}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.join_mode ? <Text style={styles.errorField}>{errors.join_mode}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Event type</Text>
            {EVENT_TYPE_CATEGORIES.map((category) => (
              <View key={category.name} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>{category.name}</Text>
                <View style={styles.typeRow}>
                  {category.types.map((type) => {
                    const info = EVENT_TYPES[type];
                    const selected = formData.event_type === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => {
                          updateField('event_type', type);
                          if (!formData.title.trim()) {
                            updateField('title', info?.label || type);
                          }
                        }}
                        disabled={saving}
                        style={({ pressed }) => [
                          styles.typeChip,
                          selected ? { borderColor: accent, backgroundColor: `${accent}22` } : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text style={[styles.typeText, selected ? styles.textStrong : null]}>
                          {`${getEventTypeEmoji(type)} ${info?.label || type}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {errors.event_type ? <Text style={styles.errorField}>{errors.event_type}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Details</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              value={formData.title}
              onChangeText={(value) => updateField('title', value)}
              placeholder="Sunset campfire in town"
              placeholderTextColor={colors.muted}
              style={[styles.input, errors.title ? styles.inputError : null]}
              maxLength={100}
              editable={!saving}
            />
            {errors.title ? <Text style={styles.errorField}>{errors.title}</Text> : null}

            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              value={formData.event_date}
              onChangeText={(value) => updateField('event_date', value)}
              placeholder="2026-02-10"
              placeholderTextColor={colors.muted}
              style={[styles.input, errors.event_date ? styles.inputError : null]}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
            />
            {errors.event_date ? <Text style={styles.errorField}>{errors.event_date}</Text> : null}

            <Text style={styles.label}>Time window</Text>
            <View style={styles.timeWindowRow}>
              {Object.entries(TIME_WINDOWS).map(([value, info]) => {
                const selected = formData.time_window === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => updateField('time_window', value)}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.timeChip,
                      selected ? { borderColor: accent, backgroundColor: `${accent}22` } : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={[styles.typeText, selected ? styles.textStrong : null]}>
                      {`${getTimeWindowEmoji(value)} ${info.label}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.time_window ? <Text style={styles.errorField}>{errors.time_window}</Text> : null}

            <Text style={styles.label}>Location</Text>
            <TextInput
              value={formData.location}
              onChangeText={(value) => updateField('location', value)}
              placeholder="Austin, TX"
              placeholderTextColor={colors.muted}
              style={[styles.input, errors.location ? styles.inputError : null]}
              editable={!saving}
            />
            {errors.location ? <Text style={styles.errorField}>{errors.location}</Text> : null}

            <Text style={styles.label}>Spots</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => updateSpots(-1)}
                disabled={saving || Number(formData.spots) <= 2}
                style={({ pressed }) => [
                  styles.stepButton,
                  (saving || Number(formData.spots) <= 2) ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.stepButtonText}>−</Text>
              </Pressable>
              <View style={styles.spotsValue}>
                <Text style={styles.spotsValueText}>{Number(formData.spots)}</Text>
              </View>
              <Pressable
                onPress={() => updateSpots(1)}
                disabled={saving || Number(formData.spots) >= 20}
                style={({ pressed }) => [
                  styles.stepButton,
                  (saving || Number(formData.spots) >= 20) ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>
            {errors.spots ? <Text style={styles.errorField}>{errors.spots}</Text> : null}

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              value={formData.description}
              onChangeText={(value) => updateField('description', value)}
              placeholder="Share meetup details and what people should bring."
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textArea, errors.description ? styles.inputError : null]}
              maxLength={500}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
            <Text style={styles.metaText}>{`${formData.description.length}/500`}</Text>
            {errors.description ? <Text style={styles.errorField}>{errors.description}</Text> : null}

            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput
              value={formData.image_url}
              onChangeText={(value) => updateField('image_url', value)}
              placeholder="https://example.com/photo.jpg"
              placeholderTextColor={colors.muted}
              style={[styles.input, errors.image_url ? styles.inputError : null]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!saving}
            />
            {errors.image_url ? <Text style={styles.errorField}>{errors.image_url}</Text> : null}
          </View>

          <View style={styles.actions}>
            <AppButton
              title={saving ? 'Creating…' : 'Create Event'}
              onPress={submit}
              disabled={saving}
              variant="primary"
            />
            <AppButton
              title="Cancel"
              onPress={() => navigation.goBack()}
              disabled={saving}
              variant="secondary"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
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
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  joinModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  joinModeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  joinModeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  joinModeHelp: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  categoryBlock: {
    gap: 6,
  },
  categoryTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  typeText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  textStrong: {
    color: colors.text,
  },
  label: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputError: {
    borderColor: colors.dangerBorder,
  },
  textArea: {
    minHeight: 94,
  },
  timeWindowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 20,
  },
  spotsValue: {
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  spotsValueText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  errorField: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    gap: 10,
    marginTop: 2,
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
});
