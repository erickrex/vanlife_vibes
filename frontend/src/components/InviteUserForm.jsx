import React, { useState, useEffect } from 'react';
import { groupsAPI } from '../services/api';

function InviteUserForm({ onSuccess, onError }) {
  const [myAdminGroups, setMyAdminGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAdminGroups();
  }, []);

  const loadAdminGroups = async () => {
    try {
      setLoading(true);
      const response = await groupsAPI.list();
      const groupsData = response.data.data || response.data.results || response.data;
      const groups = Array.isArray(groupsData) ? groupsData : [];
      
      // Filter to only groups where user is admin
      const adminGroups = groups.filter(g => g.role === 'admin' || g.created_by);
      setMyAdminGroups(adminGroups);
      
      // Auto-select first group if available
      if (adminGroups.length > 0) {
        setSelectedGroupId(adminGroups[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedGroupId) {
      if (onError) onError('Please select a group');
      return;
    }
    
    if (!username.trim()) {
      if (onError) onError('Please enter a username');
      return;
    }

    setSubmitting(true);
    try {
      await groupsAPI.inviteMember(selectedGroupId, { username: username.trim() });
      if (onSuccess) onSuccess('Invitation sent successfully');
      setUsername('');
    } catch (err) {
      if (onError) onError(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
        <p className="text-center text-zinc-300">Loading your groups...</p>
      </div>
    );
  }

  if (myAdminGroups.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 mb-8 text-center">
        <p className="text-white mb-2">
          You need to be an admin of a group to send invitations.
        </p>
        <p className="text-zinc-400 text-sm">
          Create a group first, then you can invite users to join!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="group-select" className="text-sm font-medium text-zinc-300">
            Select Group
          </label>
          <select
            id="group-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={submitting}
            className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {myAdminGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="username-input" className="text-sm font-medium text-zinc-300">
            Username to Invite
          </label>
          <input
            type="text"
            id="username-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            disabled={submitting}
            className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !username.trim()}
          className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {submitting ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
}

export default InviteUserForm;
