const multer = require('multer');
const { randomBytes } = require('crypto');
const { getClient } = require('../models/supabase');
const upload = multer({ limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 2, headerPairs: 20 } }).single('image');
const signatures = {
  'image/jpeg': buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': buffer => buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
};
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
function detect(buffer) {
  for (const [mime, matches] of Object.entries(signatures)) if (matches(buffer)) return mime;
  return null;
}
exports.upload = (req, res) => {
  upload(req, res, async error => {
    if (error) return res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande (máximo 4MB)' : 'Upload inválido' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Arquivo de imagem obrigatório' });
    const mime = detect(req.file.buffer);
    if (!mime || mime !== req.file.mimetype) return res.status(400).json({ success: false, message: 'Formato inválido. Use JPEG, PNG ou WebP.' });
    try {
      const supabase = getClient();
      const path = `products/${Date.now()}-${randomBytes(12).toString('hex')}.${extensions[mime]}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, req.file.buffer, { contentType: mime, upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      res.json({ success: true, image_url: data.publicUrl });
    } catch {
      res.status(503).json({ success: false, message: 'Não foi possível salvar a imagem no Supabase Storage' });
    }
  });
};
