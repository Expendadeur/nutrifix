import { io } from 'socket.io-client';
import { Platform } from 'react-native';

const SOCKET_URL = Platform.select({
  web: 'http://localhost:5000',
  default: 'http://localhost:5000'
});

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false
});