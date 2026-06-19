const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { User } = require('../models/index');
const logger = require('../utils/logger');

const BOT_URL = process.env.BOT_URL || 'http://localhost:8000/chat';
const BOT_TIMEOUT_MS = 90000;

let _io = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateSession(userId) {
  let session = await ChatSession.findOne({
    userId,
    status: { $in: ['bot', 'open'] },
  });
  if (!session) {
    session = await ChatSession.create({ userId });
  }
  return session;
}

async function callPythonBot(text, userToken, sessionId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);
  try {
    const res = await fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, user_token: userToken || null, session_id: String(sessionId) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Bot responded ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    logger.warn(`[Chat] Bot unreachable: ${err.message}`);
    return {
      text: 'Xin lỗi, hệ thống đang bảo trì. Vui lòng thử lại sau hoặc gọi 1800 6789.',
      actions: [],
      intent: 'fallback',
    };
  }
}

// ─── Socket.IO event wiring ──────────────────────────────────────────────────

function setChatIO(io, app) {
  _io = io;

  io.on('connection', (socket) => {
    // User sends a chat message
    socket.on('chat:send', async ({ text, userToken } = {}) => {
      try {
        if (!text?.trim()) return;
        if (!socket._chatUserId) {
          logger.warn(`[Chat] chat:send received but _chatUserId not set (socket ${socket.id}). Client may not have emitted join yet.`);
          return;
        }
        const userId = socket._chatUserId;
        const isAdminOnlineFn = app.get('isAdminOnline');
        // Exclude the sender themselves — an admin testing the chat widget should still get bot replies
        const adminOnline = isAdminOnlineFn ? isAdminOnlineFn(userId) : false;

        const session = await getOrCreateSession(userId);

        // Admin đã claim session (assignedTo) nhưng có thể đã disconnect từ lâu mà
        // không clear assignedTo — nếu admin đó không còn online, coi như chưa assign
        // để tin nhắn không bị kẹt vĩnh viễn (rớt về hàng đợi admin chung hoặc bot).
        const isSpecificAdminOnlineFn = app.get('isSpecificAdminOnline');
        const assignedAdminOnline = session.assignedTo && isSpecificAdminOnlineFn
          ? isSpecificAdminOnlineFn(session.assignedTo)
          : false;
        if (session.assignedTo && !assignedAdminOnline) {
          logger.warn(`[Chat] assigned admin ${session.assignedTo} offline — unassigning session ${session._id}`);
          await ChatSession.findByIdAndUpdate(session._id, { assignedTo: null });
          session.assignedTo = null;
        }

        logger.info(`[Chat] userId=${userId} text="${text.trim()}" sessionId=${session._id} assignedTo=${session.assignedTo} adminOnline=${adminOnline}`);

        // Save user message
        const userMsg = await ChatMessage.create({
          sessionId: session._id,
          sender: 'user',
          senderId: userId,
          text: text.trim(),
        });

        await ChatSession.findByIdAndUpdate(session._id, { lastMessageAt: new Date() });

        // Emit user message back to user (echo for their own chat window)
        _io.to(String(userId)).emit('chat:message', { message: userMsg });

        if (session.assignedTo) {
          logger.info(`[Chat] → routing to assigned admin ${session.assignedTo}`);
          _io.to(String(session.assignedTo)).emit('chat:message', { message: userMsg });
          await ChatSession.findByIdAndUpdate(session._id, { $inc: { unreadByAdmin: 1 } });
        } else if (adminOnline) {
          logger.info(`[Chat] → admin online, routing to admin_chat_room`);
          if (session.status !== 'open') {
            await ChatSession.findByIdAndUpdate(session._id, { status: 'open' });
            session.status = 'open';
          }
          await ChatSession.findByIdAndUpdate(session._id, { $inc: { unreadByAdmin: 1 } });

          const populatedSession = await ChatSession.findById(session._id).populate('userId', 'name email avatar');
          _io.to('admin_chat_room').emit('chat:new_session', { session: populatedSession });
          _io.to('admin_chat_room').emit('chat:message', { message: userMsg, session: populatedSession });
        } else {
          logger.info(`[Chat] → admin offline, calling Python bot`);
          _io.to(String(userId)).emit('chat:typing', { isTyping: true, sender: 'bot' });
          const botReply = await callPythonBot(text.trim(), userToken, session._id);
          _io.to(String(userId)).emit('chat:typing', { isTyping: false, sender: 'bot' });
          logger.info(`[Chat] bot replied intent=${botReply.intent} text="${botReply.text.slice(0, 60)}"`);

          const botMsg = await ChatMessage.create({
            sessionId: session._id,
            sender: 'bot',
            senderId: null,
            text: botReply.text,
            actions: botReply.actions || [],
            metadata: { intent: botReply.intent, confidence: botReply.confidence },
          });
          await ChatSession.findByIdAndUpdate(session._id, { lastMessageAt: new Date() });
          _io.to(String(userId)).emit('chat:message', { message: botMsg });
          logger.info(`[Chat] bot message emitted to room ${userId}`);
        }
      } catch (err) {
        logger.error(`[Chat] chat:send error: ${err.message}\n${err.stack}`);
      }
    });

    // Admin sends message to a specific session
    socket.on('chat:admin_send', async ({ sessionId, text } = {}) => {
      try {
        if (!text?.trim() || !sessionId || !socket._chatUserId) return;
        const adminId = socket._chatUserId;

        const session = await ChatSession.findById(sessionId);
        if (!session) return;

        const msg = await ChatMessage.create({
          sessionId: session._id,
          sender: 'admin',
          senderId: adminId,
          text: text.trim(),
        });

        await ChatSession.findByIdAndUpdate(session._id, {
          lastMessageAt: new Date(),
          unreadByAdmin: 0,
        });

        // Send to user
        _io.to(String(session.userId)).emit('chat:message', { message: msg });
        // Echo to admin_chat_room (other admin tabs see it too)
        _io.to('admin_chat_room').emit('chat:message', { message: msg });
      } catch (err) {
        logger.error(`[Chat] chat:admin_send error: ${err.message}`);
      }
    });

    // Admin joins a session (claims it)
    socket.on('chat:admin_join', async ({ sessionId } = {}) => {
      try {
        if (!sessionId || !socket._chatUserId) return;
        await ChatSession.findByIdAndUpdate(sessionId, {
          assignedTo: socket._chatUserId,
          status: 'open',
          unreadByAdmin: 0,
        });
        const updated = await ChatSession.findById(sessionId);
        _io.to('admin_chat_room').emit('chat:session_update', { session: updated });
        _io.to(String(updated.userId)).emit('chat:session_update', { session: updated });
      } catch (err) {
        logger.error(`[Chat] chat:admin_join error: ${err.message}`);
      }
    });

    // Admin leaves session
    socket.on('chat:admin_leave', async ({ sessionId } = {}) => {
      try {
        if (!sessionId) return;
        await ChatSession.findByIdAndUpdate(sessionId, { assignedTo: null });
      } catch (err) {
        logger.error(`[Chat] chat:admin_leave error: ${err.message}`);
      }
    });

    // User closes chat
    socket.on('chat:close', async () => {
      try {
        if (!socket._chatUserId) return;
        const session = await ChatSession.findOneAndUpdate(
          { userId: socket._chatUserId, status: { $in: ['bot', 'open'] } },
          { status: 'closed', closedAt: new Date() },
          { new: true }
        );
        if (session) {
          _io.to('admin_chat_room').emit('chat:session_update', { session });
        }
      } catch (err) {
        logger.error(`[Chat] chat:close error: ${err.message}`);
      }
    });

    // Typing relay
    socket.on('chat:typing', ({ isTyping, sessionId } = {}) => {
      try {
        if (!socket._chatUserId) return;
        // If user typing → forward to admin room
        _io.to('admin_chat_room').emit('chat:typing', { isTyping, sender: 'user', sessionId });
      } catch (_) {}
    });
  });
}

