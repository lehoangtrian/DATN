import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../utils/socketInstance';
import { getAdminStatus, getChatHistory } from '../api/chat';

const getUserToken = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.accessToken || null;
  } catch {
    return null;
  }
};

export function useChatSocket(userId) {
  const [messages, setMessages] = useState([]);
  const [adminOnline, setAdminOnline] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('bot');
  const [unread, setUnread] = useState(0);

  // Load initial state from REST API
  const loadInitial = useCallback(async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        getAdminStatus(),
        getChatHistory({ limit: 50 }),
      ]);
      setAdminOnline(statusRes.data?.isOnline ?? false);
      if (historyRes.data?.messages) {
        setMessages(historyRes.data.messages);
      }
      if (historyRes.data?.session?.status) {
        setSessionStatus(historyRes.data.session.status);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!userId) return;

    loadInitial();

    const socket = getSocket();

    // Ensure join is emitted on this socket (may already be done by useSocket in Header,
    // but re-emitting is safe and needed when socket reconnects)
    const emitJoin = () => socket.emit('join', String(userId));
    emitJoin();

    // Re-emit join on every reconnect so server re-sets _chatUserId
    socket.on('connect', emitJoin);

    const onMessage = (data) => {
      const msg = data?.message;
      if (!msg) return;
      setMessages((prev) => {
        if (msg.sender === 'user') {
          // Replace first matching temp message in place (preserves ordering)
          const tempIdx = prev.findIndex((m) => m._tempId && m.text === msg.text);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = msg;
            return next;
          }
        }
        // Deduplicate by _id
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      // Only increment unread for bot/admin messages
      if (msg.sender !== 'user') setUnread((n) => n + 1);
    };

    const onTyping = ({ isTyping, sender }) => {
      if (sender === 'bot' || sender === 'admin') {
        setIsBotTyping(isTyping);
      }
    };

    const onSessionUpdate = ({ session }) => {
      if (session?.status) setSessionStatus(session.status);
    };

    const onAdminStatus = ({ isOnline }) => {
      setAdminOnline(isOnline);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:session_update', onSessionUpdate);
    socket.on('chat:admin_status', onAdminStatus);

    return () => {
      socket.off('connect', emitJoin);
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:session_update', onSessionUpdate);
      socket.off('chat:admin_status', onAdminStatus);
    };
  }, [userId, loadInitial]);

  const sendMessage = useCallback(
    (text) => {
      if (!text?.trim() || !userId) return;
      const trimmed = text.trim();
      const socket = getSocket();

      // Optimistic update: show message immediately before server echo
      const tempId = `temp_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { _tempId: tempId, sender: 'user', text: trimmed, createdAt: new Date().toISOString() },
      ]);

      socket.emit('chat:send', { text: trimmed, userToken: getUserToken() });
    },
    [userId]
  );

  const sendTyping = useCallback((isTyping) => {
    const socket = getSocket();
    socket.emit('chat:typing', { isTyping });
  }, []);

  const closeChat = useCallback(() => {
    const socket = getSocket();
    socket.emit('chat:close');
    setSessionStatus('closed');
  }, []);

  const resetUnread = useCallback(() => setUnread(0), []);

  return {
    messages,
    adminOnline,
    isBotTyping,
    sessionStatus,
    unread,
    sendMessage,
    sendTyping,
    closeChat,
    resetUnread,
    reload: loadInitial,
  };
}
