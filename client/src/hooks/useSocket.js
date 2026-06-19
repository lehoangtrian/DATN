import { useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../utils/socketInstance';

export function useSocket(userId, onNotification) {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!userId) {
      disconnectSocket();
      return;
    }

    const socket = getSocket();
    socket.emit('join', String(userId));

    const handler = (data) => callbackRef.current?.(data);
    socket.on('new_notification', handler);

    return () => {
      socket?.off('new_notification', handler);
    };
  }, [userId]);
}
