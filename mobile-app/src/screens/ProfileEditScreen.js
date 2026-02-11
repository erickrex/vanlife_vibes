import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';

import AppButton from '../components/AppButton';
import CityAutocomplete from '../components/CityAutocomplete';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { profilesAPI } from '../services/api';
import { colors } from '../theme/colors';

const GENDER_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'non_binary', label: 'Non-binary' },
];

const PROFILE_TYPE_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'group', label: 'Group' },
];

const TRAVEL_PACE_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'slow', label: 'Slow' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'fast', label: 'Fast' },
];

const TRAVEL_STATUS_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'weekender', label: 'Weekender' },
  { value: 'aspiring', label: 'Aspiring' },
];

const WORK_STATUS_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'remote_worker', label: 'Remote worker' },
  { value: 'retired', label: 'Retired' },
  { value: 'seasonal_worker', label: 'Seasonal worker' },
  { value: 'unemployed', label: 'Not working now' },
  { value: 'other', label: 'Other' },
];

const TRAVEL_COMPANIONS_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
  { value: 'with_pets', label: 'With pets' },
];

const SOCIAL_VIBE_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'introvert', label: 'Introvert' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'social', label: 'Social' },
];

const LIFESTYLE_SCHEDULE_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'early_bird', label: 'Early bird' },
  { value: 'night_owl', label: 'Night owl' },
];

const LIFESTYLE_SOCIAL_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'quiet', label: 'Quiet' },
  { value: 'party', label: 'Party' },
];

const LIFESTYLE_ENVIRONMENT_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'outdoors', label: 'Outdoors' },
  { value: 'city_mix', label: 'City mix' },
];

const CAMPING_PREFERENCE_OPTIONS = [
  { value: 'boondocking', label: 'Boondocking' },
  { value: 'campgrounds', label: 'Campgrounds' },
  { value: 'stealth_camping', label: 'Stealth camping' },
  { value: 'rv_parks', label: 'RV parks' },
  { value: 'friends_driveways', label: "Friend's driveways" },
];

const PET_TYPE_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'other', label: 'Other' },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: '', label: 'Choose type' },
  { value: 'van', label: 'Van' },
  { value: 'rv', label: 'RV' },
  { value: 'truck_camper', label: 'Truck Camper' },
  { value: 'skoolie', label: 'Skoolie' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'car_camper', label: 'Car Camper' },
  { value: 'other', label: 'Other' },
];

const VEHICLE_BUILD_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'stock', label: 'Stock' },
  { value: 'partial', label: 'Partial Build' },
  { value: 'full', label: 'Full Build' },
];

function SegmentedField({ label, value, options, onChange, disabled = false }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={`${label}-${option.value || 'blank'}`}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.segmentChip,
                selected ? styles.segmentChipActive : null,
                pressed && !disabled ? styles.pressed : null,
                disabled ? styles.disabled : null,
              ]}
            >
              <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onChange, disabled = false, helper }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.toggle,
        value ? styles.toggleOn : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {helper ? <Text style={styles.toggleHelper}>{helper}</Text> : null}
      </View>
      <Text style={[styles.toggleValue, value ? styles.toggleValueOn : null]}>{value ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}

