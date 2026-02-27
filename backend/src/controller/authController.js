const authService = require('../service/authService');

const isMissingEmailVerificationTable = (err) =>
  err && err.code === '42P01' && String(err.message || '').includes('email_verifications');

exports.register = async (req, res) => {
  try {
    const { username, email, senha } = req.body;

    if (!username || !email || !senha) {
      return res.status(400).json({ message: 'Todos os campos sao obrigatorios.' });
    }

    await authService.createUser(username, email, senha);
    return res.status(200).json({ message: 'Codigo de verificacao enviado para o email informado.' });
  } catch (err) {
    if (err.message === 'DUPLICATE_USER') {
      return res.status(400).json({ message: 'Username ou email ja em uso.' });
    }

    if (err.message === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
      return res.status(500).json({ message: 'Servico de email nao configurado no servidor.' });
    }

    if (isMissingEmailVerificationTable(err)) {
      return res.status(500).json({ message: 'Tabela email_verifications nao existe no banco.' });
    }

    console.error('Erro no registro:', err);
    return res.status(500).json({ message: 'Erro ao processar registro' });
  }
};

exports.verifyRegister = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email e codigo sao obrigatorios.' });
    }

    await authService.verifyEmailAndCreateUser(email, code);
    return res.status(201).json({ message: 'Email verificado com sucesso. Conta criada.' });
  } catch (err) {
    if (err.message === 'VERIFICATION_NOT_FOUND') {
      return res.status(404).json({ message: 'Solicitacao de verificacao nao encontrada para este email.' });
    }

    if (err.message === 'VERIFICATION_EXPIRED') {
      return res.status(400).json({ message: 'Codigo expirado. Solicite um novo codigo.' });
    }

    if (err.message === 'INVALID_VERIFICATION_CODE') {
      return res.status(400).json({ message: 'Codigo invalido.' });
    }

    if (err.message === 'VERIFICATION_TOO_MANY_ATTEMPTS') {
      return res.status(429).json({ message: 'Muitas tentativas invalidas. Solicite um novo codigo.' });
    }

    if (err.message === 'DUPLICATE_USER') {
      return res.status(400).json({ message: 'Username ou email ja em uso.' });
    }

    if (isMissingEmailVerificationTable(err)) {
      return res.status(500).json({ message: 'Tabela email_verifications nao existe no banco.' });
    }

    console.error('Erro ao verificar email:', err);
    return res.status(500).json({ message: 'Erro ao verificar email.' });
  }
};

exports.resendRegisterCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email e obrigatorio.' });
    }

    await authService.resendVerificationCode(email);
    return res.status(200).json({ message: 'Novo codigo enviado para o email informado.' });
  } catch (err) {
    if (err.message === 'VERIFICATION_NOT_FOUND') {
      return res.status(404).json({ message: 'Solicitacao de verificacao nao encontrada para este email.' });
    }

    if (err.message === 'VERIFICATION_RESEND_TOO_SOON') {
      return res.status(429).json({ message: 'Aguarde alguns segundos antes de reenviar o codigo.' });
    }

    if (err.message === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
      return res.status(500).json({ message: 'Servico de email nao configurado no servidor.' });
    }

    if (isMissingEmailVerificationTable(err)) {
      return res.status(500).json({ message: 'Tabela email_verifications nao existe no banco.' });
    }

    console.error('Erro ao reenviar codigo:', err);
    return res.status(500).json({ message: 'Erro ao reenviar codigo.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, senha } = req.body;

    if (!identifier || !senha) {
      return res.status(400).json({ message: 'Identifier (username ou email) e senha sao obrigatorios.' });
    }

    const { accessToken, refreshToken } = await authService.logar(identifier, senha);
    return res.status(200).json({ message: 'Login efetuado com sucesso', accessToken, refreshToken });
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Credenciais invalidas' });
    }

    console.error('Erro no login:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

exports.handleRefresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token nao enviado' });
  }

  try {
    const refreshed = await authService.refreshToken(refreshToken);
    return res.status(200).json({
      message: 'Refresh token atualizado com sucesso',
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(400).json({ message: 'Usuario nao encontrado' });
    }

    if (err.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(403).json({ message: 'Refresh token invalido ou expirado' });
    }

    console.error('Erro no refresh token:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};
