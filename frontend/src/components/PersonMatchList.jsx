import React from 'react';
import PersonMatchCard from './PersonMatchCard';

function PersonMatchList({ matches, selectedMatchId, onSelectMatch, onRefresh }) {
  if (matches.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Conversations</h3>
          <button onClick={onRefresh} className="text-zinc-500 hover:text-white transition-colors" title="Refresh">
            ↻
          </button>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💭</div>
          <p className="text-white font-medium mb-1">No matches yet</p>
          <p className="text-zinc-500 text-sm">Keep swiping to find your people!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="text-white font-semibold">Conversations ({matches.length})</h3>
        <button onClick={onRefresh} className="text-zinc-500 hover:text-white transition-colors" title="Refresh">
          ↻
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {matches.map((match) => (
          <PersonMatchCard
            key={match.id}
            match={match}
            isSelected={selectedMatchId === match.id}
            onSelect={() => onSelectMatch(match)}
          />
        ))}
      </div>
    </div>
  );
}

export default PersonMatchList;
