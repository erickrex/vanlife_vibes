import React from 'react';
import PersonMatchCard from './PersonMatchCard';

function PersonMatchList({ matches, selectedMatchId, onSelectMatch, onRefresh }) {
  if (matches.length === 0) {
    return (
      <div className="app-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Matches</h3>
          <button
            onClick={onRefresh}
            className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💭</div>
          <p className="text-white font-medium mb-1">No matches yet</p>
          <p className="text-zinc-500 text-sm">Keep swiping and your new conversations will show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="text-white font-semibold">Conversations</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2 py-1">{matches.length}</span>
          <button
            onClick={onRefresh}
            className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>
      <div className="max-h-[22rem] overflow-y-auto p-2 space-y-2">
        {matches.map((match) => (
          <PersonMatchCard
            key={match.id}
            match={match}
            isSelected={selectedMatchId === match.id}
            onSelect={() => onSelectMatch(match)}
          />
        ))}
      </div>
      <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500">
        Tip: Open a match and send a message while it is fresh.
      </div>
    </div>
  );
}

export default PersonMatchList;
