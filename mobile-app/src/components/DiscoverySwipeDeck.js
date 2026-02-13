import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { discoveryAPI } from '../services/api';
import { colors } from '../theme/colors';
import { componentTokens, radius, shadow } from '../theme/tokens';
import { normalizeImageUrl } from '../utils/imageUrl';
import ProfileAvatar from './ProfileAvatar';
import { buildCompatibilityChips } from '../utils/compatibility';

const SWIPE_ANIM_MS = 260;

function prettyMode(mode) {
  return mode === 'friends' ? 'Friends' : 'Dating';
}

function firstNameFromDisplayName(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
}

function buildSwipePhotos(profile) {
  const candidates = [
    normalizeImageUrl(profile?.cover_url || ''),
    normalizeImageUrl(profile?.avatar_url || ''),
    ...(Array.isArray(profile?.gallery_photos) ? profile.gallery_photos.map((url) => normalizeImageUrl(url || '')) : []),
  ];
  const unique = [];
  for (const url of candidates) {
    if (!url) continue;
    if (!unique.includes(url)) unique.push(url);
    if (unique.length >= 5) break;
  }
  return unique;
}

function CardContent({ profile, currentProfile, photoUrls = [], photoIndex = 0 }) {
  const chips = useMemo(() => buildCompatibilityChips(currentProfile, profile, 5), [currentProfile, profile]);

  const rawDisplayName = profile?.display_name || profile?.username || 'Unknown';
  const firstName = firstNameFromDisplayName(rawDisplayName) || 'Unknown';
  const age = Number.isInteger(profile?.age) ? profile.age : null;
  const displayName = age ? `${firstName}, ${age}` : firstName;
  const location = profile?.now_in_city || profile?.current_location || '';
  const bio = profile?.bio || '';
  const [failedUrls, setFailedUrls] = useState([]);

  useEffect(() => {
    setFailedUrls([]);
  }, [profile?.id, photoUrls]);

  const usablePhotoUrls = useMemo(
    () => photoUrls.filter((url) => !!url && !failedUrls.includes(url)),
    [failedUrls, photoUrls],
  );
  const safePhotoIndex = usablePhotoUrls.length > 0 ? Math.max(0, Math.min(photoIndex, usablePhotoUrls.length - 1)) : 0;
  const activePhotoUrl = usablePhotoUrls[safePhotoIndex] || '';

  const overlapBadge = useMemo(() => {
    const windows = profile?.overlap_windows;
    if (!windows || windows.length === 0) return null;
    const w = windows[0];
    const fmt = (iso) => {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    return `📍 ${w.city_area} · ${fmt(w.start_date)} – ${fmt(w.end_date)}`;
  }, [profile?.overlap_windows]);

  return (
    <View style={styles.cardInner}>
      <View style={styles.photoWrap}>
        {activePhotoUrl ? (
          <Animated.Image
            source={{ uri: activePhotoUrl }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => {
              setFailedUrls((prev) => (prev.includes(activePhotoUrl) ? prev : [...prev, activePhotoUrl]));
            }}
          />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoFallbackText}>{firstName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        {photoUrls.length > 1 ? (
          <View style={styles.photoPagerRow}>
            {photoUrls.map((url, index) => (
              <View
                key={`${profile?.id || 'profile'}-photo-${index}-${url}`}
                style={[
                  styles.photoPagerSlice,
                  index === safePhotoIndex ? styles.photoPagerSliceActive : null,
                ]}
              />
            ))}
          </View>
        ) : null}
        <View style={styles.photoOverlay} />
      </View>

      <View style={styles.cardMeta}>
        {overlapBadge ? (
          <View style={styles.overlapBadge}>
            <Text style={styles.overlapBadgeText}>{overlapBadge}</Text>
          </View>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {location ? (
          <Text style={styles.location} numberOfLines={1}>
            📍 {location}
          </Text>
        ) : null}

        {bio ? (
          <Text style={styles.bio} numberOfLines={3}>
            {bio}
          </Text>
        ) : null}

        {chips.length > 0 ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipsLabel}>Why you might match</Text>
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function DiscoverySwipeDeck({
  profiles = [],
  mode = 'dating',
  currentProfile,
  onSwipe,
  onMatch,
  onEmpty,
  onNavigateToChat,
  accentColor,
  swipesDisabled = false,
  onSwipeLimitReached,
}) {
  const [width, setWidth] = useState(360);
  const swipeThreshold = Math.max(80, Math.min(width * 0.25, 150));
  const rightActionIcon = mode === 'friends' ? '✓' : '❤';
  const rightActionLabel = mode === 'friends' ? 'Connect' : 'Like';
  const totalProfiles = profiles.length;
  const progressSlices = Math.min(5, Math.max(totalProfiles, 1));
  const progressIndex = totalProfiles <= 1
    ? 0
    : Math.min(
        progressSlices - 1,
        Math.floor((currentIndex / Math.max(totalProfiles - 1, 1)) * progressSlices)
      );

  const position = useRef(new Animated.ValueXY()).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState({});

  const [matchVisible, setMatchVisible] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const matchHeartScale = useRef(new Animated.Value(0.6)).current;
  const matchHeartOpacity = useRef(new Animated.Value(0)).current;
  const matchRingScale = useRef(new Animated.Value(0.65)).current;
  const matchRingOpacity = useRef(new Animated.Value(0)).current;
  const floatingHeartAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const heartPulseLoopRef = useRef(null);
  const floatingHeartLoopsRef = useRef([]);
  const floatingHeartOffsets = useMemo(() => [-54, -26, 0, 26, 54], []);

  const activeProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

  useEffect(() => {
    setCurrentIndex(0);
    setPhotoIndexes({});
    position.setValue({ x: 0, y: 0 });
  }, [profiles, position]);

  const profilePhotoMap = useMemo(() => {
    const map = {};
    for (const profile of profiles) {
      map[String(profile?.id)] = buildSwipePhotos(profile);
    }
    return map;
  }, [profiles]);

  const getPhotoUrls = useCallback(
    (profile) => profilePhotoMap[String(profile?.id)] || [],
    [profilePhotoMap],
  );

  const getPhotoIndex = useCallback(
    (profile) => {
      const profileId = String(profile?.id || '');
      const urls = getPhotoUrls(profile);
      const current = photoIndexes[profileId] || 0;
      if (urls.length <= 1) return 0;
      return Math.max(0, Math.min(current, urls.length - 1));
    },
    [getPhotoUrls, photoIndexes],
  );

  const changePhoto = useCallback(
    (profile, direction) => {
      const profileId = String(profile?.id || '');
      if (!profileId) return;
      const urls = getPhotoUrls(profile);
      if (urls.length <= 1) return;
      setPhotoIndexes((prev) => {
        const current = prev[profileId] || 0;
        const next = direction < 0
          ? (current - 1 + urls.length) % urls.length
          : (current + 1) % urls.length;
        if (next === current) return prev;
        return { ...prev, [profileId]: next };
      });
    },
    [getPhotoUrls],
  );

  useEffect(() => {
    if (profiles.length > 0 && currentIndex >= profiles.length) {
      onEmpty?.();
    }
  }, [currentIndex, onEmpty, profiles.length]);

  useEffect(() => {
    const stopMatchAnimations = () => {
      if (heartPulseLoopRef.current) {
        heartPulseLoopRef.current.stop();
        heartPulseLoopRef.current = null;
      }
      if (floatingHeartLoopsRef.current.length > 0) {
        floatingHeartLoopsRef.current.forEach((animation) => animation?.stop?.());
        floatingHeartLoopsRef.current = [];
      }
    };

    if (!matchVisible) {
      stopMatchAnimations();
      return undefined;
    }

    matchHeartScale.setValue(0.6);
    matchHeartOpacity.setValue(0);
    matchRingScale.setValue(0.65);
    matchRingOpacity.setValue(0);
    floatingHeartAnims.forEach((anim) => anim.setValue(0));

    Animated.parallel([
      Animated.spring(matchHeartScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 100,
      }),
      Animated.timing(matchHeartOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(matchRingScale, {
            toValue: 1.25,
            duration: 540,
            useNativeDriver: true,
          }),
          Animated.timing(matchRingOpacity, {
            toValue: 0.7,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(matchRingOpacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(matchHeartScale, {
            toValue: 1.12,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(matchHeartScale, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
        ]),
      );
      heartPulseLoopRef.current = pulse;
      pulse.start();
    });

    floatingHeartLoopsRef.current = floatingHeartAnims.map((anim, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => {
      stopMatchAnimations();
    };
  }, [
    floatingHeartAnims,
    matchHeartOpacity,
    matchHeartScale,
    matchRingOpacity,
    matchRingScale,
    matchVisible,
  ]);

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, swipeThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-swipeThreshold, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const cardStyle = {
    transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 7,
    }).start();
  };

  const finalizeSwipe = useCallback(
    async (direction, profile) => {
      const isLike = direction === 'right';

      try {
        setIsProcessing(true);
        const response = await discoveryAPI.swipe({
          swiped_on: profile.id,
          is_like: isLike,
          mode,
        });
        const data = response.data.data || response.data;
        if (data?.is_match) {
          const match = data.match || null;
          setMatchedProfile(match?.matched_with ? match.matched_with : profile);
          setMatchId(match?.id || null);
          setMatchVisible(true);
          onMatch?.(profile, match);
        }
        onSwipe?.(direction, profile, data);
      } catch (err) {
        onSwipe?.(direction, profile, { error: err.message || 'Swipe failed' });
      } finally {
        setIsProcessing(false);
      }
    },
    [mode, onMatch, onSwipe],
  );

  const forceSwipe = useCallback(
    (direction) => {
      if (!activeProfile || isProcessing) return;
      if (swipesDisabled) {
        onSwipeLimitReached?.();
        return;
      }

      const x = direction === 'right' ? width * 1.2 : -width * 1.2;
      Animated.timing(position, {
        toValue: { x, y: 0 },
        duration: SWIPE_ANIM_MS,
        useNativeDriver: true,
      }).start(() => {
        position.setValue({ x: 0, y: 0 });
        setCurrentIndex((prev) => prev + 1);
        finalizeSwipe(direction, activeProfile);
      });
    },
    [activeProfile, finalizeSwipe, isProcessing, onSwipeLimitReached, position, swipesDisabled, width],
  );

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !isProcessing,
      onMoveShouldSetPanResponder: (_, gesture) => !isProcessing && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (isProcessing) return;
        const isTap = Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6;
        if (isTap && activeProfile) {
          changePhoto(activeProfile, 1);
          return;
        }
        if (swipesDisabled) {
          onSwipeLimitReached?.();
          resetPosition();
          return;
        }
        if (gesture.dx > swipeThreshold) {
          forceSwipe('right');
          return;
        }
        if (gesture.dx < -swipeThreshold) {
          forceSwipe('left');
          return;
        }
        resetPosition();
      },
    });
  }, [activeProfile, changePhoto, forceSwipe, isProcessing, position.x, position.y, swipesDisabled, swipeThreshold]);

  const closeMatch = () => {
    setMatchVisible(false);
    setMatchedProfile(null);
    setMatchId(null);
  };

  const handleSendMessage = () => {
    closeMatch();
    if (onNavigateToChat && matchId) onNavigateToChat(matchId);
  };

  if (!activeProfile) {
    return null;
  }

  return (
    <View
      style={styles.deck}
      onLayout={(event) => {
        const { width: nextWidth } = event.nativeEvent.layout;
        if (nextWidth && Math.abs(nextWidth - width) > 1) setWidth(nextWidth);
      }}
    >
      <View style={styles.deckTopRow}>
        <View style={styles.progressRow}>
          {Array.from({ length: progressSlices }).map((_, index) => (
            <View
              key={`progress-${index}`}
              style={[
                styles.progressSlice,
                index <= progressIndex
                  ? { backgroundColor: accentColor || colors.primary }
                  : styles.progressSliceMuted,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressCount}>{`${Math.min(currentIndex + 1, totalProfiles)} / ${totalProfiles}`}</Text>
      </View>

      {nextProfile ? (
        <View style={[styles.card, styles.nextCard]}>
          <CardContent
            profile={nextProfile}
            currentProfile={currentProfile}
            photoUrls={getPhotoUrls(nextProfile)}
            photoIndex={getPhotoIndex(nextProfile)}
          />
        </View>
      ) : null}

      <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
        <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: likeOpacity }]}>
          <Text style={[styles.overlayText, { borderColor: accentColor || colors.primary, color: accentColor || colors.primary }]}>
            {mode === 'friends' ? 'CONNECT' : 'LIKE'}
          </Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.overlay, styles.overlayLeft, { opacity: passOpacity }]}>
          <Text style={[styles.overlayText, styles.passOverlayText]}>PASS</Text>
        </Animated.View>

        <CardContent
          profile={activeProfile}
          currentProfile={currentProfile}
          photoUrls={getPhotoUrls(activeProfile)}
          photoIndex={getPhotoIndex(activeProfile)}
        />
      </Animated.View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            if (swipesDisabled) { onSwipeLimitReached?.(); return; }
            forceSwipe('left');
          }}
          disabled={isProcessing}
          style={({ pressed }) => [styles.actionButton, styles.passButton, pressed ? styles.pressed : null, (isProcessing || swipesDisabled) ? styles.disabled : null]}
        >
          <Text style={[styles.actionEmoji, { color: componentTokens.discovery.pass.iconColor }]}>✕</Text>
          <Text style={[styles.actionLabel, { color: componentTokens.discovery.pass.labelColor }]}>Pass</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (swipesDisabled) { onSwipeLimitReached?.(); return; }
            forceSwipe('right');
          }}
          disabled={isProcessing}
          style={({ pressed }) => [
            styles.actionButton,
            styles.likeButton,
            {
              borderColor: `${(accentColor || colors.primary)}cc`,
              backgroundColor: `${(accentColor || colors.primary)}4d`,
              shadowColor: accentColor || colors.primary,
            },
            pressed ? styles.pressed : null,
            (isProcessing || swipesDisabled) ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.actionEmoji, { color: componentTokens.discovery.like.iconColor }]}>{rightActionIcon}</Text>
          <Text style={[styles.actionLabel, { color: componentTokens.discovery.like.labelColor }]}>{rightActionLabel}</Text>
        </Pressable>
      </View>

      <Modal visible={matchVisible} transparent animationType="fade" onRequestClose={closeMatch}>
        <View style={styles.matchBackdrop}>
          <View style={styles.matchCard}>
            <View style={styles.matchAnimationWrap}>
              <Animated.View
                style={[
                  styles.matchRing,
                  {
                    opacity: matchRingOpacity,
                    transform: [{ scale: matchRingScale }],
                  },
                ]}
              />
              {floatingHeartAnims.map((anim, index) => (
                <Animated.Text
                  key={`float-heart-${index}`}
                  style={[
                    styles.matchFloatingHeart,
                    {
                      marginLeft: floatingHeartOffsets[index],
                      opacity: anim.interpolate({
                        inputRange: [0, 0.15, 0.75, 1],
                        outputRange: [0, 0.85, 0.45, 0],
                      }),
                      transform: [
                        {
                          translateY: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, -88 - index * 8],
                          }),
                        },
                        {
                          scale: anim.interpolate({
                            inputRange: [0, 0.22, 1],
                            outputRange: [0.6, 1.12, 0.88],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  ❤
                </Animated.Text>
              ))}
              <Animated.Text
                style={[
                  styles.matchHeart,
                  {
                    opacity: matchHeartOpacity,
                    transform: [{ scale: matchHeartScale }],
                  },
                ]}
              >
                ❤
              </Animated.Text>
            </View>
            <Text style={styles.matchTitle}>It's a match!</Text>
            <Text style={styles.matchSubtitle}>{`You matched in ${prettyMode(mode)}.`}</Text>
            <ProfileAvatar uri={matchedProfile?.avatar_url} name={matchedProfile?.display_name} size={72} />
            <Text style={styles.matchName}>{matchedProfile?.display_name || 'New match'}</Text>

            <View style={styles.matchActions}>
              <Pressable onPress={closeMatch} style={({ pressed }) => [styles.matchButton, pressed ? styles.pressed : null]}>
                <Text style={styles.matchButtonText}>Keep swiping</Text>
              </Pressable>
              <Pressable
                onPress={handleSendMessage}
                style={({ pressed }) => [
                  styles.matchButton,
                  { borderColor: accentColor || colors.primary, backgroundColor: accentColor || colors.primary },
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.matchButtonText, { color: colors.primaryText }]}>Message</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
    minHeight: 360,
    width: '100%',
    position: 'relative',
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSlice: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
  },
  progressSliceMuted: {
    backgroundColor: colors.borderStrong,
  },
  progressCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    minWidth: 42,
    textAlign: 'right',
  },
  card: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    bottom: 84,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    overflow: 'hidden',
    shadowColor: colors.bg,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 22,
    elevation: 9,
    ...shadow.elevated,
  },
  nextCard: {
    transform: [{ scale: 0.975 }, { translateY: 6 }],
    opacity: 0.58,
  },
  cardInner: {
    flex: 1,
  },
  photoWrap: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: {
    color: colors.muted,
    fontSize: 54,
    fontWeight: '900',
  },
  photoPagerRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 3,
  },
  photoPagerSlice: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  photoPagerSliceActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  photoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '36%',
    backgroundColor: 'rgba(22,12,10,0.52)',
  },
  passOverlayText: {
    borderColor: colors.danger,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  cardMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    gap: 4,
  },
  overlapBadge: {
    borderWidth: 1,
    borderColor: `${colors.emerald}80`,
    backgroundColor: `${colors.emerald}26`,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  overlapBadgeText: {
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  name: {
    color: colors.onImageText || colors.text,
    fontSize: 28,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  location: {
    color: colors.onImageSecondary || colors.secondary,
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bio: {
    color: colors.onImageSecondary || colors.secondary,
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chipsWrap: {
    gap: 4,
  },
  chipsLabel: {
    color: colors.onImageSecondary || colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.onImageChipBorder || colors.borderStrong,
    backgroundColor: colors.onImageChipBg || colors.bgElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  chipText: {
    color: colors.onImageText || colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  overlay: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
  },
  overlayLeft: {
    left: 18,
    right: 'auto',
  },
  overlayText: {
    borderWidth: 3,
    borderRadius: radius.lg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    backgroundColor: colors.overlaySoft,
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    shadowColor: colors.bg,
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 9,
  },
  passButton: {
    backgroundColor: componentTokens.discovery.pass.backgroundColor,
    borderColor: componentTokens.discovery.pass.borderColor,
    shadowColor: componentTokens.discovery.pass.shadowColor,
  },
  likeButton: {
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 10,
  },
  actionEmoji: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
  },
  actionLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
  matchBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  matchCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  matchAnimationWrap: {
    width: 168,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  matchRing: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2,
    borderColor: `${colors.rose}88`,
    backgroundColor: `${colors.rose}10`,
  },
  matchHeart: {
    color: colors.rose,
    fontSize: 62,
    fontWeight: '900',
    textShadowColor: `${colors.rose}88`,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 14,
  },
  matchFloatingHeart: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    color: colors.rose,
    fontSize: 22,
    fontWeight: '900',
  },
  matchTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  matchSubtitle: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: -6,
  },
  matchName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  matchActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  matchButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  matchButtonText: {
    color: colors.text,
    fontWeight: '900',
  },
});
