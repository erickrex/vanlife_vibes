import React from 'react';

/**
 * CandidateCard component displays a candidate for swiping.
 * Supports optional images and generic attributes.
 */
function CandidateCard({ candidate, style }) {
  const attributes = candidate.attributes || {};
  const imageUrl = candidate.image_url || attributes.image_url;
  const description = attributes.description || candidate.label;

  return (
    <div className="h-full bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden" style={style}>
      <div className="h-full flex flex-col">
        {/* Image placeholder or actual image if available */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={candidate.label} 
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <span className="text-white text-2xl font-bold text-center px-4">{candidate.label}</span>
          </div>
        )}
        
        {/* Candidate label */}
        <div className="flex-1 p-4">
          <h2 className="text-white text-lg font-semibold mb-2">{description}</h2>
          
          {/* Display attributes */}
          {Object.keys(attributes).length > 0 && (
            <div className="space-y-1">
              {Object.entries(attributes)
                .filter(([key]) => !['image_url', 'description'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{key}:</span>
                    <span className="text-zinc-300">{String(value)}</span>
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
