import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChatSocket } from '../../hooks/useChatSocket';

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-2xl rounded-bl-sm w-fit">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.sender === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center shrink-0">
          {msg.sender === 'bot'
            ? <Bot size={14} className="text-white" />
            : <UserIcon size={14} className="text-white" />
          }
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && (
          <span className="text-[10px] text-gray-400 px-1">
            {msg.sender === 'bot' ? 'Bot hỗ trợ' : 'Nhân viên'}
          </span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed ${
            isUser
              ? 'bg-red-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { messages, adminOnline, isBotTyping, sessionStatus, unread, sendMessage, sendTyping, resetUnread } =
    useChatSocket(user?._id);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isBotTyping, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      resetUnread();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, resetUnread]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput('');
    sendTyping(false);
  }, [input, sendMessage, sendTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    sendTyping(e.target.value.length > 0);
  };

  const handleAction = useCallback(
    (action) => {
      if (action.type === 'navigate') {
        navigate(action.payload);
        setIsOpen(false);
      } else if (action.type === 'trigger_intent') {
        sendMessage(action.payload);
      }
    },
    [navigate, sendMessage]
  );

  // Last bot/admin message actions
  const lastBotActions = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender !== 'user' && messages[i].actions?.length) {
        return messages[i].actions;
      }
    }
    return [];
  })();

  const isClosed = sessionStatus === 'closed';

  return (
    <div className="fixed bottom-6 right-20 z-50">
      {/* Chat panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
          style={{ height: '440px' }}>

          {/* Header */}
          <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${adminOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
              <div>
                <p className="text-sm font-semibold leading-tight">PhoneStore Hỗ Trợ</p>
                <p className="text-[11px] text-red-200 leading-tight">
                  {adminOnline ? 'Nhân viên đang trực' : 'Bot hỗ trợ 24/7'}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:opacity-70 transition-opacity">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && !isClosed && (
              <div className="text-center text-gray-400 text-xs mt-8">
                <Bot size={32} className="mx-auto mb-2 text-gray-300" />
                <p>Xin chào! Tôi có thể giúp gì cho bạn?</p>
              </div>
            )}

            {isClosed && (
              <div className="text-center text-gray-400 text-xs mt-4 px-4">
                Cuộc trò chuyện đã kết thúc. Nhắn tin để bắt đầu lại.
              </div>
            )}

            {messages.map((msg, idx) => (
              <MessageBubble key={msg._id || msg._tempId || idx} msg={msg} />
            ))}

            {isBotTyping && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <TypingDots />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Action buttons from last bot message */}
          {lastBotActions.length > 0 && !isBotTyping && (
            <div className="px-3 pb-2 flex flex-wrap gap-1 shrink-0">
              {lastBotActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleAction(action)}
                  className="text-xs border border-red-200 text-red-600 rounded-full px-2 py-1 hover:bg-red-50 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Login prompt for unauthenticated users */}
          {!user && (
            <div className="px-3 pb-3 shrink-0">
              <button
                onClick={() => { navigate('/login'); setIsOpen(false); }}
                className="w-full text-xs bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Đăng nhập để chat
              </button>
            </div>
          )}

          {/* Input — only for logged-in users */}
          {user && (
            <div className="border-t border-gray-100 p-2 flex gap-2 shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tin nhắn..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-red-400 resize-none"
                maxLength={500}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-9 h-9 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Chat hỗ trợ"
        className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 relative"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
