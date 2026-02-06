import React, { useState } from 'react';

function TagSelector({ taxonomies, selectedTermIds = [], onChange, disabled = false }) {
  const [expandedTaxonomies, setExpandedTaxonomies] = useState(new Set());

  const toggleTaxonomy = (taxonomyId) => {
    setExpandedTaxonomies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taxonomyId)) {
        newSet.delete(taxonomyId);
      } else {
        newSet.add(taxonomyId);
      }
      return newSet;
    });
  };

  const handleTermToggle = (termId) => {
    if (disabled) return;

    const newSelectedTermIds = selectedTermIds.includes(termId)
      ? selectedTermIds.filter(id => id !== termId)
      : [...selectedTermIds, termId];
    
    onChange(newSelectedTermIds);
  };

  const isTermSelected = (termId) => {
    return selectedTermIds.includes(termId);
  };

  if (!taxonomies || taxonomies.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-400 text-sm">
        No taxonomies available. Create taxonomies first to tag candidates.
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-900 max-h-[400px] md:max-h-[300px] overflow-y-auto">
      {taxonomies.map((taxonomy) => (
        <div key={taxonomy.id} className="border-b border-zinc-800 last:border-b-0">
          <button
            type="button"
            className="w-full flex justify-between items-center px-4 py-3 bg-zinc-800 hover:bg-zinc-700 transition-colors text-left min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => toggleTaxonomy(taxonomy.id)}
            disabled={disabled}
          >
            <span className="font-semibold text-white text-sm capitalize">{taxonomy.name}</span>
            <span className="text-zinc-400 text-sm">
              {expandedTaxonomies.has(taxonomy.id) ? '▼' : '▶'}
            </span>
          </button>

          {expandedTaxonomies.has(taxonomy.id) && taxonomy.terms && (
            <div className="p-2 bg-zinc-900">
              {taxonomy.terms.length === 0 ? (
                <div className="px-4 py-3 text-zinc-500 text-sm italic">No terms in this taxonomy</div>
              ) : (
                taxonomy.terms.map((term) => (
                  <label
                    key={term.id}
                    className={`flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors min-h-[44px] ${
                      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isTermSelected(term.id)}
                      onChange={() => handleTermToggle(term.id)}
                      disabled={disabled}
                      className="w-5 h-5 cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
                    />
                    <span className="flex-1 text-sm text-zinc-300">{term.value}</span>
                    {term.attributes?.color && (
                      <span
                        className="w-5 h-5 rounded-full border-2 border-zinc-700 flex-shrink-0"
                        style={{ backgroundColor: term.attributes.color }}
                      />
                    )}
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {selectedTermIds.length > 0 && (
        <div className="flex justify-between items-center px-4 py-3 bg-blue-500/15 border-t border-blue-500 text-sm">
          <span className="font-semibold text-blue-400">Selected:</span>
          <span className="text-blue-500 font-semibold">{selectedTermIds.length} tag(s)</span>
        </div>
      )}
    </div>
  );
}

export default TagSelector;
