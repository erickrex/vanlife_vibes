import React from 'react';
import { Link } from 'react-router-dom';
import './SessionList.css';

function SessionList({ sessions, groupId, isAdmin }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>No sessions yet.</p>
        {isAdmin && <p>Create a session to get started!</p>}
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      open: 'green',
      closed: 'blue',
      archived: 'purple'
    };
    return colors[status] || 'gray';
  };

  const getRuleDisplay = (rules) => {
    if (!rules) return 'No rules';
    if (rules.type === 'unanimous') return 'Unanimous';
    if (rules.type === 'threshold') return `${Math.round(rules.value * 100)}% threshold`;
    return 'Unknown rule';
  };

  return (
    <div className="decision-list">
      {sessions.map((session) => (
        <Link 
          key={session.id} 
          to={`/sessions/${session.id}`}
          className="decision-card"
        >
          <div className="decision-card-header">
            <h3 className="decision-title">{session.title}</h3>
            <span className={`status-badge status-${session.status}`}>
              {session.status}
            </span>
          </div>
          
          {session.description && (
            <p className="decision-description">{session.description}</p>
          )}
          
          <div className="decision-meta">
            <span className="meta-item">
              <span className="meta-label">Type:</span> {session.candidate_type || 'General'}
            </span>
            <span className="meta-item">
              <span className="meta-label">Rule:</span> {getRuleDisplay(session.rules)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default SessionList;
