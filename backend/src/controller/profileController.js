const profileService = require('../service/profileService');

exports.profile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await profileService.getProfile(userId);
    return res.status(200).json(profile);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao buscar perfil:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

exports.getMe = exports.profile;

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { nome_exibicao, biografia, foto_perfil, banner } = req.body;

    const updatedProfile = await profileService.updateProfile(
      userId,
      nome_exibicao,
      biografia,
      foto_perfil,
      banner
    );

    return res.status(200).json({
      message: 'Perfil atualizado com sucesso!',
      profile: updatedProfile,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro em atualizar perfil:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

exports.updateMe = exports.updateProfile;

exports.getByUsername = async (req, res) => {
 const userId = req.user?.userId || req.user?.id || null;
 const { username } = req.params;

  if (!userId) {
    return res.status(401).json({ message: 'Token invalido' });
  }

  try {
    const profile = await profileService.getProfileByUsern(userId, username);
    return res.status(200).json(profile);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao buscar perfil por username:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

exports.requestAccountChange = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { newUsername, newEmail, newPassword } = req.body;

    await profileService.requestAccountChange(userId, { newUsername, newEmail, newPassword });

    return res.status(200).json({
      message: 'Codigo de verificacao enviado para o email cadastrado.',
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (err.message === 'NOTHING_TO_UPDATE') {
      return res.status(400).json({ message: 'Informe ao menos um campo para alterar.' });
    }

    if (err.message === 'DUPLICATE_USERNAME') {
      return res.status(400).json({ message: 'Username ja em uso.' });
    }

    if (err.message === 'DUPLICATE_EMAIL') {
      return res.status(400).json({ message: 'Email ja em uso.' });
    }

    if (err.message === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
      return res.status(500).json({ message: 'Servico de email nao configurado no servidor.' });
    }

    console.error('Erro ao solicitar alteracao de conta:', err);
    return res.status(500).json({ message: 'Erro no servidor.' });
  }
};

exports.confirmAccountChange = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Codigo e obrigatorio.' });
    }

    await profileService.confirmAccountChange(userId, code);

    return res.status(200).json({ message: 'Dados da conta atualizados com sucesso.' });
  } catch (err) {
    if (err.message === 'VERIFICATION_NOT_FOUND') {
      return res.status(404).json({ message: 'Solicitacao de verificacao nao encontrada.' });
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

    console.error('Erro ao confirmar alteracao de conta:', err);
    return res.status(500).json({ message: 'Erro no servidor.' });
  }
};
