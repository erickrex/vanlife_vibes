import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import MatchList from '../components/MatchList';
import MatchChatPanel from '../components/MatchChatPanel';
import './MatchesPage.css';

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

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <div className="matches-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matches-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={() => navigate(`/sessions/${sessionId}`)} className="helper-button">
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
    <div className="matches-page">
      <div className="page-header">
        <button onClick={() => navigate(`/sessions/${sessionId}`)} className="back-link">
          ← Back
        </button>
        <Link to={`/sessions/${sessionId}`} className="view-decision-link">
          View Session
        </Link>
      </div>

      <div className="page-title-section">
        <h1 className="page-title">Matches</h1>
        {session && (
          <p className="page-subtitle">
            {session.title}
          </p>
        )}
        <p className="page-description">
          Candidates that have met the approval threshold and been selected by the group
        </p>
      </div>

      {session && (
        <div className="decision-info-card">
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span className={`status-badge status-${session.status}`}>
              {session.status}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Approval Rule:</span>
            <span className="info-value">
              {session.rules?.type === 'unanimous' 
                ? 'Unanimous (100%)' 
                : `${Math.round((session.rules?.value || 0) * 100)}% Threshold`}
            </span>
          </div>
        </div>
      )}

      <div className="matches-content">
        <section className="matches-column">
          <div className="matches-column-heading">
            <h2>Group Matches</h2>
            <p>Stay focused on the options that passed the approval rule.</p>
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

        <section className="chat-column">
          <MatchChatPanel match={selectedMatch} />
        </section>
      </div>
    </div>
  );
}

export default MatchesPage;
