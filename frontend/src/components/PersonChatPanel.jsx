import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { matchesAPI, profilesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PersonMessageList from './PersonMessageList';
import PersonMessageInput from './PersonMessageInput';
import ChatActionsMenu from './ChatActionsMenu';
import MiniCardModal from './MiniCardModal';

// Default placeholder avatar
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * PersonChatPanel - Chat interface for person-to-person matches
 * 
 * Features:
 * - Message list with timestamps
 * - Message input
 * - Mini-card sharing button
 * - Unmatch/report actions
 * 
 * **Validates: Requirements 10.1, 10.3, 10.4, 10.6**
 */
function PersonChatPanel({ match, onUnmatch, onReport }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showMiniCardModal, setShowMiniCardModal] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const actionsMenuRef = useRef(null);

  const otherUser = match?.other_user || {};
  const mode = match?.mode || 'friends';

  // Load messages for the match
  const loadMessages = useCallback(async () => {
    if (!match) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await matchesAPI.getMessages(match.id);
      const data = response.data.data || response.data;
      const messageList = Array.isArray(data) ? data : (data.results || []);
      setMessages(messageList);
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [match]);

  // Load my profile for mini-card sharing
  const loadMyProfile = useCallback(async () => {
    try {
      const response = await profilesAPI.getMyProfile();
      setMyProfile(response.data.data || response.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadMyProfile();
  }, [loadMyProfile]);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Send a text message
  const handleSendMessage = async (content) => {
    if (!match || !content.trim()) return;

    try {
      setSending(true);
      const response = await matchesAPI.sendMessage(match.id, content);
      const newMessage = response.data.data || response.data;
      setMessages(prev => [...prev, newMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Share mini-card
  const handleShareMiniCard = async () => {
    if (!match || !myProfile) return;

    try {
      setSending(true);
      const miniCardData = {
        current_location: myProfile.current_location || myProfile.in_town_windows?.[0]?.city_area,
        in_town_until: myProfile.in_town_windows?.[0]?.end_date,
        meet_preference: myProfile.meetup_interest || 'open_to_it',
      };
      
      const response = await matchesAPI.shareMiniCard(match.id, miniCardData);
      const newMessage = response.data.data || response.data;
      setMessages(prev => [...prev, newMessage]);
      setShowMiniCardModal(false);
    } catch (err) {
      console.error('Failed to share mini-card:', err);
      setError('Failed to share mini-card');
    } finally {
      setSending(false);
    }
  };

  // Handle unmatch action
  const handleUnmatch = () => {
    if (onUnmatch && match) {
      onUnmatch(match.id);
    }
    setShowActionsMenu(false);
  };

  // Handle report action
  const handleReport = (reason) => {
    if (onReport && match) {
      onReport(match.id, reason);
    }
    setShowActionsMenu(false);
  };

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-zinc-400">Select a match to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
        <Link to={`/profile/${otherUser.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src={otherUser.avatar_url || DEFAULT_AVATAR}
            alt={otherUser.display_name || 'User'}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-700"
          />
          <div>
            <span className="text-white font-semibold block">{otherUser.display_name || 'Anonymous'}</span>
            <span className={`text-xs ${mode === 'dating' ? 'text-rose-400' : 'text-blue-400'}`}>
              {mode === 'dating' ? '💕 Dating' : '🤝 Friends'}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMiniCardModal(true)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors"
            title="Share your mini-card"
          >
            📍 Share Location
          </button>
          <button 
            onClick={loadMessages} 
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" 
            title="Refresh"
          >
            ↻
          </button>
          <div className="relative" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              title="More options"
            >
              ⋮
            </button>
            {showActionsMenu && (
              <ChatActionsMenu
                onUnmatch={handleUnmatch}
                onReport={handleReport}
                userName={otherUser.display_name || 'this user'}
              />
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/50 border-b border-red-800">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Message List */}
      <PersonMessageList
        messages={messages}
        loading={loading}
        currentUserId={user?.profile_id || user?.id}
      />

      {/* Message Input */}
      <PersonMessageInput
        onSendMessage={handleSendMessage}
        disabled={sending || loading}
        placeholder={`Message ${otherUser.display_name || 'your match'}...`}
      />

      {/* Mini-Card Modal */}
      {showMiniCardModal && (
        <MiniCardModal
          profile={myProfile}
          onShare={handleShareMiniCard}
          onClose={() => setShowMiniCardModal(false)}
          sending={sending}
        />
      )}
    </div>
  );
}

export default PersonChatPanel;
