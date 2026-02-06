import React from 'react';

function SkeletonLoader({ type = 'card', count = 3 }) {
  if (type === 'card') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-32 bg-zinc-800 rounded"></div>
              <div className="h-5 w-16 bg-zinc-800 rounded"></div>
            </div>
            <div className="h-4 w-48 bg-zinc-800 rounded mb-4"></div>
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-zinc-800 rounded"></div>
              <div className="h-8 w-20 bg-zinc-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg animate-pulse">
            <div className="w-10 h-10 bg-zinc-800 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 w-24 bg-zinc-800 rounded mb-2"></div>
              <div className="h-3 w-32 bg-zinc-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-zinc-800 rounded-t-xl"></div>
        <div className="px-4 pb-4">
          <div className="w-20 h-20 bg-zinc-800 rounded-full -mt-10 border-4 border-black"></div>
          <div className="mt-4 space-y-3">
            <div className="h-6 w-32 bg-zinc-800 rounded"></div>
            <div className="h-4 w-48 bg-zinc-800 rounded"></div>
            <div className="h-4 w-full bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default SkeletonLoader;
