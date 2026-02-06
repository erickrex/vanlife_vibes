import React from 'react';

function MatchCard({ match, onSelect, isSelected = false }) {
  const candidate = match.candidate || {};
  const snapshot = match.snapshot || {};
  const attributes = candidate.attributes || {};
  const imageUrl = candidate.image_url || attributes.image_url;

  // Calculate approval percentage if not in snapshot
  const approvalPercentage = snapshot.total_members > 0
    ? Math.round((snapshot.approvals / snapshot.total_members) * 100)
    : 0;
  
  // Format date
  const matchedDate = new Date(match.matched_at);
  const formattedDate = matchedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = matchedDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleSelect = () => {
    if (onSelect) {
      onSelect(match);
    }
  };

  const handleKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
      event.preventDefault();
      onSelect(match);
    }
  };

  return (
    <div
      className={`bg-zinc-900 rounded-xl border overflow-hidden cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-800 hover:border-zinc-700'
      }`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      role={onSelect ? 'button' : 'article'}
      tabIndex={onSelect ? 0 : -1}
    >
      {/* Item Image or Placeholder */}
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={candidate.label} 
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-emerald-600 to-blue-600 flex items-center justify-center">
          <span className="text-3xl">⚡</span>
        </div>
      )}
      
      {/* Item Label */}
      <div className="p-4">
        <h3 className="text-white font-semibold mb-3">
          {candidate.label || 'Untitled Option'}
        </h3>
        
        {/* Vote Snapshot */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <div>
              <span className="text-zinc-500 block text-xs">Approvals</span>
              <span className="text-white font-medium">{snapshot.approvals || 0}</span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 block text-xs">Total Members</span>
              <span className="text-white font-medium">{snapshot.total_members || 0}</span>
            </div>
          </div>
          
          {/* Approval Percentage Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-500">Approval Rate</span>
              <span className="text-emerald-400 font-medium">{approvalPercentage}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300" 
                style={{ width: `${approvalPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {/* Rule Information */}
          {snapshot.rule && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Rule:</span>
              <span className="text-zinc-300">
                {snapshot.rule.type === 'unanimous' 
                  ? 'Unanimous' 
                  : `${Math.round(snapshot.rule.value * 100)}% Threshold`}
              </span>
            </div>
          )}
        </div>
        
        {/* Item Attributes */}
        {Object.keys(attributes).length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1">
            {Object.entries(attributes)
              .filter(([key]) => key !== 'image_url')
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-zinc-500">{key}</span>
                  <span className="text-zinc-300">{String(value)}</span>
                </div>
              ))}
          </div>
        )}
        
        {/* Selected Date */}
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-500">
          <span>🌓</span>
          <span>Matched on {formattedDate} · {formattedTime}</span>
        </div>
      </div>
    </div>
  );
}

export default MatchCard;
