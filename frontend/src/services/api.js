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
        // Check for common DRF error formats
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
        } else if (data.group_name) {
          // Field-specific errors
          errorMessage = Array.isArray(data.group_name) 
            ? data.group_name[0] 
            : data.group_name;
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

// Groups API
export const groupsAPI = {
  list: () => api.get('/groups/'),
  create: (groupData) => api.post('/groups/', groupData),
  get: (groupId) => api.get(`/groups/${groupId}/`),
  listMembers: (groupId) => api.get(`/groups/${groupId}/members/`),
  inviteMember: (groupId, userData) => api.post(`/groups/${groupId}/members/`, userData),
  updateMembership: (groupId, userId, data) => api.patch(`/groups/${groupId}/members/${userId}/`, data),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}/`),
  
  // Join request methods
  createJoinRequest: (groupName) => api.post('/groups/join-request/', { group_name: groupName }),
  listMyRequests: () => api.get('/groups/my-requests/'),
  manageMyRequest: (requestId, action) => api.patch(`/groups/my-requests/${requestId}/`, { action }),
  
  // Invitation methods
  listMyInvitations: () => api.get('/groups/my-invitations/'),
  manageMyInvitation: (invitationId, action) => api.patch(`/groups/my-invitations/${invitationId}/`, { action }),
  
  // Admin management methods
  listGroupJoinRequests: (groupId) => api.get(`/groups/${groupId}/join-requests/`),
  manageJoinRequest: (groupId, requestId, action) => api.patch(`/groups/${groupId}/join-requests/${requestId}/`, { action }),
  listRejectedInvitations: (groupId) => api.get(`/groups/${groupId}/rejected-invitations/`),
  manageRejectedInvitation: (groupId, invitationId, action) => api.patch(`/groups/${groupId}/rejected-invitations/${invitationId}/`, { action }),
  listRejectedRequests: (groupId) => api.get(`/groups/${groupId}/rejected-requests/`),
  manageRejectedRequest: (groupId, requestId, action) => api.patch(`/groups/${groupId}/rejected-requests/${requestId}/`, { action }),
};

// Sessions API
export const sessionsAPI = {
  create: (sessionData) => api.post('/sessions/', sessionData),
  get: (sessionId) => api.get(`/sessions/${sessionId}/`),
  update: (sessionId, data) => api.patch(`/sessions/${sessionId}/`, data),
  listByGroup: (groupId) => api.get(`/groups/${groupId}/sessions/`),
  shareWithGroup: (sessionId, groupId) => api.post(`/sessions/${sessionId}/share-group/`, { group_id: groupId }),
  listMatches: (sessionId) => api.get(`/sessions/${sessionId}/matches/`),
};

// Candidates API
export const candidatesAPI = {
  list: (sessionId, params = {}) => api.get(`/sessions/${sessionId}/candidates/`, { params }),
  create: (sessionId, candidateData) => api.post(`/sessions/${sessionId}/candidates/`, candidateData),
  update: (candidateId, data) => api.patch(`/candidates/${candidateId}/`, data),
  delete: (candidateId) => api.delete(`/candidates/${candidateId}/`),
  tagCandidate: (candidateId, termId) => api.post(`/candidates/${candidateId}/terms/${termId}/`),
  untagCandidate: (candidateId, termId) => api.delete(`/candidates/${candidateId}/terms/${termId}/`),
};

// Swipes API
export const swipesAPI = {
  castSwipe: (candidateId, swipeData) => api.post(`/swipes/candidates/${candidateId}/swipes/`, swipeData),
  getMySwipe: (candidateId) => api.get(`/swipes/candidates/${candidateId}/swipes/me/`),
  getSwipeSummary: (candidateId) => api.get(`/swipes/candidates/${candidateId}/swipes/summary/`),
  deleteSwipe: (candidateId) => api.delete(`/swipes/candidates/${candidateId}/swipes/`),
};

// Taxonomies API
export const taxonomiesAPI = {
  list: () => api.get('/taxonomies/'),
  create: (taxonomyData) => api.post('/taxonomies/', taxonomyData),
  listTerms: (taxonomyId) => api.get(`/taxonomies/${taxonomyId}/terms/`),
  createTerm: (taxonomyId, termData) => api.post(`/taxonomies/${taxonomyId}/terms/`, termData),
};

// Questionnaires API
export const questionnairesAPI = {
  listQuestions: (params) => api.get('/questions/', { params }),
  submitAnswer: (answerData) => api.post('/answers/submit/', answerData),
};

// Match chat API
export const matchMessagesAPI = {
  list: (matchId) =>
    api.get('/match-messages/', {
      params: { match_id: matchId },
    }),
  create: (matchId, content) =>
    api.post('/match-messages/', { match: matchId, content }),
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
  
  // In-town windows methods (Requirements 6.1, 6.2)
  getInTownWindows: () => api.get('/profiles/me/in-town-windows/'),
  createInTownWindow: (data) => api.post('/profiles/me/in-town-windows/', data),
  deleteInTownWindow: (id) => api.delete(`/profiles/me/in-town-windows/${id}/`),
  
  // Profile prompts methods (Requirements 5.3, 5.4, 5.5)
  getPrompts: () => api.get('/profiles/me/prompts/'),
  createPrompt: (data) => api.post('/profiles/me/prompts/', data),
  deletePrompt: (id) => api.delete(`/profiles/me/prompts/${id}/`),
  getAvailablePrompts: () => api.get('/profiles/prompts/available/'),
};

// Locations API
export const locationsAPI = {
  getCountries: () => api.get('/locations/countries/'),
  getRegions: (countryId) => {
    if (countryId) {
      return api.get('/locations/regions/', { params: { country: countryId } });
    }
    return api.get('/locations/regions/');
  },
  getCities: (query = '') => api.get('/locations/cities/', { params: query ? { q: query } : {} }),
};

// Feed API
export const feedAPI = {
  getNearbyFeed: () => api.get('/feed/nearby/'),
};

// Discovery API (Requirements 7.1, 7.2, 8.1, 8.2)
export const discoveryAPI = {
  // Get profiles for dating mode discovery
  getDatingProfiles: (params = {}) => api.get('/discovery/dating/', { params }),
  // Get profiles for friends mode discovery
  getFriendsProfiles: (params = {}) => api.get('/discovery/friends/', { params }),
  // Record a swipe (like/pass) on a profile
  swipe: (data) => api.post('/discovery/swipe/', data),
};

// Person Matches API (Requirements 10.1, 10.3, 10.4, 10.5, 10.6, 12.6)
export const matchesAPI = {
  // List user's matches
  list: () => api.get('/matches/'),
  // Get match details
  get: (matchId) => api.get(`/matches/${matchId}/`),
  // Unmatch (delete match)
  unmatch: (matchId) => api.delete(`/matches/${matchId}/`),
  // Report user
  report: (matchId, data) => api.post(`/matches/${matchId}/report/`, data),
  // List messages in match
  getMessages: (matchId) => api.get(`/matches/${matchId}/messages/`),
  // Send message
  sendMessage: (matchId, content) => api.post(`/matches/${matchId}/messages/`, { content }),
  // Share mini-card
  shareMiniCard: (matchId, data) => api.post(`/matches/${matchId}/messages/mini-card/`, data),
};

// Plans API (Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 12.8, 12.9)
export const plansAPI = {
  // List available plans
  list: (params = {}) => api.get('/plans/', { params }),
  // Create a new plan
  create: (data) => api.post('/plans/', data),
  // Get plan details
  get: (planId) => api.get(`/plans/${planId}/`),
  // Update plan
  update: (planId, data) => api.patch(`/plans/${planId}/`, data),
  // Cancel/delete plan
  cancel: (planId) => api.delete(`/plans/${planId}/`),
  // Join plan
  join: (planId) => api.post(`/plans/${planId}/join/`),
  // Leave plan
  leave: (planId) => api.post(`/plans/${planId}/leave/`),
  // Confirm attendance
  confirm: (planId) => api.post(`/plans/${planId}/confirm/`),
  // Get plan group chat messages
  getMessages: (planId) => api.get(`/plans/${planId}/messages/`),
  // Send message to plan group chat
  sendMessage: (planId, content) => api.post(`/plans/${planId}/messages/`, { content }),
};

// Activities API (Requirements 13.1-13.8)
export const activitiesAPI = {
  // List nearby open activities for swiping (Requirement 13.1)
  list: (params = {}) => api.get('/activities/', { params }),
  // Create a new activity (Requirement 13.2)
  create: (data) => api.post('/activities/', data),
  // Get activity details (Requirement 13.3)
  get: (id) => api.get(`/activities/${id}/`),
  // Swipe on an activity (Requirement 13.4)
  swipe: (id, isLike) => api.post(`/activities/${id}/swipe/`, { is_like: isLike }),
  // List activities created by the user (Requirement 13.5)
  getMyActivities: () => api.get('/activities/my-activities/'),
  // List activities the user has matched on (Requirement 13.6)
  getMyMatches: () => api.get('/activities/my-matches/'),
  // Get messages for a matched activity (Requirement 13.7)
  getMessages: (id) => api.get(`/activities/${id}/messages/`),
  // Send a message to a matched activity chat (Requirement 13.8)
  sendMessage: (id, content) => api.post(`/activities/${id}/messages/`, { content }),
};

// Friends API (Requirements 14.1-14.8)
export const friendsAPI = {
  // Send a friend request (Requirement 14.1)
  sendFriendRequest: (toUserId) => api.post('/friends/request/', { to_user_id: toUserId }),
  // List pending friend requests - sent and received (Requirement 14.2)
  listFriendRequests: () => api.get('/friends/requests/'),
  // Accept a friend request (Requirement 14.3)
  acceptFriendRequest: (requestId) => api.post(`/friends/requests/${requestId}/accept/`),
  // Decline a friend request (Requirement 14.4)
  declineFriendRequest: (requestId) => api.post(`/friends/requests/${requestId}/decline/`),
  // List all friendships for the current user (Requirement 14.5)
  listFriends: () => api.get('/friends/'),
  // Get messages in a friendship chat (Requirement 14.6)
  getFriendMessages: (friendshipId) => api.get(`/friends/${friendshipId}/messages/`),
  // Send a message to a friend (Requirement 14.7)
  sendFriendMessage: (friendshipId, content) => api.post(`/friends/${friendshipId}/messages/`, { content }),
  // Remove a friendship (Requirement 14.8)
  deleteFriendship: (friendshipId) => api.delete(`/friends/${friendshipId}/`),
};

export default api;
