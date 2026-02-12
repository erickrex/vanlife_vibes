import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';

import Screen from '../components/Screen';
import { builderAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function MessageBubble({ msg, isMe }) {
  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
          {msg.content}
        </Text>
        <Text style={styles.bubbleTime}>{formatTime(msg.created_at)}</Text>
      </View>
    </View>
  );
}

export default function BuilderChatScreen() {
  const { listingId, listingTitle, recipientId, listingOwnerUserId } = useRoute().params || {};
  const { user, profile } = useAuth();
  const myProfileId = profile?.id ? String(profile.id) : null;
  const myUserId = user?.id ? String(user.id) : null;
  const isOwner = Boolean(myUserId && listingOwnerUserId && myUserId === String(listingOwnerUserId));

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState(
    recipientId ? String(recipientId) : null,
  );
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const flatListRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (isOwner && !selectedRecipientId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setError('');
      const res = await builderAPI.getMessages(listingId, isOwner ? selectedRecipientId : null);
      const data = res?.data?.data ?? res?.data ?? [];
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [isOwner, listingId, selectedRecipientId]);

  const loadConversations = useCallback(async () => {
    if (!isOwner) return;
    try {
      setConversationsLoading(true);
      const res = await builderAPI.getConversations(listingId);
      const data = res?.data?.data ?? res?.data ?? [];
      const threads = Array.isArray(data) ? data : [];
      setConversations(threads);
      if (!recipientId && threads.length === 1) {
        setSelectedRecipientId((prev) => prev || String(threads[0].profile_id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setConversationsLoading(false);
    }
  }, [isOwner, listingId, recipientId]);

  useEffect(() => {
    if (!isOwner) return undefined;
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [isOwner, loadConversations]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const selectedConversation = useMemo(
    () => conversations.find((t) => String(t.profile_id) === String(selectedRecipientId)) || null,
    [conversations, selectedRecipientId],
  );

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    if (isOwner && !selectedRecipientId) {
      setError('Select a conversation to reply.');
      return;
    }
    setSending(true);
    try {
      await builderAPI.sendMessage(
        listingId,
        content,
        isOwner ? selectedRecipientId : (recipientId || null),
      );
      setText('');
      await Promise.all([
        loadMessages(),
        isOwner ? loadConversations() : Promise.resolve(),
      ]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedConversation ? `${listingTitle || 'Chat'} · ${selectedConversation.display_name}` : (listingTitle || 'Chat')}
          </Text>
        </View>

        {isOwner ? (
          <View style={styles.threadTabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.threadTabs}
            >
              <Pressable
                onPress={() => setSelectedRecipientId(null)}
                style={({ pressed }) => [
                  styles.threadTab,
                  selectedRecipientId === null && styles.threadTabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.threadTabText, selectedRecipientId === null && styles.threadTabTextActive]}>
                  All
                </Text>
              </Pressable>
              {conversations.map((thread) => {
                const active = String(selectedRecipientId) === String(thread.profile_id);
                return (
                  <Pressable
                    key={thread.profile_id}
                    onPress={() => setSelectedRecipientId(String(thread.profile_id))}
                    style={({ pressed }) => [
                      styles.threadTab,
                      active && styles.threadTabActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.threadTabText, active && styles.threadTabTextActive]}>
                      {thread.display_name || 'Conversation'}
                    </Text>
                    {thread.unread_count > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{thread.unread_count > 99 ? '99+' : thread.unread_count}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : isOwner && selectedRecipientId === null ? (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.profile_id)}
            contentContainerStyle={styles.conversationsList}
            ListEmptyComponent={(
              <View style={styles.center}>
                {conversationsLoading ? (
                  <ActivityIndicator color={colors.muted} />
                ) : (
                  <Text style={styles.emptyText}>No conversations yet.</Text>
                )}
              </View>
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedRecipientId(String(item.profile_id))}
                style={({ pressed }) => [styles.conversationCard, pressed && styles.pressed]}
              >
                <View style={styles.conversationHeader}>
                  <Text style={styles.conversationName}>{item.display_name || 'Conversation'}</Text>
                  {item.unread_count > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                    </View>
                  ) : null}
                </View>
                {item.last_message ? (
                  <Text style={styles.conversationSnippet} numberOfLines={2}>{item.last_message}</Text>
                ) : (
                  <Text style={styles.conversationSnippet}>No messages yet.</Text>
                )}
              </Pressable>
            )}
          />
        ) : error && messages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble msg={item} isMe={String(item.sender) === myProfileId} />
            )}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {!isOwner || selectedRecipientId !== null ? (
          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              maxLength={1000}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sendBtnText}>{sending ? '...' : '→'}</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  threadTabsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  threadTabs: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  threadTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  threadTabActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },
  threadTabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  threadTabTextActive: {
    color: colors.primary,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: '900',
  },
  conversationsList: {
    padding: 12,
    gap: 8,
    flexGrow: 1,
  },
  conversationCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    gap: 6,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  conversationSnippet: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { color: colors.danger, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.muted, fontWeight: '700', textAlign: 'center' },
  messageList: { padding: 12, gap: 6, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, padding: 10, paddingBottom: 6 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.borderStrong },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: colors.primaryText },
  bubbleTextThem: { color: colors.text },
  bubbleTime: { color: colors.muted, fontSize: 10, fontWeight: '700', alignSelf: 'flex-end', marginTop: 2 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface,
    color: colors.text, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.primaryText, fontSize: 20, fontWeight: '900' },
  pressed: { opacity: 0.85 },
});