// ─── REST Controllers ────────────────────────────────────────────────────────

const getAdminStatus = (req, res) => {
  const isAdminOnline = req.app.get('isAdminOnline');
  res.json({ success: true, isOnline: isAdminOnline ? isAdminOnline() : false });
};

const getHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 30);

    const session = await ChatSession.findOne({
      userId,
      status: { $in: ['bot', 'open'] },
    });

    if (!session) {
      return res.json({ success: true, messages: [], session: null });
    }

    // Lấy N tin nhắn GẦN NHẤT (sort desc + limit), rồi đảo lại thành thứ tự thời gian
    // tăng dần để hiển thị đúng chiều trên UI. page=1 → mới nhất, page=2 → cũ hơn nữa...
    const messages = await ChatMessage.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    messages.reverse();

    res.json({ success: true, messages, session });
  } catch (err) {
    next(err);
  }
};

const closeSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findOneAndUpdate(
      { userId: req.user._id, status: { $in: ['bot', 'open'] } },
      { status: 'closed', closedAt: new Date() },
      { new: true }
    );
    if (_io && session) {
      _io.to('admin_chat_room').emit('chat:session_update', { session });
    }
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const filter = status === 'all' ? {} : { status };
    const total = await ChatSession.countDocuments(filter);
    const sessions = await ChatSession.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email avatar')
      .populate('assignedTo', 'name email')
      .lean();

    // Attach last message to each session
    const sessionIds = sessions.map((s) => s._id);
    const lastMessages = await ChatMessage.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$sessionId', lastMessage: { $first: '$$ROOT' } } },
    ]);
    const lastMsgMap = Object.fromEntries(lastMessages.map((m) => [String(m._id), m.lastMessage]));

    const enriched = sessions.map((s) => ({ ...s, lastMessage: lastMsgMap[String(s._id)] || null }));

    res.json({ success: true, sessions: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

const getSessionMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findById(id).populate('userId', 'name email avatar');
    if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });

    const messages = await ChatMessage.find({ sessionId: id }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, messages, session });
  } catch (err) {
    next(err);
  }
};

const assignSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findByIdAndUpdate(
      req.params.id,
      { assignedTo: req.user._id, status: 'open', unreadByAdmin: 0 },
      { new: true }
    ).populate('userId', 'name email avatar');

    if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });

    if (_io) {
      _io.to('admin_chat_room').emit('chat:session_update', { session });
      _io.to(String(session.userId._id)).emit('chat:session_update', { session });
    }
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

const adminCloseSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', closedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });

    if (_io) {
      _io.to('admin_chat_room').emit('chat:session_update', { session });
      _io.to(String(session.userId)).emit('chat:session_update', { session });
    }
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  setChatIO,
  getAdminStatus,
  getHistory,
  closeSession,
  getSessions,
  getSessionMessages,
  assignSession,
  adminCloseSession,
};
