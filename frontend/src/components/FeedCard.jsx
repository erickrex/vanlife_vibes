import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

const DEFAULT_AVATAR = 'https://via.placeholder.com/150/3f3f46/ffffff?text=👤';

/**
 * Get friend status badge configuration based on friend_status value.
 * @param {string} friendStatus - The friend status: 'none', 'request_sent', 'request_received', 'friends'
 * @returns {object|null} Badge configuration with text and className, or null if no badge
 */
function getFriendStatusBadge(friendStatus) {
  switch (friendStatus) {
    case 'request_sent':
      return {
        text: 'Request Sent',
        className: 'bg-zinc-700 text-zinc-300',
      };
    case 'request_received':
      return {
        text: 'Wants to Connect',
        className: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
      };
    case 'friends':
      return {
        text: 'Friends',
        className: 'bg-emerald-500/20 text-emerald-400',
      };
    default:
      return null;
  }
}

/**
 * FeedCard - Compact card for displaying users in the nearby feed.
 * Instagram-style grid card with avatar, name, timing label, and friend status.
 */
function FeedCard({ profile, onClick }) {
  const { id, display_name, avatar_url, timing_label, friend_status } = profile;

  const friendBadge = getFriendStatusBadge(friend_status);

  const cardClasses = `
    flex flex-col items-center p-3 
    bg-zinc-900 rounded-xl border border-zinc-800 
    hover:border-zinc-600 hover:-translate-y-0.5
    transition-all duration-200 cursor-pointer
  `;

  const content = (
    <>
      {/* Avatar with friend status indicator */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-zinc-700 mb-2">
          <img
            src={avatar_url || DEFAULT_AVATAR}
            alt={display_name || 'User'}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Small indicator dot for friends */}
        {friend_status === 'friends' && (
          <div className="absolute -bottom-0.5 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col items-center text-center w-full min-w-0">
        <span className="text-sm font-semibold text-white truncate max-w-full">
          {display_name || 'Anonymous'}
        </span>
        {timing_label && (
          <span className="text-xs text-zinc-500 mt-0.5">
            {timing_label}
          </span>
        )}
        {/* Friend status badge */}
        {friendBadge && (
          <span className={`text-xs px-2 py-0.5 rounded-full mt-1.5 ${friendBadge.className}`}>
            {friendBadge.text}
          </span>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <div
        className={cardClasses}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View ${display_name || 'Anonymous'}'s profile`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/profile/${id}`}
      className={cardClasses}
      aria-label={`View ${display_name || 'Anonymous'}'s profile`}
    >
      {content}
    </Link>
  );
}

FeedCard.propTypes = {
  profile: PropTypes.shape({
    id: PropTypes.string.isRequired,
    display_name: PropTypes.string,
    avatar_url: PropTypes.string,
    timing_label: PropTypes.string,
    friend_status: PropTypes.oneOf(['none', 'request_sent', 'request_received', 'friends']),
  }).isRequired,
  onClick: PropTypes.func,
};

export default FeedCard;
