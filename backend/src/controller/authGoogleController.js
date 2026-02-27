const authgoogleService = require('../service/authgoogleService');
const authService = require('../service/authService');

exports.googleLogin = async (req, res) => {
  try {
    const { googleIdToken, google_id: googleId } = req.body;
    console.log('[GoogleAuth][Controller] /google/login:start', {
      hasGoogleIdToken: Boolean(googleIdToken),
      googleIdFromClient: googleId ?? null,
      bodyKeys: Object.keys(req.body || {}),
    });

    if (!googleIdToken) {
      return res.status(400).json({ message: 'googleIdToken e obrigatorio.' });
    }

    const { userId, googleId: savedGoogleId } = await authgoogleService.loginWithGoogle(googleIdToken, googleId);
    const { accessToken, refreshToken } = await authService.createSession(userId);
    console.log('[GoogleAuth][Controller] /google/login:success', { userId, savedGoogleId });

    return res.status(200).json({
      message: 'Login com Google efetuado com sucesso.',
      accessToken,
      refreshToken,
      google_id: savedGoogleId,
    });
  } catch (err) {
    console.error('[GoogleAuth][Controller] /google/login:error', {
      message: err.message,
      stack: err.stack,
    });
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado para este Google.' });
    }

    if (err.message === 'INVALID_GOOGLE_TOKEN' || err.message === 'GOOGLE_ID_MISMATCH') {
      return res.status(401).json({ message: 'Token Google invalido.' });
    }

    if (err.message === 'CONFIG_ERROR') {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID nao configurado no backend.' });
    }

    console.error('Erro no login Google:', err);
    return res.status(500).json({ message: 'Erro no servidor ao processar login Google.' });
  }
};

exports.googleRegister = async (req, res) => {
  try {
    const { username, googleIdToken, google_id: googleId } = req.body;
    console.log('[GoogleAuth][Controller] /google/register:start', {
      hasGoogleIdToken: Boolean(googleIdToken),
      googleIdFromClient: googleId ?? null,
      username: username ?? null,
      bodyKeys: Object.keys(req.body || {}),
    });

    if (!googleIdToken) {
      return res.status(400).json({ message: 'googleIdToken e obrigatorio.' });
    }

    const { userId, googleId: savedGoogleId } = await authgoogleService.registerWithGoogle(username, googleIdToken, googleId);
    const { accessToken, refreshToken } = await authService.createSession(userId);
    console.log('[GoogleAuth][Controller] /google/register:success', { userId, savedGoogleId });

    return res.status(201).json({
      message: 'Usuario registrado com Google com sucesso!',
      accessToken,
      refreshToken,
      google_id: savedGoogleId,
    });
  } catch (err) {
    console.error('[GoogleAuth][Controller] /google/register:error', {
      message: err.message,
      stack: err.stack,
    });
    if (err.message === 'DUPLICATE_USER') {
      return res.status(400).json({ message: 'Username, email ou Google ja em uso.' });
    }

    if (err.message === 'INVALID_GOOGLE_TOKEN' || err.message === 'GOOGLE_ID_MISMATCH') {
      return res.status(401).json({ message: 'Token Google invalido.' });
    }

    if (err.message === 'INVALID_USERNAME') {
      return res.status(400).json({ message: 'Username invalido para cadastro Google.' });
    }

    if (err.message === 'CONFIG_ERROR') {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID nao configurado no backend.' });
    }

    console.error('Erro no registro Google:', err);
    return res.status(500).json({ message: 'Erro no servidor ao processar cadastro Google.' });
  }
};
