import React, { useState } from 'react';

function CandidateFilter({ taxonomies, onFilterChange, disabled = false }) {
  const [selectedTags, setSelectedTags] = useState([]);
  const [attributeFilters, setAttributeFilters] = useState([]);
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTagToggle = (taxonomyName, termValue, termId) => {
    const tagKey = `${taxonomyName}:${termValue}`;
    const isSelected = selectedTags.some(tag => tag.key === tagKey);

    let newSelectedTags;
    if (isSelected) {
      newSelectedTags = selectedTags.filter(tag => tag.key !== tagKey);
    } else {
      newSelectedTags = [...selectedTags, { key: tagKey, termId, taxonomyName, termValue }];
    }

    setSelectedTags(newSelectedTags);
    notifyFilterChange(newSelectedTags, attributeFilters);
  };

  const handleAddAttributeFilter = () => {
    if (!newAttributeKey.trim() || !newAttributeValue.trim()) {
      return;
    }

    const newFilter = {
      key: newAttributeKey,
      value: newAttributeValue
    };

    const newAttributeFilters = [...attributeFilters, newFilter];
    setAttributeFilters(newAttributeFilters);
    setNewAttributeKey('');
    setNewAttributeValue('');
    notifyFilterChange(selectedTags, newAttributeFilters);
  };

  const handleRemoveAttributeFilter = (index) => {
    const newAttributeFilters = attributeFilters.filter((_, i) => i !== index);
    setAttributeFilters(newAttributeFilters);
    notifyFilterChange(selectedTags, newAttributeFilters);
  };

  const handleClearAll = () => {
    setSelectedTags([]);
    setAttributeFilters([]);
    notifyFilterChange([], []);
  };

  const notifyFilterChange = (tags, attributes) => {
    const filters = {
      tags: tags.map(tag => tag.termId),
      attributes: attributes.reduce((acc, filter) => {
        acc[filter.key] = filter.value;
        return acc;
      }, {})
    };
    onFilterChange(filters);
  };

  const hasActiveFilters = selectedTags.length > 0 || attributeFilters.length > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-4">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 p-2">
        <button
          type="button"
          className="flex-1 flex items-center gap-3 p-3 bg-transparent rounded hover:bg-zinc-800 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
        >
          <span className="text-xl">🔍</span>
          <span className="font-semibold text-white">Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold min-w-[20px] text-center">
              {selectedTags.length + attributeFilters.length}
            </span>
          )}
          <span className="ml-auto text-zinc-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            className="w-full md:w-auto bg-zinc-800 text-red-400 px-4 py-2 rounded font-semibold text-sm hover:bg-red-500/10 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleClearAll}
            disabled={disabled}
          >
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-zinc-800">
          {/* Tag Filters */}
          {taxonomies && taxonomies.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-3">Filter by Tags</h4>
              {taxonomies.map((taxonomy) => (
                <div key={taxonomy.id} className="mb-4 last:mb-0">
                  <div className="text-xs font-semibold text-zinc-500 mb-2 capitalize">{taxonomy.name}</div>
                  {taxonomy.terms && taxonomy.terms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {taxonomy.terms.map((term) => {
                        const tagKey = `${taxonomy.name}:${term.value}`;
                        const isSelected = selectedTags.some(tag => tag.key === tagKey);
                        
                        return (
                          <button
                            key={term.id}
                            type="button"
                            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm min-h-[44px] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              isSelected 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600'
                            }`}
                            onClick={() => handleTagToggle(taxonomy.name, term.value, term.id)}
                            disabled={disabled}
                          >
                            {term.value}
                            {term.attributes?.color && (
                              <span
                                className="w-3 h-3 rounded-full border border-black/20"
                                style={{ backgroundColor: term.attributes.color }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attribute Filters */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Filter by Attributes</h4>
            
            {attributeFilters.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {attributeFilters.map((filter, index) => (
                  <div key={index} className="flex justify-between items-center px-3 py-2 bg-blue-500/15 border border-blue-500 rounded gap-2">
                    <span className="flex-1 text-sm text-blue-400 font-medium">
                      {filter.key}: {filter.value}
                    </span>
                    <button
                      type="button"
                      className="w-11 h-11 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleRemoveAttributeFilter(index)}
                      disabled={disabled}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-start">
              <input
                type="text"
                value={newAttributeKey}
                onChange={(e) => setNewAttributeKey(e.target.value)}
                placeholder="Attribute key"
                className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled}
              />
              <input
                type="text"
                value={newAttributeValue}
                onChange={(e) => setNewAttributeValue(e.target.value)}
                placeholder="Value"
                className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={handleAddAttributeFilter}
                className="w-full md:w-auto px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:border disabled:border-zinc-700 disabled:text-zinc-500 disabled:hover:translate-y-0"
                disabled={disabled || !newAttributeKey.trim() || !newAttributeValue.trim()}
              >
                Add
              </button>
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              Add custom attribute filters (e.g., price: 25, color: red)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateFilter;
