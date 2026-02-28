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

exports.getMyPosts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const limitInput = Number(req.query.limit);
    const offsetInput = Number(req.query.offset);
    const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.floor(limitInput), 1), 50) : 20;
    const offset = Number.isFinite(offsetInput) ? Math.max(Math.floor(offsetInput), 0) : 0;

    const posts = await profileService.getMyWorkoutPosts(userId, { limit, offset });

    return res.status(200).json({
      items: posts,
      meta: { limit, offset, count: posts.length },
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao buscar meus posts de treino:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

exports.updateMyPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = Number(req.params.postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    const { data, duracao, finalizado } = req.body || {};

    const payload = {
      data: typeof data === 'string' && data.trim().length > 0 ? data.trim() : undefined,
      duracao: Number.isFinite(Number(duracao)) ? Math.max(0, Math.floor(Number(duracao))) : undefined,
      finalizado: typeof finalizado === 'boolean' ? finalizado : undefined,
    };

    if (payload.data === undefined && payload.duracao === undefined && payload.finalizado === undefined) {
      return res.status(400).json({ message: 'Nada para atualizar no post' });
    }

    const updated = await profileService.updateMyWorkoutPost(userId, postId, payload);

    return res.status(200).json({
      message: 'Post atualizado com sucesso!',
      post: updated,
    });
  } catch (err) {
    if (err.message === 'POST_NOT_FOUND') {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao atualizar post:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

exports.deleteMyPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = Number(req.params.postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    await profileService.deleteMyWorkoutPost(userId, postId);
    return res.status(200).json({ message: 'Post removido com sucesso!' });
  } catch (err) {
    if (err.message === 'POST_NOT_FOUND') {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao remover post:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
};

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
