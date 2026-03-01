const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');
const diarioRoutes = require('./src/routes/diario/diarioRoutes');
const detalheTreinoRoutes = require('./src/routes/diario/detalheTreinoRoutes');
const graficoRoutes = require('./src/routes/diario/graficoRoutes');
const premiumRoutes = require('./src/routes/premiumRoutes');
const profileRoutes = require('./src/routes/profileRoutes');

//const rateLimiter = require('./src/middleware/rateLimiter');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cors());


//app.use(rateLimiter);
app.use('/api/user', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/diario', diarioRoutes);
app.use('/api/detalhe-treino', detalheTreinoRoutes);
app.use('/api/diario/graficos', graficoRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/profile', profileRoutes);


module.exports = app;