function normalizeProfile(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function normalizeList(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

export default function ProfileEditScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const { refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [lookingForDating, setLookingForDating] = useState(false);
  const [lookingForFriends, setLookingForFriends] = useState(true);
  const [interestedInMen, setInterestedInMen] = useState(false);
  const [interestedInWomen, setInterestedInWomen] = useState(false);
  const [interestedInNonbinary, setInterestedInNonbinary] = useState(false);
  const [profileType, setProfileType] = useState('solo');
  const [groupDescription, setGroupDescription] = useState('');
  const [travelPace, setTravelPace] = useState('');
  const [travelStatus, setTravelStatus] = useState('');
  const [travelCompanions, setTravelCompanions] = useState('');
  const [workStatus, setWorkStatus] = useState('');
  const [socialVibe, setSocialVibe] = useState('');
  const [lifestyleSchedule, setLifestyleSchedule] = useState('');
  const [lifestyleSocial, setLifestyleSocial] = useState('');
  const [lifestyleEnvironment, setLifestyleEnvironment] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [petType, setPetType] = useState('');
  const [petFriendlyOnly, setPetFriendlyOnly] = useState(false);
  const [nowInCity, setNowInCity] = useState('');
  const [nextWeekInCity, setNextWeekInCity] = useState('');
  const [nextMonthInCity, setNextMonthInCity] = useState('');
  const [nowInStartDate, setNowInStartDate] = useState('');
  const [nowInEndDate, setNowInEndDate] = useState('');
  const [nextWeekInStartDate, setNextWeekInStartDate] = useState('');
  const [nextWeekInEndDate, setNextWeekInEndDate] = useState('');
  const [nextMonthInStartDate, setNextMonthInStartDate] = useState('');
  const [nextMonthInEndDate, setNextMonthInEndDate] = useState('');
  const [campingPreferences, setCampingPreferences] = useState([]);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const [hobbyTags, setHobbyTags] = useState([]);
  const [selectedHobbyIds, setSelectedHobbyIds] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptAnswer, setNewPromptAnswer] = useState('');
  const [promptError, setPromptError] = useState('');
  const [addingPrompt, setAddingPrompt] = useState(false);
  const [deletingPromptId, setDeletingPromptId] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [photoLoadingId, setPhotoLoadingId] = useState('');
  const [uploadingPhotoType, setUploadingPhotoType] = useState('');

  const [hasVan, setHasVan] = useState(false);
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleBuildStatus, setVehicleBuildStatus] = useState('');
  const [vehicleNickname, setVehicleNickname] = useState('');

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!displayName.trim()) return false;
    if (!lookingForDating && !lookingForFriends) return false;
    if (hasVan && !vehicleType) return false;
    return true;
  }, [displayName, hasVan, lookingForDating, lookingForFriends, saving, vehicleType]);

  const clearFieldError = (field) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [profileRes, hobbyRes, promptsRes, availablePromptsRes, photosRes] = await Promise.all([
        profilesAPI.getMyProfile(),
        profilesAPI.getHobbyTags(),
        profilesAPI.getPrompts(),
        profilesAPI.getAvailablePrompts(),
        profilesAPI.getPhotos(),
      ]);

      const profile = normalizeProfile(profileRes);
      const hobbies = normalizeList(hobbyRes);
      const promptList = normalizeList(promptsRes);
      const availablePromptList = normalizeList(availablePromptsRes);
      const profilePhotoList = normalizeList(photosRes);

      let vehicle = null;
      try {
        const vehicleRes = await profilesAPI.getMyVehicle();
        vehicle = normalizeProfile(vehicleRes);
      } catch {
        vehicle = null;
      }

      setDisplayName(profile?.display_name || '');
      setBio(profile?.bio || '');
      setGender(profile?.gender || '');
      setLookingForDating(!!profile?.looking_for_dating);
      setLookingForFriends(profile?.looking_for_friends !== false);
      setInterestedInMen(!!profile?.interested_in_men);
      setInterestedInWomen(!!profile?.interested_in_women);
      setInterestedInNonbinary(!!profile?.interested_in_nonbinary);
      setProfileType(profile?.profile_type || 'solo');
      setGroupDescription(profile?.group_description || '');
      setTravelPace(profile?.travel_pace || '');
      setTravelStatus(profile?.travel_status || '');
      setTravelCompanions(profile?.travel_companions || '');
      setWorkStatus(profile?.work_status || '');
      setSocialVibe(profile?.social_vibe || '');
      setLifestyleSchedule(profile?.lifestyle_schedule || '');
      setLifestyleSocial(profile?.lifestyle_social || '');
      setLifestyleEnvironment(profile?.lifestyle_environment || '');
      setHasPets(!!profile?.has_pets);
      setPetType(profile?.pet_type || '');
      setPetFriendlyOnly(!!profile?.pet_friendly_only);
      setNowInCity(profile?.now_in_city || '');
      setNextWeekInCity(profile?.next_week_in_city || '');
      setNextMonthInCity(profile?.next_month_in_city || '');
      setNowInStartDate(profile?.now_in_start_date || '');
      setNowInEndDate(profile?.now_in_end_date || '');
      setNextWeekInStartDate(profile?.next_week_in_start_date || '');
      setNextWeekInEndDate(profile?.next_week_in_end_date || '');
      setNextMonthInStartDate(profile?.next_month_in_start_date || '');
      setNextMonthInEndDate(profile?.next_month_in_end_date || '');
      setCampingPreferences(Array.isArray(profile?.camping_preferences) ? profile.camping_preferences : []);
      setAvatarUrlInput(profile?.avatar_url || '');
      setCoverUrlInput(profile?.cover_url || '');
      setHobbyTags(hobbies);
      setSelectedHobbyIds(Array.isArray(profile?.hobbies) ? profile.hobbies.map((hobby) => String(hobby.id)) : []);
      setPrompts(promptList);
      setAvailablePrompts(availablePromptList);
      setPhotos(profilePhotoList);
      setPromptError('');
      setPhotoError('');

      setHasVan(!!profile?.has_van);
      setVehicleType(vehicle?.type || vehicle?.vehicle_type || '');
      setVehicleMake(vehicle?.make || '');
      setVehicleModel(vehicle?.model || '');
      setVehicleYear(vehicle?.year ? String(vehicle.year) : '');
      setVehicleBuildStatus(vehicle?.build_status || '');
      setVehicleNickname(vehicle?.nickname || '');
    } catch (err) {
      setError(err.message || 'Failed to load profile settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleHobby = (id) => {
    const stringId = String(id);
    setSelectedHobbyIds((prev) =>
      prev.includes(stringId) ? prev.filter((item) => item !== stringId) : [...prev, stringId],
    );
  };

  const toggleCampingPreference = (value) => {
    setCampingPreferences((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const sortedPrompts = useMemo(() => {
    return [...prompts].sort((a, b) => (a?.display_order || 0) - (b?.display_order || 0));
  }, [prompts]);

  const unusedPrompts = useMemo(() => {
    const usedNames = new Set(sortedPrompts.map((prompt) => prompt?.prompt_name).filter(Boolean));
    return availablePrompts.filter((prompt) => !usedNames.has(prompt?.prompt_name));
  }, [availablePrompts, sortedPrompts]);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const orderDiff = (a?.display_order || 0) - (b?.display_order || 0);
      if (orderDiff !== 0) return orderDiff;
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [photos]);

  const avatarPhoto = useMemo(
    () => sortedPhotos.find((photo) => photo?.photo_type === 'avatar') || null,
    [sortedPhotos],
  );
  const coverPhoto = useMemo(
    () => sortedPhotos.find((photo) => photo?.photo_type === 'cover') || null,
    [sortedPhotos],
  );
  const galleryPhotos = useMemo(
    () => sortedPhotos.filter((photo) => photo?.photo_type === 'gallery'),
    [sortedPhotos],
  );

  const getPromptQuestion = useCallback(
    (promptItem) => {
      if (promptItem?.prompt_question) return promptItem.prompt_question;
      const match = availablePrompts.find((prompt) => prompt?.prompt_name === promptItem?.prompt_name);
      return match?.prompt_question || promptItem?.prompt_name || 'Prompt';
    },
    [availablePrompts],
  );

  const refreshPhotos = useCallback(async () => {
    const response = await profilesAPI.getPhotos();
    setPhotos(normalizeList(response));
  }, []);

  const pickAndUploadPhoto = async (photoType) => {
    if (!photoType || saving || photoLoadingId || uploadingPhotoType) return;

    try {
      setUploadingPhotoType(photoType);
      setPhotoError('');

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError('Photo library permission is required to upload photos.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: photoType !== 'gallery',
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

      const uploadResponse = await profilesAPI.uploadPhoto(formData);
      const uploadedPhoto = normalizeProfile(uploadResponse);
      if (photoType === 'avatar' && uploadedPhoto?.image) {
        setAvatarUrlInput(uploadedPhoto.image);
      }
      if (photoType === 'cover' && uploadedPhoto?.image) {
        setCoverUrlInput(uploadedPhoto.image);
      }
      await refreshPhotos();
      await refreshProfile();
    } catch (err) {
      setPhotoError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhotoType('');
    }
  };

  const addPrompt = async () => {
    if (saving || addingPrompt) return;
    if (!newPromptName) {
      setPromptError('Select a prompt first.');
      return;
    }
    if (!newPromptAnswer.trim()) {
      setPromptError('Prompt answer is required.');
      return;
    }
    if (newPromptAnswer.length > 200) {
      setPromptError('Prompt answer must be 200 characters or fewer.');
      return;
    }
    if (sortedPrompts.length >= 3) {
      setPromptError('Maximum of 3 prompts allowed.');
      return;
    }
    if (sortedPrompts.some((prompt) => prompt?.prompt_name === newPromptName)) {
      setPromptError('You already answered this prompt.');
      return;
    }

    try {
      setAddingPrompt(true);
      setPromptError('');
      const response = await profilesAPI.createPrompt({
        prompt_name: newPromptName,
        prompt_answer: newPromptAnswer.trim(),
      });
      const createdPrompt = normalizeProfile(response);
      if (createdPrompt?.id) {
        setPrompts((prev) => [...prev, createdPrompt]);
      }
      setNewPromptName('');
      setNewPromptAnswer('');
      await refreshProfile();
    } catch (err) {
      setPromptError(err.message || 'Failed to add prompt');
    } finally {
      setAddingPrompt(false);
    }
  };

  const removePrompt = async (promptId) => {
    if (!promptId || deletingPromptId || saving) return;
    try {
      setDeletingPromptId(String(promptId));
      setPromptError('');
      await profilesAPI.deletePrompt(promptId);
      setPrompts((prev) => prev.filter((item) => String(item.id) !== String(promptId)));
      await refreshProfile();
    } catch (err) {
      setPromptError(err.message || 'Failed to delete prompt');
    } finally {
      setDeletingPromptId('');
    }
  };

  const removePhoto = async (photoId) => {
    if (!photoId || photoLoadingId || saving) return;
    try {
      setPhotoLoadingId(String(photoId));
      setPhotoError('');
      await profilesAPI.deletePhoto(photoId);
      setPhotos((prev) => prev.filter((item) => String(item.id) !== String(photoId)));
      await refreshProfile();
    } catch (err) {
      setPhotoError(err.message || 'Failed to delete photo');
    } finally {
      setPhotoLoadingId('');
    }
  };

  const reorderPhoto = async (photoId, direction) => {
    if (!photoId || photoLoadingId || saving) return;
    const currentPhoto = photos.find((photo) => String(photo.id) === String(photoId));
    if (!currentPhoto) return;

    const sameTypePhotos = sortedPhotos.filter((photo) => photo.photo_type === currentPhoto.photo_type);
    const currentIndex = sameTypePhotos.findIndex((photo) => String(photo.id) === String(photoId));
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sameTypePhotos.length) return;

    const targetPhoto = sameTypePhotos[targetIndex];
    if (!targetPhoto) return;

    try {
      setPhotoLoadingId(String(photoId));
      setPhotoError('');
      await Promise.all([
        profilesAPI.updatePhotoOrder(currentPhoto.id, targetPhoto.display_order || 0),
        profilesAPI.updatePhotoOrder(targetPhoto.id, currentPhoto.display_order || 0),
      ]);
      await refreshPhotos();
    } catch (err) {
      setPhotoError(err.message || 'Failed to reorder photos');
    } finally {
      setPhotoLoadingId('');
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!displayName.trim()) nextErrors.display_name = 'Display name is required.';
    if (!lookingForDating && !lookingForFriends) {
      nextErrors.looking_for = 'Enable Dating or Friends (or both).';
    }
    if (bio.length > 500) nextErrors.bio = 'Bio must be 500 characters or fewer.';
    if ((profileType === 'couple' || profileType === 'group') && groupDescription.length > 200) {
      nextErrors.group_description = 'Group description must be 200 characters or fewer.';
    }
    if (hasVan && !vehicleType) nextErrors.vehicle_type = 'Vehicle type is required when van is enabled.';
    if (vehicleYear) {
      const parsedYear = Number(vehicleYear);
      const maxYear = new Date().getFullYear() + 1;
      if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > maxYear) {
        nextErrors.vehicle_year = `Vehicle year must be between 1900 and ${maxYear}.`;
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);
      setError('');

      await profilesAPI.updateMyProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrlInput.trim() || null,
        cover_url: coverUrlInput.trim() || null,
        gender: gender || null,
        looking_for_dating: !!lookingForDating,
        looking_for_friends: !!lookingForFriends,
        interested_in_men: !!interestedInMen,
        interested_in_women: !!interestedInWomen,
        interested_in_nonbinary: !!interestedInNonbinary,
        profile_type: profileType || 'solo',
        group_description: profileType === 'couple' || profileType === 'group' ? groupDescription.trim() : '',
        travel_pace: travelPace || null,
        travel_status: travelStatus || null,
        travel_companions: travelCompanions || null,
        work_status: workStatus || null,
        social_vibe: socialVibe || null,
        lifestyle_schedule: lifestyleSchedule || null,
        lifestyle_social: lifestyleSocial || null,
        lifestyle_environment: lifestyleEnvironment || null,
        has_pets: !!hasPets,
        pet_type: hasPets ? petType || null : null,
        pet_friendly_only: !!petFriendlyOnly,
        now_in_city: nowInCity || '',
        next_week_in_city: nextWeekInCity || '',
        next_month_in_city: nextMonthInCity || '',
        now_in_start_date: nowInStartDate || null,
        now_in_end_date: nowInEndDate || null,
        next_week_in_start_date: nextWeekInStartDate || null,
        next_week_in_end_date: nextWeekInEndDate || null,
        next_month_in_start_date: nextMonthInStartDate || null,
        next_month_in_end_date: nextMonthInEndDate || null,
        camping_preferences: hasVan ? campingPreferences : [],
        hobby_ids: selectedHobbyIds,
        has_van: !!hasVan,
      });

      if (hasVan) {
        await profilesAPI.updateMyVehicle({
          vehicle_type: vehicleType,
          make: vehicleMake.trim(),
          model: vehicleModel.trim(),
          year: vehicleYear ? Number(vehicleYear) : null,
          build_status: vehicleBuildStatus || null,
          nickname: vehicleNickname.trim(),
        });
      } else {
        try {
          await profilesAPI.deleteMyVehicle();
        } catch {
          // ignore when no vehicle exists yet
        }
      }

      await refreshProfile();
      navigation.navigate('Profile');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.loadingText}>Loading profile editor…</Text>
        </View>
      </Screen>
    );
  }

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
        >
          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basics</Text>
            <FormTextInput
              label="Display Name"
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value);
                clearFieldError('display_name');
              }}
              placeholder="Your display name"
              editable={!saving}
              error={fieldErrors.display_name}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={(value) => {
                  setBio(value);
                  clearFieldError('bio');
                }}
                placeholder="What should people know about you?"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.bioInput, fieldErrors.bio ? styles.inputError : null]}
                editable={!saving}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.metaText}>{`${bio.length}/500`}</Text>
              {fieldErrors.bio ? <Text style={styles.errorText}>{fieldErrors.bio}</Text> : null}
            </View>

            <SegmentedField
              label="Gender"
              value={gender}
              options={GENDER_OPTIONS}
              onChange={(value) => setGender(value)}
              disabled={saving}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Discovery</Text>
            <ToggleRow
              label="Dating discovery"
              value={lookingForDating}
              onChange={(value) => {
                setLookingForDating(value);
                clearFieldError('looking_for');
              }}
              disabled={saving}
              helper="Show in dating swipes."
            />
            <ToggleRow
              label="Friends discovery"
              value={lookingForFriends}
              onChange={(value) => {
                setLookingForFriends(value);
                clearFieldError('looking_for');
              }}
              disabled={saving}
              helper="Show in friends swipes."
            />
            {fieldErrors.looking_for ? <Text style={styles.errorText}>{fieldErrors.looking_for}</Text> : null}

            {lookingForDating ? (
              <View style={styles.inlineStack}>
                <Text style={styles.label}>Dating Preferences</Text>
                <ToggleRow
                  label="Interested in men"
                  value={interestedInMen}
                  onChange={setInterestedInMen}
                  disabled={saving}
                />
                <ToggleRow
                  label="Interested in women"
                  value={interestedInWomen}
                  onChange={setInterestedInWomen}
                  disabled={saving}
                />
                <ToggleRow
                  label="Interested in non-binary"
                  value={interestedInNonbinary}
                  onChange={setInterestedInNonbinary}
                  disabled={saving}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <SegmentedField
              label="Profile Type"
              value={profileType}
              options={PROFILE_TYPE_OPTIONS}
              onChange={setProfileType}
              disabled={saving}
            />
            {profileType === 'couple' || profileType === 'group' ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>{profileType === 'couple' ? 'About Your Duo' : 'About Your Group'}</Text>
                <TextInput
                  value={groupDescription}
                  onChangeText={(value) => {
                    setGroupDescription(value);
                    clearFieldError('group_description');
                  }}
                  placeholder={
                    profileType === 'couple'
                      ? 'Tell others about you two...'
                      : 'Tell others about your group...'
                  }
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.promptInput, fieldErrors.group_description ? styles.inputError : null]}
                  editable={!saving}
                  multiline
                  textAlignVertical="top"
                  maxLength={200}
                />
                <Text style={styles.metaText}>{`${groupDescription.length}/200`}</Text>
                {fieldErrors.group_description ? (
                  <Text style={styles.errorText}>{fieldErrors.group_description}</Text>
                ) : null}
              </View>
            ) : null}
            <SegmentedField
              label="Travel Pace"
              value={travelPace}
              options={TRAVEL_PACE_OPTIONS}
              onChange={setTravelPace}
              disabled={saving}
            />
            <SegmentedField
              label="Travel Status"
              value={travelStatus}
              options={TRAVEL_STATUS_OPTIONS}
              onChange={setTravelStatus}
              disabled={saving}
            />
            <SegmentedField
              label="Traveling"
              value={travelCompanions}
              options={TRAVEL_COMPANIONS_OPTIONS}
              onChange={setTravelCompanions}
              disabled={saving}
            />
            <SegmentedField
              label="Work Status"
              value={workStatus}
              options={WORK_STATUS_OPTIONS}
              onChange={setWorkStatus}
              disabled={saving}
            />
            <SegmentedField
              label="Social Vibe"
              value={socialVibe}
              options={SOCIAL_VIBE_OPTIONS}
              onChange={setSocialVibe}
              disabled={saving}
            />
            <SegmentedField
              label="Lifestyle Schedule"
              value={lifestyleSchedule}
              options={LIFESTYLE_SCHEDULE_OPTIONS}
              onChange={setLifestyleSchedule}
              disabled={saving}
            />
            <SegmentedField
              label="Lifestyle Social"
              value={lifestyleSocial}
              options={LIFESTYLE_SOCIAL_OPTIONS}
              onChange={setLifestyleSocial}
              disabled={saving}
            />
            <SegmentedField
              label="Lifestyle Environment"
              value={lifestyleEnvironment}
              options={LIFESTYLE_ENVIRONMENT_OPTIONS}
              onChange={setLifestyleEnvironment}
              disabled={saving}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Location Timeline</Text>
            <CityAutocomplete
              label="Now in city"
              value={nowInCity}
              onChange={setNowInCity}
              editable={!saving}
            />
            <View style={styles.dateRow}>
              <FormTextInput
                label="Now in from (YYYY-MM-DD)"
                value={nowInStartDate}
                onChangeText={setNowInStartDate}
                placeholder="2026-02-10"
                editable={!saving && !!nowInCity}
              />
              <FormTextInput
                label="Now in until (YYYY-MM-DD)"
                value={nowInEndDate}
                onChangeText={setNowInEndDate}
                placeholder="2026-02-14"
                editable={!saving && !!nowInCity}
              />
            </View>
            <CityAutocomplete
              label="Next week in city"
              value={nextWeekInCity}
              onChange={setNextWeekInCity}
              editable={!saving}
              optional
            />
            <View style={styles.dateRow}>
              <FormTextInput
                label="Next week from (YYYY-MM-DD)"
                value={nextWeekInStartDate}
                onChangeText={setNextWeekInStartDate}
                placeholder="2026-02-17"
                editable={!saving && !!nextWeekInCity}
              />
              <FormTextInput
                label="Next week until (YYYY-MM-DD)"
                value={nextWeekInEndDate}
                onChangeText={setNextWeekInEndDate}
                placeholder="2026-02-21"
                editable={!saving && !!nextWeekInCity}
              />
            </View>
            <CityAutocomplete
              label="Next month in city"
              value={nextMonthInCity}
              onChange={setNextMonthInCity}
              editable={!saving}
              optional
            />
            <View style={styles.dateRow}>
              <FormTextInput
                label="Next month from (YYYY-MM-DD)"
                value={nextMonthInStartDate}
                onChangeText={setNextMonthInStartDate}
                placeholder="2026-03-12"
                editable={!saving && !!nextMonthInCity}
              />
              <FormTextInput
                label="Next month until (YYYY-MM-DD)"
                value={nextMonthInEndDate}
                onChangeText={setNextMonthInEndDate}
                placeholder="2026-03-20"
                editable={!saving && !!nextMonthInCity}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Interests</Text>
            {hobbyTags.length === 0 ? (
              <Text style={styles.emptyText}>No hobbies available right now.</Text>
            ) : (
              <View style={styles.hobbyRow}>
                {hobbyTags.map((hobby) => {
                  const selected = selectedHobbyIds.includes(String(hobby.id));
                  return (
                    <Pressable
                      key={hobby.id}
                      onPress={() => toggleHobby(hobby.id)}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.hobbyChip,
                        selected ? styles.hobbyChipActive : null,
                        pressed && !saving ? styles.pressed : null,
                        saving ? styles.disabled : null,
                      ]}
                    >
                      <Text style={[styles.hobbyText, selected ? styles.hobbyTextActive : null]}>{hobby.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Prompts</Text>
            {sortedPrompts.length > 0 ? (
              <View style={styles.promptList}>
                {sortedPrompts.map((prompt) => (
                  <View key={prompt.id} style={styles.promptCard}>
                    <Text style={styles.promptQuestion}>{getPromptQuestion(prompt)}</Text>
                    <Text style={styles.promptAnswer}>{prompt?.prompt_answer || ''}</Text>
                    <Pressable
                      onPress={() => removePrompt(prompt.id)}
                      disabled={deletingPromptId === String(prompt.id) || saving}
                      style={({ pressed }) => [
                        styles.promptDelete,
                        pressed ? styles.pressed : null,
                        deletingPromptId === String(prompt.id) || saving ? styles.disabled : null,
                      ]}
                    >
                      <Text style={styles.promptDeleteText}>
                        {deletingPromptId === String(prompt.id) ? 'Removing…' : 'Remove'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No prompts added yet.</Text>
            )}

            <View style={styles.promptComposer}>
              <Text style={styles.label}>Add Prompt</Text>
              {unusedPrompts.length > 0 ? (
                <View style={styles.segmentRow}>
                  {unusedPrompts.map((prompt) => {
                    const selected = newPromptName === prompt.prompt_name;
                    return (
                      <Pressable
                        key={prompt.prompt_name}
                        onPress={() => {
                          setNewPromptName(prompt.prompt_name);
                          setPromptError('');
                        }}
                        disabled={saving || addingPrompt}
                        style={({ pressed }) => [
                          styles.segmentChip,
                          selected ? styles.segmentChipActive : null,
                          pressed ? styles.pressed : null,
                          saving || addingPrompt ? styles.disabled : null,
                        ]}
                      >
                        <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>{prompt.prompt_question}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>You are using all available prompt slots.</Text>
              )}

              <TextInput
                value={newPromptAnswer}
                onChangeText={(value) => {
                  setNewPromptAnswer(value);
                  if (promptError) setPromptError('');
                }}
                placeholder="Write your answer..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.promptInput]}
                multiline
                maxLength={200}
                textAlignVertical="top"
                editable={!saving && !addingPrompt}
              />
              <Text style={styles.metaText}>{`${newPromptAnswer.length}/200`}</Text>

              {promptError ? <Text style={styles.errorText}>{promptError}</Text> : null}

              <AppButton
                title={addingPrompt ? 'Adding…' : 'Add Prompt'}
                onPress={addPrompt}
                disabled={saving || addingPrompt || !newPromptName || !newPromptAnswer.trim()}
                variant="secondary"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Photos</Text>
            <Text style={styles.emptyText}>
              Upload, reorder, and remove avatar, cover, and gallery photos.
            </Text>
            <Text style={styles.metaText}>Gallery supports up to 6 photos.</Text>

            <View style={styles.uploadActions}>
              <AppButton
                title={
                  uploadingPhotoType === 'avatar'
                    ? 'Uploading avatar…'
                    : avatarPhoto
                      ? 'Change Avatar'
                      : 'Upload Avatar'
                }
                onPress={() => pickAndUploadPhoto('avatar')}
                disabled={!!photoLoadingId || !!uploadingPhotoType || saving}
                variant="secondary"
                style={styles.uploadActionButton}
              />
              <AppButton
                title={
                  uploadingPhotoType === 'cover'
                    ? 'Uploading cover…'
                    : coverPhoto
                      ? 'Change Cover'
                      : 'Upload Cover'
                }
                onPress={() => pickAndUploadPhoto('cover')}
                disabled={!!photoLoadingId || !!uploadingPhotoType || saving}
                variant="secondary"
                style={styles.uploadActionButton}
              />
              <AppButton
                title={
                  uploadingPhotoType === 'gallery'
                    ? 'Uploading gallery photo…'
                    : galleryPhotos.length >= 6
                      ? 'Gallery Full (6/6)'
                      : 'Add Gallery Photo'
                }
                onPress={() => pickAndUploadPhoto('gallery')}
                disabled={!!photoLoadingId || !!uploadingPhotoType || saving || galleryPhotos.length >= 6}
                variant="secondary"
                style={styles.uploadActionButton}
              />
            </View>

            <View style={styles.inlineStack}>
              <Pressable
                onPress={() => setShowAvatarUrlInput((prev) => !prev)}
                disabled={saving}
                style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null, saving ? styles.disabled : null]}
              >
                <Text style={styles.linkText}>
                  {showAvatarUrlInput ? 'Hide avatar URL input' : 'Or enter avatar URL manually'}
                </Text>
              </Pressable>
              {showAvatarUrlInput ? (
                <FormTextInput
                  label="Avatar URL"
                  value={avatarUrlInput}
                  onChangeText={setAvatarUrlInput}
                  placeholder="https://example.com/avatar.jpg"
                  autoCapitalize="none"
                  editable={!saving}
                />
              ) : null}

              <Pressable
                onPress={() => setShowCoverUrlInput((prev) => !prev)}
                disabled={saving}
                style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null, saving ? styles.disabled : null]}
              >
                <Text style={styles.linkText}>
                  {showCoverUrlInput ? 'Hide cover URL input' : 'Or enter cover URL manually'}
                </Text>
              </Pressable>
              {showCoverUrlInput ? (
                <FormTextInput
                  label="Cover URL"
                  value={coverUrlInput}
                  onChangeText={setCoverUrlInput}
                  placeholder="https://example.com/cover.jpg"
                  autoCapitalize="none"
                  editable={!saving}
                />
              ) : null}
            </View>

            {avatarPhoto ? (
              <View style={styles.photoRow}>
                <Image source={{ uri: avatarPhoto.image }} style={styles.photoThumb} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoTitle}>Avatar</Text>
                  <Text style={styles.photoMeta}>{`Order ${avatarPhoto.display_order || 0}`}</Text>
                </View>
                <Pressable
                  onPress={() => removePhoto(avatarPhoto.id)}
                  disabled={photoLoadingId === String(avatarPhoto.id) || saving}
                  style={({ pressed }) => [
                    styles.photoDelete,
                    pressed ? styles.pressed : null,
                    photoLoadingId === String(avatarPhoto.id) || saving ? styles.disabled : null,
                  ]}
                >
                  <Text style={styles.promptDeleteText}>Delete</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyText}>No avatar photo set.</Text>
            )}

            {coverPhoto ? (
              <View style={styles.photoRow}>
                <Image source={{ uri: coverPhoto.image }} style={[styles.photoThumb, styles.photoThumbWide]} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoTitle}>Cover</Text>
                  <Text style={styles.photoMeta}>{`Order ${coverPhoto.display_order || 0}`}</Text>
                </View>
                <Pressable
                  onPress={() => removePhoto(coverPhoto.id)}
                  disabled={photoLoadingId === String(coverPhoto.id) || saving}
                  style={({ pressed }) => [
                    styles.photoDelete,
                    pressed ? styles.pressed : null,
                    photoLoadingId === String(coverPhoto.id) || saving ? styles.disabled : null,
                  ]}
                >
                  <Text style={styles.promptDeleteText}>Delete</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyText}>No cover photo set.</Text>
            )}

            <View style={styles.inlineStack}>
              <Text style={styles.label}>Gallery</Text>
              {galleryPhotos.length === 0 ? (
                <Text style={styles.emptyText}>No gallery photos yet.</Text>
              ) : (
                galleryPhotos.map((photo, index) => (
                  <View key={photo.id} style={styles.photoRow}>
                    <Image source={{ uri: photo.image }} style={styles.photoThumb} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.photoTitle}>{`Gallery #${index + 1}`}</Text>
                      <Text style={styles.photoMeta}>{`Order ${photo.display_order || 0}`}</Text>
                    </View>
                    <View style={styles.photoActions}>
                      <Pressable
                        onPress={() => reorderPhoto(photo.id, -1)}
                        disabled={photoLoadingId === String(photo.id) || saving || index === 0}
                        style={({ pressed }) => [
                          styles.photoActionButton,
                          pressed ? styles.pressed : null,
                          photoLoadingId === String(photo.id) || saving || index === 0 ? styles.disabled : null,
                        ]}
                      >
                        <Text style={styles.photoActionText}>↑</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => reorderPhoto(photo.id, 1)}
                        disabled={photoLoadingId === String(photo.id) || saving || index === galleryPhotos.length - 1}
                        style={({ pressed }) => [
                          styles.photoActionButton,
                          pressed ? styles.pressed : null,
                          photoLoadingId === String(photo.id) || saving || index === galleryPhotos.length - 1 ? styles.disabled : null,
                        ]}
                      >
                        <Text style={styles.photoActionText}>↓</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removePhoto(photo.id)}
                        disabled={photoLoadingId === String(photo.id) || saving}
                        style={({ pressed }) => [
                          styles.photoDelete,
                          pressed ? styles.pressed : null,
                          photoLoadingId === String(photo.id) || saving ? styles.disabled : null,
                        ]}
                      >
                        <Text style={styles.promptDeleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pets</Text>
            <ToggleRow
              label="I travel with pets"
              value={hasPets}
              onChange={(value) => {
                setHasPets(value);
                if (!value) setPetType('');
              }}
              disabled={saving}
            />
            {hasPets ? (
              <SegmentedField
                label="Pet Type"
                value={petType}
                options={PET_TYPE_OPTIONS}
                onChange={setPetType}
                disabled={saving}
              />
            ) : null}
            <ToggleRow
              label="Only show pet-friendly meetups"
              value={petFriendlyOnly}
              onChange={setPetFriendlyOnly}
              disabled={saving}
              helper="Filter discovery to pet-friendly travelers."
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vehicle</Text>
            <ToggleRow
              label="I have a van/rig"
              value={hasVan}
              onChange={(value) => {
                setHasVan(value);
                clearFieldError('vehicle_type');
              }}
              disabled={saving}
            />

            {hasVan ? (
              <>
                <SegmentedField
                  label="Vehicle Type"
                  value={vehicleType}
                  options={VEHICLE_TYPE_OPTIONS}
                  onChange={(value) => {
                    setVehicleType(value);
                    clearFieldError('vehicle_type');
                  }}
                  disabled={saving}
                />
                {fieldErrors.vehicle_type ? <Text style={styles.errorText}>{fieldErrors.vehicle_type}</Text> : null}

                <FormTextInput
                  label="Nickname"
                  value={vehicleNickname}
                  onChangeText={setVehicleNickname}
                  placeholder="Rig nickname"
                  editable={!saving}
                />
                <FormTextInput
                  label="Make"
                  value={vehicleMake}
                  onChangeText={setVehicleMake}
                  placeholder="Ford, Mercedes, ..."
                  editable={!saving}
                />
                <FormTextInput
                  label="Model"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholder="Transit, Sprinter, ..."
                  editable={!saving}
                />
                <FormTextInput
                  label="Year"
                  value={vehicleYear}
                  onChangeText={(value) => {
                    setVehicleYear(value.replace(/[^0-9]/g, ''));
                    clearFieldError('vehicle_year');
                  }}
                  placeholder="2022"
                  keyboardType="number-pad"
                  editable={!saving}
                  error={fieldErrors.vehicle_year}
                />
                <SegmentedField
                  label="Build Status"
                  value={vehicleBuildStatus}
                  options={VEHICLE_BUILD_OPTIONS}
                  onChange={setVehicleBuildStatus}
                  disabled={saving}
                />

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Camping Preferences</Text>
                  <View style={styles.hobbyRow}>
                    {CAMPING_PREFERENCE_OPTIONS.map((option) => {
                      const selected = campingPreferences.includes(option.value);
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => toggleCampingPreference(option.value)}
                          disabled={saving}
                          style={({ pressed }) => [
                            styles.hobbyChip,
                            selected ? styles.hobbyChipActive : null,
                            pressed && !saving ? styles.pressed : null,
                            saving ? styles.disabled : null,
                          ]}
                        >
                          <Text style={[styles.hobbyText, selected ? styles.hobbyTextActive : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.actions}>
            <AppButton title={saving ? 'Saving…' : 'Save Changes'} onPress={onSave} disabled={!canSave} variant="primary" />
            <AppButton title="Cancel" onPress={() => navigation.goBack()} disabled={saving} variant="secondary" />
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
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '800',
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
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  fieldBlock: {
    gap: 6,
  },
  dateRow: {
    gap: 10,
  },
  label: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.danger,
  },
  bioInput: {
    minHeight: 96,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: -2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  segmentChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '800',
  },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleOn: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  toggleHelper: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  toggleValue: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  toggleValueOn: {
    color: colors.primary,
  },
  inlineStack: {
    gap: 8,
    marginTop: 4,
  },
  hobbyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  hobbyChipActive: {
    borderColor: colors.blue,
    backgroundColor: `${colors.blue}22`,
  },
  hobbyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  hobbyTextActive: {
    color: '#dbeafe',
    fontWeight: '800',
  },
  promptList: {
    gap: 8,
  },
  promptCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  promptQuestion: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  promptDelete: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  promptDeleteText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '800',
  },
  promptComposer: {
    gap: 8,
  },
  promptInput: {
    minHeight: 84,
  },
  uploadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uploadActionButton: {
    flexGrow: 1,
    minWidth: 150,
  },
  linkRow: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 8,
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  photoThumbWide: {
    width: 80,
  },
  photoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  photoMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  photoDelete: {
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoActionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});
