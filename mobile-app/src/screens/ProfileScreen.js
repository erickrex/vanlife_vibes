import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import AppButton from '../components/AppButton';
import ProfileAvatar from '../components/ProfileAvatar';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { profilesAPI } from '../services/api';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1400&q=80';

const TRAVEL_STATUS_LABELS = {
  'full-time': 'Full-time road life',
  'part-time': 'Part-time nomad',
  weekender: 'Weekend traveler',
  aspiring: 'Aspiring vanlifer',
};

const TRAVEL_COMPANIONS_LABELS = {
  solo: 'Solo',
  couple: 'Couple',
  family: 'Family',
  with_pets: 'With pets',
};

const WORK_STATUS_LABELS = {
  remote_worker: 'Remote worker',
  retired: 'Retired',
  seasonal_worker: 'Seasonal worker',
  unemployed: 'Not working now',
  other: 'Other',
};

const TRAVEL_PACE_LABELS = {
  slow: 'Slow travel',
  mixed: 'Mixed pace',
  fast: 'Fast mover',
};

const CAMPING_PREFERENCE_LABELS = {
  boondocking: 'Boondocking',
  campgrounds: 'Campgrounds',
  stealth_camping: 'Stealth camping',
  rv_parks: 'RV parks',
  friends_driveways: "Friends' driveways",
};

