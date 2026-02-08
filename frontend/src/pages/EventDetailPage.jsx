import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR, getActivityTypeInfo } from '../utils/constants';

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
 * Event status display info
 */
const STATUS_INFO = {
  open: { label: 'Open', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  full: { label: 'Full', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  matched: { label: 'Matched', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  completed: { label: 'Completed', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' },
};

function getTimeWindowInfo(timeWindow) {
  return TIME_WINDOWS[timeWindow] || { label: timeWindow, time: '', emoji: '🕐' };
}

function getStatusInfo(status) {
  return STATUS_INFO[status] || { label: status, color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' };
}

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
 * EventDetailPage Component
 * 
 * Displays detailed information about an event, handling both join modes:
 * - Direct mode: Shows attendees list, join/leave buttons
 * - Swipe mode: Shows match status, progress indicator
 */
function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await eventsAPI.get(id);
      setEvent(response.data.data || response.data);
    } catch (err) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const currentUserId = user?.profile_id || user?.id;
  const isCreator = event?.created_by?.id === currentUserId;
  const isDirectMode = event?.join_mode === 'direct';
  const isSwipeMode = event?.join_mode === 'swipe';
  
  // For direct mode
  const attendees = event?.attendees || [];
  const isAttendee = attendees.some(a => a.user?.id === currentUserId || a.user === currentUserId);
  const currentAttendee = attendees.find(a => a.user?.id === currentUserId || a.user === currentUserId);
  const spotsRemaining = event?.spots_remaining ?? (event?.spots ? event.spots - attendees.length : 0);
  
  // For swipe mode
  const hasMatch = event?.status === 'matched';
  const matchAttendees = event?.match_attendees || [];

  const handleJoin = async () => {
    try {
      setActionLoading(true);
      setError('');
      await eventsAPI.join(id);
      await loadEvent();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to join event');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      setActionLoading(true);
      setError('');
      await eventsAPI.leave(id);
      await loadEvent();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to leave event');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setActionLoading(true);
      setError('');
      await eventsAPI.confirm(id);
      await loadEvent();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to confirm attendance');
    } finally {
      setActionLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-zinc-500">Loading event...</p>
      </div>
    );
  }

  // Error state
  if (error && !event) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadEvent} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg mb-2">
          Try Again
        </button>
        <Link to="/events" className="text-blue-500 hover:underline">Back to Events</Link>
      </div>
    );
  }

  if (!event) return null;

  const typeInfo = getActivityTypeInfo(event.event_type);
  const timeInfo = getTimeWindowInfo(event.time_window);
  const statusInfo = getStatusInfo(event.status);
  const themeColor = isDirectMode ? 'blue' : 'emerald';

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="py-4 flex items-center justify-between">
        <Link to="/events" className={`text-${themeColor}-500 text-sm hover:underline flex items-center gap-1`}>
          <span>←</span>
          <span>Back to Events</span>
        </Link>
        <div className="flex items-center gap-2">
          {isDirectMode && (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">Direct Join</span>
          )}
          {isSwipeMode && (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">Swipe Mode</span>
          )}
          {isCreator && <span className="text-zinc-500 text-sm">You created this</span>}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Event Image */}
      <div className="relative h-48 bg-zinc-900 rounded-xl overflow-hidden mb-4">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-600">
            {typeInfo.emoji}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 ${statusInfo.bgColor} ${statusInfo.color} rounded-full text-xs font-semibold`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Event Info Card */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-1 bg-${themeColor}-500/20 text-${themeColor}-400 rounded text-xs font-semibold`}>
            {typeInfo.emoji} {typeInfo.label}
          </span>
          {event.status === 'open' && (
            <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs">
              {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-white mb-4">{event.title}</h1>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-xs block mb-1">📅 Date</span>
            <span className="text-white text-sm">{formatDate(event.event_date)}</span>
          </div>
          <div className="p-3 bg-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-xs block mb-1">{timeInfo.emoji} Time</span>
            <span className="text-white text-sm">{timeInfo.label} ({timeInfo.time})</span>
          </div>
          <div className="p-3 bg-zinc-800 rounded-lg col-span-2">
            <span className="text-zinc-500 text-xs block mb-1">📍 Location</span>
            <span className="text-white text-sm">{event.location}</span>
          </div>
          <div className="p-3 bg-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-xs block mb-1">👥 Total Spots</span>
            <span className="text-white text-sm">{event.spots}</span>
          </div>
          <div className="p-3 bg-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-xs block mb-1">✅ Status</span>
            <span className={`text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
        </div>

        {event.description && (
          <div className="mb-4">
            <h3 className="text-white text-sm font-medium mb-2">About this event</h3>
            <p className="text-zinc-400 text-sm">{event.description}</p>
          </div>
        )}

        {/* Creator info */}
        <div className="flex items-center gap-3 pt-4 border-t border-zinc-700">
          <span className="text-zinc-500 text-sm">Hosted by</span>
          <Link to={`/profile/${event.created_by?.id}`} className="flex items-center gap-2 hover:opacity-80">
            <img 
              src={event.created_by?.avatar_url || DEFAULT_AVATAR} 
              alt="" 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-zinc-700"
            />
            <span className={`text-${themeColor}-400 text-sm font-medium`}>
              {event.created_by?.display_name || 'Anonymous'}
            </span>
          </Link>
        </div>
      </div>

      {/* Direct Mode: Attendees Section */}
      {isDirectMode && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">👥</span>
            <h2 className="text-lg font-semibold text-white">Attendees</h2>
            <span className="text-zinc-500 text-sm">({attendees.length}/{event.spots})</span>
          </div>
          
          {attendees.length > 0 ? (
            <div className="space-y-2">
              {attendees.map((attendee) => {
                const attendeeUser = attendee.user || attendee;
                const attendeeId = attendeeUser.id || attendee.user;
                return (
                  <Link 
                    to={`/profile/${attendeeId}`} 
                    key={attendee.id || attendeeId}
                    className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <img 
                      src={attendeeUser.avatar_url || DEFAULT_AVATAR} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-600"
                    />
                    <div className="flex-1">
                      <span className="text-white font-medium block">
                        {attendeeUser.display_name || 'Anonymous'}
                      </span>
                      <div className="flex items-center gap-2">
                        {attendeeId === event.created_by?.id && (
                          <span className="text-blue-400 text-xs">Host</span>
                        )}
                        {attendee.status === 'confirmed' && (
                          <span className="text-emerald-400 text-xs">✓ Confirmed</span>
                        )}
                        {attendee.status === 'joined' && (
                          <span className="text-yellow-400 text-xs">Pending</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">No attendees yet</p>
          )}

          {/* Action buttons for direct mode */}
          {event.status === 'open' && !isCreator && (
            <div className="mt-4 pt-4 border-t border-zinc-700">
              {!isAttendee ? (
                <button
                  onClick={handleJoin}
                  disabled={actionLoading || spotsRemaining === 0}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {actionLoading ? 'Joining...' : spotsRemaining === 0 ? 'Event Full' : 'Join Event'}
                </button>
              ) : (
                <div className="space-y-2">
                  {currentAttendee?.status === 'joined' && (
                    <button
                      onClick={handleConfirm}
                      disabled={actionLoading}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      {actionLoading ? 'Confirming...' : 'Confirm Attendance'}
                    </button>
                  )}
                  <button
                    onClick={handleLeave}
                    disabled={actionLoading}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-red-400 font-semibold rounded-lg transition-colors"
                  >
                    {actionLoading ? 'Leaving...' : 'Leave Event'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chat button for direct mode events with attendees */}
          {attendees.length > 1 && (
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <Link
                to={`/events/${event.id}/chat`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
              >
                <span>💬</span>
                <span>Open Group Chat</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Swipe Mode: Matched Section */}
      {isSwipeMode && hasMatch && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎉</span>
            <h2 className="text-lg font-semibold text-white">Matched!</h2>
            <span className="text-zinc-500 text-sm">({matchAttendees.length}/{event.spots})</span>
          </div>
          
          {matchAttendees.length > 0 ? (
            <div className="space-y-2">
              {matchAttendees.map((attendee) => (
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
                    {attendee.id === event.created_by?.id && (
                      <span className="text-emerald-400 text-xs">Host</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">No attendees yet</p>
          )}

          <div className="mt-4 pt-4 border-t border-zinc-700">
            <Link
              to={`/events/${event.id}/chat`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
            >
              <span>💬</span>
              <span>Open Group Chat</span>
            </Link>
          </div>
        </div>
      )}

      {/* Swipe Mode: Waiting for Match */}
      {isSwipeMode && !hasMatch && event.status === 'open' && (
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

          <div className="mt-4 pt-4 border-t border-zinc-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Progress</span>
              <span className="text-emerald-400">
                {event.spots - spotsRemaining - 1} / {event.spots - 1} interested
              </span>
            </div>
            <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ 
                  width: `${Math.max(0, ((event.spots - spotsRemaining - 1) / Math.max(1, event.spots - 1)) * 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cancelled/Completed Status */}
      {(event.status === 'cancelled' || event.status === 'completed') && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center mb-4">
          <div className="text-4xl mb-3">
            {event.status === 'cancelled' ? '❌' : '✅'}
          </div>
          <p className={`font-semibold ${statusInfo.color}`}>
            This event has been {event.status}
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
  );
}

export default EventDetailPage;
