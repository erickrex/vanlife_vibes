import React from 'react';

function CandidateList({ candidates, onEdit, onDelete, isAdmin }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
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
    <div className="flex flex-col gap-4 p-2 md:p-4">
      {candidates.map((candidate) => (
        <div key={candidate.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-all hover:border-blue-500 hover:shadow-lg">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg md:text-xl font-semibold text-white flex-1">{candidate.label}</h3>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  className="w-11 h-11 flex items-center justify-center text-xl rounded hover:bg-zinc-800 transition-colors"
                  onClick={() => onEdit(candidate)}
                  title="Edit candidate"
                >
                  ✏️
                </button>
                <button
                  className="w-11 h-11 flex items-center justify-center text-xl rounded hover:bg-red-500/10 transition-colors"
                  onClick={() => onDelete(candidate.id)}
                  title="Delete candidate"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>

          {candidate.attributes && Object.keys(candidate.attributes).length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {Object.entries(candidate.attributes).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="font-semibold text-zinc-500 capitalize">{key}:</span>
                  <span className="text-zinc-300">
                    {formatAttributeValue(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {candidate.tags && candidate.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {candidate.tags.map((term) => (
                <span key={term.id} className="bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                  {term.taxonomy_name}: {term.term_value}
                </span>
              ))}
            </div>
          )}

          {candidate.external_ref && (
            <div className="flex gap-2 text-sm text-zinc-500 mt-2 pt-2 border-t border-zinc-800">
              <span className="font-semibold">Ref:</span>
              <span className="font-mono">{candidate.external_ref}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default CandidateList;
