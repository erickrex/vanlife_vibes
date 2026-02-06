import React from 'react';

/**
 * PersonMessageBubble - Displays a single message in the chat
 * 
 * Features:
 * - Different styles for current user vs other user
 * - Timestamp display
 * - Support for mini-card message type
 * 
 * **Validates: Requirements 10.1, 10.3**
 */
function PersonMessageBubble({ message, isCurrentUser }) {
  const messageType = message.message_type || 'text';
  const miniCardData = message.mini_card_data;

  // Format timestamp
  const formatTime = (timestamp) => {
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
  };

  // Format meet preference label
  const getMeetPreferenceLabel = (preference) => {
    const labels = {
      actively_looking: '🟢 Actively looking to meet',
      open_to_it: '🟡 Open to meeting up',
      selective: '🟠 Selective about meetups',
      solo_mode: '🔴 Solo mode right now',
    };
    return labels[preference] || preference;
  };

  // Render mini-card content
  const renderMiniCard = () => {
    if (!miniCardData) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span>📍</span>
          <span className="font-semibold text-sm">Location Card</span>
        </div>
        <div className="space-y-1.5 text-sm">
          {miniCardData.current_location && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Currently in:</span>
              <span className="text-white">{miniCardData.current_location}</span>
            </div>
          )}
          {miniCardData.in_town_until && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Here until:</span>
              <span className="text-white">
                {new Date(miniCardData.in_town_until).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
          {miniCardData.meet_preference && (
            <div className="pt-1 border-t border-zinc-600">
              <span className="text-white">
                {getMeetPreferenceLabel(miniCardData.meet_preference)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div 
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          messageType === 'mini_card' 
            ? 'bg-zinc-700 border border-zinc-600' 
            : isCurrentUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-zinc-800 text-white'
        }`}
      >
        {messageType === 'mini_card' ? (
          renderMiniCard()
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        )}
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

export default PersonMessageBubble;
