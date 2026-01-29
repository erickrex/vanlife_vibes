import React from 'react';
import './CandidateList.css';

function CandidateList({ candidates, onEdit, onDelete, isAdmin }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="item-list-empty">
        <p>No candidates yet. Add some candidates to get started!</p>
      </div>
    );
  }

  const formatAttributeValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className="item-list">
      {candidates.map((candidate) => (
        <div key={candidate.id} className="item-list-card">
          <div className="item-list-header">
            <h3 className="item-list-label">{candidate.label}</h3>
            {isAdmin && (
              <div className="item-list-actions">
                <button
                  className="item-action-button edit"
                  onClick={() => onEdit(candidate)}
                  title="Edit candidate"
                >
                  ✏️
                </button>
                <button
                  className="item-action-button delete"
                  onClick={() => onDelete(candidate.id)}
                  title="Delete candidate"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>

          {candidate.attributes && Object.keys(candidate.attributes).length > 0 && (
            <div className="item-list-attributes">
              {Object.entries(candidate.attributes).map(([key, value]) => (
                <div key={key} className="item-list-attribute">
                  <span className="attribute-key">{key}:</span>
                  <span className="attribute-value">
                    {formatAttributeValue(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {candidate.tags && candidate.tags.length > 0 && (
            <div className="item-list-tags">
              {candidate.tags.map((term) => (
                <span key={term.id} className="item-tag">
                  {term.taxonomy_name}: {term.term_value}
                </span>
              ))}
            </div>
          )}

          {candidate.external_ref && (
            <div className="item-list-ref">
              <span className="ref-label">Ref:</span>
              <span className="ref-value">{candidate.external_ref}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default CandidateList;
