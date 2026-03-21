const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');
const diarioRoutes = require('./src/routes/diario/diarioRoutes');
const detalheTreinoRoutes = require('./src/routes/diario/detalheTreinoRoutes');
const graficoRoutes = require('./src/routes/diario/graficoRoutes');
const gamificacaoRoutes = require('./src/routes/diario/gamificacaoRoutes');
const premiumRoutes = require('./src/routes/premiumRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const searchRoutes = require('./src/routes/searchRoutes');
const followRoutes = require('./src/routes/followRoutes');
const postRoutes = require('./src/routes/postRoutes');
const dailyRoutes = require('./src/routes/dailyRoutes');
const treinoPostRoutes = require('./src/routes/treinoPostRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const conversasRoutes = require('./src/routes/conversasRoutes');
const chatRoutes = require('./src/routes/chatRoutes');

//const rateLimiter = require('./src/middleware/rateLimiter');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cors());


//app.use(rateLimiter);
app.use('/api/user', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/diario', diarioRoutes);
app.use('/api/diario/gamificacao', gamificacaoRoutes);
app.use('/api/detalhe-treino', detalheTreinoRoutes);
app.use('/api/diario/graficos', graficoRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/conversas', conversasRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/treino-posts', treinoPostRoutes);
app.use('/api/notifications', notificationRoutes);


module.exports = app;
