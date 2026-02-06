import React, { useState } from 'react';
import PropTypes from 'prop-types';

function MyJoinRequestsList({ requests, onResend, onDelete, onSuccess, onError }) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

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

  const handleResend = async (requestId) => {
    setLoadingAction(`resend-${requestId}`);
    try {
      await onResend(requestId);
      if (onSuccess) {
        onSuccess('Request resent');
      }
    } catch (err) {
      if (onError) {
        onError(err.message || 'Failed to resend request');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteClick = (requestId) => {
    setShowDeleteConfirm(requestId);
  };

  const handleDeleteConfirm = async (requestId) => {
    setLoadingAction(`delete-${requestId}`);
    try {
      await onDelete(requestId);
      if (onSuccess) {
        onSuccess('Record deleted successfully');
      }
    } catch (err) {
      if (onError) {
        onError(err.message || 'Failed to delete request');
      }
    } finally {
      setLoadingAction(null);
      setShowDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-zinc-400 text-sm">No join requests yet</p>
      </div>
    );
  }

  // Sort: pending first, then rejected by date descending
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.rejected_at || b.invited_at) - new Date(a.rejected_at || a.invited_at);
  });

  return (
    <div className="w-full flex flex-col gap-4">
      {sortedRequests.map((request) => (
        <div key={request.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-shadow hover:shadow-lg">
          <div className="flex justify-between items-start gap-2 mb-2">
            <h3 className="text-lg font-semibold text-white flex-1 break-words">{request.group_name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              request.status === 'pending' 
                ? 'bg-yellow-500/20 text-yellow-300' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {request.status === 'pending' ? 'Pending' : 'Rejected'}
            </span>
          </div>
          <div className="mb-3">
            <span className="text-zinc-500 text-sm">
              {request.status === 'rejected' 
                ? `Rejected ${formatDate(request.rejected_at)}`
                : `Requested ${formatDate(request.invited_at)}`
              }
            </span>
          </div>
          {request.status === 'rejected' && (
            <div className="mt-4">
              {showDeleteConfirm === request.id ? (
                <div className="w-full">
                  <p className="text-zinc-300 text-sm mb-3">Are you sure you want to delete this request?</p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-4 py-2.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 font-semibold rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleDeleteCancel}
                      disabled={loadingAction === `delete-${request.id}`}
                    >
                      Cancel
                    </button>
                    <button
                      className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      onClick={() => handleDeleteConfirm(request.id)}
                      disabled={loadingAction === `delete-${request.id}`}
                    >
                      {loadingAction === `delete-${request.id}` ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-2">
                  <button
                    className="flex-1 md:flex-none md:min-w-[120px] px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={() => handleResend(request.id)}
                    disabled={loadingAction === `resend-${request.id}`}
                  >
                    {loadingAction === `resend-${request.id}` ? 'Resending...' : 'Resend'}
                  </button>
                  <button
                    className="flex-1 md:flex-none md:min-w-[120px] px-4 py-2.5 border border-red-500 text-red-400 hover:bg-red-500/10 font-semibold rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDeleteClick(request.id)}
                    disabled={loadingAction}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

MyJoinRequestsList.propTypes = {
  requests: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      group_name: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      invited_at: PropTypes.string.isRequired,
      rejected_at: PropTypes.string,
    })
  ).isRequired,
  onResend: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default MyJoinRequestsList;
