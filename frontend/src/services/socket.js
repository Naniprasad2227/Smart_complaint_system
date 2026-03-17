import { io } from 'socket.io-client';

let socketClient = null;

const buildSocketBaseUrl = () => {
  const apiUrl = String(process.env.REACT_APP_API_URL || 'http://localhost:5000').trim();
  return apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
};

export const connectNotificationSocket = (token) => {
  if (!token) return null;
  if (socketClient) return socketClient;

  socketClient = io(buildSocketBaseUrl(), {
    auth: { token: String(token).replace(/^Bearer\s+/i, '') },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socketClient;
};

export const getNotificationSocket = () => socketClient || null;

export const disconnectNotificationSocket = () => {
  if (socketClient) {
    socketClient.disconnect();
  }
  socketClient = null;
};
