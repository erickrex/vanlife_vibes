import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { matchesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PersonMatchList from '../components/PersonMatchList';
import PersonChatPanel from '../components/PersonChatPanel';
import { createRealtimeSocket } from '../services/realtime';

function PersonMatchesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [socketConnected, setSocketConnected] = useState(false);
  const selectedMatchIdFromState = location.state?.matchId;

  const loadMatches = useCallback(async (options = {}) => {
    const { silent = false } = options;

    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');

      const response = await matchesAPI.list();
      const data = response.data.data || response.data;
      const matchList = Array.isArray(data) ? data : (data.results || []);
      setMatches(matchList);

      setSelectedMatch((previousSelected) => {
        if (selectedMatchIdFromState) {
          return matchList.find((match) => match.id === selectedMatchIdFromState) || null;
        }
        if (previousSelected && matchList.some((match) => match.id === previousSelected.id)) {
          return previousSelected;
        }
        return matchList[0] || null;
      });
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load matches');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [selectedMatchIdFromState]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    const realtimeSocket = createRealtimeSocket({
      path: '/ws/matches/',
      onOpen: () => setSocketConnected(true),
      onClose: () => setSocketConnected(false),
      onMessage: (payload) => {
        if (payload?.type === 'matches_update' || payload?.type === 'new_message') {
          loadMatches({ silent: true });
        }
      },
    });

    realtimeSocket.connect();
    return () => realtimeSocket.disconnect();
  }, [loadMatches]);

  useEffect(() => {
    if (socketConnected) return undefined;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMatches({ silent: true });
      }
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [loadMatches, socketConnected]);

  const sortedMatches = useMemo(() => {
    const getSortTime = (match) => {
      const timestamp = match.last_message?.created_at || match.matched_at;
      return timestamp ? new Date(timestamp).getTime() : 0;
    };

    return [...matches].sort((a, b) => {
      const unreadDifference = (b.unread_count || 0) - (a.unread_count || 0);
      if (unreadDifference !== 0) {
        return unreadDifference;
      }
      return getSortTime(b) - getSortTime(a);
    });
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return sortedMatches.filter((match) => {
      if (filterMode === 'all') return true;
      if (filterMode === 'unread') return (match.unread_count || 0) > 0;
      return match.mode === filterMode;
    });
  }, [filterMode, sortedMatches]);

  useEffect(() => {
    if (selectedMatch && filteredMatches.some((match) => match.id === selectedMatch.id)) {
      return;
    }
    setSelectedMatch(filteredMatches[0] || null);
  }, [filteredMatches, selectedMatch]);

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
    setMatches((previousMatches) => previousMatches.map((item) => (
      item.id === match.id ? { ...item, unread_count: 0 } : item
    )));
  };

  const handleUnmatch = async (matchId) => {
    try {
      await matchesAPI.unmatch(matchId);
      setMatches((previousMatches) => {
        const remainingMatches = previousMatches.filter((match) => match.id !== matchId);
        setSelectedMatch((previousSelected) => {
          if (!previousSelected || previousSelected.id !== matchId) {
            return previousSelected;
          }
          return remainingMatches[0] || null;
        });
        return remainingMatches;
      });
    } catch (err) {
      console.error('Failed to unmatch:', err);
    }
  };

  const handleReport = async (matchId, reason) => {
    try {
      await matchesAPI.report(matchId, { reason });
    } catch (err) {
      console.error('Failed to report:', err);
    }
  };

  const datingCount = matches.filter((match) => match.mode === 'dating').length;
  const friendsCount = matches.filter((match) => match.mode === 'friends').length;
  const unreadTotal = matches.reduce((sum, match) => sum + (match.unread_count || 0), 0);

  useEffect(() => {
    const previousTitle = document.title;
    if (unreadTotal > 0) {
      document.title = `(${unreadTotal}) Matches • VanlifeVibes`;
    } else {
      document.title = 'Matches • VanlifeVibes';
    }
    return () => {
      document.title = previousTitle;
    };
  }, [unreadTotal]);

  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={loadMatches} className="app-btn-primary-social px-4 py-2">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-20">
      <div className="max-w-lg mx-auto px-4">
        <div className="py-4">
          <button onClick={() => navigate('/dating')} className="text-blue-500 text-sm hover:underline">
            ← Back to Dating
          </button>
        </div>

        <div className="app-card p-4 mb-4">
          <h1 className="text-2xl font-bold text-white mb-1">Matches & Chats</h1>
          <p className="text-zinc-400 text-sm">Message people you matched with and keep the momentum going.</p>
          <div className="flex items-center gap-2 mt-3 text-xs flex-wrap">
            <span className="px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              💕 {datingCount} Dating
            </span>
            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              🤝 {friendsCount} Friends
            </span>
            {unreadTotal > 0 && (
              <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                🔔 {unreadTotal} New message{unreadTotal === 1 ? '' : 's'}
              </span>
            )}
            <span className={`px-2 py-1 rounded-full border ${
              socketConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {socketConnected ? 'Live' : 'Syncing'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              filterMode === 'all' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('all')}
          >
            All ({matches.length})
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              filterMode === 'unread'
                ? 'bg-amber-400 text-zinc-900'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('unread')}
          >
            🔔 New ({unreadTotal})
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              filterMode === 'dating' ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('dating')}
          >
            💕 Dating ({datingCount})
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              filterMode === 'friends' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('friends')}
          >
            🤝 Friends ({friendsCount})
          </button>
        </div>

        <PersonMatchList
          matches={filteredMatches}
          selectedMatchId={selectedMatch?.id}
          onSelectMatch={handleSelectMatch}
          onRefresh={loadMatches}
          currentProfileId={profile?.id}
        />

        {selectedMatch && (
          <div className="mt-4 mb-6">
            <PersonChatPanel
              match={selectedMatch}
              onUnmatch={handleUnmatch}
              onReport={handleReport}
              currentProfileId={profile?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonMatchesPage;
