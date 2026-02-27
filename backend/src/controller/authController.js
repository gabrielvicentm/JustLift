const authService = require('../service/authService');

exports.register = async (req, res) => {
try{
  const { username, email, senha } = req.body;

  if (!username || !email || !senha) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }
  
  await authService.createUser(username, email, senha);
    return res.status(201).json({ message: 'Usuário registrado com sucesso!' });
} 

catch (err) {
    if (err.message === 'DUPLICATE_USER') {
      return res.status(400).json({ message: 'Username ou email já em uso.' });
    }

    console.error('Erro no registro:', err);
    return res.status(500).json({ message: 'Erro ao processar registro' });
    }
};
 
exports.login = async (req, res) => {
  try {
  const { identifier, senha } = req.body;

  if (!identifier || !senha) {
    return res.status(400).json({ message: 'Identifier (username ou email) e senha são obrigatórios.' });
  }

    const {accessToken, refreshToken} = await authService.logar(identifier, senha);
    return res.status(200).json({ message: 'Login efetuado com sucesso', accessToken, refreshToken});

    } catch (err) {


    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    console.error('Erro no login:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  } 
};


exports.handleRefresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
  return res.status(401).json({ message: "Refresh token não enviado" });
  }

  try {
    const {refreshToken} = await authService.refreshToken(refreshToken);
    return res.status(200).json({ message: 'Refresh token atualizado com sucesso', refreshToken});

  } catch (err) {

  if (err.message === 'USER_NOT_FOUND') {
      return res.status(400).json({ message: 'Usuário não encontrado' });
    }

  if (err.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(403).json({ message: 'Refresh token inválido ou expirado' });
    }

    console.error('Erro no refresh token:', err);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
  }; 