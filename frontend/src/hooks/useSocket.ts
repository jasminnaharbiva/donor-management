import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Get socket URL: use current origin (works in production at same domain)
// or fallback to environment variable, or default to localhost:3002
const getSocketUrl = () => {
  // Check if environment variable is set
  const envUrl = (import.meta as any).env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace('/api/v1', '');
  }
  
  // Use current window origin (same domain as frontend)
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  
  // Fallback for development
  return 'http://localhost:3002';
};

const SOCKET_URL = getSocketUrl();

export function useSocket(namespace = '') {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    // Do not attempt socket connection for public/unauthenticated users.
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }
    
    // Auto-connect with standard Auth Bearer if token exists
    const socketInstance = io(`${SOCKET_URL}${namespace}`, {
      auth: { token },
      transports: ['polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
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
      console.warn(`[Socket] Connection warning: ${err.message}`);
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [namespace]);

  return { socket, connected };
}
