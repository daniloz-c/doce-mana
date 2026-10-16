const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { production } = require('./config/runtime');
const Admin = require('./models/Admin');
const secret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const issuer = 'doce-mana';
const audience = 'doce-mana-admin';
const cookieName = production ? '__Host-doce_admin' : 'doce_admin';
const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/' };
const unauthorized = res => res.status(401).json({ success: false, message: 'Não autorizado' });
function token(req) {
  const parts = (req.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${cookieName}=`));
  return parts.length === 1 ? parts[0].slice(cookieName.length + 1) : '';
}
async function authenticate(req) {
  let payload;
  try {
    payload = jwt.verify(token(req), secret, { algorithms: ['HS256'], issuer, audience, maxAge: '8h' });
    if (!Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || !/^\d+$/.test(payload.sub) || !Number.isInteger(payload.version)) return null;
  } catch { return null; }
  const admin = await Admin.findById(payload.sub);
  return admin && admin.token_version === payload.version ? admin : null;
}
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || username.length > 100 || !password || Buffer.byteLength(password) > 72) return res.status(400).json({ success: false, message: 'Usuário ou senha inválidos' });
    const admin = await Admin.findByUsername(username);
    if (!admin || !await Admin.verifyPassword(admin, password)) return unauthorized(res);
    const signed = jwt.sign({ version: admin.token_version }, secret, { algorithm: 'HS256', subject: String(admin.id), issuer, audience, expiresIn: '8h' });
    res.cookie(cookieName, signed, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
    res.json({ success: true, message: 'Login realizado com sucesso' });
  } catch { res.status(503).json({ success: false, message: 'Autenticação indisponível. Verifique a conexão e a migração do banco.' }); }
};
exports.isAdmin = async (req, res, next) => {
  try {
    req.admin = await authenticate(req);
    if (!req.admin) return unauthorized(res);
    next();
  } catch { res.status(503).json({ success: false, message: 'Autenticação indisponível' }); }
};
exports.logout = async (req, res) => {
  try {
    const admin = await authenticate(req);
    if (admin) await Admin.revoke(admin.id);
    res.clearCookie(cookieName, cookieOptions);
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  } catch { res.status(503).json({ success: false, message: 'Não foi possível revogar a sessão. Tente novamente.' }); }
};
exports.csrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
  if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ success: false, message: 'Origem não permitida' });
  next();
};
