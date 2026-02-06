import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import TabNavigation from './components/TabNavigation';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import CreateSessionPage from './pages/CreateSessionPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SwipePage from './pages/SwipePage';
import MatchesPage from './pages/MatchesPage';
import CandidateManagementPage from './pages/CandidateManagementPage';
import ProfilePage from './pages/ProfilePage';
import ProfileEditPage from './pages/ProfileEditPage';
import NearbyFeedPage from './pages/NearbyFeedPage';
import DiscoveryPage from './pages/DiscoveryPage';
import PersonMatchesPage from './pages/PersonMatchesPage';
import PlansPage from './pages/PlansPage';
import PlanDetailPage from './pages/PlanDetailPage';
import CreatePlanPage from './pages/CreatePlanPage';
import FriendRequestsPage from './pages/FriendRequestsPage';
import FriendChatPage from './pages/FriendChatPage';
import DatingPage from './pages/DatingPage';
import ActivitiesPage from './pages/ActivitiesPage';
import CreateActivityPage from './pages/CreateActivityPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import ActivityChatPage from './pages/ActivityChatPage';

/**
 * Determines the active tab based on the current route path.
 * Returns null if the current route is not a main tab route.
 * 
 * @param {string} pathname - The current route pathname
 * @returns {'feed' | 'dating' | 'activities' | null} The active tab or null
 */
function getActiveTabFromPath(pathname) {
  if (pathname.startsWith('/feed')) return 'feed';
  if (pathname.startsWith('/dating')) return 'dating';
  if (pathname.startsWith('/activities')) return 'activities';
  return null;
}

/**
 * Routes that should show the TabNavigation.
 * These are the main tab routes where the bottom navigation should persist.
 * Requirements: 1.3 - Tab navigation persists across all authenticated screens within the three main tabs
 */
const TAB_ROUTES = ['/feed', '/dating', '/activities'];

/**
 * Checks if the current path should show the TabNavigation.
 * 
 * @param {string} pathname - The current route pathname
 * @returns {boolean} Whether to show the tab navigation
 */
function shouldShowTabNavigation(pathname) {
  return TAB_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * AppContent Component
 * 
 * Inner component that handles the main app layout including conditional
 * rendering of TabNavigation based on authentication state and current route.
 * 
 * Requirements:
 * - 1.2: When a user taps a tab, switch to that tab's content and highlight the active tab
 * - 1.3: Tab navigation persists across all authenticated screens within the three main tabs
 * - 1.4: When a user is not authenticated, the tab navigation shall not be displayed
 */
function AppContent() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  const activeTab = getActiveTabFromPath(location.pathname);
  const showTabNav = isAuthenticated && shouldShowTabNavigation(location.pathname);

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-black">
      <Navigation />
      <main className={`flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:py-8 ${showTabNav ? 'pb-20' : ''}`}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Protected routes */}
          <Route 
            path="/groups" 
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/groups/:groupId" 
            element={
              <ProtectedRoute>
                <GroupDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/groups/:groupId/sessions/new" 
            element={
              <ProtectedRoute>
                <CreateSessionPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sessions/:sessionId" 
            element={
              <ProtectedRoute>
                <SessionDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sessions/:sessionId/swipe" 
            element={
              <ProtectedRoute>
                <SwipePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sessions/:sessionId/matches" 
            element={
              <ProtectedRoute>
                <MatchesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sessions/:sessionId/candidates" 
            element={
              <ProtectedRoute>
                <CandidateManagementPage />
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
          
          {/* Discovery route (Requirements 7.1, 8.1) */}
          <Route 
            path="/discover" 
            element={
              <ProtectedRoute>
                <DiscoveryPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Dating route (Requirements 4.1, 4.2) */}
          <Route 
            path="/dating" 
            element={
              <ProtectedRoute>
                <DatingPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Person Matches route (Requirements 10.1, 12.6) */}
          <Route 
            path="/matches" 
            element={
              <ProtectedRoute>
                <PersonMatchesPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Plans routes (Requirements 11.1, 11.2, 11.3, 11.4, 11.5) */}
          <Route 
            path="/plans" 
            element={
              <ProtectedRoute>
                <PlansPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/plans/create" 
            element={
              <ProtectedRoute>
                <CreatePlanPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/plans/:planId" 
            element={
              <ProtectedRoute>
                <PlanDetailPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Friend Requests route (Requirements 14.2, 14.3, 14.4) */}
          <Route 
            path="/friends" 
            element={
              <ProtectedRoute>
                <FriendRequestsPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Friend Chat route (Requirements 3.6, 14.6, 14.7) */}
          <Route 
            path="/friends/:friendshipId/chat" 
            element={
              <ProtectedRoute>
                <FriendChatPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Activities routes (Requirements 5.1-5.7, 9.1-9.6) */}
          <Route 
            path="/activities" 
            element={
              <ProtectedRoute>
                <ActivitiesPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Create Activity route (Requirements 6.1-6.7) */}
          <Route 
            path="/activities/create" 
            element={
              <ProtectedRoute>
                <CreateActivityPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Activity Detail route (Requirement 5.6) */}
          <Route 
            path="/activities/:id" 
            element={
              <ProtectedRoute>
                <ActivityDetailPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Activity Chat route (Requirements 8.1-8.5) */}
          <Route 
            path="/activities/:id/chat" 
            element={
              <ProtectedRoute>
                <ActivityChatPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Legacy URL redirects (Requirement 10.4) */}
          {/* Redirect any unmatched /groups/* paths to /activities */}
          <Route 
            path="/groups/*" 
            element={<Navigate to="/activities" replace />} 
          />
          {/* Redirect any unmatched /sessions/* paths to /activities */}
          <Route 
            path="/sessions/*" 
            element={<Navigate to="/activities" replace />} 
          />
        </Routes>
      </main>
      
      {/* Tab Navigation - Requirements 1.2, 1.3, 1.4 */}
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
