import React, { useState } from 'react';

function InviteModal({ isOpen, onClose, onInvite, groupName }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onInvite(username.trim());
      setUsername('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setUsername('');
      setError('');
      onClose();
    }
  };

  const handleChange = (e) => {
    setUsername(e.target.value);
    if (error) {
      setError('');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-zinc-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Invite Member</h2>
          <button 
            className="w-11 h-11 flex items-center justify-center text-3xl text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <p className="text-zinc-400 text-sm mb-6">
              Invite a user to join <span className="text-white font-semibold">{groupName}</span>
            </p>

            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors ${
                  error ? 'border-red-500' : 'border-zinc-700'
                }`}
                disabled={isSubmitting}
                placeholder="Enter username"
                autoFocus
              />
              {error && <span className="text-red-400 text-sm">{error}</span>}
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-zinc-800">
            <button 
              type="button" 
              className="flex-1 px-4 py-3 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InviteModal;
