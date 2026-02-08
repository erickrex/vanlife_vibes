import React from 'react';
import { formatTime } from '../utils/formatters';

function PersonMessageBubble({ message, isCurrentUser, mode = 'friends' }) {
  const messageType = message.message_type || 'text';
  const miniCardData = message.mini_card_data;

  const getMeetPreferenceLabel = (preference) => {
    const labels = {
      actively_looking: '🟢 Actively looking to meet',
      open_to_it: '🟡 Open to meeting up',
      selective: '🟠 Selective about meetups',
      solo_mode: '🔴 Solo mode right now',
    };
    return labels[preference] || preference;
  };

  const renderMiniCard = () => {
    if (!miniCardData) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span>📍</span>
          <span className="font-semibold text-sm text-white">Location Card</span>
        </div>
        <div className="space-y-1.5 text-sm">
          {miniCardData.current_location && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Currently in:</span>
              <span className="text-zinc-100">{miniCardData.current_location}</span>
            </div>
          )}
          {miniCardData.in_town_until && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Here until:</span>
              <span className="text-zinc-100">
                {new Date(miniCardData.in_town_until).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
          {miniCardData.meet_preference && (
            <div className="pt-2 border-t border-zinc-600">
              <span className="text-zinc-200">{getMeetPreferenceLabel(miniCardData.meet_preference)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentUserBubbleClass =
    mode === 'dating'
      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white'
      : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 border ${
          messageType === 'mini_card'
            ? 'bg-zinc-800/95 border-zinc-600'
            : isCurrentUser
              ? `${currentUserBubbleClass} border-transparent`
              : 'bg-zinc-800/85 text-zinc-100 border-zinc-700'
        }`}
      >
        {messageType === 'mini_card' ? (
          renderMiniCard()
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        )}
        <div className={`flex items-center gap-1 mt-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-zinc-300/90">{formatTime(message.created_at)}</span>
          {isCurrentUser && message.is_read && (
            <span className={`text-xs ${mode === 'dating' ? 'text-rose-100' : 'text-cyan-100'}`} title="Read">
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonMessageBubble;
