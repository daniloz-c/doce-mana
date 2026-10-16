module.exports = function createOrderLimiter({ limit = 10, windowMs = 60000, maxKeys = 10000, now = Date.now } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, entry] of clients) if (entry.until <= time) clients.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = clients.get(key);
    if (!entry && clients.size < maxKeys) {
      entry = { count: 0, until: time + windowMs };
      clients.set(key, entry);
    }
    if (!entry || entry.count >= limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil(((entry?.until || time + windowMs) - time) / 1000))));
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde e reenvie o mesmo pedido.' });
    }
    entry.count++;
    next();
  };
};
