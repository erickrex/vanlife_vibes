import { useState } from 'react';

function DiscoveryFilters({ mode = 'dating', filters = {}, onFilterChange, disabled = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const travelPace = filters.travel_pace || '';
  const profileType = filters.profile_type || '';
  const petCompatible = filters.pet_compatible || false;

  const travelPaceOptions = [
    { value: '', label: 'Any pace', icon: '🌍' },
    { value: 'slow', label: 'Slow', icon: '🐢' },
    { value: 'mixed', label: 'Mixed', icon: '🔄' },
    { value: 'fast', label: 'Fast', icon: '⚡' },
  ];

  const profileTypeOptions = [
    { value: '', label: 'Any type', icon: '👤' },
    { value: 'solo', label: 'Solo', icon: '🧑' },
    { value: 'couple', label: 'Couple', icon: '👫' },
    { value: 'group', label: 'Group', icon: '👥' },
  ];

  const handleTravelPaceChange = (value) => {
    notifyFilterChange({ travel_pace: value, profile_type: profileType, pet_compatible: petCompatible });
  };

  const handleProfileTypeChange = (value) => {
    notifyFilterChange({ travel_pace: travelPace, profile_type: value, pet_compatible: petCompatible });
  };

  const handlePetCompatibleChange = (checked) => {
    notifyFilterChange({ travel_pace: travelPace, profile_type: profileType, pet_compatible: checked });
  };

  const notifyFilterChange = (newFilters) => {
    const cleanFilters = {};
    if (newFilters.travel_pace) cleanFilters.travel_pace = newFilters.travel_pace;
    if (newFilters.profile_type) cleanFilters.profile_type = newFilters.profile_type;
    if (newFilters.pet_compatible) cleanFilters.pet_compatible = newFilters.pet_compatible;
    onFilterChange?.(cleanFilters);
  };

  const handleClearAll = () => {
    onFilterChange?.({});
  };

  const activeFilterCount = [
    travelPace ? 1 : 0,
    profileType ? 1 : 0,
    petCompatible ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const hasActiveFilters = activeFilterCount > 0;

  const accentColor = mode === 'dating' ? 'rose' : 'blue';

  return (
    <div className="px-4 mb-4">
      {/* Filter header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
            isExpanded 
              ? `border-${accentColor}-500/50 bg-${accentColor}-500/10` 
              : 'border-zinc-700 hover:border-zinc-600'
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          aria-expanded={isExpanded}
        >
          <span>🔍</span>
          <span className="text-white text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
              mode === 'dating' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
            }`}>
              {activeFilterCount}
            </span>
          )}
          <span className="text-zinc-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            className="text-zinc-500 text-sm hover:text-white transition-colors"
            onClick={handleClearAll}
            disabled={disabled}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter content */}
      {isExpanded && (
        <div className="mt-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
          {/* Travel Pace */}
          <div>
            <h4 className="text-white text-sm font-medium mb-2 flex items-center gap-2">
              <span>🚐</span> Travel Pace
            </h4>
            <div className="flex flex-wrap gap-2">
              {travelPaceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    travelPace === option.value
                      ? mode === 'dating'
                        ? 'bg-rose-500 text-white'
                        : 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                  onClick={() => handleTravelPaceChange(option.value)}
                  disabled={disabled}
                >
                  <span className="mr-1">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Type */}
          <div>
            <h4 className="text-white text-sm font-medium mb-2 flex items-center gap-2">
              <span>👤</span> Profile Type
            </h4>
            <div className="flex flex-wrap gap-2">
              {profileTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    profileType === option.value
                      ? mode === 'dating'
                        ? 'bg-rose-500 text-white'
                        : 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                  onClick={() => handleProfileTypeChange(option.value)}
                  disabled={disabled}
                >
                  <span className="mr-1">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pet Compatible */}
          <div>
            <h4 className="text-white text-sm font-medium mb-2 flex items-center gap-2">
              <span>🐾</span> Pet Preferences
            </h4>
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={petCompatible}
                  onChange={(e) => handlePetCompatibleChange(e.target.checked)}
                  disabled={disabled}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  petCompatible
                    ? mode === 'dating'
                      ? 'bg-rose-500 border-rose-500'
                      : 'bg-blue-500 border-blue-500'
                    : 'border-zinc-600 bg-zinc-800'
                }`}>
                  {petCompatible && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
              <div>
                <span className="text-white text-sm flex items-center gap-1">
                  <span>🐕</span> Pet-compatible only
                </span>
                <span className="text-zinc-500 text-xs block mt-0.5">
                  Show only profiles open to pet-friendly meetups
                </span>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscoveryFilters;
