import React, { useState } from 'react';
import PropTypes from 'prop-types';

function JoinRequestsList({ requests, onApprove, onReject, onSuccess, onError }) {
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

  const handleApprove = async (requestId) => {
    setLoadingAction(`approve-${requestId}`);
    try {
      await onApprove(requestId);
      if (onSuccess) {
        onSuccess('Request approved');
      }
    } catch (err) {
      if (onError) {
        onError(err.message || 'Failed to approve request');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async (requestId) => {
    setLoadingAction(`reject-${requestId}`);
    try {
      await onReject(requestId);
      if (onSuccess) {
        onSuccess('Request rejected');
      }
    } catch (err) {
      if (onError) {
        onError(err.message || 'Failed to reject request');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-zinc-400 italic">No pending join requests</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((request) => (
        <div key={request.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-all hover:border-blue-500 hover:shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-white">{request.user?.username || 'Unknown User'}</h3>
          </div>
          <div className="mb-4">
            <span className="text-zinc-500 text-sm">
              Requested {formatDate(request.invited_at)}
            </span>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <button
              className="flex-1 md:flex-none md:min-w-[120px] px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              onClick={() => handleApprove(request.id)}
              disabled={loadingAction === `approve-${request.id}`}
            >
              {loadingAction === `approve-${request.id}` ? 'Approving...' : 'Approve'}
            </button>
            <button
              className="flex-1 md:flex-none md:min-w-[120px] px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              onClick={() => handleReject(request.id)}
              disabled={loadingAction === `reject-${request.id}`}
            >
              {loadingAction === `reject-${request.id}` ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

JoinRequestsList.propTypes = {
  requests: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      user: PropTypes.shape({
        username: PropTypes.string,
      }),
      invited_at: PropTypes.string.isRequired,
    })
  ).isRequired,
  onApprove: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default JoinRequestsList;
