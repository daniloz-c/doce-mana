require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const readline = require('readline');
async function passwordPrompt() {
  if (!process.stdin.isTTY) throw new Error('Use terminal interativo ou ADMIN_PASSWORD no ambiente');
  process.stdout.write('Senha (não será exibida): ');
  return new Promise((resolve, reject) => {
    let value = '';
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function done(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', listener);
      process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    }
    function listener(text, key = {}) {
      if (key.ctrl && key.name === 'c') return done(new Error('Cancelado'));
      if (key.name === 'return') return done();
      if (key.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key.ctrl && !key.meta) value += text;
    }
    process.stdin.on('keypress', listener);
  });
}
async function main() {
  const username = process.argv[2];
  if (!username || username.length > 100) throw new Error('Informe o usuário como argumento');
  const password = process.env.ADMIN_PASSWORD || await passwordPrompt();
  delete process.env.ADMIN_PASSWORD;
  if (password.length < 15 || Buffer.byteLength(password) > 72) throw new Error('Senha deve ter ao menos 15 caracteres e até 72 bytes');
  const runtime = require('../config/runtime');
  if (runtime.validate().length) throw new Error('Configuração incompleta');
  if (!runtime.remote) await require('../config/initDb')();
  await require('../models/Admin').create(username, password);
  console.log('Administrador criado. Nenhuma senha local foi migrada.');
}
main().catch(() => { console.error('Não foi possível criar administrador: confira usuário único, senha, configuração e migração.'); process.exitCode = 1; }).finally(() => {
  if (!require('../config/runtime').remote) require('../config/database').close();
});
