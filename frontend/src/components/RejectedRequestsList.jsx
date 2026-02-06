import React, { useState } from 'react';
import PropTypes from 'prop-types';

function RejectedRequestsList({ requests, onDelete, onSuccess, onError }) {
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
        <p className="text-zinc-400 italic">No rejected requests</p>
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
              Rejected {formatDate(request.rejected_at)}
            </span>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            {showDeleteConfirm === request.id ? (
              <div className="w-full">
                <p className="text-zinc-300 text-sm mb-3">Are you sure you want to delete this request?</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <button
                    className="flex-1 px-4 py-2.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleDeleteCancel}
                    disabled={loadingAction === `delete-${request.id}`}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={() => handleDeleteConfirm(request.id)}
                    disabled={loadingAction === `delete-${request.id}`}
                  >
                    {loadingAction === `delete-${request.id}` ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={() => handleDeleteClick(request.id)}
                disabled={loadingAction}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

RejectedRequestsList.propTypes = {
  requests: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      user: PropTypes.shape({
        username: PropTypes.string,
      }),
      rejected_at: PropTypes.string.isRequired,
    })
  ).isRequired,
  onDelete: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default RejectedRequestsList;
