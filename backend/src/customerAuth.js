const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { production } = require('./config/runtime');
const secret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const prefix = production ? '__Host-' : '';
const sessionCookie = `${prefix}doce_customer`;
const flowCookie = `${prefix}doce_google_flow`;
const options = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
function cookie(req, name) {
  const matches = (req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`));
  if (matches.length !== 1) return '';
  try { return decodeURIComponent(matches[0].slice(name.length + 1)); } catch { return ''; }
}
function client(req, res) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce', storageKey: 'customer-auth', autoRefreshToken: false, detectSessionInUrl: false, persistSession: true,
      storage: {
        getItem(key) {
          if (key !== 'customer-auth-code-verifier') return null;
          try {
            const payload = jwt.verify(cookie(req, flowCookie), secret, { algorithms: ['HS256'], issuer: 'doce-mana', audience: 'customer-pkce', maxAge: '10m' });
            return typeof payload.verifier === 'string' ? payload.verifier : null;
          } catch { return null; }
        },
        setItem(key, value) {
          if (key !== 'customer-auth-code-verifier') return;
          res.cookie(flowCookie, jwt.sign({ verifier: value }, secret, { algorithm: 'HS256', issuer: 'doce-mana', audience: 'customer-pkce', expiresIn: '10m' }), { ...options, maxAge: 600000 });
        },
        removeItem(key) { if (key === 'customer-auth-code-verifier') res.clearCookie(flowCookie, options); }
      }
    }
  });
}
function google(user) {
  return user && user.app_metadata?.provider === 'google' && user.identities?.some(identity => identity.provider === 'google');
}
function customer(user) {
  return google(user) || (user && !user.is_anonymous && user.app_metadata?.provider === 'email' && user.identities?.some(identity => identity.provider === 'email'));
}
exports.passwordLogin = async (req, res) => {
  const message = 'Não foi possível entrar. Confira email e senha e tente novamente.';
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || !password.length || password.length > 1024) {
    return res.status(400).json({ success: false, message });
  }
  try {
    const auth = client(req, res).auth;
    const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data?.session?.access_token) return res.status(401).json({ success: false, message });
    const verified = await auth.getUser(data.session.access_token);
    if (verified.error || !customer(verified.data?.user)) return res.status(401).json({ success: false, message });
    const user = verified.data.user;
    res.cookie(sessionCookie, data.session.access_token, { ...options, maxAge: Math.min(data.session.expires_in || 3600, 3600) * 1000 });
    res.json({ success: true, customer: { id: user.id, name: user.user_metadata?.full_name || '', email: user.email } });
  } catch { res.status(503).json({ success: false, message: 'Login indisponível no momento. Tente novamente mais tarde.' }); }
};
async function identity(req, res) {
  const token = cookie(req, sessionCookie);
  if (!token) return null;
  const { data, error } = await client(req, res).auth.getUser(token);
  return !error && customer(data.user) ? data.user : null;
}
exports.login = async (req, res) => {
  try {
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const state = randomBytes(32).toString('hex');
    res.cookie(`${prefix}doce_google_state`, jwt.sign({ state }, secret, { algorithm: 'HS256', issuer: 'doce-mana', audience: 'customer-state', expiresIn: '10m' }), { ...options, maxAge: 600000 });
    const { data, error } = await client(req, res).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/api/customer/callback?state=${state}`, skipBrowserRedirect: true } });
    if (error || !data.url) throw new Error();
    res.json({ success: true, url: data.url });
  } catch { res.status(503).json({ success: false, message: 'Login Google indisponível. Verifique a configuração.' }); }
};
exports.callback = async (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  try {
    const state = jwt.verify(cookie(req, `${prefix}doce_google_state`), secret, { algorithms: ['HS256'], issuer: 'doce-mana', audience: 'customer-state', maxAge: '10m' });
    const flow = jwt.verify(cookie(req, flowCookie), secret, { algorithms: ['HS256'], issuer: 'doce-mana', audience: 'customer-pkce', maxAge: '10m' });
    if (typeof req.query.code !== 'string' || typeof flow.verifier !== 'string' || typeof req.query.state !== 'string' || req.query.state !== state.state) throw new Error();
    const auth = client(req, res).auth;
    const { data, error } = await auth.exchangeCodeForSession(req.query.code);
    if (error || !data.session) throw new Error();
    const verified = await auth.getUser(data.session.access_token);
    if (verified.error || !google(verified.data.user)) throw new Error();
    res.cookie(sessionCookie, data.session.access_token, { ...options, maxAge: Math.min(data.session.expires_in, 3600) * 1000 });
    res.clearCookie(flowCookie, options);
    res.clearCookie(`${prefix}doce_google_state`, options);
    res.redirect('/?login=success');
  } catch {
    res.clearCookie(flowCookie, options);
    res.clearCookie(`${prefix}doce_google_state`, options);
    res.redirect('/?login=error');
  }
};
exports.session = async (req, res) => {
  try {
    const user = await identity(req, res);
    res.json({ success: true, customer: user ? { id: user.id, name: user.user_metadata?.full_name || '', email: user.email } : null });
  } catch { res.status(503).json({ success: false, message: 'Sessão indisponível' }); }
};
exports.requireCustomer = async (req, res, next) => {
  try {
    req.customer = await identity(req, res);
    if (!req.customer) return res.status(401).json({ success: false, message: 'Faça login para finalizar o pedido' });
    next();
  } catch { res.status(503).json({ success: false, message: 'Autenticação indisponível' }); }
};
exports.logout = async (req, res) => {
  try {
    const token = cookie(req, sessionCookie);
    if (token) {
      const { error } = await require('./models/supabase').getClient().auth.admin.signOut(token, 'global');
      if (error && error.status !== 401 && error.status !== 403) throw new Error();
    }
    res.clearCookie(sessionCookie, options);
    res.clearCookie(flowCookie, options);
    res.clearCookie(`${prefix}doce_google_state`, options);
    res.json({ success: true });
  } catch { res.status(503).json({ success: false, message: 'Não foi possível sair. Tente novamente.' }); }
};
