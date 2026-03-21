const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const SECRET_KEY = 'pantufa';

//você só cria um servidor socket, evitando uma duplicacao de sevidor
let ioInstance = null;

//Isso cria um sala. Cada chat seria uma sala pra que os 2 usuario possam conversar
const getUserRoom = (userId) => `user:${String(userId)}`;

//Bearer token é o formato padrão de enviar token de autenticação no header HTTP
//Ex: "Authorization: Bearer abc123"

//// tenta pegar o token enviado pelo frontend no handshake do socket de 2 jeitos
const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return String(authToken).replace(/^Bearer\s+/i, '').trim();
  }

  const header = socket.handshake.headers?.authorization;
  if (!header) {
    return null;
  }

  //// verifica se o header veio no formato "Bearer token"
  const [scheme, token] = String(header).split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
};

const resolveUserId = (payload) => payload?.userId || payload?.id || null;

function initSocket(server) { //inicializa o Socket.IO no servido
  if (ioInstance) { //se nao existir ele cria
    return ioInstance;
  }

  ioInstance = new Server(server, {
    cors: { //isso controla quem pode se conectar ao socket
      origin: '*', //permite conexão de qualquer origem
      methods: ['GET', 'POST'],
    },
  });

  // valida o token antes de permitir a conexao do socket
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
