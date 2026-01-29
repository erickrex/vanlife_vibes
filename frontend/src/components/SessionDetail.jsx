import React from 'react';
import './SessionDetail.css';

function SessionDetail({ session, isAdmin, onStatusChange }) {
  if (!session) {
    return <div className="loading">Loading session details...</div>;
  }

  const getRuleDisplay = (rules) => {
    if (!rules) return 'No rules configured';
    if (rules.type === 'unanimous') {
      return 'All members must approve for candidates to become matches';
    }
    if (rules.type === 'threshold') {
      return `${Math.round(rules.value * 100)}% of members must approve for candidates to become matches`;
    }
    return 'Unknown rule type';
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      open: 'green',
      closed: 'blue',
      archived: 'purple'
    };
    return colors[status] || 'gray';
  };

  const canTransitionTo = (currentStatus, targetStatus) => {
    const validTransitions = {
      draft: ['open'],
      open: ['closed'],
      closed: ['archived'],
      archived: []
    };
    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  };

  const handleStatusChange = (newStatus) => {
    if (window.confirm(`Are you sure you want to change the status to "${newStatus}"?`)) {
      onStatusChange(newStatus);
    }
  };

  return (
    <div className="decision-detail">
      <div className="decision-header">
        <div className="decision-info">
          <h1 className="decision-title">{session.title}</h1>
          <span className={`status-badge status-${session.status}`}>
            {session.status}
          </span>
        </div>
        
        {session.description && (
          <p className="decision-description">{session.description}</p>
        )}
      </div>

      <div className="decision-details-grid">
        <div className="detail-section">
          <h3 className="detail-label">Candidate Type</h3>
          <p className="detail-value">{session.candidate_type || 'General'}</p>
        </div>

        <div className="detail-section">
          <h3 className="detail-label">Approval Rule</h3>
          <p className="detail-value">{getRuleDisplay(session.rules)}</p>
        </div>

        <div className="detail-section">
          <h3 className="detail-label">Created</h3>
          <p className="detail-value">
            {session.created_at 
              ? new Date(session.created_at).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>

        {session.updated_at && (
          <div className="detail-section">
            <h3 className="detail-label">Last Updated</h3>
            <p className="detail-value">
              {session.updated_at 
                ? new Date(session.updated_at).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        )}
      </div>

      {isAdmin && onStatusChange && (
        <div className="status-controls">
          <h3 className="controls-label">Status Controls</h3>
          <div className="status-buttons">
            {canTransitionTo(session.status, 'open') && (
              <button
                className="status-button open"
                onClick={() => handleStatusChange('open')}
              >
                Open Session
              </button>
            )}
            {canTransitionTo(session.status, 'closed') && (
              <button
                className="status-button closed"
                onClick={() => handleStatusChange('closed')}
              >
                Close Session
              </button>
            )}
            {canTransitionTo(session.status, 'archived') && (
              <button
                className="status-button archived"
                onClick={() => handleStatusChange('archived')}
              >
                Archive Session
              </button>
            )}
          </div>
          {session.status === 'closed' && (
            <p className="status-note">
              Closed sessions cannot accept new swipes, but chat and matches remain accessible.
            </p>
          )}
          {session.status === 'archived' && (
            <p className="status-note">
              Archived sessions are read-only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SessionDetail;
