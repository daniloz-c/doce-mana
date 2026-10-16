const { createClient } = require('@supabase/supabase-js');
let client;
function getClient() {
  if (!client) client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error('Persistência indisponível');
  return data;
}
const table = name => getClient().from(name);
const fields = ['name', 'description', 'price', 'category', 'image_url', 'stock_quantity', 'is_active'];
const clean = value => Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key)));
const Product = {
  async getAll(active = true) {
    let query = table('products').select('*').order('category').order('name');
    if (active) query = query.eq('is_active', 1);
    return result(query);
  },
  async getByCategory(category, active = true) { return (await this.getAll(active)).filter(p => p.category === category); },
  async getCategories() { return [...new Set((await this.getAll()).map(p => p.category))]; },
  getById(id) { return result(table('products').select('*').eq('id', id).maybeSingle()); },
  create(product) { return result(table('products').insert(clean(product)).select().single()); },
  async update(id, product) {
    if (!Object.keys(clean(product)).length) return { changes: 0 };
    const rows = await result(table('products').update({ ...clean(product), updated_at: new Date().toISOString() }).eq('id', id).select('id'));
    return { changes: rows.length };
  },
  delete(id) { return this.update(id, { is_active: 0 }); },
  async decrementStock(id, quantity) {
    const success = await result(getClient().rpc('decrement_stock', { product: Number(id), amount: quantity }));
    return { success, changes: success ? 1 : 0 };
  }
};
const Admin = {
  findByUsername(username) { return result(table('admin_users').select('*').eq('username', username).eq('is_active', 1).maybeSingle()); },
  findById(id) { return result(table('admin_users').select('*').eq('id', id).eq('is_active', 1).maybeSingle()); },
  async revoke(id) { await result(getClient().rpc('revoke_admin_sessions', { admin_id: Number(id) })); },
  async create(username, password) {
    const password_hash = await require('bcryptjs').hash(password, 12);
    return result(table('admin_users').insert({ username, password_hash }).select('id,username').single());
  },
  verifyPassword(admin, password) { return require('bcryptjs').compare(password, admin.password_hash); }
};
function order(row) {
  if (!row) return null;
  return { ...row, items: row.order_items.map(({ products, ...item }) => ({ ...item, name: products?.name })) };
}
const Order = {
  async getAll() { return (await result(table('orders').select('*,order_items(*,products(name))').order('created_at', { ascending: false }))).map(order); },
  async getById(id) { return order(await result(table('orders').select('*,order_items(*,products(name))').eq('id', id).maybeSingle())); },
  async updateStatus(id, status) {
    const rows = await result(table('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select('id'));
    return { changes: rows.length };
  }
};
const Settings = {
  async get() { return (await result(table('settings').select('value').eq('key', 'pix_key').maybeSingle()))?.value || ''; },
  async set(value) { await result(table('settings').upsert({ key: 'pix_key', value })); }
};
module.exports = { Product, Admin, Order, Settings };
