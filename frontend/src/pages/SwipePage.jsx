import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SwipeCardStack from '../components/SwipeCardStack';
import Toast from '../components/Toast';
import { candidatesAPI, swipesAPI, sessionsAPI } from '../services/api';

/**
 * SwipePage component for swipe-based voting on session candidates.
 * Displays candidates with optional images and supports like/pass voting.
 */
function SwipePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [swipeHistory, setSwipeHistory] = useState([]);
  const [toast, setToast] = useState(null);

  // Fetch session and candidates
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch session details
        const sessionResponse = await sessionsAPI.get(sessionId);
        const sessionData = sessionResponse.data.data || sessionResponse.data;
        setSession(sessionData);
        
        // Fetch candidates for this session
        const candidatesResponse = await candidatesAPI.list(sessionId);
        console.log('Candidates response:', candidatesResponse);
        let fetchedCandidates = candidatesResponse.data.data?.results || candidatesResponse.data.data || candidatesResponse.data.results || candidatesResponse.data || [];
        
        // Ensure it's an array
        if (!Array.isArray(fetchedCandidates)) {
          console.warn('fetchedCandidates is not an array:', fetchedCandidates);
          fetchedCandidates = [];
        }
        
        console.log('Fetched candidates:', fetchedCandidates);
        
        // Filter out candidates the user has already swiped on
        const candidatesWithSwipes = await Promise.all(
          fetchedCandidates.map(async (candidate) => {
            try {
              const swipeResponse = await swipesAPI.getMySwipe(candidate.id);
              // API returns { status: 'success', data: null } when no swipe exists
              const swipeData = swipeResponse.data.data;
              if (swipeData) {
                return { ...candidate, hasSwiped: true, mySwipe: swipeData };
              }
              return { ...candidate, hasSwiped: false };
            } catch (err) {
              // Error means no swipe or access denied
              return { ...candidate, hasSwiped: false };
            }
          })
        );
        
        // Only show candidates without swipes
        const unswipedCandidates = candidatesWithSwipes.filter(candidate => !candidate.hasSwiped);
        console.log('Unswiped candidates:', unswipedCandidates);
        setCandidates(unswipedCandidates);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load swipe data');
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  // Handle swipe gesture
  const handleSwipe = async (direction, candidate) => {
    const isLike = direction === 'right';
    await submitSwipe(candidate.id, isLike);
  };

  // Handle button swipe
  const handleButtonSwipe = async (isLike) => {
    const currentCandidate = candidates[currentIndex];
    if (!currentCandidate) return;
    
    await submitSwipe(currentCandidate.id, isLike);
  };

  // Submit swipe to API
  const submitSwipe = async (candidateId, isLike) => {
    try {
      const swipeData = {};
      if (isLike !== null) {
        swipeData.is_like = isLike;
      }
      
      await swipesAPI.castSwipe(candidateId, swipeData);
      
      // Add to history for undo functionality
      setSwipeHistory([...swipeHistory, { candidateId, isLike, index: currentIndex }]);
      
      // Show success toast
      const swipeType = isLike ? 'liked' : 'passed';
      setToast({ message: `Swipe submitted: ${swipeType}`, type: 'success' });
      
      // Move to next candidate
      setCurrentIndex(currentIndex + 1);
    } catch (err) {
      console.error('Error submitting swipe:', err);
      setToast({ message: err.message || 'Failed to submit swipe', type: 'error' });
    }
  };

  // Handle undo last swipe
  const handleUndo = async () => {
    if (swipeHistory.length === 0) return;
    
    const lastSwipe = swipeHistory[swipeHistory.length - 1];
    
    try {
      // Delete the swipe from the database
      await swipesAPI.deleteSwipe(lastSwipe.candidateId);
      
      // Go back to the previous candidate
      setCurrentIndex(lastSwipe.index);
      setSwipeHistory(swipeHistory.slice(0, -1));
      
      setToast({ message: 'Swipe undone', type: 'success' });
    } catch (err) {
      console.error('Error undoing swipe:', err);
      setToast({ message: err.message || 'Failed to undo swipe', type: 'error' });
    }
  };

  // Calculate progress
  const totalCandidates = candidates.length;
  const swipedCandidates = currentIndex;
  const progressPercentage = totalCandidates > 0 ? (swipedCandidates / totalCandidates) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-400">Loading candidates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold mb-2">Error</h2>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button 
            onClick={() => navigate(`/sessions/${sessionId}`)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Back to Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            className="text-zinc-400 hover:text-white transition-colors"
            onClick={() => navigate(`/sessions/${sessionId}`)}
          >
            ← Back
          </button>
          <h1 className="text-white font-semibold truncate">{session?.title || 'Swipe on Candidates'}</h1>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-zinc-500 text-sm mt-2 text-center">
            {swipedCandidates} / {totalCandidates} candidates swiped
          </div>
        </div>

        {/* Swipe card stack */}
        <SwipeCardStack
          candidates={candidates}
          currentIndex={currentIndex}
          onSwipe={handleSwipe}
        />

        {/* Vote buttons */}
        {currentIndex < candidates.length && (
          <div className="flex justify-center gap-8 mt-6">
            <button 
              className="w-16 h-16 flex flex-col items-center justify-center bg-zinc-900 hover:bg-red-900/50 border-2 border-zinc-700 hover:border-red-500 rounded-full transition-all"
              onClick={() => handleButtonSwipe(false)}
            >
              <span className="text-2xl">✕</span>
              <span className="text-xs text-zinc-400 mt-0.5">Nope</span>
            </button>
            
            <button 
              className="w-16 h-16 flex flex-col items-center justify-center bg-zinc-900 hover:bg-emerald-900/50 border-2 border-zinc-700 hover:border-emerald-500 rounded-full transition-all"
              onClick={() => handleButtonSwipe(true)}
            >
              <span className="text-2xl text-rose-500">♥</span>
              <span className="text-xs text-zinc-400 mt-0.5">Like</span>
            </button>
          </div>
        )}

        {/* Undo button - show if there's history, even after all candidates swiped */}
        {swipeHistory.length > 0 && (
          <button 
            className="w-full mt-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
            onClick={handleUndo}
          >
            ↶ Undo
          </button>
        )}

        {/* Toast notifications */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}

export default SwipePage;
