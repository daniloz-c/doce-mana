# Próximos passos: integração com Supabase

## Banco de dados

- [ ] Criar ou selecionar um projeto Supabase.
- [ ] Executar `backend/database/supabase.sql` no SQL Editor do projeto.
- [ ] Confirmar as tabelas, as políticas RLS e as permissões restritas ao backend.
- [ ] Planejar a migração de produtos e pedidos locais: os dados SQLite não são transferidos automaticamente.

## Configuração da Vercel

- [ ] Manter o Root Directory na raiz do repositório e utilizar Node.js 22.
- [ ] Configurar `NODE_ENV=production`.
- [ ] Configurar `APP_ORIGIN=https://doce-mana.vercel.app`, sem barra final.
- [ ] Configurar `SUPABASE_URL` com a URL do projeto.
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente do backend; nunca usar prefixo `VITE_` para essa chave.
- [ ] Gerar um segredo criptograficamente aleatório de pelo menos 32 bytes, representado em 64 caracteres hexadecimais, e configurar `JWT_SECRET`.
- [ ] Remover `VITE_API_URL` para utilizar `/api` na mesma origem.
- [ ] Remover `SESSION_SECRET`, que não é mais utilizado.
- [ ] Não versionar senhas, chaves, arquivos `.env` ou o banco local.

## Administrador remoto

- [ ] Configurar temporariamente `DB_PROVIDER=supabase`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente local, sem registrar segredos no histórico do terminal.
- [ ] Executar `npm --prefix backend run provision-admin -- seu_usuario` na raiz do projeto.
- [ ] Informar a senha no prompt oculto: mínimo de 15 caracteres e máximo de 72 bytes.
- [ ] Guardar a senha em um gerenciador e remover as variáveis secretas do ambiente local após o provisionamento.
- [ ] Não presumir que o administrador ou a senha do SQLite já existam no Supabase.

## Validação e publicação

- [ ] Revisar as vulnerabilidades de dependências apontadas pela auditoria.
- [ ] Configurar limitação de tentativas para `/api/admin/login` antes da exposição pública.
- [ ] Executar `npm test`.
- [ ] Enviar as alterações ao repositório e realizar novo deploy na Vercel.
- [ ] Validar `/admin`, login inválido e válido, produtos, filtros e logout no ambiente publicado.
- [ ] Confirmar que as respostas de `/api` são JSON e que requisições sem autenticação são recusadas.

## Observações

- A implementação local foi validada com build e testes; a integração com Supabase real e o deploy ainda precisam ser validados.
- Logout revoga todas as sessões do administrador.
- `APP_ORIGIN` aceita uma origem exata; ambientes de preview precisam de configuração própria.
