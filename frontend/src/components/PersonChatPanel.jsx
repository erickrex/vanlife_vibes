import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { matchesAPI, profilesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PersonMessageList from './PersonMessageList';
import PersonMessageInput from './PersonMessageInput';
import ChatActionsMenu from './ChatActionsMenu';
import MiniCardModal from './MiniCardModal';
import IcebreakerModal from './IcebreakerModal';
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
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [icebreakerSeed, setIcebreakerSeed] = useState(0);
  const [myProfile, setMyProfile] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
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

  const loadOtherProfile = useCallback(async () => {
    const otherUserId = match?.other_user?.id;
    if (!otherUserId) {
      setOtherProfile(null);
      return;
    }

    try {
      const response = await profilesAPI.getProfile(otherUserId);
      setOtherProfile(response.data.data || response.data || null);
    } catch (err) {
      console.error('Failed to load other profile:', err);
      setOtherProfile(null);
    }
  }, [match]);

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
    loadOtherProfile();
  }, [loadOtherProfile]);

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

  const getCurrentLocationText = useCallback((profileData) => {
    if (!profileData) return null;

    const firstWindow = profileData.in_town_windows?.[0];
    return firstWindow?.city_area || profileData.current_location || null;
  }, []);

  const buildIcebreakerSuggestions = useCallback((seed = 0) => {
    const myName = myProfile?.display_name || 'I';
    const theirName = otherUser?.display_name || 'you';
    const myLocation = getCurrentLocationText(myProfile);
    const theirLocation = getCurrentLocationText(otherProfile);
    const myHobbies = Array.isArray(myProfile?.hobbies) ? myProfile.hobbies : [];
    const theirHobbies = Array.isArray(otherProfile?.hobbies) ? otherProfile.hobbies : [];
    const myHobbyNames = new Set(
      myHobbies.map((hobby) => String(hobby?.name || '').trim().toLowerCase()).filter(Boolean)
    );
    const sharedHobbyNames = theirHobbies
      .map((hobby) => String(hobby?.name || '').trim())
      .filter((hobbyName) => hobbyName && myHobbyNames.has(hobbyName.toLowerCase()));
    const uniqueSharedHobbies = Array.from(new Set(sharedHobbyNames));

    const theirPrompts = Array.isArray(otherProfile?.prompts) ? otherProfile.prompts : [];
    const highlightedPrompt = theirPrompts.find((promptItem) => promptItem?.prompt_answer);
    const promptQuestion = highlightedPrompt?.prompt_question
      ? String(highlightedPrompt.prompt_question).trim()
      : '';
    const promptAnswerPreview = highlightedPrompt?.prompt_answer
      ? String(highlightedPrompt.prompt_answer).trim()
      : '';
    const shortPromptQuestion = promptQuestion.length > 90
      ? `${promptQuestion.slice(0, 87)}...`
      : promptQuestion;
    const shortPromptAnswer = promptAnswerPreview.length > 90
      ? `${promptAnswerPreview.slice(0, 87)}...`
      : promptAnswerPreview;
    const sameLocation =
      myLocation &&
      theirLocation &&
      myLocation.trim().toLowerCase() === theirLocation.trim().toLowerCase();

    const locationLine = sameLocation
      ? `since we're both in ${myLocation}`
      : myLocation && theirLocation
        ? `while I'm in ${myLocation} and you're in ${theirLocation}`
        : myLocation
          ? `while I'm in ${myLocation}`
          : theirLocation
            ? `while you're in ${theirLocation}`
            : '';

    const suggestionPool = [
      `Hey ${theirName}, what has been your favorite vanlife spot recently?`,
      `What kind of adventure are you in the mood for this week${locationLine ? ` ${locationLine}` : ''}?`,
      `If we planned a low-key hang in the next couple days${locationLine ? ` ${locationLine}` : ''}, what would you pick?`,
      `Quick road question: sunrise hike or sunset campfire?`,
      `${myName} says hi. What is one place you would recommend around ${theirLocation || 'your area'}?`,
      `What is one thing you never skip when settling into a new place${locationLine ? ` ${locationLine}` : ''}?`,
      `If we had one free evening on the road, would you pick a food stop, a hike, or live music?`,
      `What is your go-to way to meet people in a new town?`,
    ];

    if (uniqueSharedHobbies.length > 0) {
      const topSharedHobbies = uniqueSharedHobbies.slice(0, 2).join(' and ');
      suggestionPool.unshift(
        `Looks like we both enjoy ${topSharedHobbies}. Want to trade favorite spots for that?`
      );
      suggestionPool.push(
        `We have ${topSharedHobbies} in common. Want to plan something around that soon?`
      );
    }

    if (shortPromptAnswer && shortPromptQuestion) {
      suggestionPool.unshift(
        `Your answer to "${shortPromptQuestion}" stood out: "${shortPromptAnswer}". What is the full story behind it?`
      );
    }

    const uniqueSuggestions = Array.from(new Set(suggestionPool.filter(Boolean)));
    if (uniqueSuggestions.length <= 6) {
      return uniqueSuggestions;
    }

    const offset = seed % uniqueSuggestions.length;
    const rotated = [
      ...uniqueSuggestions.slice(offset),
      ...uniqueSuggestions.slice(0, offset),
    ];
    if (Math.floor(seed / uniqueSuggestions.length) % 2 === 1) {
      rotated.reverse();
    }
    return rotated.slice(0, 6);
  }, [myProfile, otherProfile, otherUser?.display_name, getCurrentLocationText]);

  const icebreakerSuggestions = useMemo(
    () => buildIcebreakerSuggestions(icebreakerSeed),
    [buildIcebreakerSuggestions, icebreakerSeed]
  );

  const handleRegenerateIcebreakers = () => {
    setIcebreakerSeed((previousSeed) => previousSeed + 1);
  };

  const handleSendIcebreaker = async (content) => {
    if (!match || !content?.trim()) return;

    try {
      setSending(true);
      const response = await matchesAPI.sendIcebreaker(match.id, content.trim());
      const newMessage = response.data.data || response.data;
      appendUniqueMessage(newMessage);
      setShowIcebreakerModal(false);
    } catch (err) {
      console.error('Failed to send icebreaker:', err);
      setError('Failed to send icebreaker');
    } finally {
      setSending(false);
    }
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
            onClick={() => setShowIcebreakerModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition-colors"
            title="Send an icebreaker"
          >
            <span>✨</span>
            <span className="hidden sm:inline">Icebreaker</span>
          </button>
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

      {showIcebreakerModal && (
        <IcebreakerModal
          suggestions={icebreakerSuggestions}
          onSend={handleSendIcebreaker}
          onRegenerate={handleRegenerateIcebreakers}
          onClose={() => setShowIcebreakerModal(false)}
          sending={sending}
          otherUserName={otherUser.display_name}
        />
      )}
    </div>
  );
}

export default PersonChatPanel;
