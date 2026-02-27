/* CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
const WINDOW_MS = 15 * 1000; //Janela de tempo de 15 segundos.
const MAX_REQUESTS_PER_WINDOW = 5; //Máximo de 5 requisições
const FIRST_PENALTY_MS = 15 * 1000; //Primeira punição = 15 segundos bloqueado.
const ESCALATED_PENALTY_MS = 2 * 60 * 60 * 1000; // Segunda punição = 2 HORAS bloqueado.
const OFFENSE_RESET_MS = 12 * 60 * 60 * 1000; //Depois de 12 horas sem cometer infração, o contador zera.

const buckets = new Map(); 
//Aqui é onde tudo é guardado;
//Ele guarda dados por IP da pessoa.

function getClientKey(req) {  //Função que extrai o IP do usuário.
  const forwardedFor = req.headers["x-forwarded-for"]; //Se tiver proxy (tipo Nginx), pega o IP real.
  const proxyIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor; //Se vier como array, pega o primeiro IP.
  const ip = (proxyIp || req.ip || req.socket?.remoteAddress || "unknown") // Tenta pegar IP em várias formas possíveis.
  // Limpa o IP caso venha com múltiplos valores.
  .toString()
    .split(",")[0]
    .trim();
  //Limpa o IP caso venha com múltiplos valores.

  return ip;
}

//DEFINIR TEMPO DE PUNIÇÃO

function getPenaltyMs(offenseCount) {
  return offenseCount <= 1 ? FIRST_PENALTY_MS : ESCALATED_PENALTY_MS;
//1ª infração → 15 segundos
// 2ª ou mais → 2 horas
}

function getOrCreateBucket(clientKey) { //Pega os dados do IP ou cria se não existir.
  const now = Date.now(); //Pega horário atual.
  const existing = buckets.get(clientKey); //Tenta pegar dados do IP.

  if (!existing) {
    const fresh = {
      requests: 0, //quantas requisições já fez
      windowStartedAt: now, //quando começou a janela
      blockedUntil: 0, //até quando está bloqueado
      offenseCount: 0, //quantas infrações já fez
      lastOffenseAt: 0, //quando foi a última infração
    };
    buckets.set(clientKey, fresh); //Salva no Map
    return fresh;
  }

  //Resetar infrações após 12h
  if (existing.lastOffenseAt && now - existing.lastOffenseAt > OFFENSE_RESET_MS) { //Se ficou 12 horas sem errar:
    existing.offenseCount = 0; //Zera punição.
  }

  //Resetar janela de 15s
  if (now - existing.windowStartedAt >= WINDOW_MS) {
    existing.windowStartedAt = now;
    existing.requests = 0;
  }

  return existing;
}

function rateLimiter(req, res, next) {
  const now = Date.now();
  const clientKey = getClientKey(req); //Pega o IP do usuário.
  const bucket = getOrCreateBucket(clientKey); //Busca os dados daquele IP no Map e se não existir ele cria.

  if (bucket.blockedUntil > now) { //Se o tempo atual ainda é menor que o tempo de bloqueio o user continuara com bloq
    const retryAfterSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      message: "Muitas tentativas. Se acalme e tente novamente depois.",
      retryAfterSeconds,
      cooldownLevel: bucket.offenseCount >= 2 ? "hours" : "seconds",
    });
  }

  bucket.requests += 1;

  if (bucket.requests > MAX_REQUESTS_PER_WINDOW) { //Se passou de 5 requisições em 15s:
    bucket.offenseCount += 1; //Incrementa contador.
    bucket.lastOffenseAt = now; // Salva quando foi.

    const penaltyMs = getPenaltyMs(bucket.offenseCount);//1ª=15s; 2ª=2h
    bucket.blockedUntil = now + penaltyMs; //Define até quando ficará bloqueado.
    //Reseta janela.
    bucket.requests = 0;
    bucket.windowStartedAt = now;

    const retryAfterSeconds = Math.ceil(penaltyMs / 1000); //Calcula quantos segundos faltam para desbloquear.
    res.set("Retry-After", String(retryAfterSeconds));  //Define header novamente.

    return res.status(429).json({
      message: "Muitas tentativas. Se acalme e tente novamente depois.",
      retryAfterSeconds,
      cooldownLevel: bucket.offenseCount >= 2 ? "hours" : "seconds",
    });
  }

  next();
}

module.exports = rateLimiter;
*/