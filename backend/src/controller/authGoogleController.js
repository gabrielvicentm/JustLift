const authgoogleService = require('../service/authgoogleService');
const authService = require('../service/authService');

exports.getGoogleConfig = async (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: 'GOOGLE_CLIENT_ID nao configurado no backend.' });
  }

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  });
};

exports.googleLogin = async (req, res) => {
  try {
    const { googleIdToken, google_id: googleId } = req.body;

    if (!googleIdToken) {
      return res.status(400).json({ message: 'googleIdToken e obrigatorio.' });
    }

    const { userId, googleId: savedGoogleId } = await authgoogleService.loginWithGoogle(googleIdToken, googleId);
    const { accessToken, refreshToken } = await authService.createSession(userId);

    return res.status(200).json({
      message: 'Login com Google efetuado com sucesso.',
      accessToken,
      refreshToken,
      google_id: savedGoogleId,
    });
  } catch (err) {
    if (
      err.message === 'USER_NOT_FOUND' ||
      err.message === 'INVALID_GOOGLE_TOKEN' ||
      err.message === 'GOOGLE_ID_MISMATCH'
    ) {
      return res.status(401).json({ message: 'Nao foi possivel autenticar com Google.' });
    }

    if (err.message === 'CONFIG_ERROR') {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID nao configurado no backend.' });
    }

    return res.status(500).json({ message: 'Erro no servidor ao processar login Google.' });
  }
};

exports.googleRegister = async (req, res) => {
  try {
    const { username, googleIdToken, google_id: googleId } = req.body;

    if (!googleIdToken) {
      return res.status(400).json({ message: 'googleIdToken e obrigatorio.' });
    }

    const { userId, googleId: savedGoogleId } = await authgoogleService.registerWithGoogle(username, googleIdToken, googleId);
    const { accessToken, refreshToken } = await authService.createSession(userId);

    return res.status(201).json({
      message: 'Usuario registrado com Google com sucesso!',
      accessToken,
      refreshToken,
      google_id: savedGoogleId,
    });
  } catch (err) {
    if (
      err.message === 'DUPLICATE_USER' ||
      err.message === 'INVALID_GOOGLE_TOKEN' ||
      err.message === 'GOOGLE_ID_MISMATCH' ||
      err.message === 'INVALID_USERNAME'
    ) {
      return res.status(400).json({ message: 'Nao foi possivel concluir o cadastro com Google.' });
    }

    if (err.message === 'CONFIG_ERROR') {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID nao configurado no backend.' });
    }

    return res.status(500).json({ message: 'Erro no servidor ao processar cadastro Google.' });
  }
};
