import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="px-4 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <p className="text-blue-500 text-sm font-medium mb-3">
            VanlifeVibes · Connect with nomads
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
            Find your tribe on the road
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed mb-6">
            VanlifeVibes connects van lifers, nomads, and travelers. Discover who is 
            nearby, plan meetups, and build lasting friendships with people who 
            share your love for life on the road.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link 
              to="/signup" 
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white text-center font-semibold rounded-lg transition-colors"
            >
              Get Started
            </Link>
            <Link 
              to="/login" 
              className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-white text-center font-semibold rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-8">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-start gap-4">
              <span className="text-2xl">📍</span>
              <div>
                <h2 className="text-white font-semibold mb-1">Location-Based Discovery</h2>
                <p className="text-zinc-400 text-sm">
                  See who is in your area now, next week, or next month. Connect with 
                  travelers whose paths cross yours.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-start gap-4">
              <span className="text-2xl">��</span>
              <div>
                <h2 className="text-white font-semibold mb-1">Show Off Your Rig</h2>
                <p className="text-zinc-400 text-sm">
                  Share your van build, RV setup, or travel style. Connect over 
                  shared interests and vehicle types.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-start gap-4">
              <span className="text-2xl">👋</span>
              <div>
                <h2 className="text-white font-semibold mb-1">Friends and Dating</h2>
                <p className="text-zinc-400 text-sm">
                  Looking for travel buddies or something more? Set your preferences 
                  and find like-minded nomads.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-8 border-t border-zinc-800">
        <div className="max-w-lg mx-auto">
          <h2 className="text-lg font-semibold text-white mb-6 text-center">
            Why VanlifeVibes?
          </h2>
          <div className="space-y-6">
            <article className="text-center">
              <h3 className="text-white font-medium mb-2">Built for Nomads</h3>
              <p className="text-zinc-500 text-sm">
                Unlike generic social apps, we understand the nomadic lifestyle. 
                Location timing, travel pace, and camping preferences matter here.
              </p>
            </article>
            <article className="text-center">
              <h3 className="text-white font-medium mb-2">Privacy First</h3>
              <p className="text-zinc-500 text-sm">
                Control who sees your profile and location. Share as much or as 
                little as you are comfortable with.
              </p>
            </article>
            <article className="text-center">
              <h3 className="text-white font-medium mb-2">Real Connections</h3>
              <p className="text-zinc-500 text-sm">
                No algorithms pushing content. Just real people, real rigs, and 
                real adventures waiting to happen.
              </p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
