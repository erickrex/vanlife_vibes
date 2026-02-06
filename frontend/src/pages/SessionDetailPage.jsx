import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { sessionsAPI, candidatesAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SessionDetail from '../components/SessionDetail';

function SessionDetailPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const loadSessionData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const sessionResponse = await sessionsAPI.get(sessionId);
      const sessionData = sessionResponse.data.data || sessionResponse.data;
      setSession(sessionData);
      
      try {
        const membersResponse = await groupsAPI.listMembers(sessionData.group);
        const members = membersResponse.data.data || [];
        const currentUserMembership = members.find(m => m.user?.id === user?.id);
        setIsAdmin(currentUserMembership?.role === 'admin');
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      }
      
      const [candidatesResponse, matchesResponse] = await Promise.all([
        candidatesAPI.list(sessionId),
        sessionsAPI.listMatches(sessionId)
      ]);
      
      const candidatesData = candidatesResponse.data.data?.results || candidatesResponse.data.data || candidatesResponse.data.results || candidatesResponse.data || [];
      setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      
      let matchesData = matchesResponse.data.data || matchesResponse.data;
      if (matchesData && matchesData.results) {
        matchesData = matchesData.results;
      }
      setMatches(Array.isArray(matchesData) ? matchesData : []);
    } catch (err) {
      setError(err.message || 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  const handleStatusChange = async (newStatus) => {
    try {
      await sessionsAPI.update(sessionId, { status: newStatus });
      await loadSessionData();
    } catch (err) {
      setError(err.message || 'Failed to update session status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-400 flex items-center justify-center p-4">
        Loading session...
      </div>
    );
  }

  const groupId = session?.group?.id || session?.group_id || session?.group;

  if (error && !session) {
    return (
      <div className="min-h-screen bg-black text-red-400 flex flex-col items-center justify-center p-4 gap-4">
        <p>{error}</p>
        <button 
          onClick={() => navigate('/groups')} 
          className="px-4 py-2 bg-zinc-900 text-blue-500 border border-zinc-700 rounded-lg font-medium hover:bg-blue-500 hover:text-white hover:border-transparent transition-all"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-20 pt-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(groupId ? `/groups/${groupId}` : '/groups')} 
            className="text-blue-500 hover:text-blue-400 font-medium bg-transparent border-none cursor-pointer text-base py-2 transition-colors"
          >
            ← Back
          </button>
          {session?.status === 'open' && (
            <Link 
              to={`/sessions/${sessionId}/swipe`} 
              className="w-full sm:w-auto text-center px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg"
            >
              Start Swiping
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-500/15 text-red-400 p-4 rounded-lg mb-4 text-sm border border-red-500/50">
            {error}
          </div>
        )}

        <div className="flex gap-2 border-b-2 border-zinc-800 mb-6 overflow-x-auto">
          <button
            className={`px-4 py-3 text-base font-medium whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-500 border-b-2 border-blue-500 font-semibold'
                : 'text-zinc-400 border-b-2 border-transparent hover:text-blue-400 hover:bg-zinc-900'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-4 py-3 text-base font-medium whitespace-nowrap transition-colors ${
              activeTab === 'candidates'
                ? 'text-blue-500 border-b-2 border-blue-500 font-semibold'
                : 'text-zinc-400 border-b-2 border-transparent hover:text-blue-400 hover:bg-zinc-900'
            }`}
            onClick={() => setActiveTab('candidates')}
          >
            Candidates ({candidates.length})
          </button>
          <button
            className={`px-4 py-3 text-base font-medium whitespace-nowrap transition-colors ${
              activeTab === 'matches'
                ? 'text-blue-500 border-b-2 border-blue-500 font-semibold'
                : 'text-zinc-400 border-b-2 border-transparent hover:text-blue-400 hover:bg-zinc-900'
            }`}
            onClick={() => setActiveTab('matches')}
          >
            Matches ({matches.length})
          </button>
        </div>

        <div className="min-h-[400px]">
          {activeTab === 'overview' && (
            <SessionDetail
              session={session}
              isAdmin={isAdmin}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeTab === 'candidates' && (
            <div className="bg-zinc-900 rounded-xl p-4 sm:p-6 border border-zinc-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-semibold text-white m-0">Candidates ({candidates.length})</h2>
                {isAdmin && (
                  <Link 
                    to={`/sessions/${sessionId}/candidates`}
                    className="w-full sm:w-auto text-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg"
                  >
                    + Add Candidates
                  </Link>
                )}
              </div>
              
              {candidates.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <p className="mb-2">No candidates yet.</p>
                  {isAdmin && <p>Add candidates for members to swipe on!</p>}
                </div>
              ) : (
                <ul className="list-none p-0 m-0">
                  {candidates.map((candidate, index) => (
                    <li 
                      key={candidate.id} 
                      className="flex items-center px-4 py-3 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50 transition-colors"
                    >
                      <span className="text-zinc-500 text-sm min-w-[2.5rem]">{index + 1}.</span>
                      <span className="text-zinc-200">{candidate.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="bg-zinc-900 rounded-xl p-4 sm:p-6 border border-zinc-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-semibold text-white m-0">Matches ({matches.length})</h2>
                <Link
                  to={`/sessions/${sessionId}/matches`}
                  className="text-blue-500 hover:text-blue-400 font-semibold transition-colors"
                >
                  View All →
                </Link>
              </div>
              <p className="text-zinc-400 text-sm mb-6">
                Candidates that have met the approval threshold
              </p>
              
              {matches.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <p className="mb-2">No matches yet.</p>
                  <p>Candidates will appear here once they meet the approval rule.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {matches.map((match) => {
                    const candidate = match.candidate || {};
                    const attributes = candidate.attributes || {};
                    
                    return (
                      <div 
                        key={match.id} 
                        className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl hover:border-blue-500"
                      >
                        {attributes.image_url ? (
                          <img 
                            src={attributes.image_url} 
                            alt={candidate.label} 
                            className="w-full h-40 sm:h-44 object-cover bg-zinc-900"
                          />
                        ) : (
                          <div className="w-full h-40 sm:h-44 bg-gradient-to-br from-amber-500 to-amber-300 flex items-center justify-center text-5xl">
                            ⭐
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="text-white font-semibold mb-3 truncate">{candidate.label || 'Unknown'}</h3>
                          <div className="flex justify-end">
                            <span className="text-sm font-semibold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full">
                              ✓ {match.snapshot?.approvals || 0}/{match.snapshot?.total_members || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionDetailPage;
