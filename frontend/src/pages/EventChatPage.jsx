import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR, getActivityTypeInfo } from '../utils/constants';

const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm' },
  evening: { label: 'Evening', time: '5pm-9pm' },
  flexible: { label: 'Flexible', time: 'Any time' },
};

function getTimeWindowInfo(timeWindow) {
  return TIME_WINDOWS[timeWindow] || { label: timeWindow, time: '' };
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDateDivider(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

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

function MessageBubble({ message, isCurrentUser, themeColor }) {
  const bgClass = isCurrentUser 
    ? (themeColor === 'blue' ? 'bg-blue-600' : 'bg-emerald-600')
    : 'bg-zinc-800';
  const nameClass = themeColor === 'blue' ? 'text-blue-400' : 'text-emerald-400';

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="flex items-end gap-2 max-w-[80%]">
        {!isCurrentUser && (
          <Link to={`/profile/${message.sender?.id}`}>
            <img
              src={message.sender?.avatar_url || DEFAULT_AVATAR}
              alt={message.sender?.display_name || 'User'}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-700 flex-shrink-0"
            />
          </Link>
        )}
        <div className={`rounded-2xl px-4 py-2 ${bgClass} text-white`}>
          {!isCurrentUser && (
            <div className={`text-xs ${nameClass} font-medium mb-1`}>
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

function MessageList({ messages, loading, currentUserId, themeColor }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { scrollToBottom('auto'); }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className={`w-5 h-5 border-2 border-zinc-600 border-t-${themeColor}-500 rounded-full animate-spin`}></div>
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
              isCurrentUser={item.message.sender?.id === currentUserId || item.message.sender_id === currentUserId}
              themeColor={themeColor}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function MessageInput({ onSendMessage, disabled = false, placeholder = 'Type a message...', themeColor }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef(null);

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
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  const btnClass = themeColor === 'blue' 
    ? 'bg-blue-500 hover:bg-blue-600' 
    : 'bg-emerald-500 hover:bg-emerald-600';
  const focusClass = themeColor === 'blue' ? 'focus:border-blue-600' : 'focus:border-emerald-600';

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
        className={`flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-2xl text-white text-sm placeholder-zinc-500 resize-none focus:outline-none ${focusClass} disabled:opacity-50`}
        maxLength={500}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || isSending}
        className={`w-10 h-10 flex items-center justify-center ${btnClass} disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full text-white transition-colors`}
        title="Send message"
      >
        {isSending ? <span className="text-sm">...</span> : <span className="text-lg">➤</span>}
      </button>
    </form>
  );
}

/**
 * EventChatPage Component
 * 
 * Displays a group chat interface for event attendees.
 * Works for both direct-join and swipe-mode events.
 */
function EventChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');

  const pollIntervalRef = useRef(null);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await eventsAPI.get(id);
      const eventData = response.data.data || response.data;

      // For swipe mode, check if matched
      if (eventData.join_mode === 'swipe' && eventData.status !== 'matched') {
        setError('This activity has not been matched yet. Chat is only available for matched activities.');
        setEvent(null);
        return;
      }

      // For direct mode, check if there are attendees
      if (eventData.join_mode === 'direct' && (!eventData.attendees || eventData.attendees.length < 2)) {
        setError('Chat is available when there are at least 2 attendees.');
        setEvent(null);
        return;
      }

      setEvent(eventData);
    } catch (err) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      setMessagesLoading(true);
      const response = await eventsAPI.getMessages(id);
      const data = response.data.data || response.data;
      const messageList = Array.isArray(data) ? data : (data.results || []);
      setMessages(messageList);
    } catch (err) {
      console.error('Failed to load messages:', err);
      if (!messages.length) {
        setError(err.message || 'Failed to load messages');
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [id, messages.length]);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => { if (event) loadMessages(); }, [event, loadMessages]);

  useEffect(() => {
    if (event) {
      pollIntervalRef.current = setInterval(() => { loadMessages(); }, 5000);
      return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
    }
  }, [event, loadMessages]);

  const handleSendMessage = async (content) => {
    if (!id || !content.trim()) return;
    try {
      const response = await eventsAPI.sendMessage(id, content);
      const newMessage = response.data.data || response.data;
      setMessages(prev => [...prev, newMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
      throw err;
    }
  };

  const currentUserId = user?.profile_id || user?.id;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-zinc-500">Loading chat...</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-red-400 mb-4 text-center">{error}</p>
        <button onClick={loadEvent} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg mb-2">
          Try Again
        </button>
        <button onClick={() => navigate('/events')} className="text-blue-500 hover:underline">
          Back to Events
        </button>
      </div>
    );
  }

  if (!event) return null;

  const typeInfo = getActivityTypeInfo(event.event_type);
  const timeInfo = getTimeWindowInfo(event.time_window);
  const isDirectMode = event.join_mode === 'direct';
  const themeColor = isDirectMode ? 'blue' : 'emerald';
  const attendeeCount = isDirectMode 
    ? (event.attendees?.length || 0) 
    : (event.match_attendees?.length || 0);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3 p-3">
          <button
            onClick={() => navigate(`/events/${id}`)}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            title="Back to event"
          >
            ←
          </button>

          <Link to={`/events/${id}`} className="flex-1 hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-2">
              <span className="text-xl">{typeInfo.emoji}</span>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-semibold truncate">{event.title}</h1>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{typeInfo.label}</span>
                  <span>•</span>
                  <span>{attendeeCount} attendees</span>
                  <span>•</span>
                  <span className={isDirectMode ? 'text-blue-400' : 'text-emerald-400'}>
                    {isDirectMode ? 'Direct' : 'Swipe'}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          <button
            onClick={loadMessages}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            title="Refresh messages"
          >
            ↻
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 pb-3 text-xs text-zinc-400 overflow-x-auto">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>📅</span>
            <span>{formatDate(event.event_date)}</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>🕐</span>
            <span>{timeInfo.label}</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>📍</span>
            <span className="truncate max-w-[150px]">{event.location}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/50 border-b border-red-800">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white">✕</button>
        </div>
      )}

      <MessageList
        messages={messages}
        loading={messagesLoading && messages.length === 0}
        currentUserId={currentUserId}
        themeColor={themeColor}
      />

      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={messagesLoading && messages.length === 0}
        placeholder="Message the group..."
        themeColor={themeColor}
      />
    </div>
  );
}

export default EventChatPage;
