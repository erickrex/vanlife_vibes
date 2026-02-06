import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { friendsAPI } from '../services/api';

// Default placeholder avatar
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * Formats a timestamp into a relative time string (e.g., "2 hours ago", "3 days ago")
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Relative time string
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * FriendRequestCard Component
 * Displays a single friend request with user info and action buttons
 * 
 * @param {Object} props
 * @param {Object} props.request - The friend request object
 * @param {Object} props.user - The user profile to display (from_user or to_user)
 * @param {'received' | 'sent'} props.type - Whether this is a received or sent request
 * @param {Function} props.onAccept - Callback when accept button is clicked
 * @param {Function} props.onDecline - Callback when decline button is clicked
 * @param {boolean} props.loading - Whether an action is in progress
 */
function FriendRequestCard({ request, user, type, onAccept, onDecline, loading }) {
  const navigate = useNavigate();
  
  const handleProfileClick = () => {
    navigate(`/profile/${user.id}`);
  };
  
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <button 
          onClick={handleProfileClick}
          className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
        >
          <img
            src={user.avatar_url || DEFAULT_AVATAR}
            alt={user.display_name || 'User'}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700 hover:ring-blue-500 transition-all"
          />
        </button>
        
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <button 
            onClick={handleProfileClick}
            className="text-left focus:outline-none"
          >
            <h3 className="text-white font-semibold truncate hover:text-blue-400 transition-colors">
              {user.display_name || 'Anonymous'}
            </h3>
          </button>
          <p className="text-zinc-500 text-sm">
            {formatTimeAgo(request.created_at)}
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0">
          {type === 'received' ? (
            <>
              <button
                onClick={() => onAccept(request.id)}
                disabled={loading}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : 'Accept'}
              </button>
              <button
                onClick={() => onDecline(request.id)}
                disabled={loading}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-all border border-zinc-700 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : 'Decline'}
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-sm font-medium rounded-lg border border-zinc-700">
              Pending
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * EmptyState Component
 * Displays when there are no requests in a section
 * 
 * @param {Object} props
 * @param {'received' | 'sent'} props.type - The type of requests section
 */
function EmptyState({ type }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-4xl mb-3">
        {type === 'received' ? '📭' : '📤'}
      </div>
      <p className="text-zinc-500 text-sm">
        {type === 'received' 
          ? 'No pending friend requests' 
          : 'No sent requests pending'}
      </p>
    </div>
  );
}

/**
 * FriendRequestsPage Component
 * 
 * Displays and manages pending friend requests (both sent and received).
 * Users can accept or decline received requests.
 * 
 * Requirements:
 * - 14.2: GET /api/v1/friends/requests/ to list pending friend requests (sent and received)
 * - 14.3: POST /api/v1/friends/requests/{id}/accept/ to accept a friend request
 * - 14.4: POST /api/v1/friends/requests/{id}/decline/ to decline a friend request
 */
function FriendRequestsPage() {
  const navigate = useNavigate();
  
  // State
  const [requests, setRequests] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // Tracks which request is being acted upon
  
  /**
   * Loads friend requests from the API
   */
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await friendsAPI.listFriendRequests();
      const data = response.data.data || response.data;
      
      setRequests({
        sent: data.sent || [],
        received: data.received || [],
      });
    } catch (err) {
      setError(err.message || 'Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Load requests on mount
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);
  
  /**
   * Handles accepting a friend request
   * @param {string} requestId - The ID of the request to accept
   */
  const handleAccept = async (requestId) => {
    try {
      setActionLoading(requestId);
      setError('');
      
      await friendsAPI.acceptFriendRequest(requestId);
      
      // Remove the accepted request from the list
      setRequests(prev => ({
        ...prev,
        received: prev.received.filter(req => req.id !== requestId),
      }));
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setActionLoading(null);
    }
  };
  
  /**
   * Handles declining a friend request
   * @param {string} requestId - The ID of the request to decline
   */
  const handleDecline = async (requestId) => {
    try {
      setActionLoading(requestId);
      setError('');
      
      await friendsAPI.declineFriendRequest(requestId);
      
      // Remove the declined request from the list
      setRequests(prev => ({
        ...prev,
        received: prev.received.filter(req => req.id !== requestId),
      }));
    } catch (err) {
      setError(err.message || 'Failed to decline friend request');
    } finally {
      setActionLoading(null);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading friend requests...</p>
        </div>
      </div>
    );
  }
  
  // Error state (when no data loaded)
  if (error && !requests.sent.length && !requests.received.length) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={loadRequests} 
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="py-4">
          <button 
            onClick={() => navigate(-1)} 
            className="text-blue-500 text-sm hover:underline"
          >
            ← Back
          </button>
        </div>
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Friend Requests</h1>
          <p className="text-zinc-500 text-sm">
            Manage your pending friend requests
          </p>
        </div>
        
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Received Requests Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              📥 Received
              {requests.received.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                  {requests.received.length}
                </span>
              )}
            </h2>
          </div>
          
          {requests.received.length > 0 ? (
            <div className="space-y-3">
              {requests.received.map(request => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  user={request.from_user}
                  type="received"
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  loading={actionLoading === request.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState type="received" />
          )}
        </div>
        
        {/* Sent Requests Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              📤 Sent
              {requests.sent.length > 0 && (
                <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs font-bold rounded-full">
                  {requests.sent.length}
                </span>
              )}
            </h2>
          </div>
          
          {requests.sent.length > 0 ? (
            <div className="space-y-3">
              {requests.sent.map(request => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  user={request.to_user}
                  type="sent"
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  loading={actionLoading === request.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState type="sent" />
          )}
        </div>
        
        {/* Link to Friends List */}
        <div className="text-center">
          <Link 
            to="/friends/list" 
            className="text-blue-500 text-sm hover:underline"
          >
            View all friends →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default FriendRequestsPage;
