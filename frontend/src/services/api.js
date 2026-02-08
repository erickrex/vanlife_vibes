import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized - token expired or invalid
      if (error.response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
      
      // Extract error message from various DRF error formats
      let errorMessage = 'An error occurred';
      const data = error.response.data;
      
      if (data) {
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.non_field_errors) {
          errorMessage = Array.isArray(data.non_field_errors) 
            ? data.non_field_errors[0] 
            : data.non_field_errors;
        } else if (data.username) {
          errorMessage = Array.isArray(data.username) 
            ? data.username[0] 
            : data.username;
        } else {
          // Try to extract first field error
          const firstKey = Object.keys(data)[0];
          if (firstKey && data[firstKey]) {
            const fieldError = data[firstKey];
            errorMessage = Array.isArray(fieldError) ? fieldError[0] : fieldError;
          }
        }
      }
      
      return Promise.reject(new Error(errorMessage));
    }
    
    // Network error
    return Promise.reject(new Error('Network error. Please check your connection.'));
  }
);

// Authentication API
export const authAPI = {
  signup: (userData) => api.post('/auth/signup/', userData),
  login: (credentials) => api.post('/auth/login/', credentials),
  logout: () => api.post('/auth/logout/'),
  getCurrentUser: () => api.get('/auth/me/'),
};

// Profiles API
export const profilesAPI = {
  getMyProfile: () => api.get('/profiles/me/'),
  updateMyProfile: (data) => api.patch('/profiles/me/', data),
  getProfile: (id) => api.get(`/profiles/${id}/`),
  getHobbyTags: () => api.get('/profiles/hobbies/'),
  
  // Vehicle methods
  getMyVehicle: () => api.get('/profiles/me/vehicle/'),
  updateMyVehicle: (data) => api.put('/profiles/me/vehicle/', data),
  deleteMyVehicle: () => api.delete('/profiles/me/vehicle/'),
  uploadVehiclePhoto: (data) => api.post('/profiles/me/vehicle/photos/', data),
  deleteVehiclePhoto: (id) => api.delete(`/profiles/me/vehicle/photos/${id}/`),
  
  // Follow methods
  followUser: (id) => api.post(`/profiles/${id}/follow/`),
  unfollowUser: (id) => api.delete(`/profiles/${id}/follow/`),
  getFollowers: (id) => api.get(`/profiles/${id}/followers/`),
  getFollowing: (id) => api.get(`/profiles/${id}/following/`),
  startChat: (id, data) => api.post(`/profiles/${id}/chat/`, data),
  
  // In-town windows methods
  getInTownWindows: () => api.get('/profiles/me/in-town-windows/'),
  createInTownWindow: (data) => api.post('/profiles/me/in-town-windows/', data),
  deleteInTownWindow: (id) => api.delete(`/profiles/me/in-town-windows/${id}/`),
  
  // Profile prompts methods
  getPrompts: () => api.get('/profiles/me/prompts/'),
  createPrompt: (data) => api.post('/profiles/me/prompts/', data),
  deletePrompt: (id) => api.delete(`/profiles/me/prompts/${id}/`),
  getAvailablePrompts: () => api.get('/profiles/prompts/available/'),
};

// Locations API
export const locationsAPI = {
  getCountries: () => api.get('/locations/countries/'),
  getCities: (query = '') => api.get('/locations/cities/', { params: query ? { q: query } : {} }),
};

// Feed API
export const feedAPI = {
  getNearbyFeed: () => api.get('/feed/nearby/'),
};

// Discovery API
export const discoveryAPI = {
  getDatingProfiles: (params = {}) => api.get('/discovery/dating/', { params }),
  getFriendsProfiles: (params = {}) => api.get('/discovery/friends/', { params }),
  swipe: (data) => api.post('/discovery/swipe/', data),
};

// Person Matches API
export const matchesAPI = {
  list: () => api.get('/matches/'),
  get: (matchId) => api.get(`/matches/${matchId}/`),
  unmatch: (matchId) => api.delete(`/matches/${matchId}/`),
  report: (matchId, data) => api.post(`/matches/${matchId}/report/`, data),
  getMessages: (matchId) => api.get(`/matches/${matchId}/messages/`),
  sendMessage: (matchId, content) => api.post(`/matches/${matchId}/messages/`, { content }),
  shareMiniCard: (matchId, data) => api.post(`/matches/${matchId}/messages/mini-card/`, data),
};

// Events API (unified Plan + Activity)
export const eventsAPI = {
  // List events with optional filters (join_mode, event_type, location, from_date, to_date, status)
  list: (params = {}) => api.get('/events/', { params }),
  // Create a new event
  create: (data) => api.post('/events/', data),
  // Get event details
  get: (eventId) => api.get(`/events/${eventId}/`),
  // Update event (creator only)
  update: (eventId, data) => api.patch(`/events/${eventId}/`, data),
  // Cancel/delete event (creator only)
  cancel: (eventId) => api.delete(`/events/${eventId}/`),
  // Join event (direct mode only)
  join: (eventId) => api.post(`/events/${eventId}/join/`),
  // Leave event
  leave: (eventId) => api.post(`/events/${eventId}/leave/`),
  // Confirm attendance (direct mode)
  confirm: (eventId) => api.post(`/events/${eventId}/confirm/`),
  // Swipe on event (swipe mode only)
  swipe: (eventId, isLike) => api.post(`/events/${eventId}/swipe/`, { is_like: isLike }),
  // Get event messages
  getMessages: (eventId) => api.get(`/events/${eventId}/messages/`),
  // Send message to event chat
  sendMessage: (eventId, content) => api.post(`/events/${eventId}/messages/`, { content }),
  // Get user's created/attending events
  getMyEvents: () => api.get('/events/my-events/'),
  // Get user's matched swipe events
  getMyMatches: () => api.get('/events/my-matches/'),
};

// Friends API
export const friendsAPI = {
  sendFriendRequest: (toUserId) => api.post('/friends/request/', { to_user_id: toUserId }),
  listFriendRequests: () => api.get('/friends/requests/'),
  acceptFriendRequest: (requestId) => api.post(`/friends/requests/${requestId}/accept/`),
  declineFriendRequest: (requestId) => api.post(`/friends/requests/${requestId}/decline/`),
  listFriends: () => api.get('/friends/'),
  getFriendMessages: (friendshipId) => api.get(`/friends/${friendshipId}/messages/`),
  sendFriendMessage: (friendshipId, content) => api.post(`/friends/${friendshipId}/messages/`, { content }),
  deleteFriendship: (friendshipId) => api.delete(`/friends/${friendshipId}/`),
};

// Analytics API
export const analyticsAPI = {
  trackEvent: (eventName, metadata = {}) =>
    api.post('/analytics/events/', {
      event_name: eventName,
      metadata,
    }),
};

export default api;
