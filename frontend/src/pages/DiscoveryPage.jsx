import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { discoveryAPI } from '../services/api';
import DiscoverySwipeCard from '../components/DiscoverySwipeCard';
import DiscoveryFilters from '../components/DiscoveryFilters';

function DiscoveryPage() {
  const navigate = useNavigate();
  
  const [mode, setMode] = useState('dating');
  const [viewMode, setViewMode] = useState('swipe');
  const [profiles, setProfiles] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (filters.travel_pace) params.travel_pace = filters.travel_pace;
      if (filters.profile_type) params.profile_type = filters.profile_type;
      if (filters.pet_compatible) params.pet_compatible = filters.pet_compatible;
      
      const response = mode === 'dating' 
        ? await discoveryAPI.getDatingProfiles(params)
        : await discoveryAPI.getFriendsProfiles(params);
      
      const data = response.data.data || response.data || [];
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load profiles');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [mode, filters]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      setMode(newMode);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleViewModeToggle = () => {
    setViewMode(prev => prev === 'swipe' ? 'grid' : 'swipe');
  };

  const handleProfileClick = (profileId) => {
    navigate(`/profile/${profileId}`);
  };

  const handleSwipe = (direction, profile, data) => {
    console.log(`Swiped ${direction} on ${profile.display_name}`, data);
  };

  const handleMatch = (profile, match) => {
    console.log(`Matched with ${profile.display_name}!`, match);
  };

  const handleNavigateToChat = (matchId) => {
    navigate(`/matches/${matchId}/chat`);
  };

  const handleEmpty = () => {
    console.log('No more profiles to swipe');
  };

  const renderTabs = () => (
    <div className="flex border-b border-zinc-800">
      <button
        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
          mode === 'dating' 
            ? 'text-rose-500 border-b-2 border-rose-500' 
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => handleModeChange('dating')}
      >
        <span>💕</span>
        <span>Dating</span>
      </button>
      <button
        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
          mode === 'friends' 
            ? 'text-blue-500 border-b-2 border-blue-500' 
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => handleModeChange('friends')}
      >
        <span>👋</span>
        <span>Friends</span>
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto">
          {renderTabs()}
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${
              mode === 'dating' ? 'border-rose-500' : 'border-blue-500'
            }`}></div>
            <p className="mt-4 text-zinc-500">
              Finding {mode === 'dating' ? 'matches' : 'friends'}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && profiles.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto">
          {renderTabs()}
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              className={`px-4 py-2 rounded-lg font-semibold text-sm text-white ${
                mode === 'dating' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600'
              }`}
              onClick={() => loadProfiles()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-lg mx-auto">
        {renderTabs()}

        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              {mode === 'dating' ? '💕 Find Your Match' : '👋 Make Friends'}
            </h1>
            <p className="text-zinc-500 text-sm">
              {mode === 'dating' 
                ? 'Discover fellow travelers looking for love'
                : 'Connect with nomads on the road'}
            </p>
          </div>
          
          {profiles.length > 0 && (
            <button 
              className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                mode === 'dating' 
                  ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' 
                  : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
              }`}
              onClick={handleViewModeToggle}
              aria-label={`Switch to ${viewMode === 'swipe' ? 'grid' : 'swipe'} view`}
            >
              {viewMode === 'swipe' ? '⊞' : '🃏'}
            </button>
          )}
        </header>

        {/* Filters */}
        <DiscoveryFilters
          mode={mode}
          filters={filters}
          onFilterChange={handleFilterChange}
          disabled={loading}
        />

        {/* Error banner */}
        {error && profiles.length > 0 && (
          <div className="mx-4 mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Empty state */}
        {profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="text-5xl mb-4">
              {mode === 'dating' ? '💔' : '🤷'}
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              No {mode === 'dating' ? 'matches' : 'friends'} found
            </h2>
            <p className="text-zinc-500 mb-6">
              {mode === 'dating' 
                ? 'No one nearby is looking for dating right now. Check back later!'
                : 'No one nearby is looking for friends right now. Check back later!'}
            </p>
            <button 
              className={`px-4 py-2 rounded-lg font-semibold text-sm text-white ${
                mode === 'dating' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600'
              }`}
              onClick={() => loadProfiles()}
            >
              Refresh
            </button>
          </div>
        )}

        {/* Swipe view */}
        {profiles.length > 0 && viewMode === 'swipe' && (
          <DiscoverySwipeCard
            profiles={profiles}
            mode={mode}
            onSwipe={handleSwipe}
            onMatch={handleMatch}
            onEmpty={handleEmpty}
            onNavigateToChat={handleNavigateToChat}
          />
        )}

        {/* Grid view */}
        {profiles.length > 0 && viewMode === 'grid' && (
          <div className="px-4">
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                mode === 'dating' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {profiles.length}
              </span>
              <span className="text-zinc-500 text-sm">
                {profiles.length === 1 ? 'person' : 'people'} {mode === 'dating' ? 'looking for love' : 'looking for friends'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <div 
                  key={profile.id}
                  className={`bg-zinc-900 rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
                    mode === 'dating' ? 'border-rose-500/20 hover:border-rose-500/40' : 'border-blue-500/20 hover:border-blue-500/40'
                  }`}
                  onClick={() => handleProfileClick(profile.id)}
                >
                  <div className="aspect-square bg-zinc-800 relative">
                    {profile.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.display_name || 'Profile'} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-600">
                        {(profile.display_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-white font-semibold text-sm truncate">
                      {profile.display_name || 'Anonymous'}
                    </h3>
                    {profile.profile_type && profile.profile_type !== 'solo' && (
                      <span className="text-zinc-500 text-xs">
                        {profile.profile_type === 'couple' ? '👫 Couple' : '👥 Group'}
                      </span>
                    )}
                    {profile.travel_pace && (
                      <span className="text-zinc-500 text-xs block">
                        {profile.travel_pace === 'slow' && '🐢 Slow traveler'}
                        {profile.travel_pace === 'mixed' && '🔄 Mixed pace'}
                        {profile.travel_pace === 'fast' && '⚡ Fast mover'}
                      </span>
                    )}
                    {profile.bio && (
                      <p className="text-zinc-400 text-xs mt-1 line-clamp-2">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscoveryPage;
