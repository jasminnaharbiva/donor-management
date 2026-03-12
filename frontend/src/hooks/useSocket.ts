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

type ManagedSocket = {
  socket: Socket;
  refs: number;
  token: string;
};

const socketPool = new Map<string, ManagedSocket>();

function acquireSocket(namespace: string, token: string): Socket {
  const key = namespace || '/';
  const existing = socketPool.get(key);

  if (existing) {
    existing.refs += 1;
    if (existing.token !== token) {
      existing.token = token;
      existing.socket.auth = { token };
      if (existing.socket.connected) {
        existing.socket.disconnect();
      }
      existing.socket.connect();
    }
    return existing.socket;
  }

  const socket = io(`${SOCKET_URL}${namespace}`, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 30000,
  });

  socketPool.set(key, { socket, refs: 1, token });
  return socket;
}

function releaseSocket(namespace: string): void {
  const key = namespace || '/';
  const existing = socketPool.get(key);
  if (!existing) return;

  existing.refs -= 1;
  if (existing.refs <= 0) {
    existing.socket.disconnect();
    socketPool.delete(key);
  }
}

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
    
    const socketInstance = acquireSocket(namespace, token);

    const onConnect = () => {
      console.log(`[Socket] Connected to ${namespace || 'default'} namespace`);
      setConnected(true);
    };

    const onDisconnect = (reason: string) => {
      console.log(`[Socket] Disconnected from ${namespace || 'default'}: ${reason}`);
      setConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.warn(`[Socket] Connection warning: ${err.message}`);
      setConnected(false);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    setSocket(socketInstance);
    setConnected(socketInstance.connected);

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('connect_error', onConnectError);
      releaseSocket(namespace);
    };
  }, [namespace]);

  return { socket, connected };
}
