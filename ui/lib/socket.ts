import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (token: string) => {
  if (socket?.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000', {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('connected', (data) => {
    console.log('Connection confirmed:', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('notification', (data) => {
    console.log('Received notification:', data);
    // Handle different notification types
    if (data.type === 'BID_SUCCESS') {
      // Could show a success toast here
    } else if (data.type === 'BID_FAILED') {
      // Could show an error toast here
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};