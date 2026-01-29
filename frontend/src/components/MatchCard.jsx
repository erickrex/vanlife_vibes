import React from 'react';
import './MatchCard.css';

function MatchCard({ match, onSelect, isSelected = false }) {
  const candidate = match.candidate || {};
  const snapshot = match.snapshot || {};
  const attributes = candidate.attributes || {};
  const imageUrl = candidate.image_url || attributes.image_url;

  // Calculate approval percentage if not in snapshot
  const approvalPercentage = snapshot.total_members > 0
    ? Math.round((snapshot.approvals / snapshot.total_members) * 100)
    : 0;
  
  // Format date
  const matchedDate = new Date(match.matched_at);
  const formattedDate = matchedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = matchedDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleSelect = () => {
    if (onSelect) {
      onSelect(match);
    }
  };

  const handleKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
      event.preventDefault();
      onSelect(match);
    }
  };

  return (
    <div
      className={`match-card ${isSelected ? 'is-selected' : ''}`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      role={onSelect ? 'button' : 'article'}
      tabIndex={onSelect ? 0 : -1}
    >
      {/* Item Image or Placeholder */}
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={candidate.label} 
          className="match-card-image"
        />
      ) : (
        <div className="match-card-image-placeholder">
          <span className="match-icon">⚡</span>
        </div>
      )}
      
      {/* Item Label */}
      <div className="match-card-content">
        <h3 className="match-card-label">
          {candidate.label || 'Untitled Option'}
        </h3>
        
        {/* Vote Snapshot */}
        <div className="match-card-snapshot">
          <div className="snapshot-row">
            <div className="snapshot-stat">
              <span className="stat-label">Approvals</span>
              <span className="stat-value">{snapshot.approvals || 0}</span>
            </div>
            <div className="snapshot-stat">
              <span className="stat-label">Total Members</span>
              <span className="stat-value">{snapshot.total_members || 0}</span>
            </div>
          </div>
          
          {/* Approval Percentage Bar */}
          <div className="approval-bar-container">
            <div className="approval-bar-label">
              <span>Approval Rate</span>
              <span className="approval-percentage">{approvalPercentage}%</span>
            </div>
            <div className="approval-bar">
              <div 
                className="approval-bar-fill" 
                style={{ width: `${approvalPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {/* Rule Information */}
          {snapshot.rule && (
            <div className="snapshot-rule">
              <span className="rule-label">Rule:</span>
              <span className="rule-value">
                {snapshot.rule.type === 'unanimous' 
                  ? 'Unanimous' 
                  : `${Math.round(snapshot.rule.value * 100)}% Threshold`}
              </span>
            </div>
          )}
        </div>
        
        {/* Item Attributes */}
        {Object.keys(attributes).length > 0 && (
          <div className="match-card-attributes">
            {Object.entries(attributes)
              .filter(([key]) => key !== 'image_url')
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="match-attribute">
                  <span className="attribute-key">{key}</span>
                  <span className="attribute-value">{String(value)}</span>
                </div>
              ))}
          </div>
        )}
        
        {/* Selected Date */}
        <div className="match-card-meta">
          <span className="meta-icon">🌓</span>
          <span className="meta-text">
            Matched on {formattedDate} · {formattedTime}
          </span>
        </div>
      </div>
    </div>
  );
}

export default MatchCard;
