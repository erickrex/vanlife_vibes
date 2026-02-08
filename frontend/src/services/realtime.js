const getWsBaseUrl = () => {
  const configured = import.meta.env.VITE_WS_BASE_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
  const apiUrl = new URL(apiBaseUrl);
  const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${apiUrl.host}`;
};

const getAuthToken = () => localStorage.getItem('authToken');

export const buildWsUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const token = getAuthToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${getWsBaseUrl()}${normalizedPath}${query}`;
};

export const createRealtimeSocket = ({
  path,
  onOpen,
  onMessage,
  onClose,
  onError,
  shouldReconnect = true,
}) => {
  let socket = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let manuallyClosed = false;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    clearReconnectTimer();
    const url = buildWsUrl(path);
    socket = new WebSocket(url);

    socket.onopen = (event) => {
      reconnectAttempts = 0;
      if (onOpen) onOpen(event);
    };

    socket.onmessage = (event) => {
      let parsed = null;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        parsed = null;
      }
      if (onMessage && parsed) onMessage(parsed);
    };

    socket.onerror = (event) => {
      if (onError) onError(event);
    };

    socket.onclose = (event) => {
      if (onClose) onClose(event);
      if (manuallyClosed || !shouldReconnect) return;

      reconnectAttempts += 1;
      const delay = Math.min(1000 * (2 ** Math.min(reconnectAttempts, 4)), 10000);
      reconnectTimer = window.setTimeout(() => {
        connect();
      }, delay);
    };
  };

  const disconnect = () => {
    manuallyClosed = true;
    clearReconnectTimer();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, 'Client disconnect');
    } else if (socket) {
      socket.close();
    }
  };

  return {
    connect,
    disconnect,
    sendJson: (payload) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(payload));
      return true;
    },
    isConnected: () => !!socket && socket.readyState === WebSocket.OPEN,
  };
};

