import React from 'react';
import { DEFAULT_AVATAR } from '../utils/constants';

function PersonMatchCard({ match, isSelected, onSelect }) {
  const otherUser = match.other_user || {};
  const lastMessage = match.last_message;
  const hasUnread = match.unread_count > 0;
  const mode = match.mode || 'friends';

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateMessage = (text, maxLength = 42) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  const handleClick = () => {
    if (onSelect) onSelect(match);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (onSelect) onSelect(match);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer border transition-all ${
        isSelected
          ? 'bg-zinc-800/80 border-zinc-600 shadow-md shadow-black/20'
          : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-800/55 hover:border-zinc-700'
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="relative flex-shrink-0">
        <img
          src={otherUser.avatar_url || DEFAULT_AVATAR}
          alt={otherUser.display_name || 'User'}
          className={`w-12 h-12 rounded-full object-cover ${
            mode === 'dating' ? 'ring-2 ring-rose-500/45' : 'ring-2 ring-blue-500/45'
          }`}
        />
        <span
          className={`absolute -bottom-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
            mode === 'dating'
              ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
              : 'bg-blue-500/20 text-blue-200 border-blue-500/40'
          }`}
          title={mode === 'dating' ? 'Dating' : 'Friends'}
        >
          {mode === 'dating' ? '💕' : '🤝'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-zinc-100'}`}>
            {otherUser.display_name || 'Anonymous'}
          </span>
          <span className="text-xs text-zinc-500 flex-shrink-0">
            {formatRelativeTime(lastMessage?.created_at || match.matched_at)}
          </span>
        </div>
        <div className="mt-1">
          {lastMessage ? (
            <span className={`text-sm truncate block ${hasUnread ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {lastMessage.is_mine && <span className="text-zinc-400">You: </span>}
              {truncateMessage(lastMessage.content)}
            </span>
          ) : (
            <span className="text-sm text-zinc-500 italic">Start the conversation!</span>
          )}
        </div>
      </div>

      {hasUnread && (
        <div className="flex-shrink-0 min-w-[22px] h-[22px] bg-blue-500 rounded-full flex items-center justify-center px-1">
          <span className="text-xs text-white font-semibold">
            {match.unread_count > 9 ? '9+' : match.unread_count}
          </span>
        </div>
      )}
    </div>
  );
}

export default PersonMatchCard;
