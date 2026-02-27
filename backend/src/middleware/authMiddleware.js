const jwt =  require('jsonwebtoken');
const SECRET_KEY = "pantufa";

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
    const decoded = jwt.verify(token, SECRET_KEY);

    req.user = decoded;
    next();

  } catch (err) {

    console.log("ERRO JWT:", err.message);
    console.log("AUTH HEADER:", req.headers.authorization);
    return res.status(401).json({ message: "Token expirado ou inválido" });

  }
};

module.exports = authMiddleware;