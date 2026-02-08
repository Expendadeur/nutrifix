import { socket } from './socket';

export const setupNotificationListener = (userId, onNotification) => {
  if (!userId) return;

  if (!socket.connected) {
    socket.connect();
  }

  socket.emit('join-room', `user-${userId}`);

  socket.on('new-notification', (data) => {
    console.log('🔔 Notification temps réel:', data);
    onNotification?.(data);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket error', err.message);
  });

  return () => {
    socket.off('new-notification');
    socket.emit('leave-room', `user-${userId}`);
    socket.disconnect();
  };
};