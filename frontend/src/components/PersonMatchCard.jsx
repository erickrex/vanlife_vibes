import React from 'react';

// Default placeholder avatar
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * PersonMatchCard - Displays a single match in the match list
 * 
 * Features:
 * - Avatar and display name
 * - Last message preview
 * - Unread indicator
 * - Mode indicator (dating/friends)
 * - Match timestamp
 * 
 * **Validates: Requirements 12.6**
 */
function PersonMatchCard({ match, isSelected, onSelect }) {
  const otherUser = match.other_user || {};
  const lastMessage = match.last_message;
  const hasUnread = match.unread_count > 0;
  const mode = match.mode || 'friends';

  // Format relative time
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

  // Truncate message preview
  const truncateMessage = (text, maxLength = 40) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleClick = () => {
    if (onSelect) onSelect(match);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onSelect) onSelect(match);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        isSelected ? 'bg-zinc-800' : 'bg-zinc-900 hover:bg-zinc-800/50'
      } ${hasUnread ? 'border-l-2 border-blue-500' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {/* Avatar with mode indicator */}
      <div className="relative flex-shrink-0">
        <img
          src={otherUser.avatar_url || DEFAULT_AVATAR}
          alt={otherUser.display_name || 'User'}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700"
        />
        <span 
          className="absolute -bottom-1 -right-1 text-xs"
          title={mode === 'dating' ? 'Dating' : 'Friends'}
        >
          {mode === 'dating' ? '💕' : '🤝'}
        </span>
      </div>

      {/* Match info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-white'}`}>
            {otherUser.display_name || 'Anonymous'}
          </span>
          <span className="text-xs text-zinc-500 flex-shrink-0">
            {formatRelativeTime(lastMessage?.created_at || match.matched_at)}
          </span>
        </div>
        <div className="mt-0.5">
          {lastMessage ? (
            <span className={`text-sm truncate block ${hasUnread ? 'text-zinc-300 font-medium' : 'text-zinc-500'}`}>
              {lastMessage.is_mine && <span className="text-zinc-400">You: </span>}
              {truncateMessage(lastMessage.content)}
            </span>
          ) : (
            <span className="text-sm text-zinc-500 italic">Start the conversation!</span>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {hasUnread && (
        <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-xs text-white font-semibold">
            {match.unread_count > 9 ? '9+' : match.unread_count}
          </span>
        </div>
      )}
    </div>
  );
}

export default PersonMatchCard;
