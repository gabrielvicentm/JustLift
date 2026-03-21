require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./src/socket');

const server = http.createServer(app);
initSocket(server);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = server;
