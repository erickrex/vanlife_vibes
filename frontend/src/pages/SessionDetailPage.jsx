import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { sessionsAPI, candidatesAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SessionDetail from '../components/SessionDetail';
import './SessionDetailPage.css';

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
      // API returns { status: 'success', data: {...} }
      const sessionData = sessionResponse.data.data || sessionResponse.data;
      setSession(sessionData);
      
      // Check if user is admin of the group
      try {
        const membersResponse = await groupsAPI.listMembers(sessionData.group);
        const members = membersResponse.data.data || [];
        const currentUserMembership = members.find(m => m.user?.id === user?.id);
        setIsAdmin(currentUserMembership?.role === 'admin');
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      }
      
      // Load candidates and matches
      const [candidatesResponse, matchesResponse] = await Promise.all([
        candidatesAPI.list(sessionId),
        sessionsAPI.listMatches(sessionId)
      ]);
      
      // API returns { status: 'success', data: { results: [...], count: 20, ... } }
      const candidatesData = candidatesResponse.data.data?.results || candidatesResponse.data.data || candidatesResponse.data.results || candidatesResponse.data || [];
      setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      
      // API returns { status: 'success', data: [...] }
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
    return <div className="loading-page">Loading session...</div>;
  }

  // Get the group ID for back navigation
  const groupId = session?.group?.id || session?.group_id || session?.group;

  if (error && !session) {
    return (
      <div className="error-page">
        <p>{error}</p>
        <button onClick={() => navigate('/groups')} className="back-button">
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="decision-detail-page">
      <div className="page-header">
        <button onClick={() => navigate(groupId ? `/groups/${groupId}` : '/groups')} className="back-link">
          ← Back
        </button>
        {session?.status === 'open' && (
          <Link 
            to={`/sessions/${sessionId}/swipe`} 
            className="vote-button"
          >
            Start Swiping
          </Link>
        )}
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          Candidates ({candidates.length})
        </button>
        <button
          className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          Matches ({matches.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <SessionDetail
            session={session}
            isAdmin={isAdmin}
            onStatusChange={handleStatusChange}
          />
        )}

        {activeTab === 'candidates' && (
          <div className="items-tab">
            <div className="tab-header">
              <h2>Candidates ({candidates.length})</h2>
              {isAdmin && (
                <Link 
                  to={`/sessions/${sessionId}/candidates`}
                  className="manage-items-button"
                >
                  + Add Candidates
                </Link>
              )}
            </div>
            
            {candidates.length === 0 ? (
              <div className="empty-state">
                <p>No candidates yet.</p>
                {isAdmin && <p>Add candidates for members to swipe on!</p>}
              </div>
            ) : (
              <ul className="items-simple-list">
                {candidates.map((candidate, index) => (
                  <li key={candidate.id} className="item-row">
                    <span className="item-number">{index + 1}.</span>
                    <span className="item-name">{candidate.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="favourites-tab">
            <div className="tab-header">
              <h2>Matches ({matches.length})</h2>
              <Link
                to={`/sessions/${sessionId}/matches`}
                className="view-all-link"
              >
                View All →
              </Link>
            </div>
            <p className="tab-description">
              Candidates that have met the approval threshold
            </p>
            
            {matches.length === 0 ? (
              <div className="empty-state">
                <p>No matches yet.</p>
                <p>Candidates will appear here once they meet the approval rule.</p>
              </div>
            ) : (
              <div className="favourites-grid-view">
                {matches.map((match) => {
                  const candidate = match.candidate || {};
                  const attributes = candidate.attributes || {};
                  
                  return (
                    <div key={match.id} className="favourite-grid-card">
                      {attributes.image_url ? (
                        <img 
                          src={attributes.image_url} 
                          alt={candidate.label} 
                          className="favourite-grid-image"
                        />
                      ) : (
                        <div className="favourite-grid-placeholder">
                          <span>⭐</span>
                        </div>
                      )}
                      <div className="favourite-grid-content">
                        <h3 className="favourite-grid-label">{candidate.label || 'Unknown'}</h3>
                        <div className="favourite-grid-approval">
                          <span className="approval-badge">
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
  );
}

export default SessionDetailPage;
