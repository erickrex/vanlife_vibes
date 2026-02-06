import React, { useRef, useEffect } from 'react';
import PersonMessageBubble from './PersonMessageBubble';

/**
 * PersonMessageList - Displays messages in a person-to-person chat
 * 
 * Features:
 * - Message bubbles with timestamps
 * - Auto-scroll to bottom on new messages
 * - Loading and empty states
 * 
 * **Validates: Requirements 10.1**
 */
function PersonMessageList({ messages, loading, currentUserId }) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

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

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msg.created_at });
      }
      groups.push({ type: 'message', message: msg });
    });

    return groups;
  };

  const formatDateDivider = (timestamp) => {
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
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto bg-black" ref={containerRef}>
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
            <PersonMessageBubble
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

export default PersonMessageList;
