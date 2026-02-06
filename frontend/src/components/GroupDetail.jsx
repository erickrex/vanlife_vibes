import React from 'react';
import ProfileCard from './ProfileCard';

function GroupDetail({ group, members, onInvite, onRemoveMember, onApproveJoinRequest, onRejectJoinRequest, isAdmin }) {
  if (!group) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        Loading group details...
      </div>
    );
  }

  const confirmedMembers = members?.filter(m => m.is_confirmed) || [];
  const pendingInvitations = members?.filter(m => !m.is_confirmed && m.membership_type === 'invitation') || [];
  const pendingJoinRequests = members?.filter(m => !m.is_confirmed && m.membership_type === 'request') || [];

  // Helper to create profile data from member for ProfileCard
  const getMemberProfile = (member) => {
    // If profile data is available from the API, use it
    if (member.profile) {
      return member.profile;
    }
    // Fallback to basic user info if profile not available
    return {
      id: member.user?.id,
      display_name: member.user?.username || 'Unknown',
      avatar_url: null,
      has_van: false,
      vehicle: null,
      travel_status: null,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{group.name}</h1>
          {group.description && (
            <p className="text-zinc-400 text-sm mt-1">{group.description}</p>
          )}
        </div>
        {isAdmin && (
          <button 
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
            onClick={onInvite}
          >
            + Invite Member
          </button>
        )}
      </div>

      {/* Members Section */}
      <div>
        <h2 className="text-white font-semibold mb-3">Members ({confirmedMembers.length})</h2>
        <div className="space-y-3">
          {confirmedMembers.length === 0 ? (
            <p className="text-zinc-500 text-sm">No confirmed members yet.</p>
          ) : (
            confirmedMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                <div className="flex-1 min-w-0">
                  <ProfileCard profile={getMemberProfile(member)} />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {member.role === 'admin' && (
                    <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded-full">Admin</span>
                  )}
                  {isAdmin && member.role !== 'admin' && (
                    <button
                      className="px-3 py-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                      onClick={() => onRemoveMember(member.user?.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Pending Invitations ({pendingInvitations.length})</h2>
          <div className="space-y-2">
            {pendingInvitations.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">{member.user?.username || 'Unknown'}</span>
                  <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-xs rounded-full">Pending</span>
                </div>
                {isAdmin && (
                  <button
                    className="px-3 py-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                    onClick={() => onRemoveMember(member.user?.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Join Requests */}
      {pendingJoinRequests.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Pending Join Requests ({pendingJoinRequests.length})</h2>
          <div className="space-y-2">
            {pendingJoinRequests.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">{member.user?.username || 'Unknown'}</span>
                  <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-xs rounded-full">Pending</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
                      onClick={() => onApproveJoinRequest?.(member.id)}
                    >
                      Accept
                    </button>
                    <button
                      className="px-3 py-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                      onClick={() => onRejectJoinRequest?.(member.id)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupDetail;
