import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import AppButton from '../components/AppButton';
import CityAutocomplete from '../components/CityAutocomplete';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL, profilesAPI, subscriptionAPI } from '../services/api';
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
    id: 'photo',
    title: 'Your photo',
    subtitle: 'Add a photo to make your profile feel real. You can skip for now.',
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
const PET_TYPES = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'other', label: 'Other' },
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
        { borderColor: value ? color : colors.borderStrong, backgroundColor: value ? `${color}22` : colors.panel },
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

function normalizePhotoUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|asset:\/\/)/i.test(trimmed)) return trimmed;
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  if (!origin) return trimmed;
  return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const { profile, refreshProfile } = useAuth();
  const headerHeight = useHeaderHeight();

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
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingPhotoType, setUploadingPhotoType] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoNotice, setPhotoNotice] = useState('');
  const [showPhotoUrlFallback, setShowPhotoUrlFallback] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [avatarUploaded, setAvatarUploaded] = useState(false);
  const [coverUploaded, setCoverUploaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const [profileRes, promptRes, subscriptionRes] = await Promise.all([
          profilesAPI.getMyProfile(),
          profilesAPI.getAvailablePrompts(),
          subscriptionAPI.getStatus().catch(() => null),
        ]);

        if (!mounted) return;
        const profileData = profileRes.data.data || profileRes.data;
        const promptsData = promptRes.data.data || promptRes.data || [];
        const subscriptionData = subscriptionRes?.data?.data || subscriptionRes?.data || {};

        setPrompts(Array.isArray(promptsData) ? promptsData : []);
        setIsPremium(!!subscriptionData?.is_premium);
        setDisplayName(profileData.display_name || '');
        setBio(profileData.bio || '');
        setGender(profileData.gender || '');
        const initialAvatarUrl = normalizePhotoUrl(profileData.avatar_url || '');
        const initialCoverUrl = normalizePhotoUrl(profileData.cover_url || '');
        setAvatarUrl(initialAvatarUrl);
        setCoverUrl(initialCoverUrl);
        setAvatarUploaded(!!initialAvatarUrl);
        setCoverUploaded(!!initialCoverUrl);
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
  const travelPrompts = useMemo(
    () => prompts.filter((prompt) => prompt?.prompt_type === 'travel'),
    [prompts],
  );
  const relationshipPrompts = useMemo(
    () =>
      prompts.filter((prompt) =>
        lookingForDating ? prompt?.prompt_type === 'dating' : prompt?.prompt_type === 'friendship',
      ),
    [lookingForDating, prompts],
  );
  const selectedPromptOne = useMemo(
    () => travelPrompts.find((prompt) => prompt?.prompt_name === prompt1) || null,
    [prompt1, travelPrompts],
  );
  const selectedPromptTwo = useMemo(
    () => relationshipPrompts.find((prompt) => prompt?.prompt_name === prompt2) || null,
    [prompt2, relationshipPrompts],
  );

  const getStepValidationError = (stepId) => {
    if (stepId === 'intent') {
      if (!lookingForDating && !lookingForFriends) return 'Choose at least one intent (Friends or Dating).';
      return '';
    }
    if (stepId === 'basics') {
      if (!displayName.trim()) return 'Display name is required.';
      if (!gender) return 'Please choose your gender.';
      return '';
    }
    if (stepId === 'photo') return '';
    if (stepId === 'prefs') {
      if (hasPets && !petType) return 'Select a pet type.';
      return '';
    }
    if (stepId === 'polish') {
      if (travelPrompts.length === 0 || relationshipPrompts.length === 0) {
        return 'Prompt options are unavailable right now. Try again in a moment.';
      }
      if (!prompt1) return 'Choose Prompt 1.';
      if (!prompt1Answer.trim()) return 'Add an answer for Prompt 1.';
      if (!prompt2) return 'Choose Prompt 2.';
      if (!prompt2Answer.trim()) return 'Add an answer for Prompt 2.';
      if (prompt1 === prompt2) return 'Choose two different prompts.';
      return '';
    }
    if (stepId === 'location') {
      if (!nowInCity.trim()) return 'Your current location is required.';
      return '';
    }
    return '';
  };

  const canContinue = useMemo(() => {
    if (!stepData) return false;
    return !getStepValidationError(stepData.id);
  }, [
    getStepValidationError,
    displayName,
    gender,
    hasPets,
    lookingForDating,
    lookingForFriends,
    nowInCity,
    petType,
    prompt1,
    prompt1Answer,
    prompt2,
    prompt2Answer,
    stepData,
  ]);

  const pickAndUploadPhoto = async (photoType) => {
    if (!photoType || saving || uploadingPhotoType) return;

    try {
      setUploadingPhotoType(photoType);
      setPhotoError('');
      setPhotoNotice('');

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError('Photo library permission is required to upload photos.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: photoType === 'cover' ? [2, 1] : [1, 1],
        quality: 0.85,
      });

      if (pickerResult.canceled || !pickerResult.assets?.length) return;

      const asset = pickerResult.assets[0];
      if (!asset?.uri) {
        setPhotoError('Unable to read selected photo.');
        return;
      }

      const uriParts = asset.uri.split('.');
      const fallbackExt = uriParts.length > 1 ? uriParts[uriParts.length - 1] : 'jpg';
      const extension = (asset.mimeType?.split('/')?.[1] || fallbackExt || 'jpg').toLowerCase();
      const fileName = asset.fileName || `${photoType}-${Date.now()}.${extension}`;

      let contentType = 'image/jpeg';
      if (extension === 'png') contentType = 'image/png';
      if (extension === 'webp') contentType = 'image/webp';
      if (asset.mimeType?.startsWith('image/')) contentType = asset.mimeType;

      const formData = new FormData();
      formData.append('photo_type', photoType);
      formData.append('image', {
        uri: asset.uri,
        name: fileName,
        type: contentType,
      });

      const response = await profilesAPI.uploadPhoto(formData);
      const uploadedPhoto = response?.data?.data ?? response?.data ?? null;
      const uploadedUrl = normalizePhotoUrl(uploadedPhoto?.image || uploadedPhoto?.image_url || '');

      if (photoType === 'avatar') {
        setAvatarUrl(uploadedUrl || asset.uri);
        setAvatarUploaded(true);
        setPhotoNotice('Avatar uploaded.');
      } else if (photoType === 'cover') {
        setCoverUrl(uploadedUrl || asset.uri);
        setCoverUploaded(true);
        setPhotoNotice('Cover uploaded.');
      }

      await refreshProfile();
    } catch (err) {
      setPhotoError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhotoType('');
    }
  };

  const handleNext = () => {
    setError('');
    if (!stepData) return;
    const stepError = getStepValidationError(stepData.id);
    if (stepError) {
      setError(stepError);
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
    const firstInvalidStep = STEPS.find((item) => getStepValidationError(item.id));
    if (firstInvalidStep || !isLastStep) {
      const targetStepId = firstInvalidStep?.id || stepData?.id;
      const targetStepIndex = STEPS.findIndex((item) => item.id === targetStepId);
      setError(getStepValidationError(targetStepId) || 'Please complete this step before finishing.');
      if (targetStepIndex >= 0) setStep(targetStepIndex);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
        cover_url: coverUrl.trim() || null,
        gender,
        now_in_city: nowInCity.trim(),
        looking_for_dating: !!lookingForDating,
        looking_for_friends: !!lookingForFriends,
        interested_in_men: !!interestedInMen,
        interested_in_women: !!interestedInWomen,
        interested_in_nonbinary: !!interestedInNonbinary,
        profile_type: profileType,
        travel_pace: travelPace || null,
        has_pets: !!hasPets,
        pet_type: hasPets ? petType : null,
        has_completed_onboarding: true,
      };
      if (isPremium) {
        payload.next_week_in_city = nextWeekInCity.trim();
        payload.next_month_in_city = nextMonthInCity.trim();
      }

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
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
                <Toggle label="Dating" value={lookingForDating} onChange={setLookingForDating} color={colors.blue} />
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

          {stepData?.id === 'photo' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Photos (optional)</Text>
              <Text style={styles.sectionSubtitle}>A photo increases trust and match quality.</Text>

              <View style={styles.photoPreviewRow}>
                <View style={styles.avatarPreviewWrap}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoFallback}>
                      <Text style={styles.photoFallbackText}>
                        {displayName ? displayName.slice(0, 1).toUpperCase() : 'V'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.coverPreviewWrap}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.coverPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Text style={styles.photoFallbackText}>Cover preview</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.photoUploadActions}>
                <AppButton
                  title={
                    uploadingPhotoType === 'avatar'
                      ? 'Uploading avatar…'
                      : avatarUploaded
                        ? 'Avatar Uploaded ✓'
                        : 'Upload Avatar'
                  }
                  onPress={() => pickAndUploadPhoto('avatar')}
                  disabled={!!uploadingPhotoType || saving}
                  variant={avatarUploaded ? 'primary' : 'secondary'}
                  style={styles.photoUploadButton}
                />
                <AppButton
                  title={
                    uploadingPhotoType === 'cover'
                      ? 'Uploading cover…'
                      : coverUploaded
                        ? 'Cover Uploaded ✓'
                        : 'Upload Cover'
                  }
                  onPress={() => pickAndUploadPhoto('cover')}
                  disabled={!!uploadingPhotoType || saving}
                  variant={coverUploaded ? 'primary' : 'secondary'}
                  style={styles.photoUploadButton}
                />
              </View>

              {photoError ? <Text style={styles.inlineError}>{photoError}</Text> : null}
              {photoNotice ? <Text style={styles.inlineSuccess}>{photoNotice}</Text> : null}
              <Pressable
                onPress={() => setShowPhotoUrlFallback((prev) => !prev)}
                style={({ pressed }) => [styles.linkRow, pressed ? styles.segmentPressed : null]}
              >
                <Text style={styles.linkText}>
                  {showPhotoUrlFallback ? 'Hide URL fallback' : 'Or add a photo URL instead'}
                </Text>
              </Pressable>

              {showPhotoUrlFallback ? (
                <FormTextInput
                  label="Avatar URL"
                  value={avatarUrl}
                  onChangeText={(value) => {
                    setAvatarUrl(value);
                    setAvatarUploaded(!!value.trim());
                    if (photoError) setPhotoError('');
                  }}
                  placeholder="https://"
                  autoCapitalize="none"
                />
              ) : null}
              <Text style={styles.smallMuted}>You can add gallery photos later from Profile Edit.</Text>
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
                <Toggle
                  label="I have pets"
                  value={hasPets}
                  onChange={(value) => {
                    setHasPets(value);
                    if (!value) setPetType('');
                  }}
                  color={colors.emerald}
                />
                {hasPets ? (
                  <>
                    <Text style={styles.label}>Pet type</Text>
                    <View style={styles.segmentRow}>
                      {PET_TYPES.map((option) => (
                        <SegmentedOption
                          key={option.value}
                          label={option.label}
                          selected={petType === option.value}
                          onPress={() => setPetType(option.value)}
                        />
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {stepData?.id === 'polish' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Prompts</Text>
              <Text style={styles.sectionSubtitle}>Pick two prompts to stand out.</Text>

              <PromptPicker label="Prompt 1 (Travel)" prompts={travelPrompts} value={prompt1} onChange={setPrompt1} />
              <FormTextInput
                label="Answer 1"
                value={prompt1Answer}
                onChangeText={setPrompt1Answer}
                placeholder={selectedPromptOne?.prompt_placeholder || 'Your answer'}
                autoCapitalize="sentences"
              />

              <View style={{ height: 10 }} />

              <PromptPicker
                label={lookingForDating ? 'Prompt 2 (Dating)' : 'Prompt 2 (Friendship)'}
                prompts={relationshipPrompts}
                value={prompt2}
                onChange={setPrompt2}
              />
              <FormTextInput
                label="Answer 2"
                value={prompt2Answer}
                onChangeText={setPrompt2Answer}
                placeholder={selectedPromptTwo?.prompt_placeholder || 'Your answer'}
                autoCapitalize="sentences"
              />

              {prompt1 && prompt2 && prompt1 === prompt2 ? (
                <Text style={styles.inlineError}>Choose two different prompts.</Text>
              ) : null}
              {travelPrompts.length === 0 || relationshipPrompts.length === 0 ? (
                <Text style={styles.inlineError}>
                  Prompt options are unavailable right now. Try again in a moment.
                </Text>
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

              {isPremium ? (
                <>
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
                </>
              ) : (
                <View style={styles.premiumLockCard}>
                  <Text style={styles.premiumLockTitle}>Premium: Future location matching</Text>
                  <Text style={styles.premiumLockBody}>
                    Unlock more matches with Next week and Next month location timeline, plus unlimited swipes.
                    You can enable this later from Subscription.
                  </Text>

                  <CityAutocomplete
                    label="Next week (Premium)"
                    value=""
                    onChange={() => {}}
                    placeholder="Premium required"
                    editable={false}
                    optional
                  />

                  <CityAutocomplete
                    label="Next month (Premium)"
                    value=""
                    onChange={() => {}}
                    placeholder="Premium required"
                    editable={false}
                    optional
                  />

                  <AppButton
                    title="Unlock Premium"
                    onPress={() => navigation.navigate('Subscription')}
                    variant="primary"
                  />
                </View>
              )}
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
    borderColor: colors.borderStrong,
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
  premiumLockCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  premiumLockTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  premiumLockBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
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
  },
  inlineSuccess: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: '700',
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
    borderColor: colors.borderStrong,
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
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPreviewWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  photoFallbackText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  coverPreviewWrap: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  photoUploadActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  photoUploadButton: {
    flex: 1,
  },
  linkRow: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  linkText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
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
    borderColor: colors.borderStrong,
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
    borderBottomColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
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
  smallMuted: {
    color: colors.muted,
    fontSize: 12,
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
