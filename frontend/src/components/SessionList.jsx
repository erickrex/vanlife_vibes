import React from 'react';
import { Link } from 'react-router-dom';

function SessionList({ sessions, groupId, isAdmin }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>No sessions yet.</p>
        {isAdmin && <p className="mt-2">Create a session to get started!</p>}
      </div>
    );
  }

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'bg-zinc-700 text-zinc-300',
      open: 'bg-emerald-500 text-white',
      closed: 'bg-blue-500 text-white',
      archived: 'bg-zinc-600 text-zinc-200'
    };
    return classes[status] || 'bg-zinc-700 text-zinc-300';
  };

  const getRuleDisplay = (rules) => {
    if (!rules) return 'No rules';
    if (rules.type === 'unanimous') return 'Unanimous';
    if (rules.type === 'threshold') return `${Math.round(rules.value * 100)}% threshold`;
    return 'Unknown rule';
  };

  return (
    <div className="flex flex-col gap-4">
      {sessions.map((session) => (
        <Link 
          key={session.id} 
          to={`/sessions/${session.id}`}
          className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 md:p-5 transition-all hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-3">
            <h3 className="text-lg md:text-xl font-semibold text-white flex-1">{session.title}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase whitespace-nowrap w-fit ${getStatusBadgeClass(session.status)}`}>
              {session.status}
            </span>
          </div>
          
          {session.description && (
            <p className="text-zinc-400 text-sm mb-3 line-clamp-2">{session.description}</p>
          )}
          
          <div className="flex flex-col md:flex-row gap-2 md:gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-zinc-300">Type:</span> {session.candidate_type || 'General'}
            </span>
            <span className="flex items-center gap-1">
              <span className="font-semibold text-zinc-300">Rule:</span> {getRuleDisplay(session.rules)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default SessionList;
