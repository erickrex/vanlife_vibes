import React from 'react';
import { Link } from 'react-router-dom';

function GroupList({ groups, loading, error }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        Loading groups...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-center py-4">{error}</div>;
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-400">You don't have any groups yet.</p>
        <p className="text-zinc-500 text-sm mt-1">Create a group to start collaborating!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Link 
          key={group.id} 
          to={`/groups/${group.id}`} 
          className="block bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">{group.name}</h3>
            {group.role === 'admin' && (
              <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded-full">Admin</span>
            )}
          </div>
          {group.description && (
            <p className="text-zinc-400 text-sm mb-3 line-clamp-2">{group.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>
              {group.member_count || 0} {group.member_count === 1 ? 'member' : 'members'}
            </span>
            {group.session_count !== undefined && (
              <span>
                {group.session_count} {group.session_count === 1 ? 'session' : 'sessions'}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default GroupList;
