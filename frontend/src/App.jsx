import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
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
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <main className="main-content">
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
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
