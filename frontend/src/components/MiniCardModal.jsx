import React from 'react';

/**
 * MiniCardModal - Modal for previewing and sharing mini-card
 * 
 * Features:
 * - Preview of mini-card content
 * - Current location, in-town-until date, meet preference
 * - Share button
 * 
 * **Validates: Requirements 10.3**
 */
function MiniCardModal({ profile, onShare, onClose, sending }) {
  if (!profile) return null;

  // Get current in-town window
  const currentWindow = profile.in_town_windows?.[0];
  const currentLocation = currentWindow?.city_area || profile.current_location;
  const inTownUntil = currentWindow?.end_date;
  const meetPreference = profile.meetup_interest || 'open_to_it';

  // Format meet preference label
  const getMeetPreferenceLabel = (preference) => {
    const labels = {
      actively_looking: '🟢 Actively looking to meet',
      open_to_it: '🟡 Open to meeting up',
      selective: '🟠 Selective about meetups',
      solo_mode: '🔴 Solo mode right now',
    };
    return labels[preference] || preference;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold">Share Your Location Card</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" title="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-zinc-400 text-sm">
            Share your current location and availability with your match to help plan a meetup.
          </p>

          {/* Mini-card preview */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>📍</span>
              <span className="text-white font-semibold text-sm">Location Card</span>
            </div>
            <div className="space-y-2 text-sm">
              {currentLocation ? (
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Currently in:</span>
                  <span className="text-white">{currentLocation}</span>
                </div>
              ) : (
                <div className="text-zinc-500 italic">No location set</div>
              )}
              {inTownUntil && (
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Here until:</span>
                  <span className="text-white">{formatDate(inTownUntil)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-700">
                <span className="text-white">
                  {getMeetPreferenceLabel(meetPreference)}
                </span>
              </div>
            </div>
          </div>

          {!currentLocation && (
            <p className="text-amber-400 text-sm">
              💡 Tip: Add an in-town window to your profile to share your location.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-zinc-800">
          <button 
            onClick={onClose} 
            className="flex-1 app-btn-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={onShare} 
            className="flex-1 app-btn-primary-social px-4 py-2 text-sm disabled:bg-zinc-700"
            disabled={sending || !currentLocation}
          >
            {sending ? 'Sharing...' : '📍 Share Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MiniCardModal;
