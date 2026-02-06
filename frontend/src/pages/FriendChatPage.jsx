import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { friendsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Default placeholder avatar
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * Formats a timestamp into a readable time string
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Formats a date for the date divider
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted date string
 */
function formatDateDivider(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Groups messages by date for display with date dividers
 * @param {Array} messages - Array of message objects
 * @returns {Array} Array of grouped items (date dividers and messages)
 */
function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'date', date: msg.created_at });
    }
    groups.push({ type: 'message', message: msg });
  });

  return groups;
}

/**
 * MessageBubble Component
 * Displays a single message with appropriate styling based on sender
 * 
 * @param {Object} props
 * @param {Object} props.message - The message object
 * @param {boolean} props.isCurrentUser - Whether the current user sent this message
 */
function MessageBubble({ message, isCurrentUser }) {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isCurrentUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-800 text-white'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        <div className={`flex items-center gap-1 mt-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-zinc-400">{formatTime(message.created_at)}</span>
          {isCurrentUser && message.is_read && (
            <span className="text-xs text-blue-300" title="Read">✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * MessageList Component
 * Displays the list of messages with date dividers and auto-scroll
 * 
 * @param {Object} props
 * @param {Array} props.messages - Array of message objects
 * @param {boolean} props.loading - Whether messages are loading
 * @param {string} props.currentUserId - The current user's profile ID
 */
function MessageList({ messages, loading, currentUserId }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom immediately on mount
    scrollToBottom('auto');
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-4xl mb-2">👋</div>
          <p className="text-white">No messages yet</p>
          <p className="text-zinc-500 text-sm mt-1">Say hello and start the conversation!</p>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto bg-black">
      <div className="p-4 space-y-1">
        {groupedMessages.map((item, index) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${index}`} className="flex items-center justify-center py-3">
                <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400">
                  {formatDateDivider(item.date)}
                </span>
              </div>
            );
          }
          return (
            <MessageBubble
              key={item.message.id}
              message={item.message}
              isCurrentUser={
                item.message.sender?.id === currentUserId ||
                item.message.sender_id === currentUserId
              }
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

/**
 * MessageInput Component
 * Input field for composing and sending messages
 * 
 * @param {Object} props
 * @param {Function} props.onSendMessage - Callback when message is sent
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {string} props.placeholder - Placeholder text
 */
function MessageInput({ onSendMessage, disabled = false, placeholder = 'Type a message...' }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSendMessage(trimmedText);
      setText('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className="flex items-end gap-2 p-3 border-t border-zinc-800 bg-zinc-900" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        rows="1"
        className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-2xl text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        maxLength={1000}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || isSending}
        className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full text-white transition-colors"
        title="Send message"
      >
        {isSending ? (
          <span className="text-sm">...</span>
        ) : (
          <span className="text-lg">➤</span>
        )}
      </button>
    </form>
  );
}

/**
 * FriendChatPage Component
 * 
 * Displays a 1:1 chat interface between friends.
 * Fetches messages from the friendship and allows sending new messages.
 * 
 * Requirements:
 * - 3.6: WHEN a Friendship exists between two users, THE System SHALL enable chat functionality between them
 * - 14.6: THE System SHALL provide GET /api/v1/friends/{id}/messages/ to list messages in a friendship chat
 * - 14.7: THE System SHALL provide POST /api/v1/friends/{id}/messages/ to send a message to a friend
 */
function FriendChatPage() {
  const { friendshipId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [friendship, setFriendship] = useState(null);
  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Loads the friendship data to get friend info
   */
  const loadFriendship = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Get list of friends to find this friendship
      const response = await friendsAPI.listFriends();
      const data = response.data.data || response.data;
      const friendships = Array.isArray(data) ? data : (data.results || []);

      // Find the friendship by ID
      const foundFriendship = friendships.find(f => f.id === friendshipId);

      if (!foundFriendship) {
        setError('Friendship not found');
        return;
      }

      setFriendship(foundFriendship);
      setFriend(foundFriendship.friend);
    } catch (err) {
      setError(err.message || 'Failed to load friendship');
    } finally {
      setLoading(false);
    }
  }, [friendshipId]);

  /**
   * Loads messages for the friendship
   */
  const loadMessages = useCallback(async () => {
    if (!friendshipId) return;

    try {
      setMessagesLoading(true);
      const response = await friendsAPI.getFriendMessages(friendshipId);
      const data = response.data.data || response.data;
      const messageList = Array.isArray(data) ? data : (data.results || []);
      setMessages(messageList);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [friendshipId]);

  // Load friendship and messages on mount
  useEffect(() => {
    loadFriendship();
  }, [loadFriendship]);

  useEffect(() => {
    if (friendship) {
      loadMessages();
    }
  }, [friendship, loadMessages]);

  /**
   * Handles sending a new message
   * @param {string} content - The message content
   */
  const handleSendMessage = async (content) => {
    if (!friendshipId || !content.trim()) return;

    try {
      const response = await friendsAPI.sendFriendMessage(friendshipId, content);
      const newMessage = response.data.data || response.data;
      setMessages(prev => [...prev, newMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
      throw err; // Re-throw to let MessageInput handle it
    }
  };

  // Get current user's profile ID
  const currentUserId = user?.profile_id || user?.id;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state (when no friendship loaded)
  if (error && !friendship) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadFriendship}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors mb-2"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/friends')}
            className="text-blue-500 hover:underline"
          >
            Back to Friends
          </button>
        </div>
      </div>
    );
  }

  if (!friendship || !friend) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => navigate('/friends')}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            title="Back"
          >
            ←
          </button>

          {/* Friend Info */}
          <Link
            to={`/profile/${friend.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src={friend.avatar_url || DEFAULT_AVATAR}
              alt={friend.display_name || 'Friend'}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-700"
            />
            <div>
              <span className="text-white font-semibold block">
                {friend.display_name || 'Anonymous'}
              </span>
              <span className="text-xs text-emerald-400">🤝 Friends</span>
            </div>
          </Link>
        </div>

        {/* Refresh Button */}
        <button
          onClick={loadMessages}
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/50 border-b border-red-800">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        loading={messagesLoading}
        currentUserId={currentUserId}
      />

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={messagesLoading}
        placeholder={`Message ${friend.display_name || 'your friend'}...`}
      />
    </div>
  );
}

export default FriendChatPage;
