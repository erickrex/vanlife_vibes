import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { activitiesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Activity type options with emojis
 * Matches the ACTIVITY_TYPE_CHOICES from the backend Activity model
 */
const ACTIVITY_TYPES = {
  climbing: { label: 'Climbing', emoji: '🧗' },
  snowboarding: { label: 'Snowboarding', emoji: '🏂' },
  skiing: { label: 'Skiing', emoji: '⛷️' },
  hiking: { label: 'Hiking', emoji: '🥾' },
  kayaking: { label: 'Kayaking', emoji: '🛶' },
  surfing: { label: 'Surfing', emoji: '🏄' },
  biking: { label: 'Biking', emoji: '🚴' },
  camping: { label: 'Camping', emoji: '🏕️' },
  coffee: { label: 'Coffee', emoji: '☕' },
  cowork: { label: 'Cowork', emoji: '💻' },
  potluck: { label: 'Potluck', emoji: '🍲' },
  campfire: { label: 'Campfire', emoji: '🔥' },
  dog_walk: { label: 'Dog Walk', emoji: '🐕' },
  sunset: { label: 'Sunset', emoji: '🌅' },
  sunrise_hike: { label: 'Sunrise Hike', emoji: '🌄' },
  other: { label: 'Other', emoji: '✨' },
};

/**
 * Time window display labels
 */
const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm', emoji: '🌅' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm', emoji: '☀️' },
  evening: { label: 'Evening', time: '5pm-9pm', emoji: '🌙' },
  flexible: { label: 'Flexible', time: 'Any time', emoji: '🔄' },
};

/**
 * Activity status display info
 */
