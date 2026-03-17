const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let ioInstance = null;

const normalizeOrigin = (origin) => String(origin || '').trim();

const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: normalizeOrigin(process.env.CLIENT_URL) || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const authHeaderToken = String(socket.handshake?.auth?.token || '').replace(/^Bearer\s+/i, '');
      const bearerHeader = String(socket.handshake?.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      const queryToken = String(socket.handshake?.query?.token || '').replace(/^Bearer\s+/i, '');
      const token = authHeaderToken || bearerHeader || queryToken;

      if (!token) {
        return next(new Error('Unauthorized: token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id role accountStatus').lean();

      if (!user || user.accountStatus === 'inactive') {
        return next(new Error('Unauthorized: invalid user'));
      }

      socket.user = {
        id: String(user._id),
        role: user.role,
      };

      return next();
    } catch (_error) {
      return next(new Error('Unauthorized: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on('notifications:subscribe', () => {
      socket.join(`user:${socket.user.id}`);
    });

    socket.on('disconnect', () => {});
  });

  ioInstance = io;
  return io;
};

const getIO = () => ioInstance;

const emitToUserIds = (userIds, eventName, payload) => {
  const io = getIO();
  if (!io) return;

  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean).map((id) => String(id))));
  uniqueIds.forEach((userId) => {
    io.to(`user:${userId}`).emit(eventName, payload);
  });
};

module.exports = {
  createSocketServer,
  getIO,
  emitToUserIds,
};
