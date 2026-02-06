import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { matchesAPI } from '../services/api';
import PersonMatchList from '../components/PersonMatchList';
import PersonChatPanel from '../components/PersonChatPanel';

function PersonMatchesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const selectedMatchIdFromState = location.state?.matchId;

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await matchesAPI.list();
      const data = response.data.data || response.data;
      const matchList = Array.isArray(data) ? data : (data.results || []);
      setMatches(matchList);
      let nextSelected = null;
      if (selectedMatchIdFromState) {
        nextSelected = matchList.find(match => match.id === selectedMatchIdFromState) || null;
      }
      if (!nextSelected && !selectedMatch && matchList.length > 0) {
        nextSelected = matchList[0];
      }
      if (nextSelected || !selectedMatch) {
        setSelectedMatch(nextSelected);
      }
    } catch (err) {
      setError(err.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [selectedMatch, selectedMatchIdFromState]);

  useEffect(() => { loadMatches(); }, []);

  const filteredMatches = matches.filter(match => {
    if (filterMode === 'all') return true;
    return match.mode === filterMode;
  });

  const handleSelectMatch = (match) => setSelectedMatch(match);

  const handleUnmatch = async (matchId) => {
    try {
      await matchesAPI.unmatch(matchId);
      setMatches(prev => prev.filter(m => m.id !== matchId));
      if (selectedMatch?.id === matchId) {
        const remaining = matches.filter(m => m.id !== matchId);
        setSelectedMatch(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) { console.error('Failed to unmatch:', err); }
  };

  const handleReport = async (matchId, reason) => {
    try { await matchesAPI.report(matchId, { reason }); } 
    catch (err) { console.error('Failed to report:', err); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={loadMatches} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="py-4">
          <button onClick={() => navigate('/discover')} className="text-blue-500 text-sm hover:underline">
            ← Back to Discovery
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Your Matches</h1>
          <p className="text-zinc-500 text-sm">Connect with people you can chat with.</p>
        </div>

        {/* Mode Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button 
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterMode === 'all' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('all')}
          >
            All ({matches.length})
          </button>
          <button 
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterMode === 'dating' ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('dating')}
          >
            💕 Dating ({matches.filter(m => m.mode === 'dating').length})
          </button>
          <button 
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterMode === 'friends' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setFilterMode('friends')}
          >
            🤝 Friends ({matches.filter(m => m.mode === 'friends').length})
          </button>
        </div>

        {/* Match List */}
        <PersonMatchList
          matches={filteredMatches}
          selectedMatchId={selectedMatch?.id}
          onSelectMatch={handleSelectMatch}
          onRefresh={loadMatches}
        />

        {/* Chat Panel */}
        {selectedMatch && (
          <div className="mt-4">
            <PersonChatPanel
              match={selectedMatch}
              onUnmatch={handleUnmatch}
              onReport={handleReport}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonMatchesPage;
