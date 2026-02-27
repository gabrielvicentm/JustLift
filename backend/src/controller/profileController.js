const profileService = require('../service/profileService');

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // vem do token
    const { nome_exibicao, biografia, foto_perfil, banner } = req.body;

    await profileService.updateProfile(userId, nome_exibicao, biografia, foto_perfil, banner);
    return res.status(201).json({ message: 'Perfil atualizado com sucesso!' });
    
  } catch (err) {

    if (err.message === 'USER_NOT_FOUND') {
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    console.error('Erro em atualizar perfil:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};
