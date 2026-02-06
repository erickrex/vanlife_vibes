import usePullToRefresh from '../hooks/usePullToRefresh';

/**
 * PullToRefresh wrapper component for mobile lists
 * Provides visual feedback during pull-to-refresh gesture
 */
const PullToRefresh = ({ 
  onRefresh, 
  children, 
  enabled = true,
  threshold = 80 
}) => {
  const { 
    containerRef, 
    isPulling, 
    isRefreshing, 
    pullDistance,
    pullProgress 
  } = usePullToRefresh(onRefresh, { enabled, threshold });

  return (
    <div className="relative w-full h-full overflow-hidden">
      {(isPulling || isRefreshing) && (
        <div 
          className="absolute top-[-80px] left-0 right-0 h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-900/95 to-zinc-900/80 z-50 transition-opacity duration-200"
          style={{ 
            transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
            opacity: pullProgress / 100
          }}
        >
          <div className={`w-8 h-8 text-blue-400 transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''}`}>
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-full h-full"
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </div>
          <span className="text-sm font-medium text-zinc-400">
            {isRefreshing ? 'Refreshing...' : pullProgress >= 100 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full overflow-y-auto touch-pan-y">
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
