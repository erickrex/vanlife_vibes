import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { eventsAPI } from '../services/api';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { formatEventDate, getEventTypeEmoji, getEventTypeInfo, getTimeWindowEmoji, getTimeWindowInfo } from '../utils/events';

const SWIPE_ANIM_MS = 260;

function EventCard({ event }) {
  const typeInfo = useMemo(() => getEventTypeInfo(event?.event_type), [event?.event_type]);
  const typeEmoji = useMemo(() => getEventTypeEmoji(event?.event_type), [event?.event_type]);
  const timeInfo = useMemo(() => getTimeWindowInfo(event?.time_window), [event?.time_window]);
  const timeEmoji = useMemo(() => getTimeWindowEmoji(event?.time_window), [event?.time_window]);
  const attendeeCount = event?.attendee_count || 0;
  const spotsRemaining = event?.spots_remaining ?? Math.max((event?.spots || 0) - attendeeCount, 0);

  return (
    <View style={styles.cardInner}>
      <View style={styles.header}>
        <Text style={styles.badge}>{`${typeEmoji} ${typeInfo.label}`}</Text>
        <Text style={styles.status}>{event?.status || 'open'}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {event?.title || 'Event'}
      </Text>

      <View style={styles.metaList}>
        <Text style={styles.metaLine}>{`📅 ${formatEventDate(event?.event_date)}`}</Text>
        <Text style={styles.metaLine}>{`${timeEmoji} ${timeInfo.label}${timeInfo.time ? ` (${timeInfo.time})` : ''}`}</Text>
        <Text style={styles.metaLine}>{`📍 ${event?.location || 'Location TBD'}`}</Text>
        <Text style={styles.metaLine}>{`👥 ${attendeeCount}/${event?.spots || 0} attending`}</Text>
      </View>

      {event?.description ? (
        <Text style={styles.description} numberOfLines={4}>
          {event.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{`Hosted by ${event?.created_by?.display_name || 'Anonymous'}`}</Text>
        <Text style={styles.footerText}>{`${spotsRemaining} spots remaining`}</Text>
      </View>
    </View>
  );
}

export default function EventSwipeDeck({ events = [], onSwipe, onMatch, onEmpty, onOpenEvent, onOpenChat }) {
  const [{ width, height }] = useState(() => Dimensions.get('window'));
  const swipeThreshold = Math.max(80, Math.min(width * 0.25, 150));
  const cardHeight = Math.min(height * 0.62, 560);

  const position = useRef(new Animated.ValueXY()).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchedEvent, setMatchedEvent] = useState(null);

  const activeEvent = events[currentIndex];
  const nextEvent = events[currentIndex + 1];

  useEffect(() => {
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
  }, [events, position]);

  useEffect(() => {
    if (events.length > 0 && currentIndex >= events.length) onEmpty?.();
  }, [currentIndex, events.length, onEmpty]);

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

  const finalizeSwipe = useCallback(async (direction, event) => {
    const isLike = direction === 'right';
    try {
      setIsProcessing(true);
      const response = await eventsAPI.swipe(event.id, isLike);
      const data = response?.data?.data ?? response?.data;
      if (data?.matched) {
        setMatchedEvent(data?.event || event);
        setMatchVisible(true);
        onMatch?.(event, data);
      }
      onSwipe?.(direction, event, data);
    } catch (err) {
      onSwipe?.(direction, event, { error: err.message || 'Swipe failed' });
    } finally {
      setIsProcessing(false);
    }
  }, [onMatch, onSwipe]);

  const forceSwipe = useCallback((direction) => {
    if (!activeEvent || isProcessing) return;
    const x = direction === 'right' ? width * 1.2 : -width * 1.2;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: SWIPE_ANIM_MS,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) => prev + 1);
      finalizeSwipe(direction, activeEvent);
    });
  }, [activeEvent, finalizeSwipe, isProcessing, position, width]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !isProcessing,
      onMoveShouldSetPanResponder: (_, gesture) => !isProcessing && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (isProcessing) return;
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
  }, [forceSwipe, isProcessing, position.x, position.y, swipeThreshold]);

  if (!activeEvent) return null;

  return (
    <View style={[styles.deck, { height: cardHeight }]}>
      {nextEvent ? (
        <View style={[styles.card, styles.nextCard]}>
          <EventCard event={nextEvent} />
        </View>
      ) : null}

      <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
        <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: likeOpacity }]}>
          <Text style={[styles.overlayText, styles.likeOverlay]}>LIKE</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.overlay, styles.overlayLeft, { opacity: passOpacity }]}>
          <Text style={[styles.overlayText, styles.passOverlay]}>PASS</Text>
        </Animated.View>
        <EventCard event={activeEvent} />
      </Animated.View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => forceSwipe('left')}
          disabled={isProcessing}
          style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null, isProcessing ? styles.disabled : null]}
        >
          <Text style={styles.actionLabel}>Pass</Text>
        </Pressable>

        <Pressable
          onPress={() => onOpenEvent?.(activeEvent?.id)}
          style={({ pressed }) => [styles.actionButton, styles.detailsButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.actionLabel}>Details</Text>
        </Pressable>

        <Pressable
          onPress={() => forceSwipe('right')}
          disabled={isProcessing}
          style={({ pressed }) => [styles.actionButton, styles.likeButton, pressed ? styles.pressed : null, isProcessing ? styles.disabled : null]}
        >
          <Text style={styles.likeLabel}>Like</Text>
        </Pressable>
      </View>

      <Modal visible={matchVisible} transparent animationType="fade" onRequestClose={() => setMatchVisible(false)}>
        <View style={styles.matchBackdrop}>
          <View style={styles.matchCard}>
            <Text style={styles.matchTitle}>Event matched</Text>
            <Text style={styles.matchBody}>{matchedEvent?.title || 'Your event is now matched.'}</Text>
            <View style={styles.matchActions}>
              <Pressable onPress={() => setMatchVisible(false)} style={({ pressed }) => [styles.matchButton, pressed ? styles.pressed : null]}>
                <Text style={styles.matchButtonText}>Keep swiping</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMatchVisible(false);
                  if (matchedEvent?.id) onOpenChat?.(matchedEvent.id);
                }}
                style={({ pressed }) => [styles.matchButton, styles.matchPrimaryButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.matchPrimaryText}>Open chat</Text>
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
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 64,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  nextCard: {
    transform: [{ scale: 0.96 }, { translateY: 10 }],
    opacity: 0.7,
  },
  cardInner: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.full,
  },
  status: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  metaList: {
    gap: 6,
  },
  metaLine: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    color: colors.secondary,
    lineHeight: 19,
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 12,
    gap: 2,
  },
  footerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
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
  likeOverlay: {
    borderColor: colors.emerald,
    color: colors.emerald,
  },
  passOverlay: {
    borderColor: colors.muted,
    color: colors.muted,
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButton: {
    backgroundColor: colors.card,
  },
  likeButton: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldSoft,
  },
  actionLabel: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  likeLabel: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 13,
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
    gap: 10,
  },
  matchTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  matchBody: {
    color: colors.muted,
    lineHeight: 20,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  matchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchPrimaryButton: {
    borderColor: colors.emerald,
    backgroundColor: colors.emerald,
  },
  matchButtonText: {
    color: colors.text,
    fontWeight: '900',
  },
  matchPrimaryText: {
    color: colors.primaryText,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
});
