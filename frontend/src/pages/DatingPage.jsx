import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { discoveryAPI, matchesAPI, profilesAPI } from '../services/api';
import DiscoverySwipeCard from '../components/DiscoverySwipeCard';
import DiscoveryFilters from '../components/DiscoveryFilters';

/**
 * DatingPage Component
 * 
 * Dedicated dating tab page that displays profiles of users looking for romantic connections.
 * This page is locked to dating mode only (no mode toggle) and uses rose/pink theme colors.
 * 
 * Requirements:
 * - 4.1: Display profiles of users who have indicated interest in dating and are in the user's area
 * - 4.2: Display one profile at a time in a swipeable card format showing avatar, display name, bio, hobbies, and prompts
 * - 4.9: IF a user has not indicated interest in dating in their profile, THEN THE Dating_Tab SHALL prompt them to enable dating in their profile settings
 */
function DatingPage() {
  const navigate = useNavigate();
  
  // Dating mode is always 'dating' - no toggle
  const mode = 'dating';
  const [viewMode, setViewMode] = useState('swipe');
  const [profiles, setProfiles] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [datingEnabled, setDatingEnabled] = useState(null); // null = loading, true/false = loaded

  // Load match count for badge
  const loadMatchCount = useCallback(async () => {
    try {
      const response = await matchesAPI.list();
      const data = response.data.data || response.data;
      const matchList = Array.isArray(data) ? data : (data.results || []);
      // Count only dating matches
      const datingMatches = matchList.filter(m => m.mode === 'dating');
      setMatchCount(datingMatches.length);
    } catch (err) {
      console.error('Failed to load match count:', err);
    }
  }, []);

  // Check if user has dating enabled in their profile
  // Requirement 4.9: Prompt users without dating enabled
  const checkDatingEnabled = useCallback(async () => {
    try {
      const response = await profilesAPI.getMyProfile();
      const profile = response.data.data || response.data;
      setDatingEnabled(profile.looking_for_dating === true);
    } catch (err) {
      console.error('Failed to check dating status:', err);
      // Default to showing the prompt if we can't check
      setDatingEnabled(false);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (filters.travel_pace) params.travel_pace = filters.travel_pace;
      if (filters.profile_type) params.profile_type = filters.profile_type;
      if (filters.pet_compatible) params.pet_compatible = filters.pet_compatible;
      
      // Always fetch dating profiles
      const response = await discoveryAPI.getDatingProfiles(params);
      
      const data = response.data.data || response.data || [];
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load profiles');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    checkDatingEnabled();
    loadProfiles();
    loadMatchCount();
  }, [checkDatingEnabled, loadProfiles, loadMatchCount]);

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

  // Loading state
  if (loading && datingEnabled === null) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-rose-500">💕</span>
              Dating
            </h1>
            <Link 
              to="/matches"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="View matches"
            >
              💌
              {matchCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1">
                  {matchCount > 99 ? '99+' : matchCount}
                </span>
              )}
            </Link>
          </header>
          
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-500">Finding matches...</p>
          </div>
        </div>
      </div>
    );
  }

  // Prompt for users without dating enabled
  // Requirement 4.9: IF a user has not indicated interest in dating in their profile, 
  // THEN THE Dating_Tab SHALL prompt them to enable dating in their profile settings
  if (datingEnabled === false) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-rose-500">💕</span>
              Dating
            </h1>
            <Link 
              to="/matches"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="View matches"
            >
              💌
              {matchCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1">
                  {matchCount > 99 ? '99+' : matchCount}
                </span>
              )}
            </Link>
          </header>
          
          {/* Dating Not Enabled Prompt */}
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center mb-6">
              <span className="text-4xl">💝</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">
              Enable Dating to Find Love
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xs">
              You haven&apos;t enabled dating in your profile yet. Turn it on to discover other travelers looking for romantic connections.
            </p>
            
            <div className="bg-zinc-900 rounded-xl border border-rose-500/30 p-6 w-full max-w-sm mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-rose-400">✨</span>
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold mb-1">What you&apos;ll get</h3>
                  <ul className="text-zinc-400 text-sm space-y-1">
                    <li>• Swipe on profiles of travelers looking for love</li>
                    <li>• Get matched when you both swipe right</li>
                    <li>• Chat with your matches</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <Link 
              to="/profile/edit"
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <span>Enable Dating</span>
              <span>→</span>
            </Link>
            
            <p className="text-zinc-500 text-sm mt-4">
              You can change this anytime in your profile settings
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state (dating is enabled, loading profiles)
  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-rose-500">💕</span>
              Dating
            </h1>
            <Link 
              to="/matches"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="View matches"
            >
              💌
              {matchCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1">
                  {matchCount > 99 ? '99+' : matchCount}
                </span>
              )}
            </Link>
          </header>
          
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-500">Finding matches...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && profiles.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-rose-500">💕</span>
              Dating
            </h1>
            <Link 
              to="/matches"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="View matches"
            >
              💌
              {matchCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1">
                  {matchCount > 99 ? '99+' : matchCount}
                </span>
              )}
            </Link>
          </header>
          
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg font-semibold text-sm text-white"
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
        {/* Header - Rose/Pink themed */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-rose-500">💕</span>
              Dating
            </h1>
            <p className="text-zinc-500 text-sm">
              Find your perfect travel partner
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Matches link with badge */}
            <Link 
              to="/matches"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="View matches"
            >
              💌
              {matchCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1">
                  {matchCount > 99 ? '99+' : matchCount}
                </span>
              )}
            </Link>
            
            {/* View mode toggle */}
            {profiles.length > 0 && (
              <button 
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                onClick={handleViewModeToggle}
                aria-label={`Switch to ${viewMode === 'swipe' ? 'grid' : 'swipe'} view`}
              >
                {viewMode === 'swipe' ? '⊞' : '🃏'}
              </button>
            )}
          </div>
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
            <div className="text-5xl mb-4">💔</div>
            <h2 className="text-lg font-semibold text-white mb-2">
              No matches found
            </h2>
            <p className="text-zinc-500 mb-6">
              No one nearby is looking for dating right now. Check back later!
            </p>
            <button 
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg font-semibold text-sm text-white"
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
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-400">
                {profiles.length}
              </span>
              <span className="text-zinc-500 text-sm">
                {profiles.length === 1 ? 'person' : 'people'} looking for love
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <div 
                  key={profile.id}
                  className="bg-zinc-900 rounded-xl border border-rose-500/20 hover:border-rose-500/40 overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
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

export default DatingPage;
