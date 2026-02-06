import { useState } from 'react';
import PropTypes from 'prop-types';
import { profilesAPI } from '../services/api';

/**
 * FollowButton - A toggle button for following/unfollowing users.
 */
function FollowButton({ profileId, isFollowing, onFollowChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = async () => {
    if (loading || !profileId) return;

    setLoading(true);
    setError('');

    try {
      if (isFollowing) {
        await profilesAPI.unfollowUser(profileId);
        if (onFollowChange) {
          onFollowChange(false, -1);
        }
      } else {
        await profilesAPI.followUser(profileId);
        if (onFollowChange) {
          onFollowChange(true, 1);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update follow status');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const getButtonText = () => {
    if (loading) return '...';
    if (isFollowing) return isHovered ? 'Unfollow' : 'Following';
    return 'Follow';
  };

  const getButtonClasses = () => {
    const base = 'px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50';
    
    if (loading) {
      return `${base} bg-zinc-800 text-zinc-400 cursor-wait`;
    }
    
    if (isFollowing) {
      if (isHovered) {
        return `${base} bg-red-500 text-white border border-red-500`;
      }
      return `${base} bg-zinc-800 text-white border border-zinc-700 hover:border-red-500`;
    }
    
    return `${base} bg-blue-500 text-white hover:bg-blue-600`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={loading || !profileId}
        className={getButtonClasses()}
        aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
      >
        {getButtonText()}
      </button>
      
      {error && (
        <div 
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-red-500 text-white text-xs rounded-lg whitespace-nowrap z-10"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}

FollowButton.propTypes = {
  profileId: PropTypes.string.isRequired,
  isFollowing: PropTypes.bool,
  onFollowChange: PropTypes.func,
};

FollowButton.defaultProps = {
  isFollowing: false,
  onFollowChange: null,
};

export default FollowButton;
