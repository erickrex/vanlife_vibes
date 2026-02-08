import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { activitiesAPI } from '../services/api';
import { getActivityTypeEmoji, getActivityTypeInfo, getActivityTypesArray } from '../utils/constants';

/**
 * Get display label for activity type (with emoji prefix)
 */
function getActivityTypeLabel(type) {
  const info = getActivityTypeInfo(type);
  return `${info.emoji} ${info.label}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}


/**
 * Get time window display text
 */
function getTimeWindowLabel(timeWindow) {
  const labels = {
    morning: '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening: '🌙 Evening',
    flexible: '🔄 Flexible',
  };
  return labels[timeWindow] || timeWindow;
}

/**
 * ActivitySwipeCard Component
 * 
 * Swipeable card for activities with like/pass functionality.
 * Uses emerald/green theme to differentiate from dating (rose).
 */
function ActivitySwipeCard({ activities, onSwipe, onMatch, onEmpty }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedActivity, setMatchedActivity] = useState(null);
  
  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const currentActivity = activities[currentIndex];
  const nextActivity = activities[currentIndex + 1];

  const getSwipeThreshold = () => {
    const screenWidth = window.innerWidth;
    const threshold = screenWidth * 0.25;
    return Math.max(80, Math.min(threshold, 150));
  };

  const handleSwipeAPI = useCallback(async (activity, isLike) => {
    try {
      setIsProcessing(true);
      const response = await activitiesAPI.swipe(activity.id, isLike);
      
      const data = response.data.data || response.data;
      if (data.match) {
        setMatchedActivity(activity);
        setShowMatch(true);
        if (onMatch) onMatch(activity, data);
      }
      
      if (onSwipe) onSwipe(isLike ? 'right' : 'left', activity, data);
    } catch (error) {
      console.error('Swipe error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onSwipe, onMatch]);


  const handleSwipeComplete = useCallback((direction) => {
    if (!currentActivity || isProcessing) return;
    
    setSwipeDirection(direction);
    const isLike = direction === 'right';
    handleSwipeAPI(currentActivity, isLike);
    
    setTimeout(() => {
      setSwipeDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  }, [currentActivity, isProcessing, handleSwipeAPI]);

  useEffect(() => {
    if (currentIndex >= activities.length && activities.length > 0) {
      if (onEmpty) onEmpty();
    }
  }, [currentIndex, activities.length, onEmpty]);

  const handleMouseDown = useCallback((e) => {
    if (isProcessing) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [isProcessing]);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const threshold = getSwipeThreshold();
    
    setDragOffset((currentOffset) => {
      if (Math.abs(currentOffset.x) > threshold) {
        const direction = currentOffset.x > 0 ? 'right' : 'left';
        handleSwipeComplete(direction);
      } else {
        setIsDragging(false);
      }
      return { x: 0, y: 0 };
    });
  }, [handleSwipeComplete]);


  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleTouchStart = (e) => {
    if (isProcessing) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const threshold = getSwipeThreshold();
    
    setDragOffset((currentOffset) => {
      if (Math.abs(currentOffset.x) > threshold) {
        const direction = currentOffset.x > 0 ? 'right' : 'left';
        handleSwipeComplete(direction);
      } else {
        setIsDragging(false);
      }
      return { x: 0, y: 0 };
    });
  };

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (isProcessing) return;
      setIsDragging(true);
      setDragOffset({ x: eventData.deltaX, y: eventData.deltaY });
    },
    onSwipedLeft: () => {
      const threshold = getSwipeThreshold();
      if (Math.abs(dragOffset.x) > threshold) {
        handleSwipeComplete('left');
      } else {
        setDragOffset({ x: 0, y: 0 });
        setIsDragging(false);
      }
    },
    onSwipedRight: () => {
      const threshold = getSwipeThreshold();
      if (Math.abs(dragOffset.x) > threshold) {
        handleSwipeComplete('right');
      } else {
        setDragOffset({ x: 0, y: 0 });
        setIsDragging(false);
      }
    },
    onSwiped: () => {
      const threshold = getSwipeThreshold();
      if (Math.abs(dragOffset.x) < threshold) {
        setDragOffset({ x: 0, y: 0 });
        setIsDragging(false);
      }
    },
    trackTouch: true,
    preventScrollOnSwipe: true,
  });


  const handlePassClick = () => {
    if (!currentActivity || isProcessing) return;
    handleSwipeComplete('left');
  };

  const handleLikeClick = () => {
    if (!currentActivity || isProcessing) return;
    handleSwipeComplete('right');
  };

  const handleCloseMatch = () => {
    setShowMatch(false);
    setMatchedActivity(null);
  };

  const getCardStyle = () => {
    if (swipeDirection) {
      const direction = swipeDirection === 'right' ? 1 : -1;
      return {
        transform: `translateX(${direction * 500}px) rotate(${direction * 30}deg)`,
        opacity: 0,
        transition: 'all 0.3s ease-out',
      };
    }
    if (isDragging) {
      const rotation = dragOffset.x / 20;
      return {
        transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
        transition: 'none',
      };
    }
    return {
      transform: 'translateX(0) translateY(0) rotate(0deg)',
      transition: 'all 0.3s ease-out',
    };
  };

  const getOverlayOpacity = () => {
    if (swipeDirection) return 1;
    return Math.min(Math.abs(dragOffset.x) / 150, 1);
  };

  const renderActivityCard = (activity, isBackground = false) => {
    if (!activity) return null;
    
    const spotsRemaining = activity.spots_remaining ?? (activity.spots - 1);
    
    return (
      <div className={`relative w-full h-full rounded-2xl overflow-hidden ${
        isBackground ? 'scale-95 opacity-50' : ''
      } ring-emerald-500/20`}>
        {/* Activity image */}
        <div className="absolute inset-0 bg-zinc-800">
          {activity.image_url ? (
            <img src={activity.image_url} alt={activity.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-600">
              {getActivityTypeEmoji(activity.activity_type)}
            </div>
          )}
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        
        {/* Activity info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Activity type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
              {getActivityTypeLabel(activity.activity_type)}
            </span>
            <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
              {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
            </span>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">{activity.title}</h2>
          
          {activity.description && (
            <p className="text-zinc-300 text-sm mb-3 line-clamp-2">{activity.description}</p>
          )}
          
          {/* Date, time, location */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
              📅 {formatDate(activity.activity_date)}
            </span>
            <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
              {getTimeWindowLabel(activity.time_window)}
            </span>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-1 text-zinc-400 text-sm">
            <span>📍</span>
            <span>{activity.location}</span>
          </div>
          
          {/* Creator info */}
          {activity.created_by && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-700/50">
              <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden">
                {activity.created_by.avatar_url ? (
                  <img src={activity.created_by.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                    {(activity.created_by.display_name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-zinc-400 text-sm">
                Hosted by <span className="text-white">{activity.created_by.display_name || 'Anonymous'}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };


  // Empty state
  if (!currentActivity) {
    return (
      <div className="px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-lg font-semibold text-white mb-2">No more activities</h2>
          <p className="text-zinc-500">
            You&apos;ve seen all available activities. Check back later or create your own!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Card stack */}
      <div className="relative h-[60vh] max-h-[500px]">
        {/* Next card (background) */}
        {nextActivity && (
          <div className="absolute inset-0">
            {renderActivityCard(nextActivity, true)}
          </div>
        )}

        {/* Current card (foreground) */}
        <div
          {...handlers}
          ref={cardRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={getCardStyle()}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          aria-label={`Activity card for ${currentActivity.title}`}
        >
          {renderActivityCard(currentActivity)}
          
          {/* Like overlay - emerald theme */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl border-4 border-emerald-500 bg-emerald-500/20"
            style={{ opacity: dragOffset.x > 0 ? getOverlayOpacity() : 0 }}
          >
            <span className="text-4xl font-bold text-emerald-500">JOIN</span>
          </div>
          
          {/* Pass overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl border-4 border-zinc-500 bg-zinc-500/20"
            style={{ opacity: dragOffset.x < 0 ? getOverlayOpacity() : 0 }}
          >
            <span className="text-4xl font-bold text-zinc-500">PASS</span>
          </div>
        </div>
      </div>

      {/* Action buttons - emerald theme */}
      <div className="flex justify-center gap-6 mt-6">
        <button
          className="w-16 h-16 flex items-center justify-center rounded-full bg-zinc-900 border-2 border-zinc-700 text-zinc-400 text-2xl hover:border-zinc-500 hover:text-white transition-all disabled:opacity-50"
          onClick={handlePassClick}
          disabled={isProcessing}
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          className="w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500 border-2 border-emerald-500 text-white text-2xl hover:bg-emerald-600 transition-all disabled:opacity-50"
          onClick={handleLikeClick}
          disabled={isProcessing}
          aria-label="Join"
        >
          ✓
        </button>
      </div>


      {/* Match celebration modal - emerald theme */}
      {showMatch && matchedActivity && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm overflow-hidden"
          onClick={handleCloseMatch}
        >
          {/* Celebration sparkles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute text-2xl animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  opacity: 0.6,
                }}
              >
                {['🎉', '✨', '🌟', '⭐', '🎊', '🏕️'][i % 6]}
              </div>
            ))}
          </div>
          
          <div 
            className="bg-zinc-900 rounded-2xl p-6 mx-4 max-w-sm w-full text-center relative border-2 border-emerald-500/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-2xl blur-xl opacity-30 bg-emerald-500" />
            
            <div className="relative">
              {/* Celebration header */}
              <div className="mb-4">
                <div className="text-5xl mb-2">🎉</div>
                <h1 className="text-3xl font-bold text-emerald-400">You&apos;re In!</h1>
              </div>
              
              <p className="text-zinc-300 mb-6 text-lg">
                You&apos;ve joined <span className="font-semibold text-emerald-300">{matchedActivity.title}</span>!
              </p>
              
              {/* Activity details */}
              <div className="bg-zinc-800 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getActivityTypeEmoji(matchedActivity.activity_type)}</span>
                  <span className="text-white font-semibold">{matchedActivity.title}</span>
                </div>
                <div className="text-zinc-400 text-sm space-y-1">
                  <div>📅 {formatDate(matchedActivity.activity_date)}</div>
                  <div>📍 {matchedActivity.location}</div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="space-y-3">
                <Link 
                  to={`/activities/${matchedActivity.id}/chat`}
                  className="block w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105"
                >
                  💬 Go to Group Chat
                </Link>
                <button 
                  className="w-full py-4 rounded-xl font-semibold text-zinc-300 border-2 border-zinc-700 hover:border-zinc-500 hover:text-white transition-all"
                  onClick={handleCloseMatch}
                >
                  Keep Browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * ActivitiesPage Component
 * 
 * Main Activities tab page that displays activities for swiping, user's created activities,
 * and matched activities. Uses emerald/green theme to differentiate from dating (rose).
 * 
 * Requirements:
 * - 5.1: Display a list of nearby activities available for swiping
 * - 5.2: Provide a button to create a new activity
 * - 5.3: Display activities in a swipeable card format
 * - 5.4: Right swipe records ActivitySwipe with is_like=true
 * - 5.5: Left swipe records ActivitySwipe with is_like=false
 * - 5.6: Provide access to view activities the user has liked and created
 * - 5.7: Allow filtering by Activity_Type
 * - 9.1-9.6: Filter controls for date, location, type
 */
function ActivitiesPage() {
  const navigate = useNavigate();
  
  // View modes: discover (swipe), my-activities, my-matches
  const [viewMode, setViewMode] = useState('discover');
  const [activities, setActivities] = useState([]);
  const [myActivities, setMyActivities] = useState([]);
  const [myMatches, setMyMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters (Requirement 5.7, 9.1-9.6)
  const [filters, setFilters] = useState({
    activity_type: '',
    date_from: '',
    date_to: '',
    location: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load activities for discovery
  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (filters.activity_type) params.activity_type = filters.activity_type;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.location) params.location = filters.location;
      
      const response = await activitiesAPI.list(params);
      const data = response.data.data || response.data || [];
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load activities');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load user's created activities
  const loadMyActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await activitiesAPI.getMyActivities();
      const data = response.data.data || response.data || [];
      setMyActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load your activities');
      setMyActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load user's matched activities
  const loadMyMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await activitiesAPI.getMyMatches();
      const data = response.data.data || response.data || [];
      setMyMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load your matches');
      setMyMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);


  // Load data based on view mode
  useEffect(() => {
    if (viewMode === 'discover') {
      loadActivities();
    } else if (viewMode === 'my-activities') {
      loadMyActivities();
    } else if (viewMode === 'my-matches') {
      loadMyMatches();
    }
  }, [viewMode, loadActivities, loadMyActivities, loadMyMatches]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      activity_type: '',
      date_from: '',
      date_to: '',
      location: '',
    });
  };

  const handleSwipe = (direction, activity, data) => {
    console.log(`Swiped ${direction} on ${activity.title}`, data);
  };

  const handleMatch = (activity, data) => {
    console.log(`Matched activity: ${activity.title}!`, data);
  };

  const handleEmpty = () => {
    console.log('No more activities to swipe');
  };

  const handleActivityClick = (activityId) => {
    navigate(`/activities/${activityId}`);
  };

  // Check if any filters are active
  const hasActiveFilters = filters.activity_type || filters.date_from || filters.date_to || filters.location;

  // Render view mode tabs
  const renderTabs = () => (
    <div className="flex border-b border-zinc-800">
      <button
        className={`app-tab flex items-center justify-center gap-2 ${
          viewMode === 'discover' 
            ? 'app-tab-active-activity' 
            : 'app-tab-inactive'
        }`}
        onClick={() => setViewMode('discover')}
      >
        <span>🎯</span>
        <span>Discover</span>
      </button>
      <button
        className={`app-tab flex items-center justify-center gap-2 ${
          viewMode === 'my-activities' 
            ? 'app-tab-active-activity' 
            : 'app-tab-inactive'
        }`}
        onClick={() => setViewMode('my-activities')}
      >
        <span>📋</span>
        <span>My Activities</span>
      </button>
      <button
        className={`app-tab flex items-center justify-center gap-2 ${
          viewMode === 'my-matches' 
            ? 'app-tab-active-activity' 
            : 'app-tab-inactive'
        }`}
        onClick={() => setViewMode('my-matches')}
      >
        <span>✅</span>
        <span>Joined</span>
      </button>
    </div>
  );


  // Render filter controls (Requirements 5.7, 9.1-9.6)
  const renderFilters = () => (
      <div className={`overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-96' : 'max-h-0'}`}>
      <div className="px-4 py-4 space-y-4 app-panel border-b border-zinc-800">
        {/* Activity Type Filter (Requirement 5.7, 9.3) */}
        <div>
          <label className="block text-zinc-400 text-sm mb-2">Activity Type</label>
          <select
            value={filters.activity_type}
            onChange={(e) => handleFilterChange('activity_type', e.target.value)}
            className="app-input"
          >
            {getActivityTypesArray(true).map(type => (
              <option key={type.value} value={type.value}>
                {type.emoji ? `${type.emoji} ${type.label}` : type.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Date Range Filter */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-2">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="app-input"
            />
          </div>
        </div>
        
        {/* Location Filter */}
        <div>
          <label className="block text-zinc-400 text-sm mb-2">Location</label>
          <input
            type="text"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            placeholder="e.g., Santa Cruz, CA"
            className="app-input"
          />
        </div>
        
        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="w-full py-2 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );


  // Render activity list (for my-activities and my-matches views)
  const renderActivityList = (activityList, emptyMessage, emptyIcon) => {
    if (activityList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-5xl mb-4">{emptyIcon}</div>
          <h2 className="text-lg font-semibold text-white mb-2">No activities yet</h2>
          <p className="text-zinc-500 mb-6">{emptyMessage}</p>
          {viewMode === 'my-activities' && (
            <Link
              to="/activities/create"
              className="app-btn-primary-activity px-6 py-3"
            >
              Create Activity
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="px-4 py-4 space-y-3">
        {activityList.map((activity) => (
          <div
            key={activity.id}
            className="app-card hover:border-emerald-500/30 overflow-hidden cursor-pointer transition-all"
            onClick={() => handleActivityClick(activity.id)}
          >
            <div className="flex">
              {/* Activity image */}
              <div className="w-24 h-24 bg-zinc-800 flex-shrink-0">
                {activity.image_url ? (
                  <img src={activity.image_url} alt={activity.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-600">
                    {getActivityTypeEmoji(activity.activity_type)}
                  </div>
                )}
              </div>
              
              {/* Activity info */}
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-semibold">
                    {getActivityTypeLabel(activity.activity_type)}
                  </span>
                  {activity.status === 'matched' && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">
                      Matched
                    </span>
                  )}
                </div>
                <h3 className="text-white font-semibold truncate">{activity.title}</h3>
                <div className="text-zinc-400 text-sm mt-1">
                  <span>📅 {formatDate(activity.activity_date)}</span>
                  <span className="mx-2">•</span>
                  <span>📍 {activity.location}</span>
                </div>
                {activity.spots_remaining !== undefined && (
                  <div className="text-zinc-500 text-xs mt-1">
                    {activity.spots_remaining} {activity.spots_remaining === 1 ? 'spot' : 'spots'} remaining
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };


  // Loading state
  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-500">📅</span>
              Activities
            </h1>
            <Link
              to="/activities/create"
              className="app-btn-primary-activity text-sm"
            >
              + Create
            </Link>
          </header>
          
          {renderTabs()}
          
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-500">Loading activities...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && activities.length === 0 && myActivities.length === 0 && myMatches.length === 0) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-500">📅</span>
              Activities
            </h1>
            <Link
              to="/activities/create"
              className="app-btn-primary-activity text-sm"
            >
              + Create
            </Link>
          </header>
          
          {renderTabs()}
          
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              className="app-btn-primary-activity px-4 py-2 text-sm"
              onClick={() => {
                if (viewMode === 'discover') loadActivities();
                else if (viewMode === 'my-activities') loadMyActivities();
                else loadMyMatches();
              }}
            >
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
        {/* Header - Emerald themed */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-500">📅</span>
              Activities
            </h1>
            <p className="text-zinc-500 text-sm">
              Find adventures with fellow travelers
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter toggle (only in discover mode) */}
            {viewMode === 'discover' && (
              <button
                className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Toggle filters"
              >
                🔍
              </button>
            )}
            
            {/* Create button */}
            <Link
              to="/activities/create"
              className="app-btn-primary-activity text-sm"
            >
              + Create
            </Link>
          </div>
        </header>

        {/* View mode tabs */}
        {renderTabs()}
        
        {/* Filter controls (only in discover mode) */}
        {viewMode === 'discover' && renderFilters()}

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'discover' && (
          <>
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="text-5xl mb-4">🎯</div>
                <h2 className="text-lg font-semibold text-white mb-2">No activities found</h2>
                <p className="text-zinc-500 mb-6">
                  {hasActiveFilters 
                    ? 'Try adjusting your filters or check back later!'
                    : 'No activities nearby right now. Be the first to create one!'}
                </p>
                <div className="flex gap-3">
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="app-btn-secondary px-4 py-2 text-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                  <Link
                    to="/activities/create"
                    className="app-btn-primary-activity px-4 py-2 text-sm"
                  >
                    Create Activity
                  </Link>
                </div>
              </div>
            ) : (
              <ActivitySwipeCard
                activities={activities}
                onSwipe={handleSwipe}
                onMatch={handleMatch}
                onEmpty={handleEmpty}
              />
            )}
          </>
        )}

        {viewMode === 'my-activities' && renderActivityList(
          myActivities,
          "You haven't created any activities yet. Create one to meet fellow travelers!",
          "📋"
        )}

        {viewMode === 'my-matches' && renderActivityList(
          myMatches,
          "You haven't joined any activities yet. Start swiping to find adventures!",
          "✅"
        )}
      </div>
    </div>
  );
}

export default ActivitiesPage;
