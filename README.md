# Doce Maná - Documentação Geral

## Visão Geral

Aplicação completa para loja de doces artesanais Doce Maná, com:
- Site público para clientes
- Painel administrativo para proprietária
- Controle de estoque
- Processamento de pedidos via WhatsApp

## Arquitetura

- Frontend: React 18 + Vite
- Backend: Node.js/Express
- Banco de dados: SQLite
- Comunicação: API REST
- Autenticação: Sessão (express-session)

## Configuração Inicial

1. Clonar repositório
2. Instalar dependências (ver BACKEND.md e FRONTEND.md)
3. Configurar variáveis de ambiente
4. Inicializar banco de dados
5. Iniciar servidores

## Funcionalidades Principais

### Para Clientes

- Catálogo de produtos com imagens e descrições
- Filtro por categoria
- Carrinho de compras com validação de estoque
- Checkout via WhatsApp com resumo do pedido
- Exibição de chave Pix para pagamento

### Para Proprietária

- Login com credenciais
- Dashboard com estatísticas
- Gerenciamento de produtos (criar, editar, remover)
- Controle de estoque com atualização em tempo real
- Gerenciamento de pedidos (visualizar detalhes, atualizar status)
- Configuração de chave Pix

## Fluxo de Pedido

1. Cliente seleciona produtos no carrinho
2. Sistema valida estoque disponível
3. Cliente finaliza pedido via WhatsApp
4. Proprietária recebe pedido no WhatsApp
5. Proprietária atualiza status do pedido no painel
6. Sistema libera estoque conforme status do pedido

## Segurança

- Autenticação de admin com sessão segura
- Proteção de rotas administrativas
- Validação de estoque no backend
- Sistema de reservas temporárias para pedidos

## Variáveis de Ambiente Necessárias

### Backend

- `PORT` - Porta do servidor (padrão: 3001)
- `ADMIN_USERNAME` - Usuário admin padrão
- `ADMIN_PASSWORD` - Senha admin padrão
- `PIX_KEY` - Chave Pix configurável

### Frontend

- `VITE_API_URL` - URL da API do backend
- `VITE_WHATSAPP_NUMBER` - Número do WhatsApp para vendas

## Como Executar

```bash
# Na raiz do projeto
npm run dev:backend  # Inicia backend
npm run dev          # Inicia frontend
```

## Acesso

- Site público: http://localhost:5173
- Painel admin: http://localhost:5173/admin

## Credenciais Admin

- Usuário: admin
- Senha: admin123

## Notas

- Em produção, substituir autenticação por JWT/token mais seguro
- Configurar HTTPS para ambiente de produção
- Implementar backup regular do banco de dados
- Monitorar logs de erros para manutenção