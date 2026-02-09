import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { eventsAPI } from '../services/api';
import { getActivityTypeInfo, getActivityTypeEmoji, getActivityTypesArray } from '../utils/constants';

/**
 * Time window display labels
 */
const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm', emoji: '🌅' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm', emoji: '☀️' },
  evening: { label: 'Evening', time: '5pm-9pm', emoji: '🌙' },
  flexible: { label: 'Flexible', time: 'Any time', emoji: '🔄' },
};

/**
 * Get event type display info
 */
function getEventTypeInfo(type) {
  return getActivityTypeInfo(type);
}

/**
 * Get event type emoji
 */
function getEventTypeEmoji(type) {
  return getActivityTypeEmoji(type);
}

/**
 * Get event type label with emoji
 */
function getEventTypeLabel(type) {
  const info = getEventTypeInfo(type);
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
  const info = TIME_WINDOWS[timeWindow];
  return info ? `${info.emoji} ${info.label}` : timeWindow;
}

/**
 * Get time window info
 */
function getTimeWindowInfo(timeWindow) {
  return TIME_WINDOWS[timeWindow] || { label: timeWindow, time: '', emoji: '📅' };
}

/**
 * EventSwipeCard Component
 * 
 * Swipeable card for swipe-mode events with like/pass functionality.
 * Uses campfire amber theme.
 */
