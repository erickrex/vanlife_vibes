import { useState, useRef, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { discoveryAPI } from '../services/api';

const SWIPE_ANIM_MS = 320;

function DiscoverySwipeCard({ profiles, mode, onSwipe, onMatch, onEmpty, onNavigateToChat }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [matchId, setMatchId] = useState(null);
  
  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];
  const getSwipeThreshold = () => {
    const screenWidth = window.innerWidth;
    const threshold = screenWidth * 0.25;
    return Math.max(80, Math.min(threshold, 150));
  };

  const getDragProgress = () => {
    const threshold = getSwipeThreshold();
    return Math.min(Math.abs(dragOffset.x) / threshold, 1);
  };

  const handleSwipeAPI = useCallback(async (profile, isLike) => {
    try {
      setIsProcessing(true);
      const response = await discoveryAPI.swipe({
        swiped_on: profile.id,
        is_like: isLike,
        mode: mode
      });
      
      const data = response.data.data || response.data;
      if (data.is_match) {
        setMatchedProfile(profile);
        setMatchId(data.match?.id || data.match_id || null);
        setShowMatch(true);
        if (onMatch) onMatch(profile, data.match);
      }
      
      if (onSwipe) onSwipe(isLike ? 'right' : 'left', profile, data);
    } catch (error) {
      console.error('Swipe error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [mode, onSwipe, onMatch]);

  const handleSwipeComplete = useCallback((direction) => {
    if (!currentProfile || isProcessing) return;
    
    setIsDragging(false);
    setIsAdvancing(true);
    setSwipeDirection(direction);
    setDragOffset({ x: 0, y: 0 });
    const isLike = direction === 'right';
    handleSwipeAPI(currentProfile, isLike);
    
    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex(prev => prev + 1);
      setIsAdvancing(false);
    }, SWIPE_ANIM_MS);
  }, [currentProfile, isProcessing, handleSwipeAPI]);

  useEffect(() => {
    if (currentIndex >= profiles.length && profiles.length > 0) {
      if (onEmpty) onEmpty();
    }
  }, [currentIndex, profiles.length, onEmpty]);

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
    if (!currentProfile || isProcessing) return;
    handleSwipeComplete('left');
  };

  const handleLikeClick = () => {
    if (!currentProfile || isProcessing) return;
    handleSwipeComplete('right');
  };

  const handleCloseMatch = () => {
    setShowMatch(false);
    setMatchedProfile(null);
    setMatchId(null);
  };

  const handleSendMessage = () => {
    handleCloseMatch();
    if (onNavigateToChat && matchId) onNavigateToChat(matchId);
  };

  const getCardStyle = () => {
    if (swipeDirection) {
      const direction = swipeDirection === 'right' ? 1 : -1;
      return {
        transform: `translateX(${direction * 500}px) rotate(${direction * 30}deg)`,
        opacity: 0,
        transition: 'transform 0.32s ease-out, opacity 0.32s ease-out',
      };
    }
    if (isDragging) {
      const rotation = dragOffset.x / 20;
      return {
        transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
        opacity: 1,
        transition: 'none',
      };
    }
    return {
      transform: 'translateX(0) translateY(0) rotate(0deg)',
      opacity: 1,
      transition: 'transform 0.32s ease-out, opacity 0.32s ease-out',
    };
  };

  const getNextCardStyle = () => {
    if (!nextProfile) return undefined;
    const progress = isAdvancing ? 1 : getDragProgress();
    const scale = 0.96 + 0.04 * progress;
    const opacity = 0.6 + 0.4 * progress;
    const translateX = -12 + 12 * progress;
    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      opacity,
      transition: isDragging
        ? 'none'
        : 'transform 0.32s ease-out, opacity 0.32s ease-out',
    };
  };

  const getOverlayOpacity = () => {
    if (swipeDirection) return 1;
    return Math.min(Math.abs(dragOffset.x) / 150, 1);
  };

  const renderProfileCard = (profile, isBackground = false) => {
    if (!profile) return null;
    
    return (
      <div className={`relative w-full h-full rounded-2xl overflow-hidden ${
        isBackground ? 'pointer-events-none' : ''
      } ${mode === 'dating' ? 'ring-rose-500/20' : 'ring-blue-500/20'}`}>
        {/* Profile image */}
        <div className="absolute inset-0 bg-zinc-800">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name || 'Profile'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-600">
              {(profile.display_name || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Profile info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold text-white">
              {profile.display_name || 'Anonymous'}
            </h2>
            {profile.profile_type && profile.profile_type !== 'solo' && (
              <span className="text-lg">
                {profile.profile_type === 'couple' ? '👫' : '👥'}
              </span>
            )}
          </div>
          
          {profile.bio && (
            <p className="text-zinc-300 text-sm mb-3 line-clamp-2">{profile.bio}</p>
          )}
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.travel_pace && (
              <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
                {profile.travel_pace === 'slow' && '🐢 Slow'}
                {profile.travel_pace === 'mixed' && '🔄 Mixed'}
                {profile.travel_pace === 'fast' && '⚡ Fast'}
              </span>
            )}
            {profile.social_vibe && (
              <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
                {profile.social_vibe === 'introvert' && '🧘 Introvert'}
                {profile.social_vibe === 'balanced' && '⚖️ Balanced'}
                {profile.social_vibe === 'social' && '🎉 Social'}
              </span>
            )}
            {profile.has_pets && (
              <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
                {profile.pet_type === 'dog' && '🐕 Dog'}
                {profile.pet_type === 'cat' && '🐱 Cat'}
                {!profile.pet_type && '🐾 Pet'}
              </span>
            )}
            {profile.rig_status && (
              <span className="px-2 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-xs">
                {profile.rig_status === 'van' && '🚐 Van'}
                {profile.rig_status === 'rv' && '🚌 RV'}
                {profile.rig_status === 'skoolie' && '🚌 Skoolie'}
                {profile.rig_status === 'no_vehicle' && '🎒 No Vehicle'}
              </span>
            )}
          </div>
          
          {/* Prompts */}
            {profile.prompts && profile.prompts.length > 0 && (
              <div className="space-y-2">
                {profile.prompts.slice(0, 1).map((prompt, index) => (
                  <div key={index} className="bg-zinc-900/80 rounded-lg p-3">
                    <span className="text-zinc-500 text-xs block mb-1">
                    {prompt.prompt_question || prompt.prompt_name}
                    </span>
                    <p className="text-white text-sm">{prompt.prompt_answer}</p>
                  </div>
                ))}
              </div>
          )}
          
          {/* Location */}
          {profile.in_town_windows && profile.in_town_windows.length > 0 && (
            <div className="flex items-center gap-1 mt-3 text-zinc-400 text-sm">
              <span>📍</span>
              <span>{profile.in_town_windows[0].city_area}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state
  if (!currentProfile) {
    return (
      <div className="px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">
            {mode === 'dating' ? '💔' : '🤷'}
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No more profiles</h2>
          <p className="text-zinc-500">
            {mode === 'dating' 
              ? "You've seen everyone looking for dating. Check back later!"
              : "You've seen everyone looking for friends. Check back later!"}
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
        {nextProfile && (
          <div className="absolute inset-0" style={getNextCardStyle()}>
            {renderProfileCard(nextProfile, true)}
          </div>
        )}

        {/* Current card (foreground) */}
        <div
          {...handlers}
          ref={cardRef}
          key={currentProfile?.id || currentIndex}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={getCardStyle()}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          aria-label={`Profile card for ${currentProfile.display_name || 'Anonymous'}`}
        >
          {renderProfileCard(currentProfile)}
          
          {/* Like overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center rounded-2xl border-4 ${
              mode === 'dating' ? 'border-rose-500 bg-rose-500/20' : 'border-blue-500 bg-blue-500/20'
            }`}
            style={{ opacity: dragOffset.x > 0 ? getOverlayOpacity() : 0 }}
          >
            <span className={`text-4xl font-bold ${mode === 'dating' ? 'text-rose-500' : 'text-blue-500'}`}>
              LIKE
            </span>
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

      {/* Action buttons */}
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
          className={`w-16 h-16 flex items-center justify-center rounded-full text-2xl transition-all disabled:opacity-50 ${
            mode === 'dating' 
              ? 'bg-rose-500 border-2 border-rose-500 text-white hover:bg-rose-600' 
              : 'bg-blue-500 border-2 border-blue-500 text-white hover:bg-blue-600'
          }`}
          onClick={handleLikeClick}
          disabled={isProcessing}
          aria-label="Like"
        >
          ♥
        </button>
      </div>

      {/* Match celebration modal */}
      {showMatch && matchedProfile && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm overflow-hidden"
          onClick={handleCloseMatch}
        >
          {/* Animated hearts/confetti background for dating mode */}
          {mode === 'dating' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* Floating hearts animation */}
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
                  {['💕', '💖', '💗', '💓', '❤️', '💘'][i % 6]}
                </div>
              ))}
            </div>
          )}
          
          {/* Celebration sparkles for friends mode */}
          {mode !== 'dating' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(10)].map((_, i) => (
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
                  {['✨', '🎉', '⭐', '🌟', '🎊'][i % 5]}
                </div>
              ))}
            </div>
          )}
          
          <div 
            className={`bg-zinc-900 rounded-2xl p-6 mx-4 max-w-sm w-full text-center relative border-2 ${
              mode === 'dating' ? 'border-rose-500/50' : 'border-blue-500/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow effect */}
            <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-30 ${
              mode === 'dating' ? 'bg-rose-500' : 'bg-blue-500'
            }`} />
            
            <div className="relative">
              {/* Celebration header */}
              <div className="mb-4">
                <div className={`text-5xl mb-2 ${mode === 'dating' ? 'animate-pulse' : ''}`}>
                  {mode === 'dating' ? '💕' : '🎉'}
                </div>
                <h1 className={`text-3xl font-bold ${mode === 'dating' ? 'text-rose-400' : 'text-blue-400'}`}>
                  {mode === 'dating' ? "It's a Match!" : "New Friend!"}
                </h1>
              </div>
              
              <p className="text-zinc-300 mb-6 text-lg">
                You and <span className={`font-semibold ${mode === 'dating' ? 'text-rose-300' : 'text-blue-300'}`}>
                  {matchedProfile.display_name || 'Anonymous'}
                </span> liked each other!
              </p>
              
              {/* Profile avatar with ring */}
              <div className={`w-28 h-28 mx-auto mb-6 rounded-full overflow-hidden ring-4 ${
                mode === 'dating' ? 'ring-rose-500' : 'ring-blue-500'
              } shadow-lg`}>
                {matchedProfile.avatar_url ? (
                  <img 
                    src={matchedProfile.avatar_url} 
                    alt={matchedProfile.display_name || 'Match'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-4xl ${
                    mode === 'dating' ? 'bg-rose-900/50 text-rose-300' : 'bg-blue-900/50 text-blue-300'
                  }`}>
                    {(matchedProfile.display_name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="space-y-3">
                <button 
                  className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all transform hover:scale-105 ${
                    mode === 'dating' 
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-lg shadow-rose-500/30' 
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/30'
                  }`}
                  onClick={handleSendMessage}
                >
                  💬 Send Message
                </button>
                <button 
                  className="w-full py-4 rounded-xl font-semibold text-zinc-300 border-2 border-zinc-700 hover:border-zinc-500 hover:text-white transition-all"
                  onClick={handleCloseMatch}
                >
                  Keep Swiping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscoverySwipeCard;
