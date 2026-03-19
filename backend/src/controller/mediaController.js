const mediaService = require('../service/mediaService');

exports.presignUpload = async (req, res) => {
  try {
    const { filename, contentType, size } = req.body;

    if (!filename || !contentType || size == null) {
      return res.status(400).json({ message: 'filename, contentType e size são obrigatórios' });
    }

    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return res.status(400).json({ message: 'Tipo de arquivo não permitido' });
    }

    const numericSize = Number(size);
    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      return res.status(400).json({ message: 'size inválido' });
    }

    if (numericSize > 50 * 1024 * 1024) {
      return res.status(400).json({ message: 'Arquivo maior que 50MB' });
    }

    const payload = await mediaService.createPresignedUpload({ filename, contentType });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Erro ao gerar URL assinada de upload:', err);
    return res.status(500).json({ message: 'Erro ao gerar URL de upload' });
  }
};

exports.completeUpload = async (req, res) => {
  try {
    const { key, contentType, size } = req.body;

    if (!key) {
      return res.status(400).json({ message: 'key é obrigatória' });
    }

    // Opcional: persistir no banco aqui.
    return res.status(201).json({ message: 'Upload confirmado', key, contentType, size });
  } catch (err) {
    console.error('Erro ao confirmar upload:', err);
    return res.status(500).json({ message: 'Erro ao confirmar upload' });
  }
};
