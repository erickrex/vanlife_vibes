import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

function MessageList({ messages, currentUserId, loading = false }) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom immediately on mount
    scrollToBottom('auto');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-zinc-400">No messages yet</p>
          <p className="text-zinc-500 text-sm mt-1">Start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-4" ref={containerRef}>
      <div className="space-y-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isCurrentUser={message.user?.id === currentUserId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageList;
