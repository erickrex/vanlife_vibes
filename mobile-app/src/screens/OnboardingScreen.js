import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '../components/AppButton';
import CityAutocomplete from '../components/CityAutocomplete';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { profilesAPI } from '../services/api';
import { colors } from '../theme/colors';

const STEPS = [
  {
    id: 'intent',
    title: 'Welcome',
    subtitle: 'Tell us what you’re here for so we can tune your discovery.',
  },
  {
    id: 'basics',
    title: 'Your basics',
    subtitle: 'A few details that help others understand you.',
  },
  {
    id: 'prefs',
    title: 'Preferences',
    subtitle: 'Set the vibe for who you’ll see first.',
  },
  {
    id: 'polish',
    title: 'Quick polish',
    subtitle: 'Pick two prompts to stand out.',
  },
  {
    id: 'location',
    title: 'Your location',
    subtitle: 'Where are you now, next week, and next month?',
  },
];

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
  const [step, setStep] = useState(0);

  const [lookingForFriends, setLookingForFriends] = useState(true);
  const [lookingForDating, setLookingForDating] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [interestedInMen, setInterestedInMen] = useState(false);
  const [interestedInWomen, setInterestedInWomen] = useState(false);
  const [interestedInNonbinary, setInterestedInNonbinary] = useState(false);
  const [profileType, setProfileType] = useState('solo');
  const [travelPace, setTravelPace] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [petType, setPetType] = useState('');
  const [nowInCity, setNowInCity] = useState('');
  const [nextWeekInCity, setNextWeekInCity] = useState('');
  const [nextMonthInCity, setNextMonthInCity] = useState('');
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
        setBio(profileData.bio || '');
        setGender(profileData.gender || '');
        setNowInCity(profileData.now_in_city || '');
        setNextWeekInCity(profileData.next_week_in_city || '');
        setNextMonthInCity(profileData.next_month_in_city || '');
        setLookingForDating(!!profileData.looking_for_dating);
        setLookingForFriends(profileData.looking_for_friends !== false);
        setInterestedInMen(!!profileData.interested_in_men);
        setInterestedInWomen(!!profileData.interested_in_women);
        setInterestedInNonbinary(!!profileData.interested_in_nonbinary);
        setProfileType(profileData.profile_type || 'solo');
        setTravelPace(profileData.travel_pace || '');
        setHasPets(!!profileData.has_pets);
        setPetType(profileData.pet_type || '');
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

  const stepData = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const canContinue = useMemo(() => {
    if (!stepData) return false;
    if (stepData.id === 'intent') {
      return lookingForDating || lookingForFriends;
    }
    if (stepData.id === 'basics') {
      return !!displayName.trim() && !!gender;
    }
    if (stepData.id === 'polish') {
      if (!prompt1 || !prompt1Answer.trim()) return false;
      if (!prompt2 || !prompt2Answer.trim()) return false;
      if (prompt1 === prompt2) return false;
      return true;
    }
    if (stepData.id === 'location') {
      return !!nowInCity.trim();
    }
    return true;
  }, [
    displayName,
    gender,
    lookingForDating,
    lookingForFriends,
    nowInCity,
    prompt1,
    prompt1Answer,
    prompt2,
    prompt2Answer,
    stepData,
  ]);

  const handleNext = () => {
    setError('');
    if (!stepData) return;
    if (!canContinue) {
      setError('Please complete the required fields to continue.');
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    setError('');
    if (!canContinue || !isLastStep) {
      setError('Please complete this step before finishing.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        gender,
        now_in_city: nowInCity.trim(),
        next_week_in_city: nextWeekInCity.trim(),
        next_month_in_city: nextMonthInCity.trim(),
        looking_for_dating: !!lookingForDating,
        looking_for_friends: !!lookingForFriends,
        interested_in_men: !!interestedInMen,
        interested_in_women: !!interestedInWomen,
        interested_in_nonbinary: !!interestedInNonbinary,
        profile_type: profileType,
        travel_pace: travelPace || null,
        has_pets: !!hasPets,
        pet_type: hasPets ? petType : '',
        has_completed_onboarding: true,
      };

      await profilesAPI.updateMyProfile(payload);

      try {
        const existing = await profilesAPI.getPrompts();
        const existingData = existing.data.data || existing.data || [];
        if (Array.isArray(existingData)) {
          await Promise.all(existingData.map((p) => (p?.id ? profilesAPI.deletePrompt(p.id) : null)));
        }
      } catch {
        // Ignore prompt cleanup errors.
      }

      await profilesAPI.createPrompt({ prompt_name: prompt1, prompt_answer: prompt1Answer.trim() });
      await profilesAPI.createPrompt({ prompt_name: prompt2, prompt_answer: prompt2Answer.trim() });
      await refreshProfile();
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const showDatingPrefs = lookingForDating;

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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHeader}>
            <Text style={styles.stepCount}>{`Step ${step + 1} of ${STEPS.length}`}</Text>
            <Text style={styles.title}>{stepData?.title || 'Onboarding'}</Text>
            <Text style={styles.subtitle}>{stepData?.subtitle || ''}</Text>
          </View>

          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          {stepData?.id === 'intent' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Intent</Text>
              <Text style={styles.sectionSubtitle}>Tell us what you’re here for.</Text>
              <View style={{ gap: 10 }}>
                <Toggle label="Friends" value={lookingForFriends} onChange={setLookingForFriends} color={colors.blue} />
                <Toggle label="Dating" value={lookingForDating} onChange={setLookingForDating} color={colors.rose} />
              </View>
            </View>
          ) : null}

          {stepData?.id === 'basics' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Basics</Text>
              <FormTextInput
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="What should people call you?"
                autoCapitalize="words"
              />

              <FormTextInput
                label="Bio (optional)"
                value={bio}
                onChangeText={setBio}
                placeholder="A quick intro (optional)"
                autoCapitalize="sentences"
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

              {showDatingPrefs ? (
                <View style={{ gap: 12, marginTop: 10 }}>
                  <Text style={styles.sectionSubtitle}>Interested in (for dating)</Text>
                  <View style={{ gap: 10 }}>
                    <Toggle
                      label="Men"
                      value={interestedInMen}
                      onChange={setInterestedInMen}
                      color={colors.primary}
                    />
                    <Toggle
                      label="Women"
                      value={interestedInWomen}
                      onChange={setInterestedInWomen}
                      color={colors.primary}
                    />
                    <Toggle
                      label="Non-binary"
                      value={interestedInNonbinary}
                      onChange={setInterestedInNonbinary}
                      color={colors.primary}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {stepData?.id === 'prefs' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Preferences</Text>

              <Text style={styles.label}>Profile type</Text>
              <View style={styles.segmentRow}>
                <SegmentedOption label="Solo" selected={profileType === 'solo'} onPress={() => setProfileType('solo')} />
                <SegmentedOption
                  label="Couple"
                  selected={profileType === 'couple'}
                  onPress={() => setProfileType('couple')}
                />
                <SegmentedOption
                  label="Group"
                  selected={profileType === 'group'}
                  onPress={() => setProfileType('group')}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Travel pace (optional)</Text>
              <View style={styles.segmentRow}>
                <SegmentedOption label="Slow" selected={travelPace === 'slow'} onPress={() => setTravelPace('slow')} />
                <SegmentedOption
                  label="Mixed"
                  selected={travelPace === 'mixed'}
                  onPress={() => setTravelPace('mixed')}
                />
                <SegmentedOption label="Fast" selected={travelPace === 'fast'} onPress={() => setTravelPace('fast')} />
              </View>

              <View style={{ marginTop: 12, gap: 10 }}>
                <Toggle label="I have pets" value={hasPets} onChange={setHasPets} color={colors.emerald} />
                {hasPets ? (
                  <FormTextInput
                    label="Pet type (optional)"
                    value={petType}
                    onChangeText={setPetType}
                    placeholder="e.g. dog, cat"
                    autoCapitalize="words"
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {stepData?.id === 'polish' ? (
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
          ) : null}

          {stepData?.id === 'location' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Location</Text>
              <Text style={styles.sectionSubtitle}>Use the city list so everyone matches consistently.</Text>

              <CityAutocomplete
                label="Now in"
                value={nowInCity}
                onChange={setNowInCity}
                placeholder="Search cities…"
                editable={!saving}
              />

              <CityAutocomplete
                label="Next week"
                value={nextWeekInCity}
                onChange={setNextWeekInCity}
                placeholder="Search cities…"
                editable={!saving}
                optional
              />

              <CityAutocomplete
                label="Next month"
                value={nextMonthInCity}
                onChange={setNextMonthInCity}
                placeholder="Search cities…"
                editable={!saving}
                optional
              />
            </View>
          ) : null}

          <View style={styles.navRow}>
            <AppButton
              title="Back"
              onPress={handleBack}
              disabled={step === 0 || saving}
              variant="secondary"
              style={styles.navButton}
            />
            {isLastStep ? (
              <AppButton
                title={saving ? 'Saving…' : 'Finish'}
                onPress={handleFinish}
                disabled={!canContinue || saving}
                variant="primary"
                style={styles.navButton}
              />
            ) : (
              <AppButton
                title="Next"
                onPress={handleNext}
                disabled={!canContinue || saving}
                variant="primary"
                style={styles.navButton}
              />
            )}
          </View>

          <Text style={styles.smallPrint}>Profile id: {profile?.id || '—'} · You can edit more details later.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 14,
  },
  stepHeader: {
    gap: 6,
  },
  stepCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  navRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  navButton: {
    flex: 1,
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
