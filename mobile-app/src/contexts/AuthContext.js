import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, profilesAPI, setUnauthorizedHandler } from '../services/api';
import { clearAuthToken, getAuthToken, setAuthToken } from '../storage/authToken';

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

  const clearSession = async () => {
    await clearAuthToken();
    setUser(null);
    setProfile(null);
    setProfileLoading(false);
  };

  const refreshProfile = async () => {
    const token = await getAuthToken();
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

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
  }, []);

  // Check if user is authenticated on mount
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const token = await getAuthToken();
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await authAPI.getCurrentUser();
        const userData = response.data.data || response.data;
        if (!isMounted) return;
        setUser(userData);
        await refreshProfile();
      } catch {
        await clearAuthToken();
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);
      const { token, user: userData } = response.data.data || response.data;

      await setAuthToken(token);
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
      const { token, user: newUser } = response.data.data || response.data;

      await setAuthToken(token);
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
    } catch {
      // Ignore logout errors.
    } finally {
      await clearSession();
    }
  };

  const value = useMemo(() => {
    return {
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
  }, [error, loading, profile, profileLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

