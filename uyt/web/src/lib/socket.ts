import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './api';

export function openSocket(auth: { accessToken?: string; deviceToken?: string }): Socket {
  return io(API_BASE || window.location.origin, {
    path: '/socket.io',
    auth,
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
}
