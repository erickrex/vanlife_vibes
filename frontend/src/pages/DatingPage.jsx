import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { discoveryAPI, matchesAPI, profilesAPI } from '../services/api';
import DiscoverySwipeCard from '../components/DiscoverySwipeCard';
import DiscoveryFilters from '../components/DiscoveryFilters';
import { useAuth } from '../contexts/AuthContext';

function DatingPage() {
  const navigate = useNavigate();
  const { profile: currentProfile } = useAuth();

  const mode = 'dating';
  const [profiles, setProfiles] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [datingEnabled, setDatingEnabled] = useState(null);

  const loadMatchCount = useCallback(async () => {
    try {
      const response = await matchesAPI.list();
      const data = response.data.data || response.data;
      const matchList = Array.isArray(data) ? data : (data.results || []);
      const datingMatches = matchList.filter((match) => match.mode === 'dating');
      setMatchCount(datingMatches.length);
    } catch (err) {
      console.error('Failed to load match count:', err);
    }
  }, []);

  const checkDatingEnabled = useCallback(async () => {
    try {
      const response = await profilesAPI.getMyProfile();
      const profile = response.data.data || response.data;
      setDatingEnabled(profile.looking_for_dating === true);
    } catch (err) {
      console.error('Failed to check dating status:', err);
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

  const handleSwipe = (direction, profile, data) => {
    console.log(`Swiped ${direction} on ${profile.display_name}`, data);
  };

  const handleMatch = (profile, match) => {
    console.log(`Matched with ${profile.display_name}!`, match);
  };

  const handleNavigateToChat = (matchId) => {
    navigate('/matches', { state: { matchId } });
  };

  const handleEmpty = () => {
    console.log('No more profiles to swipe');
  };

  const renderMatchesButton = () => (
    <Link
      to="/matches"
      className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-rose-200 hover:bg-rose-500/25 transition-colors"
      aria-label="Open matches"
    >
      <span className="text-base">💌</span>
      <span className="text-sm font-semibold">Matches</span>
      <span className="min-w-[22px] h-[22px] rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center px-1">
        {matchCount > 99 ? '99+' : matchCount}
      </span>
    </Link>
  );

  const renderHeader = (subtitle = 'Swipe right to like, left to pass.') => (
    <header className="px-4 py-4 flex items-start justify-between border-b border-zinc-800">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-rose-500">💕</span>
          Dating
        </h1>
        <p className="text-zinc-400 text-sm mt-1">{subtitle}</p>
      </div>
      {renderMatchesButton()}
    </header>
  );

  if (loading && datingEnabled === null) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto">
          {renderHeader('Preparing your dating queue...')}
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-500">Finding matches...</p>
          </div>
        </div>
      </div>
    );
  }

  if (datingEnabled === false) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto">
          {renderHeader('Enable dating in your profile to start swiping.')}

          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center mb-6">
              <span className="text-4xl">💝</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Enable Dating to Find Love</h2>
            <p className="text-zinc-400 mb-8 max-w-xs">
              You have not enabled dating in your profile yet. Turn it on to discover other travelers
              looking for romantic connections.
            </p>

            <div className="app-card p-6 w-full max-w-sm mb-6 border-rose-500/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-rose-400">✨</span>
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold mb-1">What you will get</h3>
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
              className="app-btn-primary-dating px-6 py-3 flex items-center gap-2"
            >
              <span>Enable Dating</span>
              <span>→</span>
            </Link>

            <p className="text-zinc-500 text-sm mt-4">You can change this anytime in your profile settings</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto">
          {renderHeader('Preparing your dating queue...')}
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-500">Finding matches...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && profiles.length === 0) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto">
          {renderHeader('Could not load people right now.')}
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button className="app-btn-primary-dating px-4 py-2 text-sm" onClick={() => loadProfiles()}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-20">
      <div className="max-w-lg mx-auto">
        {renderHeader()}

        <DiscoveryFilters
          mode={mode}
          filters={filters}
          onFilterChange={handleFilterChange}
          disabled={loading}
        />

        {error && profiles.length > 0 && (
          <div className="mx-4 mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="text-5xl mb-4">💔</div>
            <h2 className="text-lg font-semibold text-white mb-2">No matches found</h2>
            <p className="text-zinc-500 mb-6">
              No one nearby is looking for dating right now. Check back later!
            </p>
            <button className="app-btn-primary-dating px-4 py-2 text-sm" onClick={() => loadProfiles()}>
              Refresh
            </button>
          </div>
        )}

        {profiles.length > 0 && (
          <DiscoverySwipeCard
            profiles={profiles}
            mode={mode}
            currentProfile={currentProfile}
            onSwipe={handleSwipe}
            onMatch={handleMatch}
            onEmpty={handleEmpty}
            onNavigateToChat={handleNavigateToChat}
          />
        )}
      </div>
    </div>
  );
}

export default DatingPage;
