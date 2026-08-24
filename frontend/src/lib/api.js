// ✅ frontend/src/lib/api.js
// API helper functions for making requests to the backend

const API_BASE = '/api';

/**
 * Admin API fetch - for admin-only operations
 * Used by ChatRoom.jsx and other admin components
 */
export const adminFetch = async (endpoint, options = {}) => {
  try {
    const url = `${API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || 
        `API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('adminFetch error:', error);
    throw error;
  }
};

/**
 * Upload media files (images, videos, audio, etc.)
 * Sends file as multipart/form-data to /api/upload
 */
export const uploadMedia = async (file) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || 
        `Upload failed: ${response.status}`
      );
    }

    const data = await response.json();
    return data; // Should contain: { url, filename, size, type, etc. }
  } catch (error) {
    console.error('uploadMedia error:', error);
    throw error;
  }
};

// ========== Room Operations ==========

export const getRoom = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}`);
};

export const createRoom = async (roomData) => {
  return adminFetch('/rooms', {
    method: 'POST',
    body: roomData,
  });
};

export const updateRoom = async (roomCode, updates) => {
  return adminFetch(`/rooms/${roomCode}`, {
    method: 'PUT',
    body: updates,
  });
};

export const deleteRoom = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}`, {
    method: 'DELETE',
  });
};

export const getRoomMembers = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}/members`);
};

export const getRoomMessages = async (roomCode, limit = 50, offset = 0) => {
  return adminFetch(`/rooms/${roomCode}/messages?limit=${limit}&offset=${offset}`);
};

// ========== Message Operations ==========

export const sendMessage = async (roomCode, messageData) => {
  return adminFetch(`/rooms/${roomCode}/messages`, {
    method: 'POST',
    body: messageData,
  });
};

export const editMessage = async (roomCode, messageId, content) => {
  return adminFetch(`/rooms/${roomCode}/messages/${messageId}`, {
    method: 'PUT',
    body: { content },
  });
};

export const deleteMessage = async (roomCode, messageId) => {
  return adminFetch(`/rooms/${roomCode}/messages/${messageId}`, {
    method: 'DELETE',
  });
};

// ========== Join Requests ==========

export const submitJoinRequest = async (roomCode, nickname) => {
  return adminFetch(`/rooms/${roomCode}/join-request`, {
    method: 'POST',
    body: { nickname },
  });
};

export const getPendingJoinRequests = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}/join-requests`);
};

export const respondToJoinRequest = async (roomCode, requestId, approve) => {
  return adminFetch(`/rooms/${roomCode}/join-request/${requestId}`, {
    method: 'POST',
    body: { approve },
  });
};

// ========== Music Operations ==========

export const searchMusic = async (query, provider = 'spotify') => {
  return adminFetch('/music/search', {
    method: 'POST',
    body: { query, provider },
  });
};

export const playMusic = async (roomCode, musicData) => {
  return adminFetch(`/rooms/${roomCode}/music/play`, {
    method: 'POST',
    body: musicData,
  });
};

export const pauseMusic = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}/music/pause`, {
    method: 'POST',
  });
};

export const nextTrack = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}/music/next`, {
    method: 'POST',
  });
};

export const previousTrack = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}/music/previous`, {
    method: 'POST',
  });
};

export const setVolume = async (roomCode, volume) => {
  return adminFetch(`/rooms/${roomCode}/music/volume`, {
    method: 'POST',
    body: { volume },
  });
};

export const getPlaylistSongs = async (roomCode) => {
  return adminFetch(`/rooms/${roomCode}/music/playlist`);
};

export const addToPlaylist = async (roomCode, song) => {
  return adminFetch(`/rooms/${roomCode}/music/playlist`, {
    method: 'POST',
    body: song,
  });
};

export const removeFromPlaylist = async (roomCode, songId) => {
  return adminFetch(`/rooms/${roomCode}/music/playlist/${songId}`, {
    method: 'DELETE',
  });
};

// ========== User/Admin Operations ==========

export const kickUser = async (roomCode, userId) => {
  return adminFetch(`/rooms/${roomCode}/members/${userId}`, {
    method: 'DELETE',
  });
};

export const promoteToAdmin = async (roomCode, userId) => {
  return adminFetch(`/rooms/${roomCode}/members/${userId}/promote`, {
    method: 'POST',
  });
};

export const demoteFromAdmin = async (roomCode, userId) => {
  return adminFetch(`/rooms/${roomCode}/members/${userId}/demote`, {
    method: 'POST',
  });
};

// ========== Reactions & Interactions ==========

export const addReaction = async (roomCode, messageId, emoji) => {
  return adminFetch(`/rooms/${roomCode}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { emoji },
  });
};

export const removeReaction = async (roomCode, messageId, emoji) => {
  return adminFetch(`/rooms/${roomCode}/messages/${messageId}/reactions/${emoji}`, {
    method: 'DELETE',
  });
};

// ========== Utility Functions ==========

/**
 * Check if API is reachable
 */
export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get API configuration or version info
 */
export const getApiInfo = async () => {
  try {
    return await adminFetch('/info');
  } catch {
    return null;
  }
};

/**
 * Handle API errors with user-friendly messages
 */
export const handleApiError = (error) => {
  if (error instanceof TypeError) {
    return 'Network error - cannot reach server';
  }
  if (error.message.includes('401')) {
    return 'Unauthorized - please check your access';
  }
  if (error.message.includes('403')) {
    return 'Forbidden - you do not have permission';
  }
  if (error.message.includes('404')) {
    return 'Not found - this resource does not exist';
  }
  if (error.message.includes('500')) {
    return 'Server error - please try again later';
  }
  return error.message || 'An error occurred';
};
