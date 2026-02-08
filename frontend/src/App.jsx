import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import TabNavigation from './components/TabNavigation';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ProfileEditPage from './pages/ProfileEditPage';
import NearbyFeedPage from './pages/NearbyFeedPage';
import DiscoveryPage from './pages/DiscoveryPage';
import PersonMatchesPage from './pages/PersonMatchesPage';
import FriendRequestsPage from './pages/FriendRequestsPage';
import FriendChatPage from './pages/FriendChatPage';
import DatingPage from './pages/DatingPage';
import EventsPage from './pages/EventsPage';
import CreateEventPage from './pages/CreateEventPage';
import EventDetailPage from './pages/EventDetailPage';
import EventChatPage from './pages/EventChatPage';
import OnboardingPage from './pages/OnboardingPage';
import SignupPage from './pages/SignupPage';
import WelcomePage from './pages/WelcomePage';

/**
 * Determines the active tab based on the current route path.
 * Returns null if the current route is not a main tab route.
 * 
 * @param {string} pathname - The current route pathname
 * @returns {'feed' | 'dating' | 'activities' | null} The active tab or null
 */
function getActiveTabFromPath(pathname) {
  if (pathname.startsWith('/feed')) return 'feed';
  if (pathname.startsWith('/discover')) return 'feed';
  if (pathname.startsWith('/dating')) return 'dating';
  if (pathname.startsWith('/activities')) return 'activities';
  if (pathname.startsWith('/events')) return 'activities';
  return null;
}

/**
 * AppContent Component
 * 
 * Inner component that handles the main app layout including conditional
 * rendering of TabNavigation based on authentication state and current route.
 */
function AppContent() {
  const { isAuthenticated, loading, profile, profileLoading } = useAuth();
  const location = useLocation();
  
  const activeTab = getActiveTabFromPath(location.pathname);
  const showTabNav = isAuthenticated;
  const hideNavigation = location.pathname.startsWith('/onboarding');
  const needsOnboarding = isAuthenticated && profile && !profile.has_completed_onboarding;

  if (loading || (isAuthenticated && profileLoading)) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsOnboarding && location.pathname === '/onboarding') {
    const postOnboardingRoute = profile?.looking_for_dating ? '/dating' : '/feed';
    return <Navigate to={postOnboardingRoute} replace />;
  }
  

  return (
    <div className="app-shell flex flex-col relative overflow-x-hidden">
      {!hideNavigation && <Navigation />}
      <main className={`flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:py-8 ${showTabNav ? 'pb-20' : ''}`}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Protected routes */}
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/welcome"
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />
          
          {/* Profile routes */}
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile/edit" 
            element={
              <ProtectedRoute>
                <ProfileEditPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile/:id" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          
          {/* Feed route */}
          <Route 
            path="/feed" 
            element={
              <ProtectedRoute>
                <NearbyFeedPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Discovery route */}
          <Route 
            path="/discover" 
            element={
              <ProtectedRoute>
                <DiscoveryPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Dating route */}
          <Route 
            path="/dating" 
            element={
              <ProtectedRoute>
                <DatingPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Person Matches route */}
          <Route 
            path="/matches" 
            element={
              <ProtectedRoute>
                <PersonMatchesPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Friend Requests route */}
          <Route 
            path="/friends" 
            element={
              <ProtectedRoute>
                <FriendRequestsPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Friend Chat route */}
          <Route 
            path="/friends/:friendshipId/chat" 
            element={
              <ProtectedRoute>
                <FriendChatPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Events routes (unified Plan/Activity) */}
          <Route 
            path="/events" 
            element={
              <ProtectedRoute>
                <EventsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/events/create" 
            element={
              <ProtectedRoute>
                <CreateEventPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/events/:id" 
            element={
              <ProtectedRoute>
                <EventDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/events/:id/chat" 
            element={
              <ProtectedRoute>
                <EventChatPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Legacy URL redirects */}
          <Route 
            path="/plans/*" 
            element={<Navigate to="/events" replace />} 
          />
          <Route 
            path="/activities/*" 
            element={<Navigate to="/events" replace />} 
          />
          <Route 
            path="/groups/*" 
            element={<Navigate to="/events" replace />} 
          />
          <Route 
            path="/sessions/*" 
            element={<Navigate to="/events" replace />} 
          />
        </Routes>
      </main>
      
      {/* Tab Navigation */}
      {showTabNav && <TabNavigation activeTab={activeTab} />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
