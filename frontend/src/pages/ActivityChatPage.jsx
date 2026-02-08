import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { activitiesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR, getActivityTypeInfo } from '../utils/constants';

/**
 * Time window display labels
 */
const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm' },
  evening: { label: 'Evening', time: '5pm-9pm' },
  flexible: { label: 'Flexible', time: 'Any time' },
};

/**
 * Get time window info
 */
function getTimeWindowInfo(timeWindow) {
  return TIME_WINDOWS[timeWindow] || { label: timeWindow, time: '' };
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

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
 * Uses emerald/green theme for activity chat
 * 
 * @param {Object} props
 * @param {Object} props.message - The message object
 * @param {boolean} props.isCurrentUser - Whether the current user sent this message
 */
function MessageBubble({ message, isCurrentUser }) {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="flex items-end gap-2 max-w-[80%]">
        {/* Avatar for other users */}
        {!isCurrentUser && (
          <Link to={`/profile/${message.sender?.id}`}>
            <img
              src={message.sender?.avatar_url || DEFAULT_AVATAR}
              alt={message.sender?.display_name || 'User'}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-700 flex-shrink-0"
            />
          </Link>
        )}
        
        <div
          className={`rounded-2xl px-4 py-2 ${
            isCurrentUser
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-800 text-white'
          }`}
        >
          {/* Sender name for group chat (only for other users) */}
          {!isCurrentUser && (
            <div className="text-xs text-emerald-400 font-medium mb-1">
              {message.sender?.display_name || 'Anonymous'}
            </div>
          )}
          <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
          <div className={`flex items-center gap-1 mt-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-xs text-zinc-400">{formatTime(message.created_at)}</span>
          </div>
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
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin"></div>
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-white">No messages yet</p>
          <p className="text-zinc-500 text-sm mt-1">Start coordinating your meetup!</p>
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
 * Uses emerald/green theme for activity chat
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
        className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-2xl text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-600 disabled:opacity-50"
        maxLength={500}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || isSending}
        className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full text-white transition-colors"
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
 * ActivityChatPage Component
 * 
 * Displays a group chat interface for matched activity attendees.
 * Fetches activity details and messages, allows sending new messages.
 * Polls for new messages every 5 seconds.
 * 
 * Requirements:
 * - 8.1: WHEN an Activity_Match exists, THE System SHALL provide a group chat accessible to all matched attendees
 * - 8.2: THE Activity_Chat SHALL display messages with sender name, avatar, content, and timestamp
 * - 8.3: WHEN an attendee sends a message, THE System SHALL broadcast it to all other attendees in the Activity_Chat
 * - 8.4: THE Activity_Chat SHALL display messages in chronological order
 * - 8.5: THE Activity_Chat SHALL show the activity details (title, type, date, time, location) in a header
 */
function ActivityChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [activity, setActivity] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');

  // Polling interval ref
  const pollIntervalRef = useRef(null);

  /**
   * Loads the activity data
   */
  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await activitiesAPI.get(id);
      const activityData = response.data.data || response.data;

      // Check if activity has a match (required for chat access)
      if (!activityData.match) {
        setError('This activity has not been matched yet. Chat is only available for matched activities.');
        setActivity(null);
        return;
      }

      setActivity(activityData);
    } catch (err) {
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * Loads messages for the activity
   */
  const loadMessages = useCallback(async () => {
    if (!id) return;

    try {
      setMessagesLoading(true);
      const response = await activitiesAPI.getMessages(id);
      const data = response.data.data || response.data;
      const messageList = Array.isArray(data) ? data : (data.results || []);
      setMessages(messageList);
    } catch (err) {
      console.error('Failed to load messages:', err);
      // Don't set error for message loading failures during polling
      if (!messages.length) {
        setError(err.message || 'Failed to load messages');
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [id, messages.length]);

  // Load activity on mount
  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  // Load messages when activity is loaded
  useEffect(() => {
    if (activity) {
      loadMessages();
    }
  }, [activity, loadMessages]);

  // Set up polling for new messages (every 5 seconds)
  useEffect(() => {
    if (activity) {
      // Start polling
      pollIntervalRef.current = setInterval(() => {
        loadMessages();
      }, 5000);

      // Cleanup on unmount
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [activity, loadMessages]);

  /**
   * Handles sending a new message
   * @param {string} content - The message content
   */
  const handleSendMessage = async (content) => {
    if (!id || !content.trim()) return;

    try {
      const response = await activitiesAPI.sendMessage(id, content);
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
      <div className="app-shell pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state (when no activity loaded)
  if (error && !activity) {
    return (
      <div className="app-shell pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-red-400 mb-4 text-center">{error}</p>
          <button
            onClick={loadActivity}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors mb-2"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/activities')}
            className="text-emerald-500 hover:underline"
          >
            Back to Activities
          </button>
        </div>
      </div>
    );
  }

  if (!activity) {
    return null;
  }

  const typeInfo = getActivityTypeInfo(activity.activity_type);
  const timeInfo = getTimeWindowInfo(activity.time_window);
  const attendeeCount = activity.match?.attendees?.length || 0;

  return (
    <div className="app-shell flex flex-col">
      {/* Header with Activity Details - Requirement 8.5 */}
      <div className="border-b border-zinc-800 bg-zinc-900">
        {/* Top row: Back button and activity title */}
        <div className="flex items-center gap-3 p-3">
          {/* Back Button */}
          <button
            onClick={() => navigate(`/activities/${id}`)}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            title="Back to activity"
          >
            ←
          </button>

          {/* Activity Info */}
          <Link
            to={`/activities/${id}`}
            className="flex-1 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{typeInfo.emoji}</span>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-semibold truncate">{activity.title}</h1>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{typeInfo.label}</span>
                  <span>•</span>
                  <span>{attendeeCount} attendees</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Refresh Button */}
          <button
            onClick={loadMessages}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            title="Refresh messages"
          >
            ↻
          </button>
        </div>

        {/* Activity details bar */}
        <div className="flex items-center gap-3 px-3 pb-3 text-xs text-zinc-400 overflow-x-auto">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>📅</span>
            <span>{formatDate(activity.activity_date)}</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>🕐</span>
            <span>{timeInfo.label}</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>📍</span>
            <span className="truncate max-w-[150px]">{activity.location}</span>
          </div>
        </div>
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

      {/* Message List - Requirements 8.2, 8.4 */}
      <MessageList
        messages={messages}
        loading={messagesLoading && messages.length === 0}
        currentUserId={currentUserId}
      />

      {/* Message Input - Requirement 8.3 */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={messagesLoading && messages.length === 0}
        placeholder="Message the group..."
      />
    </div>
  );
}

export default ActivityChatPage;
