const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = require('../config/security');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token não enviado" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Formato de token inválido" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    req.user = decoded;
    next();

  } catch (err) {

    console.log("ERRO JWT:", err.message);
    return res.status(401).json({ message: "Token expirado ou inválido" });

  }
};

module.exports = authMiddleware;