function EventSwipeCard({ events, onSwipe, onMatch, onEmpty }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedEvent, setMatchedEvent] = useState(null);
  
  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const currentEvent = events[currentIndex];
  const nextEvent = events[currentIndex + 1];

  const getSwipeThreshold = () => {
    const screenWidth = window.innerWidth;
    const threshold = screenWidth * 0.25;
    return Math.max(80, Math.min(threshold, 150));
  };

  const handleSwipeAPI = useCallback(async (event, isLike) => {
    try {
      setIsProcessing(true);
      const response = await eventsAPI.swipe(event.id, isLike);
      
      const data = response.data.data || response.data;
      if (data.match) {
        setMatchedEvent(event);
        setShowMatch(true);
        if (onMatch) onMatch(event, data);
      }
      
      if (onSwipe) onSwipe(isLike ? 'right' : 'left', event, data);
    } catch (error) {
      console.error('Swipe error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onSwipe, onMatch]);

  const handleSwipeComplete = useCallback((direction) => {
    if (!currentEvent || isProcessing) return;
    
    setSwipeDirection(direction);
    const isLike = direction === 'right';
    handleSwipeAPI(currentEvent, isLike);
    
    setTimeout(() => {
      setSwipeDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  }, [currentEvent, isProcessing, handleSwipeAPI]);

  useEffect(() => {
    if (currentIndex >= events.length && events.length > 0) {
      if (onEmpty) onEmpty();
    }
  }, [currentIndex, events.length, onEmpty]);

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
    if (!currentEvent || isProcessing) return;
    handleSwipeComplete('left');
  };

  const handleLikeClick = () => {
    if (!currentEvent || isProcessing) return;
    handleSwipeComplete('right');
  };

  const handleCloseMatch = () => {
    setShowMatch(false);
    setMatchedEvent(null);
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

  const renderEventCard = (event, isBackground = false) => {
    if (!event) return null;
    
    const spotsRemaining = event.spots_remaining ?? (event.spots - 1);
    
    return (
      <div className={`relative w-full h-full rounded-2xl overflow-hidden ${
        isBackground ? 'scale-95 opacity-50' : ''
      } ring-amber-500/20`}>
        {/* Event image */}
        <div className="absolute inset-0 bg-zinc-800">
          {event.image_url ? (
            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-600">
              {getEventTypeEmoji(event.event_type)}
            </div>
          )}
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        
        {/* Event info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Event type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold">
              {getEventTypeLabel(event.event_type)}
            </span>
            <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
              {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
            </span>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">{event.title}</h2>
          
          {event.description && (
            <p className="text-zinc-300 text-sm mb-3 line-clamp-2">{event.description}</p>
          )}
          
          {/* Date, time, location */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
              📅 {formatDate(event.event_date)}
            </span>
            <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
              {getTimeWindowLabel(event.time_window)}
            </span>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-1 text-zinc-400 text-sm">
            <span>📍</span>
            <span>{event.location}</span>
          </div>
          
          {/* Creator info */}
          {event.created_by && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-700/50">
              <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden">
                {event.created_by.avatar_url ? (
                  <img src={event.created_by.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                    {(event.created_by.display_name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-zinc-400 text-sm">
                Hosted by <span className="text-white">{event.created_by.display_name || 'Anonymous'}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state
  if (!currentEvent) {
    return (
      <div className="px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-lg font-semibold text-white mb-2">No more events</h2>
          <p className="text-zinc-500">
            You&apos;ve seen all available events. Check back later or create your own!
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
        {nextEvent && (
          <div className="absolute inset-0">
            {renderEventCard(nextEvent, true)}
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
          aria-label={`Event card for ${currentEvent.title}`}
        >
          {renderEventCard(currentEvent)}
          
          {/* Like overlay - campfire theme */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl border-4 border-amber-500 bg-amber-500/20"
            style={{ opacity: dragOffset.x > 0 ? getOverlayOpacity() : 0 }}
          >
            <span className="text-4xl font-bold text-amber-400">JOIN</span>
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

      {/* Action buttons - campfire theme */}
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
          className="w-16 h-16 flex items-center justify-center rounded-full bg-amber-500 border-2 border-amber-500 text-white text-2xl hover:bg-amber-600 transition-all disabled:opacity-50"
          onClick={handleLikeClick}
          disabled={isProcessing}
          aria-label="Join"
        >
          ✓
        </button>
      </div>

      {/* Match celebration modal - campfire theme */}
      {showMatch && matchedEvent && (
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
            className="bg-zinc-900 rounded-2xl p-6 mx-4 max-w-sm w-full text-center relative border-2 border-amber-500/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-2xl blur-xl opacity-30 bg-amber-500" />
            
            <div className="relative">
              {/* Celebration header */}
              <div className="mb-4">
                <div className="text-5xl mb-2">🎉</div>
                <h1 className="text-3xl font-bold text-amber-300">You&apos;re In!</h1>
              </div>
              
              <p className="text-zinc-300 mb-6 text-lg">
                You&apos;ve joined <span className="font-semibold text-amber-200">{matchedEvent.title}</span>!
              </p>
              
              {/* Event details */}
              <div className="bg-zinc-800 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getEventTypeEmoji(matchedEvent.event_type)}</span>
                  <span className="text-white font-semibold">{matchedEvent.title}</span>
                </div>
                <div className="text-zinc-400 text-sm space-y-1">
                  <div>📅 {formatDate(matchedEvent.event_date)}</div>
                  <div>📍 {matchedEvent.location}</div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="space-y-3">
                <Link 
                  to={`/events/${matchedEvent.id}/chat`}
                  className="block w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
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
 * EventsPage Component
 * 
 * Unified page for browsing events with two join modes:
 * - Direct Join: Browse and directly join events (replaces PlansPage)
 * - Swipe to Join: Swipe on events to express interest (replaces ActivitiesPage)
 * 
 * Requirements:
 * - REQ-7.1: Create unified EventsPage replacing PlansPage and ActivitiesPage
 */
function EventsPage() {
  const navigate = useNavigate();
  
  // Join mode tabs: 'direct' or 'swipe'
  const [joinMode, setJoinMode] = useState('direct');
  
  // View modes for each join mode
  const [directViewMode, setDirectViewMode] = useState('browse'); // browse, my-events
  const [swipeViewMode, setSwipeViewMode] = useState('discover'); // discover, my-events, my-matches
  
  // Data states
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [myMatches, setMyMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    event_type: '',
    date: '',
    location: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load events based on current mode
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = { join_mode: joinMode };
      if (filters.event_type) params.event_type = filters.event_type;
      if (filters.date) {
        params.from_date = filters.date;
        params.to_date = filters.date;
      }
      if (filters.location) params.location = filters.location;
      
      const response = await eventsAPI.list(params);
      const data = response.data.data || response.data;
      const eventList = Array.isArray(data) ? data : (data.results || []);
      setEvents(eventList);
    } catch (err) {
      setError(err.message || 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [joinMode, filters]);

  // Load user's events
  const loadMyEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await eventsAPI.getMyEvents();
      const data = response.data.data || response.data;
      const eventList = Array.isArray(data) ? data : (data.results || []);
      // Filter by current join mode
      const filtered = eventList.filter(e => e.join_mode === joinMode);
      setMyEvents(filtered);
    } catch (err) {
      setError(err.message || 'Failed to load your events');
      setMyEvents([]);
    } finally {
      setLoading(false);
    }
  }, [joinMode]);

  // Load user's matched events (swipe mode only)
  const loadMyMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await eventsAPI.getMyMatches();
      const data = response.data.data || response.data;
      setMyMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load your matches');
      setMyMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data based on current mode and view
  useEffect(() => {
    if (joinMode === 'direct') {
      if (directViewMode === 'browse') {
        loadEvents();
      } else {
        loadMyEvents();
      }
    } else {
      if (swipeViewMode === 'discover') {
        loadEvents();
      } else if (swipeViewMode === 'my-events') {
        loadMyEvents();
      } else {
        loadMyMatches();
      }
    }
  }, [joinMode, directViewMode, swipeViewMode, loadEvents, loadMyEvents, loadMyMatches]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ event_type: '', date: '', location: '' });
  };

  const handleSwipe = (direction, event, data) => {
    console.log(`Swiped ${direction} on ${event.title}`, data);
  };

  const handleMatch = (event, data) => {
    console.log(`Matched event: ${event.title}!`, data);
  };

  const handleEmpty = () => {
    console.log('No more events to swipe');
  };

  const handleEventClick = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  const hasActiveFilters = filters.event_type || filters.date || filters.location;

  // Render join mode tabs (Direct Join vs Swipe to Join)
  const renderJoinModeTabs = () => (
    <div className="flex border-b border-zinc-800">
      <button
        className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
          joinMode === 'direct'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setJoinMode('direct')}
      >
        <span className="flex items-center justify-center gap-2">
          <span>📅</span>
          <span>Direct Join</span>
        </span>
      </button>
      <button
        className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
          joinMode === 'swipe'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setJoinMode('swipe')}
      >
        <span className="flex items-center justify-center gap-2">
          <span>👆</span>
          <span>Swipe to Join</span>
        </span>
      </button>
    </div>
  );

  // Render sub-tabs for direct mode
  const renderDirectSubTabs = () => (
    <div className="flex border-b border-zinc-800">
      <button
        className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
          directViewMode === 'browse'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setDirectViewMode('browse')}
      >
        Browse
      </button>
      <button
        className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
          directViewMode === 'my-events'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setDirectViewMode('my-events')}
      >
        My Events
      </button>
    </div>
  );

  // Render sub-tabs for swipe mode
  const renderSwipeSubTabs = () => (
    <div className="flex border-b border-zinc-800">
      <button
        className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
          swipeViewMode === 'discover'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setSwipeViewMode('discover')}
      >
        🎯 Discover
      </button>
      <button
        className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
          swipeViewMode === 'my-events'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setSwipeViewMode('my-events')}
      >
        📋 My Events
      </button>
      <button
        className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
          swipeViewMode === 'my-matches'
            ? 'text-amber-300 border-b-2 border-amber-400'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => setSwipeViewMode('my-matches')}
      >
        ✅ Joined
      </button>
    </div>
  );

  // Render filter controls
  const renderFilters = () => (
    <div className={`overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-96' : 'max-h-0'}`}>
      <div className="px-4 py-4 space-y-4 bg-zinc-900 border-b border-zinc-800">
        {/* Event Type Filter */}
        <div>
          <label className="block text-zinc-400 text-sm mb-2">Event Type</label>
          <select
            value={filters.event_type}
            onChange={(e) => handleFilterChange('event_type', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-zinc-500"
          >
            {getActivityTypesArray(true).map(type => (
              <option key={type.value} value={type.value}>
                {type.emoji ? `${type.emoji} ${type.label}` : type.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Date Filter */}
        <div>
          <label className="block text-zinc-400 text-sm mb-2">Date</label>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => handleFilterChange('date', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-zinc-500"
          />
        </div>
        
        {/* Location Filter */}
        <div>
          <label className="block text-zinc-400 text-sm mb-2">Location</label>
          <input
            type="text"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            placeholder="Search by location..."
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:border-zinc-500"
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

  // Render event list (for direct mode browse and my-events views)
  const renderEventList = (eventList, emptyMessage, emptyIcon, isDirectMode = true) => {
    if (eventList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-5xl mb-4">{emptyIcon}</div>
          <h2 className="text-lg font-semibold text-white mb-2">No events found</h2>
          <p className="text-zinc-500 mb-6">{emptyMessage}</p>
          <div className="flex gap-3">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}
            <Link
              to="/events/create"
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors bg-amber-500 hover:bg-amber-600"
            >
              Create Event
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-4 space-y-3">
        {eventList.map((event) => {
          const typeInfo = getEventTypeInfo(event.event_type);
          const timeInfo = getTimeWindowInfo(event.time_window);
          const attendeeCount = event.attendee_count || 0;
          const spotsRemaining = event.spots_remaining ?? (event.spots - attendeeCount);
          const isFull = event.status === 'full' || spotsRemaining <= 0;
          const isSwipeMode = event.join_mode === 'swipe';
          
          return (
            <div
              key={event.id}
              className={`bg-zinc-900 rounded-xl border p-4 transition-all cursor-pointer hover:border-zinc-600 ${
                isFull ? 'border-zinc-800 opacity-60' : 'border-zinc-800'
              }`}
              onClick={() => handleEventClick(event.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isSwipeMode
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-orange-500/20 text-orange-300'
                  }`}>
                    {typeInfo.emoji} {typeInfo.label}
                  </span>
                  {event.status === 'matched' && (
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs font-medium">
                      Matched
                    </span>
                  )}
                </div>
                {isFull && (
                  <span className="px-2 py-1 bg-zinc-800 text-zinc-500 rounded text-xs">
                    Full
                  </span>
                )}
              </div>
              
              <h3 className="text-white font-semibold mb-3">{event.title}</h3>
              
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>📅</span>
                  <span>{formatDate(event.event_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>🕐</span>
                  <span>{timeInfo.label} ({timeInfo.time})</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>📍</span>
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>👥</span>
                  <span>{attendeeCount}/{event.spots} attending</span>
                </div>
              </div>

              {event.description && (
                <p className="text-zinc-500 text-sm mt-3 line-clamp-2">{event.description}</p>
              )}

              <div className="mt-3 pt-3 border-t border-zinc-800">
                <span className="text-zinc-500 text-xs">
                  Created by {event.created_by?.display_name || 'Anonymous'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Determine if we should show filters
  const shouldShowFilterToggle = () => {
    if (joinMode === 'direct') {
      return directViewMode === 'browse';
    }
    return swipeViewMode === 'discover';
  };

  // Loading state
  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto app-card overflow-hidden">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-300">🔥</span>
              Campfire
            </h1>
            <Link
              to="/events/create"
              className="px-3 py-1.5 text-white text-sm font-semibold rounded-lg transition-colors bg-amber-500 hover:bg-amber-600"
            >
              + Create
            </Link>
          </header>
          
          {renderJoinModeTabs()}
          {joinMode === 'direct' ? renderDirectSubTabs() : renderSwipeSubTabs()}
          
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-500">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (only show if no data at all)
  if (error && events.length === 0 && myEvents.length === 0 && myMatches.length === 0) {
    return (
      <div className="app-shell pb-20">
        <div className="max-w-lg mx-auto app-card overflow-hidden">
          {/* Header */}
          <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-300">🔥</span>
              Campfire
            </h1>
            <Link
              to="/events/create"
              className="px-3 py-1.5 text-white text-sm font-semibold rounded-lg transition-colors bg-amber-500 hover:bg-amber-600"
            >
              + Create
            </Link>
          </header>
          
          {renderJoinModeTabs()}
          {joinMode === 'direct' ? renderDirectSubTabs() : renderSwipeSubTabs()}
          
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors bg-amber-500 hover:bg-amber-600"
              onClick={() => {
                if (joinMode === 'direct') {
                  directViewMode === 'browse' ? loadEvents() : loadMyEvents();
                } else {
                  if (swipeViewMode === 'discover') loadEvents();
                  else if (swipeViewMode === 'my-events') loadMyEvents();
                  else loadMyMatches();
                }
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="app-shell pb-20">
      <div className="max-w-lg mx-auto app-card overflow-hidden">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-800">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-300">🔥</span>
              Campfire
            </h1>
            <p className="text-zinc-500 text-sm">
              {joinMode === 'direct' 
                ? 'Browse and join meetups'
                : 'Swipe to find adventures'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            {shouldShowFilterToggle() && (
              <button
                className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'border-amber-500 text-amber-300 bg-amber-500/10'
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
              to="/events/create"
              className="px-3 py-1.5 text-white text-sm font-semibold rounded-lg transition-colors bg-amber-500 hover:bg-amber-600"
            >
              + Create
            </Link>
          </div>
        </header>

        {/* Join mode tabs */}
        {renderJoinModeTabs()}
        
        {/* Sub-tabs based on join mode */}
        {joinMode === 'direct' ? renderDirectSubTabs() : renderSwipeSubTabs()}
        
        {/* Filter controls */}
        {shouldShowFilterToggle() && renderFilters()}

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Content based on mode */}
        {joinMode === 'direct' && (
          <>
            {directViewMode === 'browse' && renderEventList(
              events,
              hasActiveFilters 
                ? 'Try adjusting your filters or check back later!'
                : 'No events nearby right now. Be the first to create one!',
              '📅',
              true
            )}
            {directViewMode === 'my-events' && renderEventList(
              myEvents,
              "You haven't created or joined any direct events yet.",
              '📋',
              true
            )}
          </>
        )}

        {joinMode === 'swipe' && (
          <>
            {swipeViewMode === 'discover' && (
              events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="text-5xl mb-4">🎯</div>
                  <h2 className="text-lg font-semibold text-white mb-2">No events found</h2>
                  <p className="text-zinc-500 mb-6">
                    {hasActiveFilters 
                      ? 'Try adjusting your filters or check back later!'
                      : 'No events nearby right now. Be the first to create one!'}
                  </p>
                  <div className="flex gap-3">
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                    <Link
                      to="/events/create"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Create Event
                    </Link>
                  </div>
                </div>
              ) : (
                <EventSwipeCard
                  events={events}
                  onSwipe={handleSwipe}
                  onMatch={handleMatch}
                  onEmpty={handleEmpty}
                />
              )
            )}
            {swipeViewMode === 'my-events' && renderEventList(
              myEvents,
              "You haven't created any swipe events yet. Create one to meet fellow travelers!",
              '📋',
              false
            )}
            {swipeViewMode === 'my-matches' && renderEventList(
              myMatches,
              "You haven't joined any events yet. Start swiping to find adventures!",
              '✅',
              false
            )}
          </>
        )}

        {/* Refresh button */}
        {((joinMode === 'direct' && directViewMode === 'browse' && events.length > 0) ||
          (joinMode === 'swipe' && swipeViewMode !== 'discover' && (myEvents.length > 0 || myMatches.length > 0))) && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                if (joinMode === 'direct') {
                  directViewMode === 'browse' ? loadEvents() : loadMyEvents();
                } else {
                  if (swipeViewMode === 'my-events') loadMyEvents();
                  else loadMyMatches();
                }
              }}
              className="text-zinc-500 text-sm hover:text-white transition-colors"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventsPage;
