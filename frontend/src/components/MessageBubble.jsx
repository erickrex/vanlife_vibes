import React from 'react';

function MessageBubble({ message, isCurrentUser }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
        isCurrentUser ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-white'
      }`}>
        {!isCurrentUser && (
          <div className="text-xs text-zinc-400 mb-1">
            {message.user?.username || message.user_username || 'Unknown user'}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap break-words">{message.content || message.text}</div>
        <div className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-200' : 'text-zinc-500'}`}>
          {formatTime(message.created_at || message.sent_at)}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
