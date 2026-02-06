import React, { useState } from 'react';

/**
 * ChatActionsMenu - Dropdown menu for chat actions
 * 
 * Features:
 * - Unmatch option with confirmation
 * - Report option with reason selection
 * 
 * **Validates: Requirements 10.4, 10.6**
 */
function ChatActionsMenu({ onUnmatch, onReport, userName }) {
  const [showConfirm, setShowConfirm] = useState(null); // 'unmatch', 'report'
  const [reportReason, setReportReason] = useState('');

  const reportReasons = [
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'spam', label: 'Spam or scam' },
    { value: 'fake_profile', label: 'Fake profile' },
    { value: 'other', label: 'Other' },
  ];

  const handleUnmatchClick = () => {
    setShowConfirm('unmatch');
  };

  const handleReportClick = () => {
    setShowConfirm('report');
  };

  const handleConfirmUnmatch = () => {
    onUnmatch();
    setShowConfirm(null);
  };

  const handleConfirmReport = () => {
    if (reportReason) {
      onReport(reportReason);
      setShowConfirm(null);
      setReportReason('');
    }
  };

  const handleCancel = () => {
    setShowConfirm(null);
    setReportReason('');
  };

  // Render confirmation dialog
  if (showConfirm === 'unmatch') {
    return (
      <div className="absolute right-0 top-full mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-xl z-50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">💔</span>
          <span className="text-white font-semibold">Unmatch?</span>
        </div>
        <p className="text-zinc-400 text-sm mb-4">
          Are you sure you want to unmatch with {userName}? This will remove your conversation and you won't be able to message each other.
        </p>
        <div className="flex gap-2">
          <button onClick={handleCancel} className="flex-1 px-3 py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirmUnmatch} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
            Unmatch
          </button>
        </div>
      </div>
    );
  }

  if (showConfirm === 'report') {
    return (
      <div className="absolute right-0 top-full mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-xl z-50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">⚠️</span>
          <span className="text-white font-semibold">Report User</span>
        </div>
        <p className="text-zinc-400 text-sm mb-3">
          Why are you reporting {userName}?
        </p>
        <div className="space-y-2 mb-4">
          {reportReasons.map((reason) => (
            <label key={reason.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportReason"
                value={reason.value}
                checked={reportReason === reason.value}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-zinc-300 text-sm">{reason.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCancel} className="flex-1 px-3 py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm rounded-lg transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleConfirmReport} 
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            disabled={!reportReason}
          >
            Report
          </button>
        </div>
      </div>
    );
  }

  // Default menu
  return (
    <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl z-50">
      <button onClick={handleUnmatchClick} className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors">
        <span>💔</span>
        <span className="text-sm">Unmatch</span>
      </button>
      <button onClick={handleReportClick} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-zinc-800 transition-colors">
        <span>⚠️</span>
        <span className="text-sm">Report</span>
      </button>
    </div>
  );
}

export default ChatActionsMenu;
