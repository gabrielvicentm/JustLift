const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const SECRET_KEY = 'pantufa';

let ioInstance = null;

const getUserRoom = (userId) => `user:${String(userId)}`;

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return String(authToken).replace(/^Bearer\s+/i, '').trim();
  }

  const header = socket.handshake.headers?.authorization;
  if (!header) {
    return null;
  }

  const [scheme, token] = String(header).split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
};

const resolveUserId = (payload) => payload?.userId || payload?.id || null;

function initSocket(server) {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) {
        return next(new Error('SOCKET_UNAUTHORIZED'));
      }

      const decoded = jwt.verify(token, SECRET_KEY);
      const userId = resolveUserId(decoded);
      if (!userId) {
        return next(new Error('SOCKET_UNAUTHORIZED'));
      }

      socket.data.userId = String(userId);
      return next();
    } catch (error) {
      return next(new Error('SOCKET_UNAUTHORIZED'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(getUserRoom(userId));
  });

  return ioInstance;
}

function emitToUser(userId, event, payload) {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(getUserRoom(userId)).emit(event, payload);
}

module.exports = {
  initSocket,
  emitToUser,
};
