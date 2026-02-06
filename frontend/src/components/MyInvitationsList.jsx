import React, { useState } from 'react';
import PropTypes from 'prop-types';

function MyInvitationsList({ invitations, onAccept, onReject, onSuccess, onError }) {
  const [loadingAction, setLoadingAction] = useState(null);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleAccept = async (invitationId) => {
    setLoadingAction(`accept-${invitationId}`);
    try {
      await onAccept(invitationId);
      if (onSuccess) {
        onSuccess('Invitation accepted');
      }
    } catch (err) {
      if (onError) {
        onError(err.message || 'Failed to accept invitation');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async (invitationId) => {
    setLoadingAction(`reject-${invitationId}`);
    try {
      await onReject(invitationId);
      if (onSuccess) {
        onSuccess('Invitation declined');
      }
    } catch (err) {
      if (onError) {
        onError(err.message || 'Failed to reject invitation');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  if (!invitations || invitations.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-zinc-400 text-sm">No invitations yet</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {invitations.map((invitation) => (
        <div key={invitation.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-shadow hover:shadow-lg">
          <div className="flex justify-between items-start gap-2 mb-2">
            <h3 className="text-lg font-semibold text-white flex-1 break-words">{invitation.group_name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              invitation.status === 'pending' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {invitation.status === 'pending' ? 'Pending' : 'Rejected'}
            </span>
          </div>
          <div className="mb-3">
            <span className="text-zinc-500 text-sm">
              {invitation.status === 'rejected' 
                ? `Rejected ${formatDate(invitation.rejected_at)}`
                : `Invited ${formatDate(invitation.invited_at)}`
              }
            </span>
          </div>
          {invitation.status === 'pending' && (
            <div className="flex flex-col md:flex-row gap-2 mt-4">
              <button
                className="flex-1 md:flex-none md:min-w-[120px] px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={() => handleAccept(invitation.id)}
                disabled={loadingAction === `accept-${invitation.id}`}
              >
                {loadingAction === `accept-${invitation.id}` ? 'Accepting...' : 'Accept'}
              </button>
              <button
                className="flex-1 md:flex-none md:min-w-[120px] px-4 py-2.5 border border-red-500 text-red-400 hover:bg-red-500/10 font-semibold rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleReject(invitation.id)}
                disabled={loadingAction === `reject-${invitation.id}`}
              >
                {loadingAction === `reject-${invitation.id}` ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

MyInvitationsList.propTypes = {
  invitations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      group_name: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      invited_at: PropTypes.string.isRequired,
      rejected_at: PropTypes.string,
    })
  ).isRequired,
  onAccept: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default MyInvitationsList;
