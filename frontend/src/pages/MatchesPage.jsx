import React, { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import MatchList from '../components/MatchList';
import MatchChatPanel from '../components/MatchChatPanel';

function MatchesPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await sessionsAPI.get(sessionId);
      // API returns { status: 'success', data: {...} }
      const sessionData = response.data.data || response.data;
      setSession(sessionData);
    } catch (err) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => navigate(`/sessions/${sessionId}`)} 
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleMatchesChange = useCallback((updatedMatches) => {
    if (!selectedMatch && updatedMatches.length > 0) {
      setSelectedMatch(updatedMatches[0]);
    } else if (selectedMatch && !updatedMatches.some(match => match.id === selectedMatch.id) && updatedMatches.length > 0) {
      setSelectedMatch(updatedMatches[0]);
    }
  }, [selectedMatch]);

  return (
    <div className="min-h-screen bg-black px-4 py-6 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(`/sessions/${sessionId}`)} 
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <Link 
            to={`/sessions/${sessionId}`} 
            className="text-blue-500 hover:text-blue-400 text-sm transition-colors"
          >
            View Session
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Matches</h1>
          {session && (
            <p className="text-zinc-400 text-sm">{session.title}</p>
          )}
          <p className="text-zinc-500 text-sm mt-1">
            Candidates that have met the approval threshold and been selected by the group
          </p>
        </div>

        {session && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-zinc-500 text-sm">Status:</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                  session.status === 'open' ? 'bg-emerald-900/50 text-emerald-400' :
                  session.status === 'closed' ? 'bg-zinc-700 text-zinc-300' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {session.status}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-sm">Approval Rule:</span>
                <span className="ml-2 text-white text-sm">
                  {session.rules?.type === 'unanimous' 
                    ? 'Unanimous (100%)' 
                    : `${Math.round((session.rules?.value || 0) * 100)}% Threshold`}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <div className="mb-4">
              <h2 className="text-white font-semibold">Group Matches</h2>
              <p className="text-zinc-500 text-sm">Stay focused on the options that passed the approval rule.</p>
            </div>
            <MatchList 
              sessionId={sessionId} 
              autoRefresh={session?.status === 'open'}
              refreshInterval={5000}
              onSelectMatch={(match) => setSelectedMatch(match)}
              selectedMatchId={selectedMatch?.id}
              onMatchesChange={handleMatchesChange}
            />
          </section>

          <section>
            <MatchChatPanel match={selectedMatch} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default MatchesPage;
