import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { matchMessagesAPI, profilesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Default placeholder avatar
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

// Display labels for vehicle types
const VEHICLE_TYPE_LABELS = {
  van: 'Van',
  rv: 'RV',
  truck_camper: 'Truck Camper',
  skoolie: 'Skoolie',
  trailer: 'Trailer',
  car_camper: 'Car Camper',
  other: 'Other',
};

// Display labels for travel status
const TRAVEL_STATUS_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  weekender: 'Weekender',
  aspiring: 'Aspiring',
};

/**
 * ProfilePreview - A compact profile preview for chat participants.
 * Displays avatar, name, vehicle type (if has van), and travel status.
 * Clickable to navigate to full profile.
 * 
 * **Validates: Requirements 11.3**
 */
function ProfilePreview({ profile }) {
  const {
    id,
    display_name,
    avatar_url,
    has_van,
    vehicle,
    travel_status,
  } = profile;

  // Get vehicle type label if user has a van
  const vehicleTypeLabel = has_van && vehicle?.vehicle_type
    ? VEHICLE_TYPE_LABELS[vehicle.vehicle_type] || vehicle.vehicle_type
    : null;

  // Get travel status label
  const travelStatusLabel = travel_status
    ? TRAVEL_STATUS_LABELS[travel_status] || travel_status
    : null;

  return (
    <Link to={`/profile/${id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors">
      <img
        src={avatar_url || DEFAULT_AVATAR}
        alt={display_name || 'User'}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-700"
      />
      <div className="flex-1 min-w-0">
        <span className="text-white text-sm font-medium block truncate">{display_name || 'Anonymous'}</span>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {vehicleTypeLabel && (
            <span className="text-xs text-zinc-400">🚐 {vehicleTypeLabel}</span>
          )}
          {travelStatusLabel && (
            <span className="text-xs text-zinc-500">{travelStatusLabel}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function MatchChatPanel({ match }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!match) {
      setMessages([]);
      setLoading(false);
      setError('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await matchMessagesAPI.list(match.id);
      const payload = response.data.data || response.data;
      const sortedMessages = Array.isArray(payload) ? payload : [];
      setMessages(sortedMessages);
    } catch (err) {
      setError(err.message || 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [match]);

  // Load participant profiles from messages
  const loadParticipants = useCallback(async () => {
    if (messages.length === 0) {
      setParticipants([]);
      return;
    }

    // Extract unique user IDs from messages
    const userIds = [...new Set(
      messages
        .filter(msg => msg.user?.id)
        .map(msg => msg.user.id)
    )];

    if (userIds.length === 0) {
      setParticipants([]);
      return;
    }

    setParticipantsLoading(true);
    try {
      // Fetch profiles for each participant
      const profilePromises = userIds.map(async (userId) => {
        try {
          const response = await profilesAPI.getProfile(userId);
          return response.data.data || response.data;
        } catch {
          // If profile fetch fails, return basic info from message
          const userMessage = messages.find(msg => msg.user?.id === userId);
          return {
            id: userId,
            display_name: userMessage?.user?.username || 'Unknown',
            avatar_url: null,
            has_van: false,
            vehicle: null,
            travel_status: null,
          };
        }
      });

      const profiles = await Promise.all(profilePromises);
      setParticipants(profiles.filter(Boolean));
    } catch (err) {
      console.error('Failed to load participant profiles:', err);
    } finally {
      setParticipantsLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Load participant profiles when messages are loaded
  useEffect(() => {
    if (!loading && messages.length > 0) {
      loadParticipants();
    }
  }, [messages, loading, loadParticipants]);

  const handleSendMessage = async (content) => {
    if (!match) return;

    try {
      setSending(true);
      const response = await matchMessagesAPI.create(match.id, content);
      const message = response.data.data || response.data;
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setSending(false);
    }
  };

  if (!match) {
    return (
      <div className="flex items-center justify-center h-64 bg-zinc-900 rounded-xl border border-zinc-800">
        <p className="text-zinc-500">Select a match to open its chat thread.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div>
          <p className="text-white font-semibold">{match.candidate?.label || 'Match'}</p>
          <span className="text-zinc-500 text-sm">
            Group chat · {match.snapshot?.approvals || 0} approvals
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowParticipants(!showParticipants)} 
            className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
            title={showParticipants ? 'Hide participants' : 'Show participants'}
          >
            👥 {participants.length > 0 ? participants.length : ''}
          </button>
          <button 
            onClick={loadMessages} 
            className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Participants Section */}
      {showParticipants && (
        <div className="border-b border-zinc-800 p-3 bg-zinc-800/50">
          <div className="text-xs text-zinc-500 mb-2">Chat Participants</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {participantsLoading ? (
              <div className="text-zinc-500 text-sm py-2">Loading profiles...</div>
            ) : participants.length > 0 ? (
              participants.map((profile) => (
                <ProfilePreview key={profile.id} profile={profile} />
              ))
            ) : (
              <div className="text-zinc-500 text-sm py-2">No participants yet</div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-900/50 border-b border-red-800">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="flex-1 max-h-64 overflow-y-auto">
        <MessageList
          messages={messages}
          loading={loading}
          currentUserId={user?.id}
        />
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={sending || loading}
      />
    </div>
  );
}

export default MatchChatPanel;
