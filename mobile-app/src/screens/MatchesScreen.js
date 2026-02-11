import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import AppButton from '../components/AppButton';
import ProfileAvatar from '../components/ProfileAvatar';
import Screen from '../components/Screen';
import { matchesAPI } from '../services/api';
import { createRealtimeSocket } from '../services/realtime';
import { colors } from '../theme/colors';

function normalizeListResponse(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function getSortTime(match) {
  const timestamp = match?.last_message?.created_at || match?.matched_at;
  const parsed = timestamp ? new Date(timestamp).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatPreviewText(match) {
  if (!match?.last_message?.content) return 'New match';
  const content = match.last_message.content.trim();
  if (!content) return 'New match';
  return content.length > 64 ? `${content.slice(0, 64)}…` : content;
}

export default function MatchesScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const initialFilter = route.params?.initialFilter;
  const [filterMode, setFilterMode] = useState(initialFilter || 'all');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

  const loadMatches = useCallback(async (options = {}) => {
    const { silent = false } = options;
    try {
      if (!silent) setLoading(true);
      setError('');
      const response = await matchesAPI.list();
      setMatches(normalizeListResponse(response));
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load matches');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    const realtimeSocket = createRealtimeSocket({
      path: '/ws/matches/',
      onOpen: () => setSocketConnected(true),
      onClose: () => setSocketConnected(false),
      onMessage: (payload) => {
        if (payload?.type === 'matches_update' || payload?.type === 'new_message') {
          loadMatches({ silent: true });
        }
      },
    });
    realtimeSocket.connect();
    return () => realtimeSocket.disconnect();
  }, [loadMatches]);

  useEffect(() => {
    // Fallback sync keeps match cards and unread counts up to date.
    const intervalMs = socketConnected ? 5000 : 2000;
    const interval = setInterval(() => {
      loadMatches({ silent: true });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [loadMatches, socketConnected]);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const unreadDifference = (b.unread_count || 0) - (a.unread_count || 0);
      if (unreadDifference !== 0) return unreadDifference;
      return getSortTime(b) - getSortTime(a);
    });
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return sortedMatches.filter((match) => {
      if (filterMode === 'all') return true;
      if (filterMode === 'unread') return (match.unread_count || 0) > 0;
      return match.mode === filterMode;
    });
  }, [filterMode, sortedMatches]);

  const datingCount = useMemo(() => matches.filter((m) => m.mode === 'dating').length, [matches]);
  const friendsCount = useMemo(() => matches.filter((m) => m.mode === 'friends').length, [matches]);
  const unreadTotal = useMemo(() => matches.reduce((sum, m) => sum + (m.unread_count || 0), 0), [matches]);

  const handleOpenChat = (match) => {
    navigation.navigate('Chat', { matchId: match.id, match });
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading matches…</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Try Again" onPress={loadMatches} variant="primary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Matches & Chats</Text>
          <Text style={styles.summarySubtitle}>Message people you matched with and keep the momentum going.</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, styles.badgeDating]}>
              <Text style={styles.badgeText}>💕 {datingCount} Dating</Text>
            </View>
            <View style={[styles.badge, styles.badgeFriends]}>
              <Text style={styles.badgeText}>🤝 {friendsCount} Friends</Text>
            </View>
            {unreadTotal > 0 ? (
              <View style={[styles.badge, styles.badgeUnread]}>
                <Text style={styles.badgeText}>🔔 {unreadTotal} New</Text>
              </View>
            ) : null}
            <View style={[styles.badge, socketConnected ? styles.badgeLive : styles.badgeSync]}>
              <Text style={styles.badgeText}>{socketConnected ? 'Live' : 'Syncing'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilterMode('all')}
            style={({ pressed }) => [
              styles.filterChip,
              filterMode === 'all' ? styles.filterChipActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.filterText, filterMode === 'all' ? styles.filterTextActive : null]}>
              All ({matches.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode('unread')}
            style={({ pressed }) => [
              styles.filterChip,
              filterMode === 'unread' ? styles.filterChipUnread : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.filterText, filterMode === 'unread' ? styles.filterTextActive : null]}>
              🔔 New ({unreadTotal})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode('dating')}
            style={({ pressed }) => [
              styles.filterChip,
              filterMode === 'dating' ? styles.filterChipDating : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.filterText, filterMode === 'dating' ? styles.filterTextActive : null]}>
              💕 Dating ({datingCount})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode('friends')}
            style={({ pressed }) => [
              styles.filterChip,
              filterMode === 'friends' ? styles.filterChipFriends : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.filterText, filterMode === 'friends' ? styles.filterTextActive : null]}>
              🤝 Friends ({friendsCount})
            </Text>
          </Pressable>
        </View>

        {filteredMatches.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No matches yet.</Text>
            <AppButton title="Refresh" onPress={loadMatches} variant="primary" />
          </View>
        ) : (
          <FlatList
            data={filteredMatches}
            keyExtractor={(item) => item.id}
            refreshing={loading}
            onRefresh={loadMatches}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const other = item.other_user || item.user2_profile || item.user1_profile;
              const unreadCount = item.unread_count || 0;
              const modeIcon = item.mode === 'dating' ? '💕' : '🤝';

              return (
                <Pressable
                  onPress={() => handleOpenChat(item)}
                  style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                >
                  <ProfileAvatar uri={other?.avatar_url} name={other?.display_name} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {other?.display_name || 'Match'} <Text style={styles.rowMode}>{modeIcon}</Text>
                      </Text>
                      {unreadCount > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {formatPreviewText(item)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '800',
    textAlign: 'center',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  summarySubtitle: {
    color: colors.muted,
    marginTop: -2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  badgeDating: {
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    borderColor: 'rgba(251, 113, 133, 0.28)',
  },
  badgeFriends: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.28)',
  },
  badgeUnread: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  badgeLive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.28)',
  },
  badgeSync: {
    backgroundColor: colors.panel,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  filterChipActive: {
    backgroundColor: '#f4f4f5',
    borderColor: '#f4f4f5',
  },
  filterChipUnread: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  filterChipDating: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  filterChipFriends: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  filterText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 12,
  },
  filterTextActive: {
    color: '#001018',
  },
  list: {
    paddingTop: 6,
    paddingBottom: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowName: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
    flex: 1,
  },
  rowMode: {
    color: colors.muted,
    fontWeight: '900',
  },
  rowPreview: {
    color: colors.muted,
    fontWeight: '700',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#001018',
    fontWeight: '900',
    fontSize: 11,
  },
  emptyText: {
    color: colors.muted,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
  },
});
