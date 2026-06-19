import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('[Socket] connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[Socket] disconnected:', reason));
    socket.on('connect_error', (err) => console.error('[Socket] connect_error:', err.message));
    socket.onAny((event, ...args) => console.log('[Socket] event:', event, JSON.stringify(args).slice(0, 200)));
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
