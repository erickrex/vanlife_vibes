import axios from 'axios';
import Constants from 'expo-constants';
import { clearAuthToken, getAuthToken } from '../storage/authToken';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.expoGoConfig?.debuggerHost ||
    Constants?.manifest?.debuggerHost ||
    '';
  const expoHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
  const isPrivateIpv4 = (host) =>
    /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(
      host
    );
  const shouldRewriteLocalhost = isPrivateIpv4(expoHost);
  const resolved = expoHost
    ? configured.replace(
        /\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?/i,
        (_, port) => (shouldRewriteLocalhost ? `//${expoHost}${port ? `:${port}` : ''}` : _)
      )
    : configured;
  return resolved.replace(/\/$/, '');
}

const apiBaseUrl = getApiBaseUrl();
export const API_BASE_URL = apiBaseUrl;

// Create axios instance with base configuration
const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
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
  async (error) => {
    if (error.response) {
      // Handle 401 Unauthorized - token expired or invalid
      if (error.response.status === 401) {
        await clearAuthToken();
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }

      // Extract error message from various DRF error formats
      let errorMessage = 'An error occurred';
      const data = error.response.data;

      if (data) {
        if (data.errors && typeof data.errors === 'object') {
          const errorMessages = [];
          for (const [field, messages] of Object.entries(data.errors)) {
            const fieldErrors = Array.isArray(messages) ? messages : [messages];
            const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            fieldErrors.forEach((msg) => {
              if (typeof msg !== 'string') return;
              if (msg.toLowerCase().includes(field.toLowerCase())) {
                errorMessages.push(msg);
              } else {
                errorMessages.push(`${fieldName}: ${msg}`);
              }
            });
          }
          if (errorMessages.length > 0) {
            errorMessage = errorMessages.join('. ');
          }
        } else if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message && data.message !== 'Registration failed' && data.message !== 'Invalid credentials') {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.non_field_errors) {
          errorMessage = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else if (data.username) {
          errorMessage = Array.isArray(data.username) ? data.username[0] : data.username;
        } else if (data.message) {
          errorMessage = data.message;
        } else {
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
    return Promise.reject(
      new Error(
        `Network error. Could not reach API at ${apiBaseUrl}. Ensure Django is running with: uv run python manage.py runserver 0.0.0.0:8000`
      )
    );
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

  // In-town windows methods
  getInTownWindows: () => api.get('/profiles/me/in-town-windows/'),
  createInTownWindow: (data) => api.post('/profiles/me/in-town-windows/', data),
  deleteInTownWindow: (id) => api.delete(`/profiles/me/in-town-windows/${id}/`),

  // Profile prompts methods
  getPrompts: () => api.get('/profiles/me/prompts/'),
  createPrompt: (data) => api.post('/profiles/me/prompts/', data),
  deletePrompt: (id) => api.delete(`/profiles/me/prompts/${id}/`),
  getAvailablePrompts: () => api.get('/profiles/prompts/available/'),

  // Profile photo methods
  uploadPhoto: (formData) =>
    api.post('/profiles/me/photos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getPhotos: () => api.get('/profiles/me/photos/'),
  deletePhoto: (id) => api.delete(`/profiles/me/photos/${id}/`),
  updatePhotoOrder: (id, displayOrder) =>
    api.patch(`/profiles/me/photos/${id}/update/`, { display_order: displayOrder }),
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
  sendIcebreaker: (matchId, content) => api.post(`/matches/${matchId}/messages/icebreaker/`, { content }),
};

// Events API (unified Plan + Activity)
export const eventsAPI = {
  list: (params = {}) => api.get('/events/', { params }),
  create: (data) => api.post('/events/', data),
  get: (eventId) => api.get(`/events/${eventId}/`),
  update: (eventId, data) => api.patch(`/events/${eventId}/`, data),
  cancel: (eventId) => api.delete(`/events/${eventId}/`),
  join: (eventId) => api.post(`/events/${eventId}/join/`),
  leave: (eventId) => api.post(`/events/${eventId}/leave/`),
  confirm: (eventId) => api.post(`/events/${eventId}/confirm/`),
  swipe: (eventId, isLike) => api.post(`/events/${eventId}/swipe/`, { is_like: isLike }),
  getMessages: (eventId) => api.get(`/events/${eventId}/messages/`),
  sendMessage: (eventId, content) => api.post(`/events/${eventId}/messages/`, { content }),
  getMyEvents: () => api.get('/events/my-events/'),
  getMyMatches: () => api.get('/events/my-matches/'),
};

// Subscription API
export const subscriptionAPI = {
  getStatus: () => api.get('/subscription/status/'),
  sync: (customerInfo, entitlementId = 'premium') =>
    api.post('/subscription/sync/', {
      customer_info: customerInfo,
      entitlement_id: entitlementId,
    }),
};

// Builder Marketplace API
export const builderAPI = {
  list: (params = {}) => api.get('/builder/', { params }),
  create: (data) => api.post('/builder/', data),
  get: (id) => api.get(`/builder/${id}/`),
  update: (id, data) => api.patch(`/builder/${id}/`, data),
  remove: (id) => api.delete(`/builder/${id}/`),
  myListings: () => api.get('/builder/my-listings/'),
  getMessages: (listingId, recipientId = null) =>
    api.get(`/builder/${listingId}/messages/`, {
      params: recipientId ? { recipient_id: recipientId } : undefined,
    }),
  sendMessage: (listingId, content, recipientId = null) => {
    const body = { content };
    if (recipientId) body.recipient_id = recipientId;
    return api.post(`/builder/${listingId}/messages/`, body);
  },
  getConversations: (listingId) => api.get(`/builder/${listingId}/conversations/`),
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
