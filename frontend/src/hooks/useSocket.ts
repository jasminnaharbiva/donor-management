import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Use same base URL as standard API requests, stripped of /api/v1
const SOCKET_URL = (import.meta as any).env.VITE_API_URL ? (import.meta as any).env.VITE_API_URL.replace('/api/v1', '') : '';

export function useSocket(namespace = '') {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Auto-connect with standard Auth Bearer if token exists
    const socketInstance = io(`${SOCKET_URL}${namespace}`, {
      auth: { token: token || undefined },
      transports: ['websocket', 'polling'], // fallback gracefully
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected to ${namespace || 'default'} namespace`);
      setConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected from ${namespace || 'default'}: ${reason}`);
      setConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error(`[Socket] Connection error: ${err.message}`);
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [namespace]);

  return { socket, connected };
}
