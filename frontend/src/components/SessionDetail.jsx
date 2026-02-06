import React from 'react';

function SessionDetail({ session, isAdmin, onStatusChange }) {
  if (!session) {
    return <div className="text-center py-8 text-zinc-400">Loading session details...</div>;
  }

  const getRuleDisplay = (rules) => {
    if (!rules) return 'No rules configured';
    if (rules.type === 'unanimous') {
      return 'All members must approve for candidates to become matches';
    }
    if (rules.type === 'threshold') {
      return `${Math.round(rules.value * 100)}% of members must approve for candidates to become matches`;
    }
    return 'Unknown rule type';
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'bg-zinc-600 text-zinc-200',
      open: 'bg-emerald-500/20 text-emerald-400',
      closed: 'bg-blue-500/20 text-blue-400',
      archived: 'bg-purple-500/20 text-purple-400'
    };
    return classes[status] || 'bg-zinc-600 text-zinc-200';
  };

  const canTransitionTo = (currentStatus, targetStatus) => {
    const validTransitions = {
      draft: ['open'],
      open: ['closed'],
      closed: ['archived'],
      archived: []
    };
    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  };

  const handleStatusChange = (newStatus) => {
    if (window.confirm(`Are you sure you want to change the status to "${newStatus}"?`)) {
      onStatusChange(newStatus);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-4 md:p-6 border border-zinc-800">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-white flex-1">{session.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize w-fit ${getStatusBadgeClass(session.status)}`}>
            {session.status}
          </span>
        </div>
        
        {session.description && (
          <p className="text-zinc-400 leading-relaxed">{session.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8 p-4 md:p-6 bg-zinc-800 rounded-lg">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Candidate Type</h3>
          <p className="text-zinc-200 font-medium">{session.candidate_type || 'General'}</p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Approval Rule</h3>
          <p className="text-zinc-200 font-medium">{getRuleDisplay(session.rules)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Created</h3>
          <p className="text-zinc-200 font-medium">
            {session.created_at 
              ? new Date(session.created_at).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>

        {session.updated_at && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Last Updated</h3>
            <p className="text-zinc-200 font-medium">
              {session.updated_at 
                ? new Date(session.updated_at).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        )}
      </div>

      {isAdmin && onStatusChange && (
        <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-zinc-800">
          <h3 className="text-white font-semibold mb-4">Status Controls</h3>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            {canTransitionTo(session.status, 'open') && (
              <button
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-w-[140px]"
                onClick={() => handleStatusChange('open')}
              >
                Open Session
              </button>
            )}
            {canTransitionTo(session.status, 'closed') && (
              <button
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-w-[140px]"
                onClick={() => handleStatusChange('closed')}
              >
                Close Session
              </button>
            )}
            {canTransitionTo(session.status, 'archived') && (
              <button
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-w-[140px]"
                onClick={() => handleStatusChange('archived')}
              >
                Archive Session
              </button>
            )}
          </div>
          {session.status === 'closed' && (
            <p className="p-3 bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-200 text-sm rounded">
              Closed sessions cannot accept new swipes, but chat and matches remain accessible.
            </p>
          )}
          {session.status === 'archived' && (
            <p className="p-3 bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-200 text-sm rounded">
              Archived sessions are read-only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SessionDetail;
