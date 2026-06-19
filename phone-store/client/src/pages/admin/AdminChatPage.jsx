import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, User as UserIcon, Bot, RefreshCw, X } from 'lucide-react';
import { getSocket } from '../../utils/socketInstance';
import { getChatSessions, getSessionMessages, assignChatSession, adminCloseSession } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABEL = { bot: 'Bot', open: 'Đang mở', closed: 'Đã đóng' };
const STATUS_COLOR = {
  bot: 'bg-yellow-100 text-yellow-700',
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

function formatTime(date) {
  return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const selectedSession = sessions.find((s) => s._id === selectedId);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await getChatSessions({ status: statusFilter, limit: 50 });
      setSessions(res.data?.sessions || []);
    } catch (_) {}
    setLoadingSessions(false);
  }, [statusFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadMessages = useCallback(async (sessionId) => {
    try {
      const res = await getSessionMessages(sessionId);
      setMessages(res.data?.messages || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedId) inputRef.current?.focus();
  }, [selectedId]);

  // Emit join so server sets _chatUserId and adds admin to admin_chat_room
  useEffect(() => {
    if (!user?._id) return;
    const socket = getSocket();
    const emitJoin = () => socket.emit('join', String(user._id));
    emitJoin();
    socket.on('connect', emitJoin);
    return () => socket.off('connect', emitJoin);
  }, [user?._id]);

  // Socket.IO — listen to admin_chat_room events
  useEffect(() => {
    const socket = getSocket();

    const onMessage = ({ message }) => {
      if (!message) return;
      // If message belongs to selected session, append it
      if (String(message.sessionId) === String(selectedId)) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
      // Update last message preview in sessions list
      setSessions((prev) =>
        prev.map((s) =>
          String(s._id) === String(message.sessionId)
            ? { ...s, lastMessage: message, lastMessageAt: message.createdAt }
            : s
        )
      );
    };

    const onNewSession = ({ session }) => {
      if (!session) return;
      setSessions((prev) => {
        const exists = prev.some((s) => s._id === session._id);
        if (exists) {
          return prev.map((s) => (s._id === session._id ? { ...s, ...session } : s));
        }
        return [session, ...prev];
      });
    };

    const onSessionUpdate = ({ session }) => {
      if (!session) return;
      setSessions((prev) => prev.map((s) => (s._id === session._id ? { ...s, ...session } : s)));
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:new_session', onNewSession);
    socket.on('chat:session_update', onSessionUpdate);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:new_session', onNewSession);
      socket.off('chat:session_update', onSessionUpdate);
    };
  }, [selectedId]);

  const handleSelectSession = async (sessionId) => {
    setSelectedId(sessionId);
    setMessages([]);
    // Claim the session if not already assigned
    const session = sessions.find((s) => s._id === sessionId);
    if (session && !session.assignedTo) {
      try {
        const res = await assignChatSession(sessionId);
        setSessions((prev) => prev.map((s) => (s._id === sessionId ? { ...s, ...res.data?.session } : s)));
      } catch (_) {}
    }
    // Notify via socket that admin joined
    getSocket().emit('chat:admin_join', { sessionId });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !selectedId) return;
    getSocket().emit('chat:admin_send', { sessionId: selectedId, text });
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCloseSession = async (sessionId) => {
    try {
      await adminCloseSession(sessionId);
      setSessions((prev) => prev.map((s) => (s._id === sessionId ? { ...s, status: 'closed' } : s)));
      if (selectedId === sessionId) setSelectedId(null);
    } catch (_) {}
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Session list */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <MessageSquare size={18} className="text-red-600" />
              Hội thoại
            </h2>
            <button onClick={loadSessions} className="text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw size={16} className={loadingSessions ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex gap-1">
            {['open', 'bot', 'all'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === s ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'Tất cả' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && !loadingSessions && (
            <div className="text-center text-gray-400 text-sm py-8">Không có hội thoại nào</div>
          )}
          {sessions.map((session) => (
            <button
              key={session._id}
              onClick={() => handleSelectSession(session._id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                selectedId === session._id ? 'bg-red-50 border-l-2 border-l-red-600' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-gray-800 truncate">
                      {session.userId?.name || 'Khách hàng'}
                    </span>
                    {session.unreadByAdmin > 0 && (
                      <span className="w-4 h-4 bg-red-600 text-white text-[9px] rounded-full flex items-center justify-center shrink-0">
                        {session.unreadByAdmin}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {session.lastMessage?.text || session.userId?.email || ''}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_COLOR[session.status]}`}>
                  {STATUS_LABEL[session.status]}
                </span>
              </div>
              <p className="text-[10px] text-gray-300 mt-1">
                {session.lastMessageAt ? formatTime(session.lastMessageAt) : ''}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3">
            <MessageSquare size={48} className="text-gray-200" />
            <p className="text-sm">Chọn một hội thoại để bắt đầu</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
              <div>
                <p className="font-semibold text-gray-800">
                  {selectedSession?.userId?.name || 'Khách hàng'}
                </p>
                <p className="text-xs text-gray-400">{selectedSession?.userId?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[selectedSession?.status]}`}>
                  {STATUS_LABEL[selectedSession?.status]}
                </span>
                {selectedSession?.status !== 'closed' && (
                  <button
                    onClick={() => handleCloseSession(selectedId)}
                    className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                  >
                    <X size={14} /> Đóng
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((msg, idx) => {
                const isAdmin = msg.sender === 'admin';
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg._id || idx} className={`flex items-end gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isAdmin ? 'bg-blue-500' : isUser ? 'bg-gray-300' : 'bg-red-600'
                    }`}>
                      {msg.sender === 'bot' ? <Bot size={14} className="text-white" /> : <UserIcon size={14} className="text-white" />}
                    </div>
                    <div className={`max-w-[70%] flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-400 mb-0.5 px-1">
                        {isAdmin ? 'Bạn' : isUser ? 'Khách hàng' : 'Bot'} · {formatTime(msg.createdAt)}
                      </span>
                      <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed ${
                        isAdmin
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {selectedSession?.status !== 'closed' ? (
              <div className="bg-white border-t border-gray-200 p-3 flex gap-2 shrink-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn cho khách hàng..."
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-400"
                  maxLength={1000}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white rounded-xl transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Send size={16} /> Gửi
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center text-sm text-gray-400">
                Hội thoại đã kết thúc
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
