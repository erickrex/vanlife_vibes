import React, { useRef, useEffect } from 'react';
import PersonMessageBubble from './PersonMessageBubble';

function PersonMessageList({ messages, loading, currentUserId, mode = 'friends' }) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const normalizeId = (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const isCurrentUserMessage = (message) => {
    const myId = normalizeId(currentUserId);
    if (!myId) return false;

    const candidates = [
      message.sender,
      message.sender_id,
      message.sender?.id,
      message.sender_profile?.id,
      message.sender_profile_id,
    ];

    return candidates.some((candidate) => normalizeId(candidate) === myId);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950/40">
        <div className="flex items-center gap-2 text-zinc-400">
          <div
            className={`w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin ${
              mode === 'dating' ? 'border-t-rose-500' : 'border-t-blue-500'
            }`}
          ></div>
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950/40">
        <div className="text-center px-4">
          <div className="text-4xl mb-2">👋</div>
          <p className="text-white font-medium">No messages yet</p>
          <p className="text-zinc-500 text-sm mt-1">Send a quick opener and break the ice.</p>
        </div>
      </div>
    );
  }

  const groupMessagesByDate = (messageList) => {
    const groups = [];
    let currentDate = null;

    messageList.forEach((message) => {
      const messageDate = new Date(message.created_at).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ type: 'date', date: message.created_at });
      }
      groups.push({ type: 'message', message });
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
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-zinc-950/65 via-zinc-950/35 to-zinc-900/20"
    >
      <div className="p-4 space-y-1">
        {groupedMessages.map((item, index) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${index}`} className="flex items-center justify-center py-3">
                <span className="px-3 py-1 rounded-full text-xs text-zinc-300 bg-zinc-900/85 border border-zinc-700">
                  {formatDateDivider(item.date)}
                </span>
              </div>
            );
          }

          return (
            <PersonMessageBubble
              key={item.message.id}
              message={item.message}
              isCurrentUser={isCurrentUserMessage(item.message)}
              mode={mode}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default PersonMessageList;
