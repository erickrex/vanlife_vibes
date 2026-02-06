import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feedAPI } from '../services/api';
import FeedCard from '../components/FeedCard';

/**
 * NearbyFeedPage - Instagram-style feed of nearby users grouped by timing
 */
function NearbyFeedPage() {
  const navigate = useNavigate();
  
  const [feedData, setFeedData] = useState({
    here_now: [],
    here_next_week: [],
    here_next_month: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      
      const response = await feedAPI.getNearbyFeed();
      const data = response.data.data || response.data;
      
      setFeedData({
        here_now: data.here_now || [],
        here_next_week: data.here_next_week || [],
        here_next_month: data.here_next_month || [],
      });
    } catch (err) {
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleProfileClick = (profileId) => {
    navigate(`/profile/${profileId}`);
  };

  const isEmpty = 
    feedData.here_now.length === 0 && 
    feedData.here_next_week.length === 0 && 
    feedData.here_next_month.length === 0;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-zinc-500">Finding travelers nearby...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && isEmpty) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={() => loadFeed()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="text-center space-y-1">
          <h1 className="text-xl font-bold text-white">📍 Nearby Travelers</h1>
          <p className="text-sm text-zinc-500">People in your area</p>
          {refreshing && (
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
              Refreshing...
            </div>
          )}
        </header>

        {/* Error banner */}
        {error && !isEmpty && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="text-lg font-semibold text-white mb-1">No travelers nearby</h2>
            <p className="text-sm text-zinc-500 max-w-xs mb-4">
              Set your location in your profile to discover other travelers in your area.
            </p>
            <button 
              onClick={() => navigate('/profile/edit')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Update Location
            </button>
          </div>
        )}

        {/* Here Now Section */}
        {feedData.here_now.length > 0 && (
          <FeedSection 
            title="Here Now" 
            count={feedData.here_now.length}
            dotColor="bg-emerald-500"
            profiles={feedData.here_now}
            onProfileClick={handleProfileClick}
          />
        )}

        {/* Here Next Week Section */}
        {feedData.here_next_week.length > 0 && (
          <FeedSection 
            title="Here Next Week" 
            count={feedData.here_next_week.length}
            dotColor="bg-amber-500"
            profiles={feedData.here_next_week}
            onProfileClick={handleProfileClick}
          />
        )}

        {/* Here Next Month Section */}
        {feedData.here_next_month.length > 0 && (
          <FeedSection 
            title="Here Next Month" 
            count={feedData.here_next_month.length}
            dotColor="bg-orange-500"
            profiles={feedData.here_next_month}
            onProfileClick={handleProfileClick}
          />
        )}

        {/* Refresh button */}
        {!isEmpty && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => loadFeed(true)}
              disabled={refreshing}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedSection({ title, count, dotColor, profiles, onProfileClick }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {profiles.map((profile) => (
          <FeedCard
            key={profile.id}
            profile={profile}
            onClick={() => onProfileClick(profile.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default NearbyFeedPage;
