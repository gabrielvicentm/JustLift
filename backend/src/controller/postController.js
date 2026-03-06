const postService = require('../service/postService');

const MAX_MIDIAS = 9;
const MAX_DESCRICAO = 1000;
const MAX_COMENTARIO = 400;

function getUserIdFromRequest(req) {
  return req.user?.userId || req.user?.id || null;
}

function normalizeMediaList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => ({
      type: String(item?.type || '').trim().toLowerCase(),
      url: String(item?.url || '').trim(),
      key: item?.key ? String(item.key).trim() : null,
    }))
    .filter((item) => item.url.length > 0);
}

exports.createPost = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const descricao = String(req.body?.descricao || '').trim();
    const midias = normalizeMediaList(req.body?.midias);

    if (!descricao && midias.length === 0) {
      return res.status(400).json({ message: 'Post vazio. Adicione descricao ou midia.' });
    }

    if (descricao.length > MAX_DESCRICAO) {
      return res.status(400).json({ message: `Descricao maior que ${MAX_DESCRICAO} caracteres` });
    }

    if (midias.length > MAX_MIDIAS) {
      return res.status(400).json({ message: `Limite de ${MAX_MIDIAS} midias por post` });
    }

    if (midias.some((item) => item.type !== 'image' && item.type !== 'video')) {
      return res.status(400).json({ message: 'Tipo de midia invalido. Use image ou video.' });
    }

    const created = await postService.createPost({
      userId,
      descricao: descricao || '',
      midias,
    });

    return res.status(201).json({
      message: 'Post criado com sucesso',
      post: created,
    });
  } catch (err) {
    console.error('Erro ao criar post:', err);
    return res.status(500).json({ message: 'Erro ao criar post' });
  }
};

exports.getPostsByUser = async (req, res) => {
  try {
    const viewerUserId = getUserIdFromRequest(req);
    if (!viewerUserId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ message: 'userId obrigatorio' });
    }

    const posts = await postService.getPostsByUser({ userId, viewerUserId });
    return res.status(200).json({ posts });
  } catch (err) {
    console.error('Erro ao buscar posts por usuario:', err);
    return res.status(500).json({ message: 'Erro ao buscar posts' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const viewerUserId = getUserIdFromRequest(req);
    if (!viewerUserId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const postId = Number(req.params?.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    const post = await postService.getPostById({ postId, viewerUserId });
    if (!post) {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    return res.status(200).json({ post });
  } catch (err) {
    console.error('Erro ao buscar post por id:', err);
    return res.status(500).json({ message: 'Erro ao buscar post' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const postId = Number(req.params?.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    const result = await postService.toggleLike({ postId, userId });
    if (!result) {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro ao alternar like:', err);
    return res.status(500).json({ message: 'Erro ao alternar like' });
  }
};

exports.toggleSave = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const postId = Number(req.params?.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    const result = await postService.toggleSave({ postId, userId });
    if (!result) {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro ao alternar save:', err);
    return res.status(500).json({ message: 'Erro ao alternar save' });
  }
};

exports.reportPost = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const postId = Number(req.params?.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    const reason = String(req.body?.reason || '').trim() || 'sem_descricao';
    const result = await postService.reportPost({ postId, userId, reason });
    if (!result) {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    return res.status(201).json({ message: 'Denuncia registrada com sucesso' });
  } catch (err) {
    console.error('Erro ao denunciar post:', err);
    return res.status(500).json({ message: 'Erro ao denunciar post' });
  }
};

exports.createComment = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const postId = Number(req.params?.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ message: 'postId invalido' });
    }

    const comentario = String(req.body?.comentario || '').trim();
    if (!comentario) {
      return res.status(400).json({ message: 'Comentario obrigatorio' });
    }

    if (comentario.length > MAX_COMENTARIO) {
      return res.status(400).json({ message: `Comentario maior que ${MAX_COMENTARIO} caracteres` });
    }

    const created = await postService.createComment({ postId, userId, comentario });
    if (!created) {
      return res.status(404).json({ message: 'Post nao encontrado' });
    }

    return res.status(201).json({
      message: 'Comentario criado com sucesso',
      comment: created,
    });
  } catch (err) {
    console.error('Erro ao comentar no post:', err);
    return res.status(500).json({ message: 'Erro ao comentar no post' });
  }
};
