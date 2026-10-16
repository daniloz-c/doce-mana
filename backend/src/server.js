require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const runtime = require('./config/runtime');
async function start() {
  if (runtime.validate().length) throw new Error('Configuração incompleta: ' + runtime.validate().join(', '));
  if (!runtime.remote) await require('./config/initDb')();
  const server = require('./app').listen(Number(process.env.PORT) || 3001);
  const shutdown = () => server.close(() => {
    if (!runtime.remote) require('./config/database').close();
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
start().catch(() => { console.error('Falha ao iniciar: verifique configuração e banco.'); process.exitCode = 1; });
