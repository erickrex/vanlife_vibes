import React, { useState, useEffect, useCallback, useRef } from 'react';
import { plansAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { normalizePlanMessages } from '../utils/plans';

// Default placeholder avatar
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * PlanChat - Group chat component for plan attendees
 * 
 * Features:
 * - Message list with sender info
 * - Message input
 * - Auto-scroll to latest messages
 * 
 * **Validates: Requirements 11.3**
 */
function PlanChat({ planId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentUserId = user?.profile_id || user?.id;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!planId) return;

    try {
      setLoading(true);
      setError('');
      const response = await plansAPI.getMessages(planId);
      const data = response.data.data || response.data;
      const messageList = Array.isArray(data) ? data : (data.results || []);
      setMessages(normalizePlanMessages(messageList));
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await plansAPI.sendMessage(planId, newMessage.trim());
      const sentMessage = response.data.data || response.data;
      setMessages((prev) => [...prev, normalizePlanMessages([sentMessage])[0]]);
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle key press (Enter to send)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
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
      hour12: true,
    });
  };

  // Group messages by sender for consecutive messages
  const groupMessages = (messages) => {
    const grouped = [];
    let currentGroup = null;

    messages.forEach((message) => {
      const senderId = message.sender?.id || message.sender_profile?.id || message.sender_id;
      
      if (currentGroup && currentGroup.senderId === senderId) {
        currentGroup.messages.push(message);
      } else {
        currentGroup = {
          senderId,
          sender: message.sender || message.sender_profile || null,
          messages: [message],
          isCurrentUser: senderId === currentUserId,
        };
        grouped.push(currentGroup);
      }
    });

    return grouped;
  };

  const groupedMessages = groupMessages(messages);

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        <span>Loading chat...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/50 border-b border-red-800">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 max-h-80 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-2xl block mb-2">💬</span>
            <p className="text-zinc-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          groupedMessages.map((group, groupIndex) => (
            <div 
              key={groupIndex} 
              className={`flex gap-2 ${group.isCurrentUser ? 'flex-row-reverse' : ''}`}
            >
              {!group.isCurrentUser && (
                <img
                  src={group.sender?.avatar_url || DEFAULT_AVATAR}
                  alt={group.sender?.display_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className={`flex flex-col gap-1 ${group.isCurrentUser ? 'items-end' : 'items-start'}`}>
                {!group.isCurrentUser && (
                  <span className="text-xs text-zinc-500 ml-1">
                    {group.sender?.display_name || 'Anonymous'}
                  </span>
                )}
                {group.messages.map((message, msgIndex) => (
                  <div 
                    key={message.id || msgIndex} 
                    className={`max-w-xs px-3 py-2 rounded-2xl ${
                      group.isCurrentUser 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-800 text-white'
                    }`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <span className="text-xs opacity-60 mt-1 block">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-3 border-t border-zinc-800">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={sending}
          maxLength={500}
          className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-full text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim() || sending}
          className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full text-white transition-colors"
        >
          {sending ? '...' : '➤'}
        </button>
      </form>

      {/* Refresh Button */}
      <button 
        onClick={loadMessages} 
        className="w-full py-2 text-zinc-400 hover:text-white text-sm border-t border-zinc-800 transition-colors"
        disabled={loading}
      >
        ↻ Refresh
      </button>
    </div>
  );
}

export default PlanChat;
