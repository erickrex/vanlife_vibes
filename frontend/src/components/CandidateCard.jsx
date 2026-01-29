import React from 'react';
import './CandidateCard.css';

/**
 * CandidateCard component displays a candidate for swiping.
 * Supports optional images and generic attributes.
 */
function CandidateCard({ candidate, style }) {
  const attributes = candidate.attributes || {};
  const imageUrl = candidate.image_url || attributes.image_url;
  const description = attributes.description || candidate.label;

  return (
    <div className="item-card" style={style}>
      <div className="item-card-content">
        {/* Image placeholder or actual image if available */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={candidate.label} 
            className="item-card-image"
          />
        ) : (
          <div className="item-card-image-placeholder">
            <span className="item-card-label-large">{candidate.label}</span>
          </div>
        )}
        
        {/* Candidate label */}
        <div className="item-card-info">
          <h2 className="item-card-label">{description}</h2>
          
          {/* Display attributes */}
          {Object.keys(attributes).length > 0 && (
            <div className="item-card-attributes">
              {Object.entries(attributes)
                .filter(([key]) => !['image_url', 'description'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="item-card-attribute">
                    <span className="attribute-key">{key}:</span>
                    <span className="attribute-value">{String(value)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateCard;
