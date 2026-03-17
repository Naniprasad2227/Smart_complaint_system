const noopSocket = {
  emit: () => {},
  on: () => {},
  off: () => {},
  disconnect: () => {},
};

let socketClient = null;

export const connectNotificationSocket = () => {
  if (!socketClient) {
    socketClient = noopSocket;
  }
  return socketClient;
};

export const getNotificationSocket = () => socketClient;

export const disconnectNotificationSocket = () => {
  socketClient = null;
};
