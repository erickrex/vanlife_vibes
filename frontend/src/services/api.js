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

export default api;