function normalizeProfile(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function toTitle(value) {
  if (!value) return '';
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout } = useAuth();

  const profileId = route.params?.profileId;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = profileId ? await profilesAPI.getProfile(profileId) : await profilesAPI.getMyProfile();
      setProfile(normalizeProfile(response));
    } catch (err) {
      setError(err.message || 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isOwnProfile = useMemo(() => {
    if (!profile) return !profileId;
    if (!profileId) return true;
    if (!user?.id) return false;
    return String(user.id) === String(profile.user_id);
  }, [profile, profileId, user?.id]);

  useEffect(() => {
    if (!profile?.display_name) return;
    navigation.setOptions({
      title: isOwnProfile ? 'My Profile' : profile.display_name,
    });
  }, [isOwnProfile, navigation, profile?.display_name]);

  const photoGallery = useMemo(() => {
    if (!profile) return [];
    const galleryUrls = Array.isArray(profile?.gallery_photos)
      ? profile.gallery_photos.map((photo) => photo?.url).filter(Boolean)
      : [];
    const vehicleUrls = Array.isArray(profile?.vehicle?.photos)
      ? profile.vehicle.photos.map((photo) => photo?.url).filter(Boolean)
      : [];
    return [...galleryUrls, ...vehicleUrls];
  }, [profile]);

  const quickFacts = useMemo(() => {
    if (!profile) return [];
    const facts = [];
    if (profile.travel_status) {
      facts.push({ label: 'Travel style', value: TRAVEL_STATUS_LABELS[profile.travel_status] || toTitle(profile.travel_status) });
    }
    if (profile.travel_companions) {
      facts.push({ label: 'Crew', value: TRAVEL_COMPANIONS_LABELS[profile.travel_companions] || toTitle(profile.travel_companions) });
    }
    if (profile.travel_pace) {
      facts.push({ label: 'Pace', value: TRAVEL_PACE_LABELS[profile.travel_pace] || toTitle(profile.travel_pace) });
    }
    if (profile.work_status) {
      facts.push({ label: 'Work mode', value: WORK_STATUS_LABELS[profile.work_status] || toTitle(profile.work_status) });
    }
    if (profile.social_vibe) {
      facts.push({ label: 'Social vibe', value: toTitle(profile.social_vibe) });
    }
    if (profile.rig_status) {
      facts.push({ label: 'Rig', value: toTitle(profile.rig_status) });
    }
    return facts.slice(0, 6);
  }, [profile]);

  const highlights = useMemo(() => {
    if (!profile) return [];
    const list = [];
    if (profile.profile_type) list.push(toTitle(profile.profile_type));
    if (profile.lifestyle_schedule) list.push(toTitle(profile.lifestyle_schedule));
    if (profile.lifestyle_environment) list.push(toTitle(profile.lifestyle_environment));
    if (profile.has_pets) list.push(profile.pet_type ? `${toTitle(profile.pet_type)} companion` : 'Pet companion');
    if (profile.current_location) list.push(`Based around ${profile.current_location}`);
    return list.slice(0, 5);
  }, [profile]);

  const stats = useMemo(() => {
    return [
      { label: 'Photos', value: photoGallery.length || 0 },
      { label: 'Interests', value: profile?.hobbies?.length || 0 },
      { label: 'Prompts', value: profile?.prompts?.length || 0 },
    ];
  }, [photoGallery.length, profile?.hobbies?.length, profile?.prompts?.length]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </Screen>
    );
  }

  if (error && !profile) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Try Again" onPress={loadProfile} variant="primary" />
        </View>
      </Screen>
    );
  }

  if (!profile) return null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topCard}>
          <Image source={{ uri: profile.cover_url || DEFAULT_COVER }} style={styles.cover} resizeMode="cover" />
          <View style={styles.avatarWrap}>
            <ProfileAvatar uri={profile.avatar_url} name={profile.display_name} size={94} />
          </View>
          <View style={styles.topBody}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{profile.display_name || 'Anonymous'}</Text>
                {profile.username ? <Text style={styles.username}>{`@${profile.username}`}</Text> : null}
              </View>
              {isOwnProfile ? (
                <Pressable
                  onPress={() => navigation.navigate('ProfileEdit')}
                  style={({ pressed }) => [styles.editChip, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.editChipText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {(profile.looking_for_dating || profile.looking_for_friends) && (
              <View style={styles.intentRow}>
                {profile.looking_for_dating ? (
                  <View style={[styles.intentChip, styles.intentDating]}>
                    <Text style={styles.intentText}>Dating</Text>
                  </View>
                ) : null}
                {profile.looking_for_friends ? (
                  <View style={[styles.intentChip, styles.intentFriends]}>
                    <Text style={styles.intentText}>Friends</Text>
                  </View>
                ) : null}
              </View>
            )}

            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            {highlights.length > 0 ? (
              <View style={styles.highlightRow}>
                {highlights.map((tag) => (
                  <View key={tag} style={styles.highlightChip}>
                    <Text style={styles.highlightText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {isOwnProfile ? (
          <View style={styles.actionRow}>
            <AppButton title="Edit Profile" onPress={() => navigation.navigate('ProfileEdit')} variant="primary" style={styles.flexButton} />
            <AppButton title="Welcome" onPress={() => navigation.navigate('Welcome')} variant="secondary" style={styles.flexButton} />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick Facts</Text>
          {quickFacts.length > 0 ? (
            <View style={styles.quickFactsGrid}>
              {quickFacts.map((fact) => (
                <View key={fact.label} style={styles.quickFact}>
                  <Text style={styles.quickFactLabel}>{fact.label}</Text>
                  <Text style={styles.quickFactValue}>{fact.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No quick facts yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Locations</Text>
          {profile.now_in_city ? (
            <View style={[styles.locationRow, styles.locationNow]}>
              <Text style={styles.locationLabel}>Now</Text>
              <Text style={styles.locationValue}>{profile.now_in_city}</Text>
            </View>
          ) : null}
          {profile.next_week_in_city ? (
            <View style={[styles.locationRow, styles.locationNextWeek]}>
              <Text style={styles.locationLabel}>Next Week</Text>
              <Text style={styles.locationValue}>{profile.next_week_in_city}</Text>
            </View>
          ) : null}
          {profile.next_month_in_city ? (
            <View style={[styles.locationRow, styles.locationNextMonth]}>
              <Text style={styles.locationLabel}>Next Month</Text>
              <Text style={styles.locationValue}>{profile.next_month_in_city}</Text>
            </View>
          ) : null}
          {!profile.now_in_city && !profile.next_week_in_city && !profile.next_month_in_city ? (
            <Text style={styles.emptyText}>No location timeline set.</Text>
          ) : null}
        </View>

        {photoGallery.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photo Highlights</Text>
            <View style={styles.galleryGrid}>
              {photoGallery.map((photoUrl, index) => (
                <Image
                  key={`${photoUrl}-${index + 1}`}
                  source={{ uri: photoUrl }}
                  style={[styles.galleryPhoto, index === 0 ? styles.galleryPhotoLarge : null]}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>
        ) : null}

        {profile?.hobbies?.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.hobbyRow}>
              {profile.hobbies.map((hobby) => (
                <View key={hobby.id || hobby.slug || hobby.name} style={styles.hobbyChip}>
                  <Text style={styles.hobbyText}>{hobby.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profile?.prompts?.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <View style={styles.promptList}>
              {profile.prompts.map((prompt) => (
                <View key={prompt.id} style={styles.promptCard}>
                  <Text style={styles.promptQuestion}>{prompt.prompt_question}</Text>
                  <Text style={styles.promptAnswer}>{prompt.prompt_answer}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profile?.has_van ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rig & Camping</Text>
            <View style={styles.quickFactsGrid}>
              {profile?.vehicle?.nickname ? (
                <View style={styles.quickFact}>
                  <Text style={styles.quickFactLabel}>Rig Name</Text>
                  <Text style={styles.quickFactValue}>{profile.vehicle.nickname}</Text>
                </View>
              ) : null}
              {profile?.vehicle?.make || profile?.vehicle?.model ? (
                <View style={styles.quickFact}>
                  <Text style={styles.quickFactLabel}>Vehicle</Text>
                  <Text style={styles.quickFactValue}>
                    {`${profile?.vehicle?.year ? `${profile.vehicle.year} ` : ''}${profile?.vehicle?.make || ''} ${profile?.vehicle?.model || ''}`.trim()}
                  </Text>
                </View>
              ) : null}
            </View>

            {Array.isArray(profile?.camping_preferences) && profile.camping_preferences.length > 0 ? (
              <View style={styles.hobbyRow}>
                {profile.camping_preferences.map((preference) => (
                  <View key={preference} style={styles.highlightChip}>
                    <Text style={styles.highlightText}>{CAMPING_PREFERENCE_LABELS[preference] || toTitle(preference)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {isOwnProfile ? (
          <View style={styles.actionRow}>
            <AppButton title="Subscription" onPress={() => navigation.navigate('Subscription')} variant="secondary" style={styles.flexButton} />
            <AppButton title="Matches" onPress={() => navigation.navigate('Matches')} variant="secondary" style={styles.flexButton} />
            <AppButton title="Log out" onPress={logout} variant="danger" style={styles.flexButton} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '800',
  },
  container: {
    paddingBottom: 30,
  },
  topCard: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: 180,
  },
  avatarWrap: {
    position: 'absolute',
    top: 133,
    left: 20,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: colors.card,
    overflow: 'hidden',
  },
  topBody: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  username: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  editChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  editChipText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  intentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intentChip: {
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  intentDating: {
    backgroundColor: `${colors.rose}22`,
    borderWidth: 1,
    borderColor: `${colors.rose}44`,
  },
  intentFriends: {
    backgroundColor: `${colors.blue}22`,
    borderWidth: 1,
    borderColor: `${colors.blue}44`,
  },
  intentText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  bio: {
    color: colors.secondary,
    lineHeight: 20,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  highlightText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  flexButton: {
    flex: 1,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  quickFactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFact: {
    width: '47%',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: 10,
    gap: 3,
  },
  quickFactLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  quickFactValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  locationNow: {
    borderColor: `${colors.emerald}44`,
    backgroundColor: `${colors.emerald}14`,
  },
  locationNextWeek: {
    borderColor: `${colors.blue}44`,
    backgroundColor: `${colors.blue}14`,
  },
  locationNextMonth: {
    borderColor: `${colors.primary}44`,
    backgroundColor: `${colors.primary}14`,
  },
  locationLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    width: 80,
  },
  locationValue: {
    color: colors.text,
    fontWeight: '800',
    flex: 1,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  galleryPhoto: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
  },
  galleryPhotoLarge: {
    width: '100%',
    aspectRatio: 1.6,
  },
  hobbyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hobbyText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  promptList: {
    gap: 10,
  },
  promptCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
  promptQuestion: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  promptAnswer: {
    color: colors.secondary,
    lineHeight: 19,
  },
});
