import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '../components/AppButton';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { profilesAPI } from '../services/api';
import { colors } from '../theme/colors';

function PromptPicker({ label, prompts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => prompts.find((p) => p.prompt_name === value) || null, [prompts, value]);

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.picker}>
        <Text style={styles.pickerText} numberOfLines={2}>
          {selected ? selected.prompt_question : 'Choose a prompt…'}
        </Text>
        <Text style={styles.pickerChevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Screen style={{ backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick a prompt</Text>
            <Pressable onPress={() => setOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={prompts}
            keyExtractor={(item) => item.prompt_name}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.prompt_name);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.promptRow, pressed ? styles.promptRowPressed : null]}
              >
                <Text style={styles.promptQuestion}>{item.prompt_question}</Text>
                <Text style={styles.promptMeta}>{item.prompt_type}</Text>
              </Pressable>
            )}
          />
        </Screen>
      </Modal>
    </View>
  );
}

function Toggle({ label, value, onChange, color = colors.primary }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.toggle,
        { borderColor: value ? color : colors.border, backgroundColor: value ? `${color}22` : colors.panel },
        pressed ? styles.togglePressed : null,
      ]}
    >
      <Text style={[styles.toggleLabel, { color: value ? colors.text : colors.muted }]}>{label}</Text>
      <Text style={[styles.toggleValue, { color: value ? color : colors.muted }]}>{value ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}

function SegmentedOption({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        selected ? styles.segmentSelected : null,
        pressed ? styles.segmentPressed : null,
      ]}
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [prompts, setPrompts] = useState([]);

  const [lookingForFriends, setLookingForFriends] = useState(true);
  const [lookingForDating, setLookingForDating] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('');
  const [nowInCity, setNowInCity] = useState('');
  const [prompt1, setPrompt1] = useState('');
  const [prompt1Answer, setPrompt1Answer] = useState('');
  const [prompt2, setPrompt2] = useState('');
  const [prompt2Answer, setPrompt2Answer] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const [profileRes, promptRes] = await Promise.all([
          profilesAPI.getMyProfile(),
          profilesAPI.getAvailablePrompts(),
        ]);

        if (!mounted) return;
        const profileData = profileRes.data.data || profileRes.data;
        const promptsData = promptRes.data.data || promptRes.data || [];

        setPrompts(Array.isArray(promptsData) ? promptsData : []);
        setDisplayName(profileData.display_name || '');
        setGender(profileData.gender || '');
        setNowInCity(profileData.now_in_city || '');
        setLookingForDating(!!profileData.looking_for_dating);
        setLookingForFriends(profileData.looking_for_friends !== false);
      } catch (err) {
        setError(err.message || 'Failed to load onboarding data');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (!displayName.trim()) return false;
    if (!gender) return false;
    if (!nowInCity.trim()) return false;
    if (!lookingForDating && !lookingForFriends) return false;
    if (!prompt1 || !prompt1Answer.trim()) return false;
    if (!prompt2 || !prompt2Answer.trim()) return false;
    if (prompt1 === prompt2) return false;
    return true;
  }, [displayName, gender, lookingForDating, lookingForFriends, nowInCity, prompt1, prompt1Answer, prompt2, prompt2Answer]);

  const handleFinish = async () => {
    setError('');
    if (!canSubmit) {
      setError('Please complete all required fields.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        display_name: displayName.trim(),
        gender,
        now_in_city: nowInCity.trim(),
        looking_for_dating: !!lookingForDating,
        looking_for_friends: !!lookingForFriends,
        has_completed_onboarding: true,
      };

      await profilesAPI.updateMyProfile(payload);
      await profilesAPI.createPrompt({ prompt_name: prompt1, prompt_answer: prompt1Answer.trim() });
      await profilesAPI.createPrompt({ prompt_name: prompt2, prompt_answer: prompt2Answer.trim() });
      await refreshProfile();
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.loadingText}>Preparing onboarding…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Let’s set up the basics so you can start connecting.</Text>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Intent</Text>
          <Text style={styles.sectionSubtitle}>Tell us what you’re here for.</Text>
          <View style={{ gap: 10 }}>
            <Toggle label="Friends" value={lookingForFriends} onChange={setLookingForFriends} color={colors.blue} />
            <Toggle label="Dating" value={lookingForDating} onChange={setLookingForDating} color={colors.rose} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basics</Text>
          <FormTextInput
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What should people call you?"
            autoCapitalize="words"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Gender</Text>
          <View style={styles.segmentRow}>
            <SegmentedOption label="Man" selected={gender === 'man'} onPress={() => setGender('man')} />
            <SegmentedOption label="Woman" selected={gender === 'woman'} onPress={() => setGender('woman')} />
            <SegmentedOption
              label="Non-binary"
              selected={gender === 'non_binary'}
              onPress={() => setGender('non_binary')}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.sectionSubtitle}>Where are you right now?</Text>
          <FormTextInput
            label="Current city"
            value={nowInCity}
            onChangeText={setNowInCity}
            placeholder="e.g. Flagstaff, AZ"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Prompts</Text>
          <Text style={styles.sectionSubtitle}>Pick two prompts to stand out.</Text>

          <PromptPicker label="Prompt 1" prompts={prompts} value={prompt1} onChange={setPrompt1} />
          <FormTextInput
            label="Answer 1"
            value={prompt1Answer}
            onChangeText={setPrompt1Answer}
            placeholder="Your answer"
            autoCapitalize="sentences"
          />

          <View style={{ height: 10 }} />

          <PromptPicker label="Prompt 2" prompts={prompts} value={prompt2} onChange={setPrompt2} />
          <FormTextInput
            label="Answer 2"
            value={prompt2Answer}
            onChangeText={setPrompt2Answer}
            placeholder="Your answer"
            autoCapitalize="sentences"
          />

          {prompt1 && prompt2 && prompt1 === prompt2 ? (
            <Text style={styles.inlineError}>Choose two different prompts.</Text>
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <AppButton
            title={saving ? 'Saving…' : 'Finish'}
            onPress={handleFinish}
            disabled={!canSubmit || saving}
            variant="primary"
          />
          <Text style={styles.smallPrint}>
            Profile id: {profile?.id || '—'} · You can edit more details later.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    marginTop: -6,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: -8,
  },
  label: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '700',
  },
  banner: {
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 14,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 14,
  },
  segmentPressed: {
    opacity: 0.9,
  },
  segmentSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: colors.text,
  },
  toggle: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  togglePressed: {
    opacity: 0.9,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  toggleValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pickerText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerChevron: {
    color: colors.muted,
    fontWeight: '900',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  modalClose: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  modalCloseText: {
    color: colors.muted,
    fontWeight: '700',
  },
  modalList: {
    padding: 20,
    gap: 10,
  },
  promptRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  promptRowPressed: {
    opacity: 0.9,
  },
  promptQuestion: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  promptMeta: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  inlineError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  smallPrint: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
  },
});

