import React, { useState } from 'react';
import PropTypes from 'prop-types';

function JoinRequestForm({ onSubmit, onSuccess, onError }) {
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate group name is not empty
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit(groupName.trim());
      setGroupName('');
      if (onSuccess) {
        onSuccess('Join request sent successfully');
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to send join request';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="w-full max-w-lg" onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="group-name" className="block mb-2 font-medium text-sm text-zinc-300">
          Group Name
        </label>
        <input
          id="group-name"
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Enter group name..."
          disabled={loading}
          className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors ${
            error ? 'border-red-500' : 'border-zinc-700'
          }`}
        />
        {error && <span className="text-red-400 text-sm mt-1 block">{error}</span>}
      </div>
      <button 
        type="submit" 
        className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        disabled={loading || !groupName.trim()}
      >
        {loading ? 'Sending...' : 'Request to Join'}
      </button>
    </form>
  );
}

JoinRequestForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default JoinRequestForm;
