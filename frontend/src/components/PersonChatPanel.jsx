import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { matchesAPI, profilesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PersonMessageList from './PersonMessageList';
import PersonMessageInput from './PersonMessageInput';
import ChatActionsMenu from './ChatActionsMenu';
import MiniCardModal from './MiniCardModal';
import { DEFAULT_AVATAR } from '../utils/constants';
import { createRealtimeSocket } from '../services/realtime';

function PersonChatPanel({ match, onUnmatch, onReport, currentProfileId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showMiniCardModal, setShowMiniCardModal] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const actionsMenuRef = useRef(null);

  const otherUser = match?.other_user || {};
  const mode = match?.mode || 'friends';
  const activeMatchId = match?.id ? String(match.id) : null;

  const appendUniqueMessage = useCallback((incomingMessage) => {
    if (!incomingMessage) return;
    setMessages((previousMessages) => {
      if (previousMessages.some((message) => String(message.id) === String(incomingMessage.id))) {
        return previousMessages;
      }
      return [...previousMessages, incomingMessage];
    });
  }, []);

  const loadMessages = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!match) {
      setMessages([]);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await matchesAPI.getMessages(match.id);
      const data = response.data.data || response.data;
      const messageList = Array.isArray(data) ? data : (data.results || []);
      setMessages(messageList);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load messages');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [match]);

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
    if (!activeMatchId) return undefined;

    const realtimeSocket = createRealtimeSocket({
      path: `/ws/matches/${activeMatchId}/`,
      onOpen: () => setSocketConnected(true),
      onClose: () => setSocketConnected(false),
      onMessage: (payload) => {
        if (payload?.type === 'chat_message' && String(payload?.match_id) === activeMatchId) {
          appendUniqueMessage(payload.message);
        }
      },
    });

    realtimeSocket.connect();
    return () => realtimeSocket.disconnect();
  }, [activeMatchId, appendUniqueMessage]);

  useEffect(() => {
    if (!match || socketConnected) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages({ silent: true });
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [loadMessages, match, socketConnected]);

  useEffect(() => {
    loadMyProfile();
  }, [loadMyProfile]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendMessage = async (content) => {
    if (!match || !content.trim()) return;

    try {
      setSending(true);
      const response = await matchesAPI.sendMessage(match.id, content);
      const newMessage = response.data.data || response.data;
      appendUniqueMessage(newMessage);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

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
      appendUniqueMessage(newMessage);
      setShowMiniCardModal(false);
    } catch (err) {
      console.error('Failed to share mini-card:', err);
      setError('Failed to share mini-card');
    } finally {
      setSending(false);
    }
  };

  const handleUnmatch = () => {
    if (onUnmatch && match) {
      onUnmatch(match.id);
    }
    setShowActionsMenu(false);
  };

  const handleReport = (reason) => {
    if (onReport && match) {
      onReport(match.id, reason);
    }
    setShowActionsMenu(false);
  };

  if (!match) {
    return (
      <div className="app-card p-8 text-center">
        <div className="text-4xl mb-2">💬</div>
        <p className="text-white font-semibold">Select a match</p>
        <p className="text-zinc-500 text-sm mt-1">Open a conversation to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="app-card flex flex-col min-h-[30rem] overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/75">
        <Link to={`/profile/${otherUser.id}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img
            src={otherUser.avatar_url || DEFAULT_AVATAR}
            alt={otherUser.display_name || 'User'}
            className={`w-11 h-11 rounded-full object-cover ${
              mode === 'dating' ? 'ring-2 ring-rose-500/40' : 'ring-2 ring-blue-500/40'
            }`}
          />
          <div>
            <span className="text-white font-semibold block leading-tight">
              {otherUser.display_name || 'Anonymous'}
            </span>
            <span className={`text-xs ${mode === 'dating' ? 'text-rose-300' : 'text-blue-300'}`}>
              {mode === 'dating' ? '💕 Dating match' : '🤝 Friend match'}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span className={`hidden sm:inline-flex px-2 py-1 rounded-full text-[10px] border ${
            socketConnected
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}>
            {socketConnected ? 'Live' : 'Syncing'}
          </span>
          <button
            onClick={() => setShowMiniCardModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition-colors"
            title="Share your location card"
          >
            <span>📍</span>
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={loadMessages}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
          <div className="relative" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
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

      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/35 border-b border-red-800">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white">✕</button>
        </div>
      )}

      <PersonMessageList
        messages={messages}
        loading={loading}
        currentUserId={currentProfileId || user?.profile_id || user?.id}
        mode={mode}
      />

      <PersonMessageInput
        onSendMessage={handleSendMessage}
        disabled={sending || loading}
        placeholder={`Message ${otherUser.display_name || 'your match'}...`}
        mode={mode}
      />

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
