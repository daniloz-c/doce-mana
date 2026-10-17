const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const remote = production || process.env.DB_PROVIDER === 'supabase';

function validate() {
  const missing = [];
  if (production && (!/^[a-f0-9]{64,}$/i.test(process.env.JWT_SECRET || ''))) missing.push('JWT_SECRET (ao menos 32 bytes aleatórios em hexadecimal)');
  if (production || remote) {
    if (!process.env.SUPABASE_URL || !/^https:\/\//.test(process.env.SUPABASE_URL)) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  }
  if (production) {
    try {
      const url = new URL(process.env.APP_ORIGIN);
      if (url.protocol !== 'https:' || url.origin !== process.env.APP_ORIGIN) throw new Error();
    } catch { missing.push('APP_ORIGIN (origem HTTPS sem barra final)'); }
  }
  return missing;
}

module.exports = { production, remote, validate };
