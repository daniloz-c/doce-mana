# Frontend - Doce Maná

Aplicação React para o site Doce Maná.

## Dependências

```bash
cd frontend
npm install
```

## Configuração

Criar arquivo `.env` na raiz do frontend:
```
VITE_API_URL=http://localhost:3001/api
VITE_WHATSAPP_NUMBER=5547984572173
```

## Scripts

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## Rotas

- `/` - Página principal
- `/admin` - Painel administrativo

## Credenciais Admin

- Usuário: admin
- Senha: admin123

## Funcionalidades

1. Catálogo de produtos com filtro por categoria
2. Carrinho de compras com validação de estoque
3. Checkout via WhatsApp com resumo do pedido
4. Painel administrativo para gerenciar produtos e pedidos
5. Controle de estoque com indicação visual de disponibilidade
6. Configuração de chave Pix para pagamento