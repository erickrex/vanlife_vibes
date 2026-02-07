import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, profilesAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshProfile = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }
    try {
      setProfileLoading(true);
      const response = await profilesAPI.getMyProfile();
      const profileData = response.data.data || response.data;
      setProfile(profileData);
      return profileData;
    } catch {
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  // Check if user is authenticated on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Fetch current user data
      authAPI.getCurrentUser()
        .then(response => {
          // Backend returns: { status: 'success', data: { user data } }
          const userData = response.data.data || response.data;
          setUser(userData);
          return refreshProfile();
        })
        .catch(() => {
          // Token is invalid, clear it
          localStorage.removeItem('authToken');
          setProfile(null);
          setLoading(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);
      // Backend returns: { status: 'success', data: { token, user } }
      const { token, user: userData } = response.data.data || response.data;
      
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      setUser(userData);
      await refreshProfile();
      
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const signup = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.signup(userData);
      // Backend returns: { status: 'success', data: { token, user } }
      const { token, user: newUser } = response.data.data || response.data;
      
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      setUser(newUser);
      await refreshProfile();
      
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Signup failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      // Ignore logout errors
    } finally {
      // Clear token and user state
      localStorage.removeItem('authToken');
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    profileLoading,
    error,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
