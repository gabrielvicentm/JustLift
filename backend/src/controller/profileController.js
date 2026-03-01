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
