import { io } from 'socket.io-client';

const resolveSocketBaseUrl = () => {
  const explicit = String(process.env.REACT_APP_SOCKET_URL || '').trim();
  if (explicit) return explicit;

  const apiBase = String(process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim();
  return apiBase.replace(/\/api\/?$/, '');
};

let socketClient = null;

export const connectNotificationSocket = (token) => {
  if (!token) return null;

  if (socketClient) {
    return socketClient;
  }

  socketClient = io(resolveSocketBaseUrl(), {
    transports: ['websocket'],
    auth: {
      token,
    },
  });

  return socketClient;
};

export const getNotificationSocket = () => socketClient;

export const disconnectNotificationSocket = () => {
  if (!socketClient) return;
  socketClient.disconnect();
  socketClient = null;
};