const STATUS_INFO = {
  open: { label: 'Open', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  matched: { label: 'Matched', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  completed: { label: 'Completed', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' },
};

const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * Get activity type info
 */
function getActivityTypeInfo(type) {
  return ACTIVITY_TYPES[type] || { label: type, emoji: '📅' };
}

/**
 * Get time window info
 */
function getTimeWindowInfo(timeWindow) {
  return TIME_WINDOWS[timeWindow] || { label: timeWindow, time: '', emoji: '🕐' };
}

/**
 * Get status info
 */
function getStatusInfo(status) {
  return STATUS_INFO[status] || { label: status, color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' };
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * ActivityDetailPage Component
 * 
 * Displays detailed information about an activity including:
 * - Activity info (title, type, description, image, date, time, location, spots)
 * - Creator profile info
 * - Attendees list (if matched)
 * - Link to chat (if matched)
 * - Current swipe status (if not matched)
 * 
 * Requirements:
 * - 5.6: Provide access to view activities the user has liked and created
 */
function ActivityDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await activitiesAPI.get(id);
      setActivity(response.data.data || response.data);
    } catch (err) {
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  // Check if current user is the creator
  const isCreator = activity?.created_by?.id === (user?.profile_id || user?.id);
  
  // Check if activity has a match
  const hasMatch = !!activity?.match;
  
  // Get attendees from match
  const attendees = activity?.match?.attendees || [];
  
  // Calculate spots remaining
  const spotsRemaining = activity?.spots_remaining ?? (activity?.spots ? activity.spots - 1 : 0);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading activity...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !activity) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={loadActivity} 
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg mb-2 transition-colors"
          >
            Try Again
          </button>
          <Link to="/activities" className="text-emerald-500 hover:underline">
            Back to Activities
          </Link>
        </div>
      </div>
    );
  }

  if (!activity) return null;

  const typeInfo = getActivityTypeInfo(activity.activity_type);
  const timeInfo = getTimeWindowInfo(activity.time_window);
  const statusInfo = getStatusInfo(activity.status);

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="py-4 flex items-center justify-between">
          <Link to="/activities" className="text-emerald-500 text-sm hover:underline flex items-center gap-1">
            <span>←</span>
            <span>Back to Activities</span>
          </Link>
          {isCreator && activity.status === 'open' && (
            <span className="text-zinc-500 text-sm">You created this</span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Activity Image */}
        <div className="relative h-48 bg-zinc-900 rounded-xl overflow-hidden mb-4">
          {activity.image_url ? (
            <img 
              src={activity.image_url} 
              alt={activity.title} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-600">
              {typeInfo.emoji}
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span className={`px-3 py-1 ${statusInfo.bgColor} ${statusInfo.color} rounded-full text-xs font-semibold`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Activity Info Card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4">
          {/* Type badge and spots */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-semibold">
              {typeInfo.emoji} {typeInfo.label}
            </span>
            {activity.status === 'open' && (
              <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs">
                {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-white mb-4">{activity.title}</h1>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">📅 Date</span>
              <span className="text-white text-sm">{formatDate(activity.activity_date)}</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">{timeInfo.emoji} Time</span>
              <span className="text-white text-sm">{timeInfo.label} ({timeInfo.time})</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg col-span-2">
              <span className="text-zinc-500 text-xs block mb-1">📍 Location</span>
              <span className="text-white text-sm">{activity.location}</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">👥 Total Spots</span>
              <span className="text-white text-sm">{activity.spots}</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">✅ Status</span>
              <span className={`text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
          </div>

          {/* Description */}
          {activity.description && (
            <div className="mb-4">
              <h3 className="text-white text-sm font-medium mb-2">About this activity</h3>
              <p className="text-zinc-400 text-sm">{activity.description}</p>
            </div>
          )}

          {/* Creator info */}
          <div className="flex items-center gap-3 pt-4 border-t border-zinc-700">
            <span className="text-zinc-500 text-sm">Hosted by</span>
            <Link 
              to={`/profile/${activity.created_by?.id}`} 
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img 
                src={activity.created_by?.avatar_url || DEFAULT_AVATAR} 
                alt="" 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-zinc-700"
              />
              <span className="text-emerald-400 text-sm font-medium">
                {activity.created_by?.display_name || 'Anonymous'}
              </span>
            </Link>
          </div>
        </div>

        {/* Matched Activity - Attendees Section */}
        {hasMatch && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎉</span>
              <h2 className="text-lg font-semibold text-white">Attendees</h2>
              <span className="text-zinc-500 text-sm">({attendees.length}/{activity.spots})</span>
            </div>
            
            {attendees.length > 0 ? (
              <div className="space-y-2">
                {attendees.map((attendee) => (
                  <Link 
                    to={`/profile/${attendee.id}`} 
                    key={attendee.id}
                    className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <img 
                      src={attendee.avatar_url || DEFAULT_AVATAR} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-600"
                    />
                    <div className="flex-1">
                      <span className="text-white font-medium block">
                        {attendee.display_name || 'Anonymous'}
                      </span>
                      {attendee.id === activity.created_by?.id && (
                        <span className="text-emerald-400 text-xs">Host</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">
                No attendees yet
              </p>
            )}

            {/* Chat button for matched activities */}
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <Link
                to={`/activities/${activity.id}/chat`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
              >
                <span>💬</span>
                <span>Open Group Chat</span>
              </Link>
            </div>
          </div>
        )}

        {/* Not Matched - Swipe Status Section */}
        {!hasMatch && activity.status === 'open' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎯</span>
              <h2 className="text-lg font-semibold text-white">Activity Status</h2>
            </div>
            
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-zinc-300 mb-2">Waiting for more people to join</p>
              <p className="text-zinc-500 text-sm">
                {spotsRemaining} more {spotsRemaining === 1 ? 'person needs' : 'people need'} to swipe right for this activity to match
              </p>
            </div>

            {/* Swipe count indicator */}
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Progress</span>
                <span className="text-emerald-400">
                  {activity.spots - spotsRemaining - 1} / {activity.spots - 1} interested
                </span>
              </div>
              <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ 
                    width: `${((activity.spots - spotsRemaining - 1) / (activity.spots - 1)) * 100}%` 
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cancelled/Completed Status */}
        {(activity.status === 'cancelled' || activity.status === 'completed') && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center mb-4">
            <div className="text-4xl mb-3">
              {activity.status === 'cancelled' ? '❌' : '✅'}
            </div>
            <p className={`font-semibold ${statusInfo.color}`}>
              This activity has been {activity.status}
            </p>
          </div>
        )}

        {/* Safety Note */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
          <p className="text-yellow-400 text-xs">
            <span className="font-medium">💡 Safety tip:</span> Meet in public places for first meetups. Share your plans with a friend!
          </p>
        </div>
      </div>
    </div>
  );
}

export default ActivityDetailPage;
